"""
Add Baseline (GPT-3.5) to the v5 pilot results and print side-by-side comparison.

Usage:
    cd backend
    uv run python evaluate/benchmark/run_baseline_35.py
"""

import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
PILOT_DIR = os.path.join(SCRIPT_DIR, "results", "pilot")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, SCRIPT_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(override=True)

import pandas as pd
import numpy as np
from openai import OpenAI


# ============================================================
# Step 1 — Generate Baseline (GPT-3.5) responses
# ============================================================
def generate_baseline_35(seekers_df):
    print("\n" + "=" * 60)
    print("STEP 1: Generating Baseline (GPT-3.5) responses")
    print("=" * 60)

    out_path = os.path.join(PILOT_DIR, "generated_baseline_35.csv")
    if os.path.exists(out_path):
        df = pd.read_csv(out_path)
        if len(df) == len(seekers_df):
            print(f"  Found cached results ({len(df)} rows), skipping generation.")
            return df

    client = OpenAI()
    rows = []

    for idx, (_, row) in enumerate(seekers_df.iterrows()):
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            temperature=0,
            messages=[
                {"role": "system", "content": "You are an empathetic mental health supporter. Respond with empathy."},
                {"role": "user", "content": row["seeker_post"]},
            ],
        )
        response = completion.choices[0].message.content
        rows.append({
            "sp_id": row["sp_id"],
            "seeker_post": row["seeker_post"],
            "config": "Baseline (GPT-3.5)",
            "response": response,
        })
        print(f"  [{idx+1}/{len(seekers_df)}] sp_id={row['sp_id']}")

    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    print(f"  Saved {len(df)} responses to {out_path}")
    return df


# ============================================================
# Step 2 — Score with EPITOME
# ============================================================
def score_baseline_35(responses_df):
    print("\n" + "=" * 60)
    print("STEP 2: Scoring with EPITOME models")
    print("=" * 60)

    out_path = os.path.join(PILOT_DIR, "scored_baseline_35.csv")
    if os.path.exists(out_path):
        df = pd.read_csv(out_path)
        if len(df) == len(responses_df):
            print(f"  Found cached scored results ({len(df)} rows), skipping scoring.")
            return df

    from epitome_scorer import EpitomeScorer

    scorer = EpitomeScorer(
        er_path=os.path.join(MODELS_DIR, "reddit_ER.pth"),
        ip_path=os.path.join(MODELS_DIR, "reddit_IP.pth"),
        ex_path=os.path.join(MODELS_DIR, "reddit_EX.pth"),
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
        print(f"  Scored {idx+1}/{len(responses_df)}")

    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    print(f"  Saved {len(df)} scored rows to {out_path}")
    return df


# ============================================================
# Step 3 — Print side-by-side comparison
# ============================================================
def print_comparison(scored_35_df):
    print("\n" + "=" * 60)
    print("STEP 3: Side-by-side comparison")
    print("=" * 60)

    # Load existing v5 scored results
    v5_path = os.path.join(PILOT_DIR, "scored_responses_v5.csv")
    if not os.path.exists(v5_path):
        print(f"  ERROR: {v5_path} not found. Run run_benchmark_v5.py first.")
        return

    v5_df = pd.read_csv(v5_path)

    # Load human baseline from EPITOME dataset
    er = pd.read_csv("data/epitome/emotional-reactions-reddit.csv")
    ip = pd.read_csv("data/epitome/interpretations-reddit.csv")
    ex = pd.read_csv("data/epitome/explorations-reddit.csv")
    human_row = pd.DataFrame([{
        "config": "Human (Reddit)",
        "ER_score": er["level"].mean(),
        "IP_score": ip["level"].mean(),
        "EX_score": ex["level"].mean(),
        "total_score": er["level"].mean() + ip["level"].mean() + ex["level"].mean(),
    }])

    # Combine all scored data
    combined = pd.concat([v5_df, scored_35_df], ignore_index=True)

    # Aggregate
    agg = combined.groupby("config").agg(
        ER=("ER_score", "mean"),
        IP=("IP_score", "mean"),
        EX=("EX_score", "mean"),
        Total=("total_score", "mean"),
    ).reset_index().rename(columns={"config": "Config"})

    # Order configs
    config_order = ["Baseline (GPT-3.5)", "Baseline", "RAG", "RAG+Memory", "RAG+OCEAN", "Agentic"]
    agg["Config"] = pd.Categorical(agg["Config"], categories=config_order, ordered=True)
    agg = agg.sort_values("Config").reset_index(drop=True)

    # Prepend human row
    human_agg = pd.DataFrame([{
        "Config": "Human (Reddit)",
        "ER": human_row["ER_score"].values[0],
        "IP": human_row["IP_score"].values[0],
        "EX": human_row["EX_score"].values[0],
        "Total": human_row["total_score"].values[0],
    }])
    results = pd.concat([human_agg, agg], ignore_index=True)

    # Print table
    print(f"\n  {'Config':<22} {'ER':>6} {'IP':>6} {'EX':>6} {'Total':>7}")
    print(f"  {'-'*22} {'-'*6} {'-'*6} {'-'*6} {'-'*7}")
    for _, row in results.iterrows():
        marker = " *" if row["Config"] == "Baseline (GPT-3.5)" else ""
        print(f"  {row['Config']:<22} {row['ER']:>6.4f} {row['IP']:>6.4f} {row['EX']:>6.4f} {row['Total']:>7.4f}{marker}")

    print(f"\n  * = new config added in this run")
    print(f"\n  Note: Baseline = GPT-4o-mini (no pipeline)")
    print(f"        Baseline (GPT-3.5) = GPT-3.5-turbo (no pipeline)")
    print(f"        All SoulMate configs (RAG/Memory/OCEAN/Agentic) use GPT-3.5-turbo backbone")

    # Save combined results
    out_path = os.path.join(PILOT_DIR, "results_v5_extended.csv")
    results.to_csv(out_path, index=False)
    print(f"\n  Full results saved to {out_path}")


# ============================================================
# Main
# ============================================================
def main():
    print("=" * 60)
    print("  BASELINE (GPT-3.5) ADDITION — v5 Pilot Comparison")
    print("=" * 60)

    # Load existing 50 test posts
    seekers_path = os.path.join(PILOT_DIR, "test_seekers_v5.csv")
    if not os.path.exists(seekers_path):
        print(f"ERROR: {seekers_path} not found. Run run_benchmark_v5.py first.")
        sys.exit(1)
    seekers_df = pd.read_csv(seekers_path)
    print(f"\n  Loaded {len(seekers_df)} test posts from test_seekers_v5.csv")

    responses_df = generate_baseline_35(seekers_df)
    scored_df = score_baseline_35(responses_df)
    print_comparison(scored_df)

    print("\n" + "=" * 60)
    print("  DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
