"""
Finalize full benchmark from partial results (1000 posts).
Scores responses, aggregates results, generates chart and router analysis.
"""

import sys
import os
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
FULL_DIR = os.path.join(SCRIPT_DIR, "results", "full")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, SCRIPT_DIR)
os.chdir(BACKEND_DIR)

import pandas as pd
import numpy as np


def compute_human_baseline():
    print("Computing human baseline...")
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


def score_responses():
    print("\n" + "=" * 60)
    print("Scoring 5,000 responses with EPITOME models...")
    print("=" * 60)

    responses_df = pd.read_csv(os.path.join(FULL_DIR, "generated_responses_full.csv"))
    scored_path = os.path.join(FULL_DIR, "scored_responses_full.csv")

    if os.path.exists(scored_path):
        existing = pd.read_csv(scored_path)
        if len(existing) == len(responses_df):
            print(f"  Found cached scored results ({len(existing)} rows), skipping.")
            return existing

    from epitome_scorer import EpitomeScorer
    scorer = EpitomeScorer(
        er_path=os.path.join(MODELS_DIR, "reddit_ER.pth"),
        ip_path=os.path.join(MODELS_DIR, "reddit_IP.pth"),
        ex_path=os.path.join(MODELS_DIR, "reddit_EX.pth"),
    )

    rows = []
    t0 = time.time()
    total = len(responses_df)

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
            eta = (total - idx - 1) / rate / 60
            print(f"  Scored {idx+1}/{total} | {elapsed/60:.1f}m elapsed | ETA: {eta:.0f}m")

    scored_df = pd.DataFrame(rows)
    scored_df.to_csv(scored_path, index=False)
    elapsed = time.time() - t0
    print(f"  Saved {len(scored_df)} scored rows | took {elapsed/60:.1f}m")
    return scored_df


def aggregate_and_visualize(scored_df, human_baseline):
    print("\n" + "=" * 60)
    print("Aggregating results and generating chart...")
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

    results_path = os.path.join(FULL_DIR, "results_full.csv")
    results.to_csv(results_path, index=False)
    print(f"\n  Results saved to {results_path}")
    print(results.to_string(index=False))

    # Chart
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
    ax.set_title("EPITOME Empathy Benchmark — Full Dataset (1,000 posts x 5 configs)")
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(systems, rotation=15, ha="right")
    ax.legend()
    ax.set_ylim(0, max(results["Total"].max() * 1.15, 2.5))
    plt.tight_layout()

    chart_path = os.path.join(FULL_DIR, "results_full.png")
    fig.savefig(chart_path, dpi=150)
    plt.close(fig)
    print(f"  Chart saved to {chart_path}")

    return results


def analyze_router():
    print("\n" + "=" * 60)
    print("Router decision analysis...")
    print("=" * 60)

    router_path = os.path.join(FULL_DIR, "router_decisions_full.csv")
    if not os.path.exists(router_path):
        print("  No router decisions found.")
        return

    df = pd.read_csv(router_path)
    n = len(df)
    print(f"\n  Total decisions: {n}")
    print(f"  RAG activated:    {df['use_rag'].sum()}/{n} ({df['use_rag'].mean()*100:.0f}%)")
    print(f"  Memory activated: {df['use_memory'].sum()}/{n} ({df['use_memory'].mean()*100:.0f}%)")
    print(f"  OCEAN activated:  {df['use_ocean'].sum()}/{n} ({df['use_ocean'].mean()*100:.0f}%)")

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
        print(f"    {combo}: {count} ({count/n*100:.1f}%)")

    print("\n  Router choices by emotion:")
    for emo in sorted(df["emotion"].unique()):
        emo_df = df[df["emotion"] == emo]
        n_emo = len(emo_df)
        mem = emo_df["use_memory"].sum()
        ocean = emo_df["use_ocean"].sum()
        print(f"    {emo} (n={n_emo}): Memory={mem}, OCEAN={ocean}")

    analysis_path = os.path.join(FULL_DIR, "router_analysis_full.csv")
    df.to_csv(analysis_path, index=False)
    print(f"\n  Router analysis saved to {analysis_path}")


if __name__ == "__main__":
    human_baseline = compute_human_baseline()
    scored_df = score_responses()
    results = aggregate_and_visualize(scored_df, human_baseline)
    analyze_router()
    print("\n" + "=" * 60)
    print("  DONE")
    print("=" * 60)
