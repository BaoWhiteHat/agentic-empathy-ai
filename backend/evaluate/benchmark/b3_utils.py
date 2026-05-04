import json
import os
import sys
import time

import numpy as np
import pandas as pd


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "results", "b3")
DATASET_PATH = os.path.join(BACKEND_DIR, "data", "benchmark3", "b3_cases.json")

LOADED_CASES_PATH = os.path.join(OUTPUT_DIR, "loaded_cases_b3.csv")
PREDICTIONS_PATH = os.path.join(OUTPUT_DIR, "router_predictions_b3.csv")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "summary_results_b3.csv")
CONFUSION_PATH = os.path.join(OUTPUT_DIR, "confusion_matrix_b3.csv")
CLASSIFICATION_PATH = os.path.join(OUTPUT_DIR, "classification_report_b3.csv")
ERROR_ANALYSIS_PATH = os.path.join(OUTPUT_DIR, "error_analysis_b3.csv")
CONFUSION_PLOT_PATH = os.path.join(OUTPUT_DIR, "confusion_matrix_b3.png")
PER_CLASS_PLOT_PATH = os.path.join(OUTPUT_DIR, "per_class_accuracy_b3.png")

CASE_ORDER = ["rag_only", "memory", "ocean"]
EXPECTED_CASE_COUNT = 60
EXPECTED_CASES_PER_TYPE = 20
JSON_COLUMNS = ["history", "ocean_profile"]

CASE_COLUMNS = [
    "case_id",
    "case_type",
    "history",
    "current_message",
    "emotion",
    "ocean_profile",
    "expected_route",
    "why",
]

PREDICTION_COLUMNS = [
    "case_id",
    "case_type",
    "current_message",
    "emotion",
    "expected_route",
    "predicted_route",
    "use_rag",
    "use_memory",
    "use_ocean",
    "reasoning",
    "is_correct",
    "why",
    "has_history",
    "has_ocean",
    "narrative",
    "ocean_profile_str",
    "anomaly",
    "replayed_turns",
    "skipped_fragments",
]

DEFAULT_OCEAN = {
    "openness": 0.5,
    "conscientiousness": 0.5,
    "extraversion": 0.5,
    "agreeableness": 0.5,
    "neuroticism": 0.5,
}


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
    if isinstance(value, (list, dict)):
        return value
    if pd.isna(value) or value == "":
        return [] if value != "{}" else {}
    return json.loads(value)


def _normalize_history(value):
    if isinstance(value, list):
        return value
    return []


def _normalize_ocean_profile(value):
    if not isinstance(value, dict):
        return DEFAULT_OCEAN.copy()

    profile = DEFAULT_OCEAN.copy()
    for key in DEFAULT_OCEAN:
        raw_value = value.get(key, DEFAULT_OCEAN[key])
        try:
            profile[key] = float(raw_value)
        except (TypeError, ValueError):
            profile[key] = DEFAULT_OCEAN[key]
    return profile


def _normalize_case_record(record):
    return {
        "case_id": str(record.get("case_id", "")).strip(),
        "case_type": str(record.get("case_type", "")).strip(),
        "history": _normalize_history(record.get("history", [])),
        "current_message": str(record.get("current_message", "")).strip(),
        "emotion": str(record.get("emotion", "")).strip(),
        "ocean_profile": _normalize_ocean_profile(record.get("ocean_profile", {})),
        "expected_route": str(record.get("expected_route", "")).strip(),
        "why": str(record.get("why", "")).strip(),
    }


def _normalize_cases_df(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=CASE_COLUMNS)

    for column in CASE_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[CASE_COLUMNS].copy()
    df["history"] = df["history"].apply(_deserialize_json).apply(_normalize_history)
    df["ocean_profile"] = df["ocean_profile"].apply(_deserialize_json).apply(_normalize_ocean_profile)
    df = df.drop_duplicates(subset=["case_id"], keep="last")
    df = df.sort_values("case_id").reset_index(drop=True)
    return df


def load_b3_cases():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Benchmark 3 case file not found at {DATASET_PATH}")

    with open(DATASET_PATH, "r", encoding="utf-8") as handle:
        raw_data = json.load(handle)

    if not isinstance(raw_data, list):
        raise ValueError(f"Unexpected B3 case format in {DATASET_PATH}: expected top-level list.")

    normalized_rows = [_normalize_case_record(record) for record in raw_data]
    cases_df = _normalize_cases_df(pd.DataFrame(normalized_rows))
    validate_b3_cases(cases_df)

    csv_df = cases_df.copy()
    for column in JSON_COLUMNS:
        csv_df[column] = csv_df[column].apply(_serialize_json)
    csv_df.to_csv(LOADED_CASES_PATH, index=False)
    return cases_df


def validate_b3_cases(cases_df):
    if len(cases_df) != EXPECTED_CASE_COUNT:
        raise ValueError(f"Benchmark 3 expects {EXPECTED_CASE_COUNT} cases, found {len(cases_df)}.")

    if set(cases_df["case_type"]) != set(CASE_ORDER):
        raise ValueError(f"Benchmark 3 case_type values must be {CASE_ORDER}.")

    if set(cases_df["expected_route"]) != set(CASE_ORDER):
        raise ValueError(f"Benchmark 3 expected_route values must be {CASE_ORDER}.")

    counts = cases_df["case_type"].value_counts().to_dict()
    for case_type in CASE_ORDER:
        if counts.get(case_type, 0) != EXPECTED_CASES_PER_TYPE:
            raise ValueError(
                f"Benchmark 3 expects {EXPECTED_CASES_PER_TYPE} {case_type} cases, found {counts.get(case_type, 0)}."
            )


def require_memory_for_b3(system):
    if not system.memory or not system.memory.driver:
        raise RuntimeError("Benchmark 3 requires Neo4j-backed memory to seed history and OCEAN profiles.")


def clean_b3_users(system):
    if not system.memory or not system.memory.driver:
        print("No Neo4j connection, skipping Benchmark 3 user cleanup.")
        return

    query = "MATCH (u:User) WHERE u.id STARTS WITH 'bench_b3_' DETACH DELETE u"
    with system.memory.driver.session() as session:
        result = session.run(query)
        summary = result.consume()
    print(f"Cleaned {summary.counters.nodes_deleted} Neo4j nodes for Benchmark 3 users.")


def delete_b3_user(system, user_id):
    if not system.memory or not system.memory.driver:
        return

    query = "MATCH (u:User {id: $user_id}) DETACH DELETE u"
    with system.memory.driver.session() as session:
        session.run(query, user_id=user_id)


def build_b3_user_id(case_id):
    return f"bench_b3_{case_id}"


def replay_b3_history(system, user_id, history):
    if not system.memory or not system.memory.driver:
        return {"replayed_turns": 0, "skipped_fragments": 0}

    replayed_turns = 0
    skipped_fragments = 0
    pending_user = None

    for item in history:
        if not isinstance(item, dict):
            skipped_fragments += 1
            continue

        speaker = str(item.get("speaker", "")).strip().lower()
        text = str(item.get("text", "")).strip()

        if not text:
            skipped_fragments += 1
            continue

        if speaker == "user":
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
            continue

        if speaker == "assistant":
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
            continue

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


def seed_b3_ocean_profile(system, user_id, ocean_profile, narrative=""):
    if not system.memory or not system.memory.driver:
        raise RuntimeError("Cannot seed Benchmark 3 OCEAN profile without Neo4j memory connection.")

    profile = _normalize_ocean_profile(ocean_profile)
    query = """
    MERGE (u:User {id: $user_id})
    MERGE (u)-[:HAS_PROFILE]->(p:Profile)
    SET p.openness = $openness,
        p.conscientiousness = $conscientiousness,
        p.extraversion = $extraversion,
        p.agreeableness = $agreeableness,
        p.neuroticism = $neuroticism,
        p.narrative = $narrative,
        p.last_updated = $timestamp
    """
    with system.memory.driver.session() as session:
        session.run(
            query,
            user_id=user_id,
            narrative=narrative,
            timestamp=int(time.time()),
            **profile,
        )
    return profile


def _is_non_default_ocean(profile):
    return any(abs(float(profile.get(key, 0.5)) - 0.5) > 1e-9 for key in DEFAULT_OCEAN)


def _profile_to_string(profile):
    return ", ".join(f"{key}: {profile[key]}" for key in DEFAULT_OCEAN)


def normalize_predicted_route(decisions):
    use_memory = bool(decisions.get("use_memory"))
    use_ocean = bool(decisions.get("use_ocean"))
    anomaly = ""

    if use_memory and use_ocean:
        use_ocean = False
        anomaly = "both_secondaries_true_preferred_memory"

    if use_memory:
        route = "memory"
    elif use_ocean:
        route = "ocean"
    else:
        route = "rag_only"

    return route, use_memory, use_ocean, anomaly


def run_router_predictions(system, cases_df):
    rows = []

    for idx, case_row in cases_df.iterrows():
        case_data = case_row.to_dict()
        user_id = build_b3_user_id(case_data["case_id"])
        delete_b3_user(system, user_id)

        replay_info = {"replayed_turns": 0, "skipped_fragments": 0}
        if case_data["case_type"] == "memory":
            replay_info = replay_b3_history(system, user_id, case_data["history"])
        elif case_data["case_type"] == "ocean":
            seed_b3_ocean_profile(system, user_id, case_data["ocean_profile"], narrative="")

        has_history = bool(system.memory.get_context(user_id))
        profile = system.memory.get_user_profile(user_id)
        has_ocean = _is_non_default_ocean(profile)
        try:
            narrative = system.memory.get_narrative_profile(user_id)
        except Exception:
            narrative = ""
        ocean_profile_str = _profile_to_string(profile)

        decisions = system.router.decide(
            case_data["current_message"],
            case_data["emotion"],
            has_history,
            has_ocean,
            narrative=narrative,
            ocean_profile=ocean_profile_str,
        )

        predicted_route, norm_use_memory, norm_use_ocean, anomaly = normalize_predicted_route(decisions)
        is_correct = int(predicted_route == case_data["expected_route"])

        rows.append(
            {
                "case_id": case_data["case_id"],
                "case_type": case_data["case_type"],
                "current_message": case_data["current_message"],
                "emotion": case_data["emotion"],
                "expected_route": case_data["expected_route"],
                "predicted_route": predicted_route,
                "use_rag": bool(decisions.get("use_rag", True)),
                "use_memory": norm_use_memory,
                "use_ocean": norm_use_ocean,
                "reasoning": str(decisions.get("reasoning", "")),
                "is_correct": is_correct,
                "why": case_data["why"],
                "has_history": has_history,
                "has_ocean": has_ocean,
                "narrative": narrative,
                "ocean_profile_str": ocean_profile_str,
                "anomaly": anomaly,
                "replayed_turns": replay_info["replayed_turns"],
                "skipped_fragments": replay_info["skipped_fragments"],
            }
        )
        print(
            f"[{idx + 1}/{len(cases_df)}] case_id={case_data['case_id']} "
            f"| expected={case_data['expected_route']} | predicted={predicted_route}"
        )

    predictions_df = pd.DataFrame(rows, columns=PREDICTION_COLUMNS)
    predictions_df.to_csv(PREDICTIONS_PATH, index=False)
    return predictions_df


def _safe_divide(numerator, denominator):
    if denominator == 0:
        return 0.0
    return float(numerator) / float(denominator)


def build_confusion_matrix(predictions_df):
    rows = []
    for true_label in CASE_ORDER:
        for predicted_label in CASE_ORDER:
            count = int(
                (
                    (predictions_df["expected_route"] == true_label)
                    & (predictions_df["predicted_route"] == predicted_label)
                ).sum()
            )
            rows.append(
                {
                    "true_label": true_label,
                    "predicted_label": predicted_label,
                    "count": count,
                }
            )
    confusion_df = pd.DataFrame(rows)
    confusion_df.to_csv(CONFUSION_PATH, index=False)
    return confusion_df


def build_classification_report(predictions_df):
    rows = []
    for label in CASE_ORDER:
        tp = int(((predictions_df["expected_route"] == label) & (predictions_df["predicted_route"] == label)).sum())
        fp = int(((predictions_df["expected_route"] != label) & (predictions_df["predicted_route"] == label)).sum())
        fn = int(((predictions_df["expected_route"] == label) & (predictions_df["predicted_route"] != label)).sum())
        support = int((predictions_df["expected_route"] == label).sum())

        precision = _safe_divide(tp, tp + fp)
        recall = _safe_divide(tp, tp + fn)
        f1 = _safe_divide(2 * precision * recall, precision + recall)

        rows.append(
            {
                "class_label": label,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "support": support,
            }
        )

    report_df = pd.DataFrame(rows)
    report_df.to_csv(CLASSIFICATION_PATH, index=False)
    return report_df


def build_summary(predictions_df, report_df):
    rows = [
        {
            "scope": "overall",
            "label": "all",
            "metric": "accuracy",
            "value": float(predictions_df["is_correct"].mean()),
        },
        {
            "scope": "overall",
            "label": "all",
            "metric": "macro_f1",
            "value": float(report_df["f1"].mean()),
        },
    ]

    for case_type, case_df in predictions_df.groupby("case_type"):
        rows.append(
            {
                "scope": "by_case_type",
                "label": case_type,
                "metric": "accuracy",
                "value": float(case_df["is_correct"].mean()),
            }
        )

    summary_df = pd.DataFrame(rows)
    summary_df.to_csv(SUMMARY_PATH, index=False)
    return summary_df


def build_error_analysis(predictions_df):
    error_df = predictions_df[predictions_df["is_correct"] == 0].copy()
    error_df.to_csv(ERROR_ANALYSIS_PATH, index=False)
    return error_df


def plot_outputs(confusion_df, report_df):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    confusion_matrix = (
        confusion_df.pivot(index="true_label", columns="predicted_label", values="count")
        .reindex(index=CASE_ORDER, columns=CASE_ORDER)
        .fillna(0)
    )

    fig, ax = plt.subplots(figsize=(6, 5))
    image = ax.imshow(confusion_matrix.values, cmap="Blues")
    ax.set_xticks(range(len(CASE_ORDER)))
    ax.set_xticklabels(CASE_ORDER)
    ax.set_yticks(range(len(CASE_ORDER)))
    ax.set_yticklabels(CASE_ORDER)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Benchmark 3 Confusion Matrix")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)

    for row_idx in range(len(CASE_ORDER)):
        for col_idx in range(len(CASE_ORDER)):
            ax.text(
                col_idx,
                row_idx,
                int(confusion_matrix.iloc[row_idx, col_idx]),
                ha="center",
                va="center",
                color="black",
            )

    plt.tight_layout()
    fig.savefig(CONFUSION_PLOT_PATH, dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(report_df["class_label"], report_df["recall"], color=["#6C8EAD", "#D3A252", "#7F7AA8"])
    ax.set_ylim(0, 1.0)
    ax.set_xlabel("Route")
    ax.set_ylabel("Recall")
    ax.set_title("Benchmark 3 Per-Class Accuracy")

    for idx, value in enumerate(report_df["recall"]):
        ax.annotate(
            f"{value:.3f}",
            xy=(idx, value),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=9,
        )

    plt.tight_layout()
    fig.savefig(PER_CLASS_PLOT_PATH, dpi=150)
    plt.close(fig)


def finalize_b3_outputs():
    if not os.path.exists(PREDICTIONS_PATH):
        raise ValueError(f"No Benchmark 3 predictions found at {PREDICTIONS_PATH}")

    predictions_df = pd.read_csv(PREDICTIONS_PATH)
    confusion_df = build_confusion_matrix(predictions_df)
    report_df = build_classification_report(predictions_df)
    summary_df = build_summary(predictions_df, report_df)
    error_df = build_error_analysis(predictions_df)
    plot_outputs(confusion_df, report_df)
    return {
        "predictions": predictions_df,
        "confusion": confusion_df,
        "classification_report": report_df,
        "summary": summary_df,
        "error_analysis": error_df,
    }
