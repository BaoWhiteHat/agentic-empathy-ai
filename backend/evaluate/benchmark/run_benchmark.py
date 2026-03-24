"""
EPITOME Empathy Benchmark — SoulMate Ablation Study (v4)
Generates responses from 6 configs (including Agentic Router), scores with EPITOME models.

Usage:
    cd backend
    uv run python evaluate/benchmark/run_benchmark.py
"""

import sys
import os
import asyncio

# Fix Windows console encoding for emoji in agent print statements
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, SCRIPT_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(override=True)

import pandas as pd
import numpy as np
from openai import OpenAI

NUM_CONFIGS = 6
EXPECTED_ROWS = 50 * NUM_CONFIGS  # 300


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
# Step 2 — Load test seeker posts
# ============================================================
def load_test_seekers():
    print("\n" + "=" * 60)
    print("STEP 2: Loading test seeker posts")
    print("=" * 60)

    path = os.path.join(SCRIPT_DIR, "test_seekers.csv")
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"  Loaded {len(df)} seeker posts from cache")
        return df

    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    unique = er.drop_duplicates(subset="sp_id")[["sp_id", "seeker_post"]]
    sample = unique.sample(n=50, random_state=42)
    sample.to_csv(path, index=False)
    print(f"  Sampled and saved {len(sample)} seeker posts")
    return sample


# ============================================================
# Step 3 — Warm-up phase
# ============================================================
# Each memory-using config gets its own user to prevent cross-contamination
USER_IDS = {
    "+Memory": "bench_memory",
    "+Memory+OCEAN": "bench_ocean",
    "Full SoulMate": "bench_full",
    "Agentic SoulMate": "bench_agentic",
}

WARMUP_MESSAGES = [
    "I've been feeling really anxious about school lately",
    "Sometimes I feel like nobody understands me",
    "I had a fight with my best friend and I feel terrible",
    "I can't sleep at night because I keep overthinking",
    "Today was actually a good day, I felt hopeful",
]


async def warmup(system):
    print("\n" + "=" * 60)
    print(f"STEP 3: Warm-up phase (5 messages x {len(USER_IDS)} users)")
    print("=" * 60)

    for user_id in USER_IDS.values():
        print(f"  Warming up user: {user_id}")
        for msg in WARMUP_MESSAGES:
            emotion_result = system.perception.detect_emotion(msg)
            emotion = emotion_result["emotion"]
            await system.process_brain(
                msg, user_id, emotion,
                use_memory=True, use_ocean=True, use_rag=True
            )
            # Update OCEAN scores (normally done by WebSocket handler, not process_brain)
            await system.background_learning(msg, user_id, emotion)

        profile = system.memory.get_user_profile(user_id) if system.memory else {}
        print(f"    {user_id} done. OCEAN: {profile}")

    print("  All warm-ups complete.")


# ============================================================
# Step 4 — Generate responses
# ============================================================
async def generate_responses(system, seekers_df):
    print("\n" + "=" * 60)
    print(f"STEP 4: Generating responses ({NUM_CONFIGS} configs x 50 posts)")
    print("=" * 60)

    output_path = os.path.join(SCRIPT_DIR, "generated_responses.csv")
    router_path = os.path.join(SCRIPT_DIR, "router_decisions.csv")

    # Check for cached results
    if os.path.exists(output_path):
        existing = pd.read_csv(output_path)
        if len(existing) == EXPECTED_ROWS:
            print(f"  Found complete cached results ({len(existing)} rows), skipping generation.")
            return existing

    client = OpenAI()
    rows = []
    router_rows = []

    for idx, (_, row) in enumerate(seekers_df.iterrows()):
        sp_id = row["sp_id"]
        seeker_post = row["seeker_post"]

        # Shared emotion detection
        emotion_result = system.perception.detect_emotion(seeker_post)
        emotion = emotion_result["emotion"]

        print(f"  [{idx+1}/50] sp_id={sp_id} | emotion={emotion}")

        # Config 1 — Baseline (direct GPT-4o-mini)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=[
                {"role": "system", "content": "You are an empathetic mental health supporter. Respond with empathy."},
                {"role": "user", "content": seeker_post},
            ],
        )
        resp_baseline = completion.choices[0].message.content
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Baseline", "response": resp_baseline, "emotion": emotion})

        # Config 2 — +RAG
        resp_rag = await system.process_brain(
            seeker_post, "benchmark_rag_user", emotion,
            use_memory=False, use_ocean=False, use_rag=True
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "+RAG", "response": resp_rag, "emotion": emotion})

        # Config 3 — +Memory (accumulates turns, own user)
        resp_mem = await system.process_brain(
            seeker_post, USER_IDS["+Memory"], emotion,
            use_memory=True, use_ocean=False, use_rag=False
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "+Memory", "response": resp_mem, "emotion": emotion})

        # Config 4 — +Memory+OCEAN (accumulates turns, own user)
        resp_ocean = await system.process_brain(
            seeker_post, USER_IDS["+Memory+OCEAN"], emotion,
            use_memory=True, use_ocean=True, use_rag=False
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "+Memory+OCEAN", "response": resp_ocean, "emotion": emotion})

        # Config 5 — Full SoulMate (accumulates turns, own user)
        resp_full = await system.process_brain(
            seeker_post, USER_IDS["Full SoulMate"], emotion,
            use_memory=True, use_ocean=True, use_rag=True
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Full SoulMate", "response": resp_full, "emotion": emotion})

        # Config 6 — Agentic SoulMate (router decides)
        resp_agentic, decisions = await system.process_brain_agentic(
            seeker_post, USER_IDS["Agentic SoulMate"], emotion
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Agentic SoulMate", "response": resp_agentic, "emotion": emotion})
        router_rows.append({
            "sp_id": sp_id,
            "emotion": emotion,
            "use_rag": decisions["use_rag"],
            "use_memory": decisions["use_memory"],
            "use_ocean": decisions["use_ocean"],
            "reasoning": decisions["reasoning"],
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"  Saved {len(df)} responses to {output_path}")

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

    from epitome_scorer import EpitomeScorer

    scorer = EpitomeScorer(
        er_path=os.path.join(SCRIPT_DIR, "reddit_ER.pth"),
        ip_path=os.path.join(SCRIPT_DIR, "reddit_IP.pth"),
        ex_path=os.path.join(SCRIPT_DIR, "reddit_EX.pth"),
    )

    rows = []
    for idx, (_, row) in enumerate(responses_df.iterrows()):
        scores = scorer.score(row["seeker_post"], row["response"])
        rows.append({
            "sp_id": row["sp_id"],
            "config": row["config"],
            "ER_score": scores["ER"],
            "IP_score": scores["IP"],
            "EX_score": scores["EX"],
            "total_score": scores["ER"] + scores["IP"] + scores["EX"],
        })
        if (idx + 1) % 50 == 0:
            print(f"  Scored {idx+1}/{len(responses_df)}")

    scored_df = pd.DataFrame(rows)
    output_path = os.path.join(SCRIPT_DIR, "scored_responses.csv")
    scored_df.to_csv(output_path, index=False)
    print(f"  Saved {len(scored_df)} scored rows to {output_path}")
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
    config_order = ["Baseline", "+RAG", "+Memory", "+Memory+OCEAN", "Full SoulMate", "Agentic SoulMate"]
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
    results_path = os.path.join(SCRIPT_DIR, "results_v4.csv")
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
    ax.set_title("EPITOME Empathy Benchmark v4 — SoulMate Ablation + Agentic Router")
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(systems, rotation=15, ha="right")
    ax.legend()
    ax.set_ylim(0, max(results["Total"].max() * 1.15, 2.5))
    plt.tight_layout()

    chart_path = os.path.join(SCRIPT_DIR, "results_v4.png")
    fig.savefig(chart_path, dpi=150)
    plt.close(fig)
    print(f"  Chart saved to {chart_path}")


# ============================================================
# Router analysis
# ============================================================
def analyze_router():
    print("\n" + "=" * 60)
    print("STEP 7: Router decision analysis")
    print("=" * 60)

    router_path = os.path.join(SCRIPT_DIR, "router_decisions.csv")
    if not os.path.exists(router_path):
        print("  No router decisions found, skipping.")
        return

    df = pd.read_csv(router_path)

    print(f"\n  Total decisions: {len(df)}")
    print(f"  RAG activated:    {df['use_rag'].sum()}/50 ({df['use_rag'].mean()*100:.0f}%)")
    print(f"  Memory activated: {df['use_memory'].sum()}/50 ({df['use_memory'].mean()*100:.0f}%)")
    print(f"  OCEAN activated:  {df['use_ocean'].sum()}/50 ({df['use_ocean'].mean()*100:.0f}%)")

    # Combination counts
    df["combo"] = ""
    for _, r in df.iterrows():
        parts = []
        if r["use_rag"]: parts.append("RAG")
        if r["use_memory"]: parts.append("Memory")
        if r["use_ocean"]: parts.append("OCEAN")
        df.loc[_, "combo"] = "+".join(parts) if parts else "None"

    print("\n  Component combinations:")
    for combo, count in df["combo"].value_counts().items():
        print(f"    {combo}: {count} ({count/len(df)*100:.0f}%)")

    # By emotion
    print("\n  RAG activation by emotion:")
    emo_rag = df.groupby("emotion")["use_rag"].mean()
    for emo, rate in emo_rag.sort_values(ascending=False).items():
        n = (df["emotion"] == emo).sum()
        print(f"    {emo}: {rate*100:.0f}% (n={n})")

    # Save analysis
    analysis_path = os.path.join(SCRIPT_DIR, "router_analysis.csv")
    df.to_csv(analysis_path, index=False)
    print(f"\n  Router analysis saved to {analysis_path}")


# ============================================================
# Main
# ============================================================
async def main():
    print("=" * 60)
    print("  EPITOME EMPATHY BENCHMARK v4 — Agentic Router")
    print("=" * 60)

    # Step 1
    human_baseline = compute_human_baseline()

    # Step 2
    seekers_df = load_test_seekers()

    # Step 3-4: Initialize system, warm up, generate
    from core.engine import AgenticEmpathySystem
    system = AgenticEmpathySystem()

    await warmup(system)
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

    print("\n" + "=" * 60)
    print("  BENCHMARK v4 COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
