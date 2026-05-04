import asyncio
import json
import os
import re
import string
import sys
import time
from dataclasses import asdict

import numpy as np
import pandas as pd
from openai import OpenAI
from scipy.stats import binomtest


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "results", "b2_200")
DATASET_PATH = os.path.join(BACKEND_DIR, "data", "LongMemEval", "longmemeval_s_cleaned.json")

TEST_CASES_PATH = os.path.join(OUTPUT_DIR, "test_cases_b2_200.csv")
GENERATED_PATH = os.path.join(OUTPUT_DIR, "generated_responses_b2_200.csv")
SCORED_PATH = os.path.join(OUTPUT_DIR, "scored_responses_b2_200.csv")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "summary_results_b2_200.csv")
STATS_PATH = os.path.join(OUTPUT_DIR, "statistical_tests_b2_200.csv")
ROUTER_DECISIONS_PATH = os.path.join(OUTPUT_DIR, "router_decisions_b2_200.csv")
ROUTER_ANALYSIS_PATH = os.path.join(OUTPUT_DIR, "router_analysis_b2_200.csv")
PLOT_PATH = os.path.join(OUTPUT_DIR, "results_b2_200.png")

MAIN_OUTPUT_PATHS = [
    GENERATED_PATH,
    SCORED_PATH,
    SUMMARY_PATH,
    STATS_PATH,
    PLOT_PATH,
]

LEGACY_OUTPUT_PATHS = [
    ROUTER_DECISIONS_PATH,
    ROUTER_ANALYSIS_PATH,
]

SAMPLE_SIZE = 200
RANDOM_SEED = 42
CHECKPOINT_EVERY = 10

CONFIG_ORDER = [
    "Baseline",
    "RAG",
    "RAG+Memory",
    "Full pipeline",
]

RUN_CONFIGS = CONFIG_ORDER.copy()
MEMORY_CONFIGS = {"RAG+Memory", "Full pipeline"}
JSON_COLUMNS = ["haystack_sessions", "haystack_session_ids", "haystack_dates"]

TEST_CASE_COLUMNS = [
    "case_id",
    "question_type",
    "question",
    "gold_answer",
    "haystack_sessions",
    "haystack_session_ids",
    "haystack_dates",
]

GENERATED_COLUMNS = [
    "case_id",
    "question_type",
    "question",
    "gold_answer",
    "config",
    "user_id",
    "response",
    "emotion",
    "risk_type",
    "risk_level",
    "use_rag",
    "use_memory",
    "use_ocean",
    "reasoning",
    "replayed_turns",
    "skipped_fragments",
]

SCORED_COLUMNS = GENERATED_COLUMNS + ["normalized_gold", "normalized_response", "match_type", "is_correct"]

_WHITESPACE_RE = re.compile(r"\s+")
_PUNCT_TRANSLATOR = str.maketrans("", "", string.punctuation)


def setup_paths():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)
    if SCRIPT_DIR not in sys.path:
        sys.path.insert(0, SCRIPT_DIR)
    os.chdir(BACKEND_DIR)


def _serialize_json(value):
    return json.dumps(value, ensure_ascii=False)


def _deserialize_json(value):
    if isinstance(value, list):
        return value
    if pd.isna(value) or value == "":
        return []
    return json.loads(value)


def _ensure_dataset_exists():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"LongMemEval dataset not found at {DATASET_PATH}. "
            "Expected local file: backend/data/LongMemEval/longmemeval_s_cleaned.json"
        )


def _normalize_case_record(record):
    return {
        "case_id": str(record["question_id"]),
        "question_type": record.get("question_type", "unknown"),
        "question": record.get("question", ""),
        "gold_answer": record.get("answer", ""),
        "haystack_sessions": record.get("haystack_sessions", []),
        "haystack_session_ids": record.get("haystack_session_ids", []),
        "haystack_dates": record.get("haystack_dates", []),
    }


def _normalize_cases_df(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=TEST_CASE_COLUMNS)

    for column in TEST_CASE_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[TEST_CASE_COLUMNS].copy()
    for column in JSON_COLUMNS:
        df[column] = df[column].apply(_deserialize_json)

    df = df.drop_duplicates(subset=["case_id"], keep="last")
    df = df.sort_values("case_id").reset_index(drop=True)
    return df


def load_or_create_case_set():
    if os.path.exists(TEST_CASES_PATH):
        existing = _normalize_cases_df(pd.read_csv(TEST_CASES_PATH))
        if len(existing) == SAMPLE_SIZE:
            return existing

    _ensure_dataset_exists()
    with open(DATASET_PATH, "r", encoding="utf-8") as handle:
        raw_data = json.load(handle)

    if not isinstance(raw_data, list):
        raise ValueError(f"Unexpected LongMemEval format in {DATASET_PATH}: expected top-level list.")

    if len(raw_data) < SAMPLE_SIZE:
        raise ValueError(f"Dataset only contains {len(raw_data)} rows, cannot sample {SAMPLE_SIZE}.")

    normalized_rows = [_normalize_case_record(record) for record in raw_data]
    sampled_df = pd.DataFrame(normalized_rows).sample(
        n=SAMPLE_SIZE,
        random_state=RANDOM_SEED,
    )
    sampled_df = sampled_df.sort_values("case_id").reset_index(drop=True)

    csv_df = sampled_df.copy()
    for column in JSON_COLUMNS:
        csv_df[column] = csv_df[column].apply(_serialize_json)
    csv_df.to_csv(TEST_CASES_PATH, index=False)

    return _normalize_cases_df(sampled_df)


def require_memory_for_b2(system):
    if not system.memory or not system.memory.driver:
        raise RuntimeError(
            "Benchmark 2 requires Neo4j-backed memory for replay-based configs, but GraphMemory is not connected."
        )


def clean_benchmark_users(system):
    if not system.memory or not system.memory.driver:
        print("No Neo4j connection, skipping benchmark-user cleanup.")
        return

    query = "MATCH (u:User) WHERE u.id STARTS WITH 'bench_b2_' DETACH DELETE u"
    with system.memory.driver.session() as session:
        result = session.run(query)
        summary = result.consume()
    print(f"Cleaned {summary.counters.nodes_deleted} Neo4j nodes for Benchmark 2 users.")


def delete_benchmark_user(system, user_id):
    if not system.memory or not system.memory.driver:
        return

    query = "MATCH (u:User {id: $user_id}) DETACH DELETE u"
    with system.memory.driver.session() as session:
        session.run(query, user_id=user_id)


def remove_b2_outputs(preserve_case_file=True):
    paths_to_remove = list(MAIN_OUTPUT_PATHS) + list(LEGACY_OUTPUT_PATHS)
    if not preserve_case_file:
        paths_to_remove.append(TEST_CASES_PATH)

    for path in paths_to_remove:
        if os.path.exists(path):
            os.remove(path)


def build_benchmark_user_id(config, case_id):
    slug = config.lower().replace("+", "").replace(" ", "_")
    return f"bench_b2_{slug}_{case_id}"


def _extract_message_text(message):
    if not isinstance(message, dict):
        return ""

    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text).strip())
            elif isinstance(item, str):
                parts.append(item.strip())
        return "\n".join(part for part in parts if part).strip()
    return str(content).strip()


def replay_haystack_sessions(system, user_id, haystack_sessions):
    if not system.memory or not system.memory.driver:
        return {"replayed_turns": 0, "skipped_fragments": 0}

    replayed_turns = 0
    skipped_fragments = 0

    for session in haystack_sessions:
        if not isinstance(session, list):
            skipped_fragments += 1
            continue

        pending_user = None
        for message in session:
            text = _extract_message_text(message)
            if not text:
                skipped_fragments += 1
                continue

            role = str(message.get("role", "")).lower() if isinstance(message, dict) else ""
            if role == "user":
                if pending_user is not None:
                    system.memory.add_turn(
                        user_id,
                        pending_user,
                        "neutral",
                        "",
                        risk_level="low",
                        risk_type="normal_support",
                        raw_stored=True,
                    )
                    replayed_turns += 1
                pending_user = text
            elif role == "assistant":
                if pending_user is None:
                    skipped_fragments += 1
                    continue
                system.memory.add_turn(
                    user_id,
                    pending_user,
                    "neutral",
                    text,
                    risk_level="low",
                    risk_type="normal_support",
                    raw_stored=True,
                )
                replayed_turns += 1
                pending_user = None
            else:
                skipped_fragments += 1

        if pending_user is not None:
            system.memory.add_turn(
                user_id,
                pending_user,
                "neutral",
                "",
                risk_level="low",
                risk_type="normal_support",
                raw_stored=True,
            )
            replayed_turns += 1

    return {"replayed_turns": replayed_turns, "skipped_fragments": skipped_fragments}


def _normalize_generated_df(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=GENERATED_COLUMNS)

    for column in GENERATED_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[GENERATED_COLUMNS].copy()
    df = df[df["config"].isin(RUN_CONFIGS)].copy()
    df = df.drop_duplicates(subset=["case_id", "config"], keep="last")
    df = df.sort_values(["case_id", "config"]).reset_index(drop=True)
    return df


def load_existing_generated():
    if not os.path.exists(GENERATED_PATH):
        return pd.DataFrame(columns=GENERATED_COLUMNS)
    return _normalize_generated_df(pd.read_csv(GENERATED_PATH))


def _save_generated_checkpoint(df):
    df = _normalize_generated_df(df)
    df.to_csv(GENERATED_PATH, index=False)


def _baseline_response(client, question):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a factual QA assistant. Answer the user's question briefly. "
                    "Use only the information present in the question itself. "
                    "If the question does not contain enough information, say you do not know."
                ),
            },
            {"role": "user", "content": question},
        ],
    )
    return completion.choices[0].message.content.strip()


async def _run_fixed_pipeline(system, question, user_id, emotion, use_memory, use_ocean, use_rag):
    safety = system.safety.classifier.classify(question, emotion, mode="messaging")

    if safety.risk_type == "self_harm_or_suicide":
        response = system.safety.policy.immediate_response(safety.risk_type, question, emotion)
        return response, asdict(safety), {
            "use_rag": False,
            "use_memory": False,
            "use_ocean": False,
            "reasoning": "safety override",
        }

    response = await system.process_brain(
        user_input=question,
        user_id=user_id,
        emotion=emotion,
        use_memory=use_memory,
        use_ocean=use_ocean,
        use_rag=use_rag,
        save_ai_response=False,
        safe_mode=safety.safe_mode,
        risk_type=safety.risk_type,
        safety_instruction=system.safety.policy.safe_instruction(safety.risk_type),
        safety_decision=safety,
    )

    effective = {
        "use_rag": bool(use_rag and safety.allow_rag),
        "use_memory": bool(use_memory and safety.allow_memory),
        "use_ocean": bool(use_ocean and safety.allow_ocean),
        "reasoning": "fixed config with safety constraints",
    }
    return response, asdict(safety), effective


def _row_from_result(case_row, config, user_id, response, emotion, replay_info, safety_info=None, routing_info=None):
    safety_info = safety_info or {}
    routing_info = routing_info or {}
    replay_info = replay_info or {}
    return {
        "case_id": case_row["case_id"],
        "question_type": case_row["question_type"],
        "question": case_row["question"],
        "gold_answer": case_row["gold_answer"],
        "config": config,
        "user_id": user_id,
        "response": response,
        "emotion": emotion,
        "risk_type": safety_info.get("risk_type"),
        "risk_level": safety_info.get("risk_level"),
        "use_rag": routing_info.get("use_rag"),
        "use_memory": routing_info.get("use_memory"),
        "use_ocean": routing_info.get("use_ocean"),
        "reasoning": routing_info.get("reasoning"),
        "replayed_turns": replay_info.get("replayed_turns", 0),
        "skipped_fragments": replay_info.get("skipped_fragments", 0),
    }


async def generate_responses(system, cases_df):
    client = OpenAI()
    generated_df = load_existing_generated()
    existing_pairs = set(zip(generated_df["case_id"], generated_df["config"]))

    new_case_count = 0
    t0 = time.time()

    for idx, case_row in cases_df.iterrows():
        case_data = case_row.to_dict()
        question = case_data["question"]
        emotion = system.perception.detect_emotion(question).get("emotion", "neutral")
        new_rows = []

        print(f"[{idx + 1}/{len(cases_df)}] case_id={case_data['case_id']} | type={case_data['question_type']} | emotion={emotion}")

        for config in RUN_CONFIGS:
            pair = (case_data["case_id"], config)
            if pair in existing_pairs:
                continue

            user_id = build_benchmark_user_id(config, case_data["case_id"])
            replay_info = {"replayed_turns": 0, "skipped_fragments": 0}

            if config in MEMORY_CONFIGS:
                delete_benchmark_user(system, user_id)
                replay_info = replay_haystack_sessions(system, user_id, case_data["haystack_sessions"])

            if config == "Baseline":
                response = _baseline_response(client, question)
                new_rows.append(_row_from_result(case_data, config, user_id, response, emotion, replay_info))

            elif config == "RAG":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, question, user_id, emotion, False, False, True
                )
                new_rows.append(_row_from_result(case_data, config, user_id, response, emotion, replay_info, safety_info, routing_info))

            elif config == "RAG+Memory":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, question, user_id, emotion, True, False, True
                )
                new_rows.append(_row_from_result(case_data, config, user_id, response, emotion, replay_info, safety_info, routing_info))

            elif config == "Full pipeline":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, question, user_id, emotion, True, True, True
                )
                routing_info["reasoning"] = "fixed full pipeline with safety constraints"
                new_rows.append(_row_from_result(case_data, config, user_id, response, emotion, replay_info, safety_info, routing_info))

        if new_rows:
            generated_df = pd.concat([generated_df, pd.DataFrame(new_rows)], ignore_index=True)
            generated_df = _normalize_generated_df(generated_df)
            existing_pairs.update((row["case_id"], row["config"]) for row in new_rows)
            new_case_count += 1

        if new_case_count and new_case_count % CHECKPOINT_EVERY == 0:
            _save_generated_checkpoint(generated_df)
            elapsed = time.time() - t0
            print(f"  Checkpoint saved after {new_case_count} newly processed cases ({elapsed / 60:.1f}m elapsed).")

    _save_generated_checkpoint(generated_df)
    return generated_df


def normalize_text(text):
    text = "" if text is None else str(text)
    text = text.lower().translate(_PUNCT_TRANSLATOR)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


def score_answer(response, gold_answer):
    normalized_gold = normalize_text(gold_answer)
    normalized_response = normalize_text(response)

    if not normalized_gold or not normalized_response:
        return normalized_gold, normalized_response, "failed", 0
    if normalized_response == normalized_gold:
        return normalized_gold, normalized_response, "exact", 1
    if normalized_gold in normalized_response:
        return normalized_gold, normalized_response, "gold_in_response", 1
    return normalized_gold, normalized_response, "failed", 0


def score_generated_responses(generated_df):
    generated_df = _normalize_generated_df(generated_df)
    if generated_df.empty:
        raise ValueError("No generated responses found to score.")

    if os.path.exists(SCORED_PATH):
        existing = pd.read_csv(SCORED_PATH)
    else:
        existing = pd.DataFrame(columns=SCORED_COLUMNS)

    for column in SCORED_COLUMNS:
        if column not in existing.columns:
            existing[column] = None

    existing = existing[SCORED_COLUMNS]
    existing = existing[existing["config"].isin(RUN_CONFIGS)].copy()
    existing = existing.drop_duplicates(subset=["case_id", "config"], keep="last")
    scored_pairs = set(zip(existing["case_id"], existing["config"]))
    generated_pairs = set(zip(generated_df["case_id"], generated_df["config"]))

    if scored_pairs == generated_pairs:
        return existing.sort_values(["case_id", "config"]).reset_index(drop=True)

    rows = []
    t0 = time.time()
    for idx, row in enumerate(generated_df.itertuples(index=False), start=1):
        pair = (row.case_id, row.config)
        if pair in scored_pairs:
            continue

        normalized_gold, normalized_response, match_type, is_correct = score_answer(row.response, row.gold_answer)
        row_dict = row._asdict()
        row_dict.update(
            {
                "normalized_gold": normalized_gold,
                "normalized_response": normalized_response,
                "match_type": match_type,
                "is_correct": is_correct,
            }
        )
        rows.append(row_dict)

        if rows and len(rows) % 250 == 0:
            combined = pd.concat([existing, pd.DataFrame(rows)], ignore_index=True)
            combined = combined.drop_duplicates(subset=["case_id", "config"], keep="last")
            combined.to_csv(SCORED_PATH, index=False)
            elapsed = time.time() - t0
            print(f"  Scoring checkpoint: {len(combined)}/{len(generated_df)} rows saved ({elapsed / 60:.1f}m elapsed).")

    combined = pd.concat([existing, pd.DataFrame(rows)], ignore_index=True)
    combined = combined.drop_duplicates(subset=["case_id", "config"], keep="last")
    combined = combined[SCORED_COLUMNS].sort_values(["case_id", "config"]).reset_index(drop=True)
    combined.to_csv(SCORED_PATH, index=False)
    return combined


def summarize_scores(scored_df):
    overall = scored_df.groupby("config").agg(
        n_cases=("case_id", "nunique"),
        accuracy=("is_correct", "mean"),
    ).reset_index()
    overall["scope"] = "overall"
    overall["question_type"] = None

    by_type = scored_df.groupby(["config", "question_type"]).agg(
        n_cases=("case_id", "nunique"),
        accuracy=("is_correct", "mean"),
    ).reset_index()
    by_type["scope"] = "by_question_type"

    summary = pd.concat([overall, by_type], ignore_index=True, sort=False)
    summary["config"] = pd.Categorical(summary["config"], categories=CONFIG_ORDER, ordered=True)
    summary = summary[["scope", "question_type", "config", "n_cases", "accuracy"]]
    summary = summary.sort_values(["scope", "question_type", "config"]).reset_index(drop=True)
    summary.to_csv(SUMMARY_PATH, index=False)
    return summary


def run_statistical_tests(scored_df):
    comparisons = [
        ("RAG", "Baseline"),
        ("RAG+Memory", "RAG"),
        ("Full pipeline", "RAG+Memory"),
        ("Full pipeline", "Baseline"),
    ]

    rows = []
    for config_a, config_b in comparisons:
        subset = scored_df[scored_df["config"].isin([config_a, config_b])].copy()
        pivot = subset.pivot(index="case_id", columns="config", values="is_correct").dropna()
        if pivot.empty:
            continue

        a_correct_b_wrong = int(((pivot[config_a] == 1) & (pivot[config_b] == 0)).sum())
        b_correct_a_wrong = int(((pivot[config_a] == 0) & (pivot[config_b] == 1)).sum())
        n_discordant = a_correct_b_wrong + b_correct_a_wrong

        if n_discordant == 0:
            p_value = 1.0
            statistic = 0.0
        else:
            result = binomtest(a_correct_b_wrong, n=n_discordant, p=0.5, alternative="two-sided")
            p_value = result.pvalue
            statistic = a_correct_b_wrong

        rows.append(
            {
                "config_a": config_a,
                "config_b": config_b,
                "metric": "accuracy",
                "test_name": "Exact McNemar (binomial on discordant pairs)",
                "p_value": p_value,
                "statistic": statistic,
                "n_pairs": int(len(pivot)),
                "n_discordant": n_discordant,
                "wins_a": a_correct_b_wrong,
                "wins_b": b_correct_a_wrong,
                "accuracy_a": pivot[config_a].mean(),
                "accuracy_b": pivot[config_b].mean(),
                "accuracy_diff": pivot[config_a].mean() - pivot[config_b].mean(),
            }
        )

    stats_df = pd.DataFrame(
        rows,
        columns=[
            "config_a",
            "config_b",
            "metric",
            "test_name",
            "p_value",
            "statistic",
            "n_pairs",
            "n_discordant",
            "wins_a",
            "wins_b",
            "accuracy_a",
            "accuracy_b",
            "accuracy_diff",
        ],
    )
    stats_df.to_csv(STATS_PATH, index=False)
    return stats_df


def plot_summary(summary_df):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    overall = summary_df[summary_df["scope"] == "overall"].copy()
    overall["config"] = pd.Categorical(overall["config"], categories=CONFIG_ORDER, ordered=True)
    overall = overall.sort_values("config").reset_index(drop=True)

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(overall["config"], overall["accuracy"], color=["#6C8EAD", "#6FB07F", "#D3A252", "#7F7AA8"])

    for bar, value in zip(bars, overall["accuracy"]):
        ax.annotate(
            f"{value:.3f}",
            xy=(bar.get_x() + bar.get_width() / 2, value),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=9,
        )

    ax.set_xlabel("Configuration")
    ax.set_ylabel("Accuracy")
    ax.set_title("Benchmark 2: LongMemEval Accuracy (200 cases)")
    ax.set_ylim(0, max(1.0, overall["accuracy"].max() * 1.15 if not overall.empty else 1.0))
    plt.xticks(rotation=15, ha="right")
    plt.tight_layout()
    fig.savefig(PLOT_PATH, dpi=150)
    plt.close(fig)


def finalize_outputs():
    generated_df = load_existing_generated()
    if generated_df.empty:
        raise ValueError(f"No generated responses found at {GENERATED_PATH}")

    scored_df = score_generated_responses(generated_df)
    summary_df = summarize_scores(scored_df)
    stats_df = run_statistical_tests(scored_df)
    remove_b2_outputs(preserve_case_file=True)
    generated_df.to_csv(GENERATED_PATH, index=False)
    scored_df.to_csv(SCORED_PATH, index=False)
    summary_df.to_csv(SUMMARY_PATH, index=False)
    stats_df.to_csv(STATS_PATH, index=False)
    plot_summary(summary_df)
    return {
        "generated": generated_df,
        "scored": scored_df,
        "summary": summary_df,
    }
