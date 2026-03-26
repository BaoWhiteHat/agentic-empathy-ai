"""
EPITOME Empathy Benchmark — FULL Reddit Dataset (2,979 posts)

Same 5-config ablation as v5 but uses ALL unique seeker posts.
Resume-safe: checkpoints every 25 posts so you can Ctrl+C and restart.

Output files:
  - test_seekers_full.csv          (all unique seeker posts)
  - generated_responses_full.csv   (all responses, 5 configs x 2979 posts)
  - scored_responses_full.csv      (per-post EPITOME scores)
  - results_full.csv               (aggregated mean scores per config)
  - results_full.png               (grouped bar chart)
  - router_decisions_full.csv      (raw router decisions)
  - router_analysis_full.csv       (router analysis with combos)

Usage:
    cd backend
    uv run python evaluate/benchmark/run_benchmark_full.py
"""

import sys
import os
import asyncio
import time
import traceback

# Fix Windows console encoding for emoji in agent print statements
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
FULL_DIR = os.path.join(SCRIPT_DIR, "results", "full")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, SCRIPT_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(override=True)

import pandas as pd
import numpy as np
from openai import OpenAI

NUM_CONFIGS = 5
SAVE_EVERY = 25  # Checkpoint every N posts

# Users for configs that need memory/OCEAN
USER_IDS = {
    "RAG+Memory": "bench_ragmem",
    "RAG+OCEAN": "bench_ragocean",
    "Agentic": "bench_agentic",
}

WARMUP_MESSAGES = [
    "I've been feeling really anxious about school lately",
    "Sometimes I feel like nobody understands me",
    "I had a fight with my best friend and I feel terrible",
    "I can't sleep at night because I keep overthinking",
    "Today was actually a good day, I felt hopeful",
]

MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 30]  # seconds


def retry_openai_call(fn, *args, **kwargs):
    """Retry an OpenAI API call with exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                print(f"    [retry] API error: {e}. Retrying in {delay}s... (attempt {attempt+2}/{MAX_RETRIES})")
                time.sleep(delay)
            else:
                raise


# ============================================================
# Step 0 — Clean Neo4j benchmark users
# ============================================================
def clean_neo4j(system):
    print("\n" + "=" * 60)
    print("STEP 0: Cleaning old benchmark users from Neo4j")
    print("=" * 60)

    if not system.memory or not system.memory.driver:
        print("  No Neo4j connection, skipping cleanup.")
        return

    queries = [
        "MATCH (u:User) WHERE u.id STARTS WITH 'bench' DETACH DELETE u",
        "MATCH (u:User) WHERE u.id STARTS WITH 'benchmark' DETACH DELETE u",
    ]
    try:
        with system.memory.driver.session() as session:
            for q in queries:
                result = session.run(q)
                summary = result.consume()
                print(f"  Deleted {summary.counters.nodes_deleted} nodes")
        print("  Neo4j cleanup complete.")
    except Exception as e:
        print(f"  Warning: Neo4j cleanup failed: {e}")


# ============================================================
# Step 1 — Human Baseline
# ============================================================
def compute_human_baseline():
    print("\n" + "=" * 60)
    print("STEP 1: Computing Human Baseline")
    print("=" * 60)

    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    ip = pd.read_csv("data/epitome/interpretations-reddit.csv")
    ex = pd.read_csv("data/epitome/explorations-reddit.csv")

    baseline = {
        "ER": er["level"].mean(),
        "IP": ip["level"].mean(),
        "EX": ex["level"].mean(),
    }
    baseline["Total"] = baseline["ER"] + baseline["IP"] + baseline["EX"]

    for k, v in baseline.items():
        print(f"  {k}: {v:.4f}")

    return baseline


# ============================================================
# Step 2 — Load ALL seeker posts
# ============================================================
def load_test_seekers():
    print("\n" + "=" * 60)
    print("STEP 2: Loading ALL test seeker posts")
    print("=" * 60)

    path = os.path.join(FULL_DIR, "test_seekers_full.csv")
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"  Loaded {len(df)} seeker posts from cache")
        return df

    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    unique = er.drop_duplicates(subset="sp_id")[["sp_id", "seeker_post"]]
    unique = unique.reset_index(drop=True)

    unique.to_csv(path, index=False)
    print(f"  Using ALL {len(unique)} unique seeker posts")
    return unique


# ============================================================
# Step 3 — Warm-up phase
# ============================================================
async def warmup(system):
    print("\n" + "=" * 60)
    print(f"STEP 3: Warm-up phase (5 messages x {len(USER_IDS)} users)")
    print("=" * 60)

    for config_name, user_id in USER_IDS.items():
        print(f"  Warming up user: {user_id} ({config_name})")
        for msg in WARMUP_MESSAGES:
            emotion_result = system.perception.detect_emotion(msg)
            emotion = emotion_result["emotion"]
            await system.process_brain(
                msg, user_id, emotion,
                use_memory=True, use_ocean=True, use_rag=True
            )
            # Update OCEAN scores
            await system.background_learning(msg, user_id, emotion)

        profile = system.memory.get_user_profile(user_id) if system.memory else {}
        print(f"    {user_id} done. OCEAN: {profile}")

    print("  All warm-ups complete.")


# ============================================================
# Step 4 — Generate responses (resume-safe)
# ============================================================
async def generate_responses(system, seekers_df):
    total = len(seekers_df)
    expected = total * NUM_CONFIGS
    print("\n" + "=" * 60)
    print(f"STEP 4: Generating responses ({NUM_CONFIGS} configs x {total} posts = {expected} rows)")
    print("=" * 60)

    output_path = os.path.join(FULL_DIR, "generated_responses_full.csv")
    router_path = os.path.join(FULL_DIR, "router_decisions_full.csv")

    # Check for complete cached results
    if os.path.exists(output_path):
        existing = pd.read_csv(output_path)
        if len(existing) == expected:
            print(f"  Found complete cached results ({len(existing)} rows), skipping generation.")
            return existing

    # Resume support: load partial results if they exist
    rows = []
    router_rows = []
    completed_sp_ids = set()
    skipped_sp_ids = set()

    if os.path.exists(output_path):
        partial = pd.read_csv(output_path)
        rows = partial.to_dict("records")
        completed_sp_ids = set(partial["sp_id"].unique())
        print(f"  Resuming from {len(completed_sp_ids)}/{total} completed posts ({len(rows)} rows)")

    if os.path.exists(router_path):
        partial_router = pd.read_csv(router_path)
        router_rows = partial_router.to_dict("records")

    client = OpenAI()
    t0 = time.time()
    new_count = 0

    for idx, (_, row) in enumerate(seekers_df.iterrows()):
        sp_id = row["sp_id"]
        seeker_post = row["seeker_post"]

        # Skip already completed posts (resume support)
        if sp_id in completed_sp_ids:
            continue

        # Shared emotion detection
        emotion_result = system.perception.detect_emotion(seeker_post)
        emotion = emotion_result["emotion"]

        # ETA calculation
        new_count += 1
        remaining = total - len(completed_sp_ids) - new_count
        if new_count > 1:
            elapsed = time.time() - t0
            rate = new_count / elapsed  # posts per second
            eta_min = remaining / rate / 60 if rate > 0 else 0
            eta_str = f" | ETA: {eta_min:.0f}m"
        else:
            eta_str = ""

        print(f"  [{idx+1}/{total}] sp_id={sp_id} | emotion={emotion}{eta_str}")

        try:
            # Config 1 — Baseline (direct GPT-4o-mini, no SoulMate)
            completion = retry_openai_call(
                client.chat.completions.create,
                model="gpt-4o-mini",
                temperature=0,
                messages=[
                    {"role": "system", "content": "You are an empathetic mental health supporter. Respond with empathy."},
                    {"role": "user", "content": seeker_post},
                ],
            )
            resp_baseline = completion.choices[0].message.content
            rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Baseline", "response": resp_baseline, "emotion": emotion})

            # Config 2 — RAG only
            resp_rag = await system.process_brain(
                seeker_post, "bench_rag", emotion,
                use_memory=False, use_ocean=False, use_rag=True,
                save_ai_response=False
            )
            rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG", "response": resp_rag, "emotion": emotion})

            # Config 3 — RAG + Memory
            resp_ragmem = await system.process_brain(
                seeker_post, USER_IDS["RAG+Memory"], emotion,
                use_memory=True, use_ocean=False, use_rag=True,
                save_ai_response=False
            )
            rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG+Memory", "response": resp_ragmem, "emotion": emotion})

            # Config 4 — RAG + OCEAN
            resp_ragocean = await system.process_brain(
                seeker_post, USER_IDS["RAG+OCEAN"], emotion,
                use_memory=False, use_ocean=True, use_rag=True,
                save_ai_response=False
            )
            rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG+OCEAN", "response": resp_ragocean, "emotion": emotion})

            # Config 5 — Agentic SoulMate (router decides, RAG always on)
            resp_agentic, decisions = await system.process_brain_agentic(
                seeker_post, USER_IDS["Agentic"], emotion,
                save_ai_response=False
            )
            rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Agentic", "response": resp_agentic, "emotion": emotion})
            router_rows.append({
                "sp_id": sp_id,
                "emotion": emotion,
                "use_rag": decisions["use_rag"],
                "use_memory": decisions["use_memory"],
                "use_ocean": decisions["use_ocean"],
                "reasoning": decisions["reasoning"],
            })

            # Mark completed
            completed_sp_ids.add(sp_id)

        except Exception as e:
            print(f"    [ERROR] sp_id={sp_id} failed after retries: {e}")
            print(f"    Skipping this post and continuing...")
            skipped_sp_ids.add(sp_id)
            continue

        # Save progress periodically
        if len(completed_sp_ids) % SAVE_EVERY == 0:
            pd.DataFrame(rows).to_csv(output_path, index=False)
            pd.DataFrame(router_rows).to_csv(router_path, index=False)
            elapsed = time.time() - t0
            print(f"    [checkpoint] {len(completed_sp_ids)}/{total} posts | {elapsed/60:.1f}m elapsed")

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    elapsed = time.time() - t0
    print(f"  Saved {len(df)} responses to {output_path}")
    print(f"  Completed: {len(completed_sp_ids)}, Skipped: {len(skipped_sp_ids)}")
    print(f"  Generation took {elapsed/3600:.1f} hours")

    if skipped_sp_ids:
        skipped_path = os.path.join(FULL_DIR, "skipped_posts_full.txt")
        with open(skipped_path, "w") as f:
            for sp_id in sorted(skipped_sp_ids):
                f.write(f"{sp_id}\n")
        print(f"  Skipped post IDs saved to {skipped_path}")

    router_df = pd.DataFrame(router_rows)
    router_df.to_csv(router_path, index=False)
    print(f"  Saved {len(router_df)} router decisions to {router_path}")

    return df


# ============================================================
# Step 5 — Score empathy with EPITOME models
# ============================================================
def score_responses(responses_df):
    print("\n" + "=" * 60)
    print("STEP 5: Scoring empathy with EPITOME models")
    print("=" * 60)

    expected = len(responses_df)
    scored_path = os.path.join(FULL_DIR, "scored_responses_full.csv")
    if os.path.exists(scored_path):
        existing = pd.read_csv(scored_path)
        if len(existing) == expected:
            print(f"  Found cached scored results ({len(existing)} rows), skipping scoring.")
            return existing

    from epitome_scorer import EpitomeScorer

    scorer = EpitomeScorer(
        er_path=os.path.join(MODELS_DIR, "reddit_ER.pth"),
        ip_path=os.path.join(MODELS_DIR, "reddit_IP.pth"),
        ex_path=os.path.join(MODELS_DIR, "reddit_EX.pth"),
    )

    rows = []
    t0 = time.time()
    for idx, (_, row) in enumerate(responses_df.iterrows()):
        scores = scorer.score(row["seeker_post"], row["response"])
        rows.append({
            "sp_id": row["sp_id"],
            "config": row["config"],
            "seeker_post": row["seeker_post"],
            "response": row["response"],
            "emotion": row["emotion"],
            "ER_score": scores["ER"],
            "IP_score": scores["IP"],
            "EX_score": scores["EX"],
            "total_score": scores["ER"] + scores["IP"] + scores["EX"],
        })
        if (idx + 1) % 500 == 0:
            elapsed = time.time() - t0
            rate = (idx + 1) / elapsed
            eta = (expected - idx - 1) / rate / 60
            print(f"  Scored {idx+1}/{expected} | {elapsed/60:.1f}m elapsed | ETA: {eta:.0f}m")

    scored_df = pd.DataFrame(rows)
    scored_df.to_csv(scored_path, index=False)
    elapsed = time.time() - t0
    print(f"  Saved {len(scored_df)} scored rows to {scored_path}")
    print(f"  Scoring took {elapsed/60:.1f} minutes")
    return scored_df


# ============================================================
# Step 6 — Aggregate and visualize
# ============================================================
def aggregate_and_visualize(scored_df, human_baseline):
    print("\n" + "=" * 60)
    print("STEP 6: Aggregating results and generating chart")
    print("=" * 60)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Aggregate means per config
    agg = scored_df.groupby("config").agg(
        ER=("ER_score", "mean"),
        IP=("IP_score", "mean"),
        EX=("EX_score", "mean"),
        Total=("total_score", "mean"),
    ).reset_index()

    # Reorder configs
    config_order = ["Baseline", "RAG", "RAG+Memory", "RAG+OCEAN", "Agentic"]
    agg["config"] = pd.Categorical(agg["config"], categories=config_order, ordered=True)
    agg = agg.sort_values("config").reset_index(drop=True)

    # Add human baseline row
    human_row = pd.DataFrame([{
        "config": "Human (Reddit)",
        "ER": human_baseline["ER"],
        "IP": human_baseline["IP"],
        "EX": human_baseline["EX"],
        "Total": human_baseline["Total"],
    }])
    results = pd.concat([human_row, agg], ignore_index=True)

    # Save CSV
    results_path = os.path.join(FULL_DIR, "results_full.csv")
    results.to_csv(results_path, index=False)
    print(f"\n  Results saved to {results_path}")
    print(results.to_string(index=False))

    # Generate grouped bar chart
    fig, ax = plt.subplots(figsize=(14, 6))
    systems = results["config"].tolist()
    metrics = ["ER", "IP", "EX", "Total"]
    x = np.arange(len(systems))
    width = 0.18

    colors = ["#4C72B0", "#55A868", "#C44E52", "#8172B2"]
    for i, metric in enumerate(metrics):
        bars = ax.bar(x + i * width, results[metric], width, label=metric, color=colors[i])
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f"{height:.2f}", xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3), textcoords="offset points", ha="center", va="bottom", fontsize=7)

    ax.set_xlabel("System")
    ax.set_ylabel("Mean Score")
    ax.set_title("EPITOME Empathy Benchmark — Full Reddit Dataset (2,979 posts)")
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(systems, rotation=15, ha="right")
    ax.legend()
    ax.set_ylim(0, max(results["Total"].max() * 1.15, 2.5))
    plt.tight_layout()

    chart_path = os.path.join(FULL_DIR, "results_full.png")
    fig.savefig(chart_path, dpi=150)
    plt.close(fig)
    print(f"  Chart saved to {chart_path}")


# ============================================================
# Step 7 — Router analysis
# ============================================================
def analyze_router():
    print("\n" + "=" * 60)
    print("STEP 7: Router decision analysis")
    print("=" * 60)

    router_path = os.path.join(FULL_DIR, "router_decisions_full.csv")
    if not os.path.exists(router_path):
        print("  No router decisions found, skipping.")
        return

    df = pd.read_csv(router_path)

    n = len(df)
    print(f"\n  Total decisions: {n}")
    print(f"  RAG activated:    {df['use_rag'].sum()}/{n} ({df['use_rag'].mean()*100:.0f}%)")
    print(f"  Memory activated: {df['use_memory'].sum()}/{n} ({df['use_memory'].mean()*100:.0f}%)")
    print(f"  OCEAN activated:  {df['use_ocean'].sum()}/{n} ({df['use_ocean'].mean()*100:.0f}%)")

    # Combination counts
    combos = []
    for _, r in df.iterrows():
        parts = []
        if r["use_rag"]: parts.append("RAG")
        if r["use_memory"]: parts.append("Memory")
        if r["use_ocean"]: parts.append("OCEAN")
        combos.append("+".join(parts) if parts else "None")
    df["combo"] = combos

    print("\n  Component combinations:")
    for combo, count in df["combo"].value_counts().items():
        print(f"    {combo}: {count} ({count/len(df)*100:.1f}%)")

    # By emotion
    print("\n  Router choices by emotion:")
    for emo in sorted(df["emotion"].unique()):
        emo_df = df[df["emotion"] == emo]
        n_emo = len(emo_df)
        mem = emo_df["use_memory"].sum()
        ocean = emo_df["use_ocean"].sum()
        print(f"    {emo} (n={n_emo}): Memory={mem}, OCEAN={ocean}")

    # Save analysis
    analysis_path = os.path.join(FULL_DIR, "router_analysis_full.csv")
    df.to_csv(analysis_path, index=False)
    print(f"\n  Router analysis saved to {analysis_path}")


# ============================================================
# Main
# ============================================================
async def main():
    t_start = time.time()
    print("=" * 60)
    print("  EPITOME EMPATHY BENCHMARK — FULL REDDIT DATASET")
    print("=" * 60)

    # Initialize system
    from core.engine import AgenticEmpathySystem
    system = AgenticEmpathySystem()

    # Step 0
    clean_neo4j(system)

    # Step 1
    human_baseline = compute_human_baseline()

    # Step 2
    seekers_df = load_test_seekers()

    # Step 3
    await warmup(system)

    # Step 4
    responses_df = await generate_responses(system, seekers_df)

    # Cleanup engine before loading scorer (free GPU memory)
    system.close()
    del system

    # Step 5
    scored_df = score_responses(responses_df)

    # Step 6
    aggregate_and_visualize(scored_df, human_baseline)

    # Step 7
    analyze_router()

    elapsed = time.time() - t_start
    print("\n" + "=" * 60)
    print(f"  FULL BENCHMARK COMPLETE — {elapsed/3600:.1f} hours total")
    print("=" * 60)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
