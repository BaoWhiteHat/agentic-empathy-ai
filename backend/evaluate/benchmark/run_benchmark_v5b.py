"""
EPITOME Empathy Benchmark v5b — Updated Router Prompt (RAG-only option)

Same as v5 but with improved router prompt that explicitly allows RAG-only decisions.

Usage:
    cd backend
    uv run python evaluate/benchmark/run_benchmark_v5b.py
"""

import sys
import os
import asyncio

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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

NUM_CONFIGS = 5
EXPECTED_ROWS = 50 * NUM_CONFIGS

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


def clean_neo4j(system):
    print("\n" + "=" * 60)
    print("STEP 0: Cleaning old benchmark users from Neo4j")
    print("=" * 60)

    if not system.memory or not system.memory.driver:
        print("  No Neo4j connection, skipping cleanup.")
        return

    try:
        with system.memory.driver.session() as session:
            result = session.run("MATCH (u:User) WHERE u.id STARTS WITH 'bench' DETACH DELETE u")
            summary = result.consume()
            print(f"  Deleted {summary.counters.nodes_deleted} nodes")
        print("  Neo4j cleanup complete.")
    except Exception as e:
        print(f"  Warning: Neo4j cleanup failed: {e}")


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


def load_test_seekers():
    print("\n" + "=" * 60)
    print("STEP 2: Loading test seeker posts")
    print("=" * 60)

    # Reuse same 50 posts from v5
    path = os.path.join(SCRIPT_DIR, "test_seekers_v5.csv")
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
            await system.background_learning(msg, user_id, emotion)

        profile = system.memory.get_user_profile(user_id) if system.memory else {}
        print(f"    {user_id} done. OCEAN: {profile}")

    print("  All warm-ups complete.")


def _router_decision_label(decisions):
    """Convert router booleans to a human-readable label."""
    if decisions.get("use_memory") and decisions.get("use_ocean"):
        return "RAG+Memory+OCEAN"  # shouldn't happen with new prompt
    if decisions.get("use_memory"):
        return "RAG+Memory"
    if decisions.get("use_ocean"):
        return "RAG+OCEAN"
    return "RAG_only"


async def generate_responses(system, seekers_df):
    print("\n" + "=" * 60)
    print(f"STEP 4: Generating responses ({NUM_CONFIGS} configs x 50 posts)")
    print("=" * 60)

    output_path = os.path.join(SCRIPT_DIR, "generated_responses_v5b.csv")
    router_path = os.path.join(SCRIPT_DIR, "router_decisions_v5b.csv")

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

        emotion_result = system.perception.detect_emotion(seeker_post)
        emotion = emotion_result["emotion"]

        print(f"  [{idx+1}/50] sp_id={sp_id} | emotion={emotion}")

        # Config 1 — Baseline
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

        # Config 5 — Agentic
        resp_agentic, decisions = await system.process_brain_agentic(
            seeker_post, USER_IDS["Agentic"], emotion,
            save_ai_response=False
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Agentic", "response": resp_agentic, "emotion": emotion})
        router_rows.append({
            "sp_id": sp_id,
            "seeker_post": seeker_post,
            "emotion": emotion,
            "router_decision": _router_decision_label(decisions),
            "reasoning": decisions["reasoning"],
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"  Saved {len(df)} responses to {output_path}")

    router_df = pd.DataFrame(router_rows)
    router_df.to_csv(router_path, index=False)
    print(f"  Saved {len(router_df)} router decisions to {router_path}")

    return df


def score_responses(responses_df):
    print("\n" + "=" * 60)
    print("STEP 5: Scoring empathy with EPITOME models")
    print("=" * 60)

    scored_path = os.path.join(SCRIPT_DIR, "scored_responses_v5b.csv")
    if os.path.exists(scored_path):
        existing = pd.read_csv(scored_path)
        if len(existing) == EXPECTED_ROWS:
            print(f"  Found cached scored results ({len(existing)} rows), skipping scoring.")
            return existing

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
    scored_df.to_csv(scored_path, index=False)
    print(f"  Saved {len(scored_df)} scored rows to {scored_path}")
    return scored_df


def aggregate_and_visualize(scored_df, human_baseline):
    print("\n" + "=" * 60)
    print("STEP 6: Aggregating results and generating chart")
    print("=" * 60)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    agg = scored_df.groupby("config").agg(
        ER=("ER_score", "mean"),
        IP=("IP_score", "mean"),
        EX=("EX_score", "mean"),
        Total=("total_score", "mean"),
    ).reset_index()

    config_order = ["Baseline", "RAG", "RAG+Memory", "RAG+OCEAN", "Agentic"]
    agg["config"] = pd.Categorical(agg["config"], categories=config_order, ordered=True)
    agg = agg.sort_values("config").reset_index(drop=True)

    human_row = pd.DataFrame([{
        "config": "Human (Reddit)",
        "ER": human_baseline["ER"],
        "IP": human_baseline["IP"],
        "EX": human_baseline["EX"],
        "Total": human_baseline["Total"],
    }])
    results = pd.concat([human_row, agg], ignore_index=True)

    results_path = os.path.join(SCRIPT_DIR, "results_v5b.csv")
    results.to_csv(results_path, index=False)
    print(f"\n  Results saved to {results_path}")
    print(results.to_string(index=False))

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
    ax.set_title("EPITOME Empathy Benchmark v5b — RAG-base Ablation + Agentic Router (Updated Prompt)")
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(systems, rotation=15, ha="right")
    ax.legend()
    ax.set_ylim(0, max(results["Total"].max() * 1.15, 2.5))
    plt.tight_layout()

    chart_path = os.path.join(SCRIPT_DIR, "results_v5b.png")
    fig.savefig(chart_path, dpi=150)
    plt.close(fig)
    print(f"  Chart saved to {chart_path}")


def analyze_router():
    print("\n" + "=" * 60)
    print("STEP 7: Router decision analysis")
    print("=" * 60)

    router_path = os.path.join(SCRIPT_DIR, "router_decisions_v5b.csv")
    if not os.path.exists(router_path):
        print("  No router decisions found, skipping.")
        return

    df = pd.read_csv(router_path)
    n = len(df)

    print(f"\n  Total decisions: {n}")
    print("\n  Router decision distribution:")
    for decision, count in df["router_decision"].value_counts().items():
        print(f"    {decision}: {count}/{n} ({count/n*100:.0f}%)")

    print("\n  Router choices by emotion:")
    for emo in sorted(df["emotion"].unique()):
        emo_df = df[df["emotion"] == emo]
        en = len(emo_df)
        decisions = emo_df["router_decision"].value_counts().to_dict()
        parts = [f"{k}={v}" for k, v in decisions.items()]
        print(f"    {emo} (n={en}): {', '.join(parts)}")

    analysis_path = os.path.join(SCRIPT_DIR, "router_analysis_v5b.csv")
    df.to_csv(analysis_path, index=False)
    print(f"\n  Router analysis saved to {analysis_path}")


async def main():
    print("=" * 60)
    print("  EPITOME EMPATHY BENCHMARK v5b — Updated Router Prompt")
    print("=" * 60)

    from core.engine import AgenticEmpathySystem
    system = AgenticEmpathySystem()

    clean_neo4j(system)
    human_baseline = compute_human_baseline()
    seekers_df = load_test_seekers()
    await warmup(system)
    responses_df = await generate_responses(system, seekers_df)

    system.close()
    del system

    scored_df = score_responses(responses_df)
    aggregate_and_visualize(scored_df, human_baseline)
    analyze_router()

    print("\n" + "=" * 60)
    print("  BENCHMARK v5b COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
