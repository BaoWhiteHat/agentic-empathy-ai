"""
EPITOME Stability Test — Run benchmark 3 times, compute mean ± std.

Usage:
    cd backend
    uv run python evaluate/benchmark/run_stability_test.py
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
NUM_RUNS = 3

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


def load_test_seekers():
    path = os.path.join(SCRIPT_DIR, "test_seekers_v5.csv")
    if os.path.exists(path):
        return pd.read_csv(path)
    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    unique = er.drop_duplicates(subset="sp_id")[["sp_id", "seeker_post"]]
    sample = unique.sample(n=50, random_state=42)
    sample.to_csv(path, index=False)
    return sample


def compute_human_baseline():
    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    ip = pd.read_csv("data/epitome/interpretations-reddit.csv")
    ex = pd.read_csv("data/epitome/explorations-reddit.csv")
    baseline = {
        "ER": er["level"].mean(),
        "IP": ip["level"].mean(),
        "EX": ex["level"].mean(),
    }
    baseline["Total"] = baseline["ER"] + baseline["IP"] + baseline["EX"]
    return baseline


def clean_neo4j(system):
    if not system.memory or not system.memory.driver:
        return
    try:
        with system.memory.driver.session() as session:
            result = session.run("MATCH (u:User) WHERE u.id STARTS WITH 'bench' DETACH DELETE u")
            summary = result.consume()
            print(f"    Cleaned {summary.counters.nodes_deleted} nodes from Neo4j")
    except Exception as e:
        print(f"    Warning: Neo4j cleanup failed: {e}")


async def warmup(system):
    for config_name, user_id in USER_IDS.items():
        for msg in WARMUP_MESSAGES:
            emotion_result = system.perception.detect_emotion(msg)
            emotion = emotion_result["emotion"]
            await system.process_brain(
                msg, user_id, emotion,
                use_memory=True, use_ocean=True, use_rag=True
            )
            await system.background_learning(msg, user_id, emotion)
        profile = system.memory.get_user_profile(user_id) if system.memory else {}
        print(f"    {user_id} warmed up. OCEAN: {profile}")


def _router_decision_label(decisions):
    if decisions.get("use_memory") and decisions.get("use_ocean"):
        return "RAG+Memory+OCEAN"
    if decisions.get("use_memory"):
        return "RAG+Memory"
    if decisions.get("use_ocean"):
        return "RAG+OCEAN"
    return "RAG_only"


async def generate_responses(system, seekers_df):
    client = OpenAI()
    rows = []
    router_rows = []

    for idx, (_, row) in enumerate(seekers_df.iterrows()):
        sp_id = row["sp_id"]
        seeker_post = row["seeker_post"]

        emotion_result = system.perception.detect_emotion(seeker_post)
        emotion = emotion_result["emotion"]

        if (idx + 1) % 10 == 0:
            print(f"      [{idx+1}/50]")

        # Config 1 — Baseline
        completion = client.chat.completions.create(
            model="gpt-4o-mini", temperature=0,
            messages=[
                {"role": "system", "content": "You are an empathetic mental health supporter. Respond with empathy."},
                {"role": "user", "content": seeker_post},
            ],
        )
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Baseline",
                      "response": completion.choices[0].message.content, "emotion": emotion})

        # Config 2 — RAG
        resp = await system.process_brain(
            seeker_post, "bench_rag", emotion,
            use_memory=False, use_ocean=False, use_rag=True, save_ai_response=False)
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG",
                      "response": resp, "emotion": emotion})

        # Config 3 — RAG+Memory
        resp = await system.process_brain(
            seeker_post, USER_IDS["RAG+Memory"], emotion,
            use_memory=True, use_ocean=False, use_rag=True, save_ai_response=False)
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG+Memory",
                      "response": resp, "emotion": emotion})

        # Config 4 — RAG+OCEAN
        resp = await system.process_brain(
            seeker_post, USER_IDS["RAG+OCEAN"], emotion,
            use_memory=False, use_ocean=True, use_rag=True, save_ai_response=False)
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "RAG+OCEAN",
                      "response": resp, "emotion": emotion})

        # Config 5 — Agentic
        resp, decisions = await system.process_brain_agentic(
            seeker_post, USER_IDS["Agentic"], emotion, save_ai_response=False)
        rows.append({"sp_id": sp_id, "seeker_post": seeker_post, "config": "Agentic",
                      "response": resp, "emotion": emotion})
        router_rows.append({
            "sp_id": sp_id, "seeker_post": seeker_post, "emotion": emotion,
            "router_decision": _router_decision_label(decisions),
            "reasoning": decisions["reasoning"],
        })

    return pd.DataFrame(rows), pd.DataFrame(router_rows)


def score_responses(responses_df):
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
            "sp_id": row["sp_id"], "config": row["config"],
            "ER_score": scores["ER"], "IP_score": scores["IP"],
            "EX_score": scores["EX"],
            "total_score": scores["ER"] + scores["IP"] + scores["EX"],
        })
        if (idx + 1) % 50 == 0:
            print(f"      Scored {idx+1}/{len(responses_df)}")

    return pd.DataFrame(rows)


def aggregate_run(scored_df):
    """Return per-config means for a single run."""
    return scored_df.groupby("config").agg(
        ER=("ER_score", "mean"),
        IP=("IP_score", "mean"),
        EX=("EX_score", "mean"),
        Total=("total_score", "mean"),
    ).reset_index()


async def main():
    print("=" * 60)
    print("  STABILITY TEST — 3 runs of v5b benchmark")
    print("=" * 60)

    from core.engine import AgenticEmpathySystem

    seekers_df = load_test_seekers()
    human_baseline = compute_human_baseline()
    print(f"  Human baseline: {human_baseline}")
    print(f"  Loaded {len(seekers_df)} seeker posts")

    all_run_results = []

    for run_num in range(1, NUM_RUNS + 1):
        print(f"\n{'='*60}")
        print(f"  RUN {run_num}/{NUM_RUNS}")
        print(f"{'='*60}")

        # Init system fresh each run
        system = AgenticEmpathySystem()

        # Clean + warm-up
        print(f"  [Run {run_num}] Cleaning Neo4j...")
        clean_neo4j(system)
        print(f"  [Run {run_num}] Warming up...")
        await warmup(system)

        # Generate
        print(f"  [Run {run_num}] Generating responses...")
        responses_df, router_df = await generate_responses(system, seekers_df)

        # Save generated responses
        responses_df.to_csv(os.path.join(SCRIPT_DIR, f"generated_responses_run{run_num}.csv"), index=False)
        router_df.to_csv(os.path.join(SCRIPT_DIR, f"router_analysis_run{run_num}.csv"), index=False)

        # Cleanup engine before scoring
        system.close()
        del system

        # Score
        print(f"  [Run {run_num}] Scoring...")
        scored_df = score_responses(responses_df)
        scored_df.to_csv(os.path.join(SCRIPT_DIR, f"scored_responses_run{run_num}.csv"), index=False)

        # Aggregate
        run_agg = aggregate_run(scored_df)
        run_agg["run"] = run_num

        # Save per-run results
        config_order = ["Baseline", "RAG", "RAG+Memory", "RAG+OCEAN", "Agentic"]
        run_agg["config"] = pd.Categorical(run_agg["config"], categories=config_order, ordered=True)
        run_agg = run_agg.sort_values("config").reset_index(drop=True)

        # Add human baseline
        human_row = pd.DataFrame([{
            "config": "Human (Reddit)", "ER": human_baseline["ER"],
            "IP": human_baseline["IP"], "EX": human_baseline["EX"],
            "Total": human_baseline["Total"], "run": run_num,
        }])
        run_results = pd.concat([human_row, run_agg], ignore_index=True)
        run_results.to_csv(os.path.join(SCRIPT_DIR, f"results_run{run_num}.csv"), index=False)

        print(f"\n  Run {run_num} results:")
        print(run_results[["config", "ER", "IP", "EX", "Total"]].to_string(index=False))

        # Router summary
        print(f"\n  Run {run_num} router decisions:")
        for decision, count in router_df["router_decision"].value_counts().items():
            print(f"    {decision}: {count}/50 ({count/50*100:.0f}%)")

        all_run_results.append(run_agg)

    # ============================================================
    # Stability analysis — mean ± std across 3 runs
    # ============================================================
    print(f"\n{'='*60}")
    print("  STABILITY ANALYSIS — Mean ± Std across 3 runs")
    print(f"{'='*60}")

    combined = pd.concat(all_run_results, ignore_index=True)

    stability = combined.groupby("config").agg(
        ER_mean=("ER", "mean"), ER_std=("ER", "std"),
        IP_mean=("IP", "mean"), IP_std=("IP", "std"),
        EX_mean=("EX", "mean"), EX_std=("EX", "std"),
        Total_mean=("Total", "mean"), Total_std=("Total", "std"),
    ).reset_index()

    config_order = ["Baseline", "RAG", "RAG+Memory", "RAG+OCEAN", "Agentic"]
    stability["config"] = pd.Categorical(stability["config"], categories=config_order, ordered=True)
    stability = stability.sort_values("config").reset_index(drop=True)

    # Add human baseline (no std — it's fixed)
    human_row = pd.DataFrame([{
        "config": "Human (Reddit)",
        "ER_mean": human_baseline["ER"], "ER_std": 0.0,
        "IP_mean": human_baseline["IP"], "IP_std": 0.0,
        "EX_mean": human_baseline["EX"], "EX_std": 0.0,
        "Total_mean": human_baseline["Total"], "Total_std": 0.0,
    }])
    stability = pd.concat([human_row, stability], ignore_index=True)

    # Format for display
    display_rows = []
    for _, r in stability.iterrows():
        display_rows.append({
            "System": r["config"],
            "ER": f"{r['ER_mean']:.2f} ± {r['ER_std']:.2f}",
            "IP": f"{r['IP_mean']:.2f} ± {r['IP_std']:.2f}",
            "EX": f"{r['EX_mean']:.2f} ± {r['EX_std']:.2f}",
            "Total": f"{r['Total_mean']:.2f} ± {r['Total_std']:.2f}",
        })
    display_df = pd.DataFrame(display_rows)

    print("\n" + display_df.to_string(index=False))

    # Save
    stability.to_csv(os.path.join(SCRIPT_DIR, "results_stability.csv"), index=False)
    display_df.to_csv(os.path.join(SCRIPT_DIR, "results_stability_formatted.csv"), index=False)
    print(f"\n  Saved to results_stability.csv and results_stability_formatted.csv")

    # Also save per-run comparison
    print("\n  Per-run breakdown:")
    for run_num in range(1, NUM_RUNS + 1):
        run_data = combined[combined["run"] == run_num]
        print(f"\n  Run {run_num}:")
        print(run_data[["config", "ER", "IP", "EX", "Total"]].to_string(index=False))

    print(f"\n{'='*60}")
    print("  STABILITY TEST COMPLETE")
    print(f"{'='*60}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
