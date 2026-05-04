import os
import sys
import time
import json
from dataclasses import asdict
from typing import Iterable

import numpy as np
import pandas as pd
from openai import OpenAI
from scipy.stats import wilcoxon


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "results", "b1_500")

GENERATED_PATH = os.path.join(OUTPUT_DIR, "generated_responses_b1_500.csv")
SEEKERS_PATH = os.path.join(OUTPUT_DIR, "test_seekers_b1_500.csv")
SCORED_PATH = os.path.join(OUTPUT_DIR, "scored_responses_b1_500.csv")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "summary_results_b1_500.csv")
SUMMARY_BY_MODE_PATH = os.path.join(OUTPUT_DIR, "summary_results_b1_500_by_mode.csv")
STATS_PATH = os.path.join(OUTPUT_DIR, "statistical_tests_b1_500.csv")
ROUTER_DECISIONS_PATH = os.path.join(OUTPUT_DIR, "router_decisions_b1_500.csv")
ROUTER_ANALYSIS_PATH = os.path.join(OUTPUT_DIR, "router_analysis_b1_500.csv")
SAFETY_ANALYSIS_PATH = os.path.join(OUTPUT_DIR, "safety_analysis_b1_500.csv")
PLOT_PATH = os.path.join(OUTPUT_DIR, "results_b1_500.png")

SAMPLE_SIZE = 500
RANDOM_SEED = 42
CHECKPOINT_EVERY = 25
DEFAULT_BENCHMARK_MODE = "clean"
BENCHMARK_MODES = ("clean", "overload")
DEFAULT_EXPECTED_ROUTE = "rag_only"

CONFIG_ORDER = [
    "Human (Reddit)",
    "Baseline",
    "RAG",
    "RAG+Memory",
    "RAG+OCEAN",
    "Agentic",
    "Full pipeline",
]

RUN_CONFIGS = [
    "Baseline",
    "RAG",
    "RAG+Memory",
    "RAG+OCEAN",
    "Agentic",
    "Full pipeline",
]

B1_USER_PREFIXES = (
    "bench_b1_clean_",
    "bench_b1_overload_",
    "bench_b1_rag",
)
OVERLOAD_CASE_TYPES = ("memory_irrelevant", "ocean_irrelevant", "conflict")

SEEKER_COLUMNS = [
    "sp_id",
    "seeker_post",
    "benchmark_mode",
    "overload_case_type",
    "expected_route",
    "seed_memory_json",
    "seed_ocean_json",
    "seed_narrative",
    "why_secondary_should_be_ignored",
]

GENERATED_COLUMNS = [
    "sp_id",
    "seeker_post",
    "benchmark_mode",
    "overload_case_type",
    "expected_route",
    "why_secondary_should_be_ignored",
    "config",
    "response",
    "emotion",
    "risk_type",
    "risk_level",
    "use_rag",
    "use_memory",
    "use_ocean",
    "reasoning",
]

SCORED_COLUMNS = [
    "sp_id",
    "benchmark_mode",
    "config",
    "seeker_post",
    "response",
    "emotion",
    "risk_type",
    "risk_level",
    "ER_score",
    "IP_score",
    "EX_score",
    "total_score",
]


def normalize_benchmark_mode(benchmark_mode: str | None) -> str:
    mode = (benchmark_mode or DEFAULT_BENCHMARK_MODE).strip().lower()
    if mode not in BENCHMARK_MODES:
        raise ValueError(f"Unsupported benchmark_mode={benchmark_mode!r}. Expected one of {BENCHMARK_MODES}.")
    return mode


def get_b1_sample_size() -> int:
    raw_value = os.getenv("B1_SAMPLE_SIZE")
    if not raw_value:
        return SAMPLE_SIZE
    sample_size = int(raw_value)
    if sample_size <= 0:
        raise ValueError(f"B1_SAMPLE_SIZE must be positive, got {sample_size}.")
    return sample_size


def get_b1_seekers_path() -> str:
    return os.getenv("B1_SEEKERS_PATH") or SEEKERS_PATH


def get_mode_specific_path(path: str, benchmark_mode: str) -> str:
    mode = normalize_benchmark_mode(benchmark_mode)
    root, ext = os.path.splitext(path)
    return f"{root}_{mode}{ext}"


def filter_to_benchmark_mode(df: pd.DataFrame | None, benchmark_mode: str, *, df_name: str) -> pd.DataFrame:
    mode = normalize_benchmark_mode(benchmark_mode)
    if df is None or df.empty:
        return df.copy() if df is not None else pd.DataFrame()
    if "benchmark_mode" not in df.columns:
        raise ValueError(f"{df_name} is missing required 'benchmark_mode' column.")
    filtered = df[df["benchmark_mode"] == mode].copy()
    if filtered.empty:
        raise ValueError(f"No {df_name} rows found for benchmark_mode={mode!r}.")
    return filtered


def setup_paths():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)
    if SCRIPT_DIR not in sys.path:
        sys.path.insert(0, SCRIPT_DIR)
    os.chdir(BACKEND_DIR)


def compute_human_baseline():
    er = pd.read_csv(os.path.join(BACKEND_DIR, "data", "epitome", "emotional-reactions-reddit.csv"))
    ip = pd.read_csv(os.path.join(BACKEND_DIR, "data", "epitome", "interpretations-reddit.csv"))
    ex = pd.read_csv(os.path.join(BACKEND_DIR, "data", "epitome", "explorations-reddit.csv"))
    baseline = {
        "benchmark_mode": "overall",
        "config": "Human (Reddit)",
        "N": int(min(len(er), len(ip), len(ex))),
        "ER": er["level"].mean(),
        "IP": ip["level"].mean(),
        "EX": ex["level"].mean(),
    }
    baseline["Total"] = baseline["ER"] + baseline["IP"] + baseline["EX"]
    baseline["ER_std"] = er["level"].std(ddof=1)
    baseline["IP_std"] = ip["level"].std(ddof=1)
    baseline["EX_std"] = ex["level"].std(ddof=1)
    baseline["Total_std"] = np.nan
    return baseline


def _default_overload_case_type(index: int) -> str:
    return OVERLOAD_CASE_TYPES[index % len(OVERLOAD_CASE_TYPES)]


def _default_seed_memory(index: int) -> str:
    packs = [
        [
            {
                "emotion": "anxious",
                "user_input": "I keep overthinking whether I sounded awkward in class discussions.",
                "ai_response": "That kind of replaying can be exhausting when you are already tense.",
            },
            {
                "emotion": "sad",
                "user_input": "I still feel embarrassed about how distant I got with an old friend.",
                "ai_response": "That lingering embarrassment can make new interactions feel heavy.",
            },
        ],
        [
            {
                "emotion": "neutral",
                "user_input": "My sleep schedule keeps drifting later and it throws off the whole next day.",
                "ai_response": "When sleep slips, it can affect everything else more than people expect.",
            },
            {
                "emotion": "fearful",
                "user_input": "I worry people will stop replying if I ask for support too often.",
                "ai_response": "It makes sense that fear would make reaching out feel risky.",
            },
        ],
        [
            {
                "emotion": "confusion",
                "user_input": "I want advice, but I also want space and that feels contradictory.",
                "ai_response": "Those needs can coexist, especially when you are overwhelmed.",
            },
            {
                "emotion": "anxious",
                "user_input": "Deadlines pile up fast when I start avoiding one task after another.",
                "ai_response": "Avoidance can snowball and make everything feel larger than it is.",
            },
        ],
    ]
    return json.dumps(packs[index % len(packs)], separators=(",", ":"))


def _default_seed_ocean(index: int) -> str:
    profiles = [
        {
            "openness": 0.81,
            "conscientiousness": 0.29,
            "extraversion": 0.22,
            "agreeableness": 0.76,
            "neuroticism": 0.84,
        },
        {
            "openness": 0.34,
            "conscientiousness": 0.88,
            "extraversion": 0.62,
            "agreeableness": 0.41,
            "neuroticism": 0.27,
        },
        {
            "openness": 0.68,
            "conscientiousness": 0.44,
            "extraversion": 0.19,
            "agreeableness": 0.71,
            "neuroticism": 0.79,
        },
    ]
    return json.dumps(profiles[index % len(profiles)], separators=(",", ":"))


def _default_seed_narrative(case_type: str) -> str:
    if case_type == "memory_irrelevant":
        return (
            "Past stored memories point to unrelated academic stress and friendship rumination, "
            "but the current post should still be answered from the post itself."
        )
    if case_type == "ocean_irrelevant":
        return (
            "The stored personality profile is intentionally non-default but should not override "
            "the concrete needs expressed in the current seeker post."
        )
    return (
        "Both stored memory and personality cues are deliberately plausible but secondary; the "
        "current seeker post should still dominate routing and response strategy."
    )


def _default_secondary_reason(case_type: str) -> str:
    if case_type == "memory_irrelevant":
        return "Seeded memory is coherent but off-topic, so retrieval should not outrank the current post."
    if case_type == "ocean_irrelevant":
        return "Seeded personality traits are non-default but should not outweigh the user’s immediate context."
    return "Secondary memory and personality cues conflict with the current post and should both be deprioritized."


def _normalize_seeker_df(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame(columns=SEEKER_COLUMNS)

    df = df.copy()
    for column in SEEKER_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[SEEKER_COLUMNS].copy()
    df["sp_id"] = df["sp_id"].astype(str)
    df["seeker_post"] = df["seeker_post"].astype(str)
    df["benchmark_mode"] = df["benchmark_mode"].fillna("").astype(str).str.lower()

    invalid_modes = sorted(mode for mode in df["benchmark_mode"].unique() if mode and mode not in BENCHMARK_MODES)
    if invalid_modes:
        raise ValueError(f"Unsupported seeker benchmark_mode values: {invalid_modes}")

    for idx in df.index:
        benchmark_mode = df.at[idx, "benchmark_mode"]
        case_type = df.at[idx, "overload_case_type"]
        if benchmark_mode == "overload":
            if pd.isna(case_type) or str(case_type).strip() == "":
                case_type = _default_overload_case_type(idx)
            case_type = str(case_type).strip().lower()
            if case_type not in OVERLOAD_CASE_TYPES:
                raise ValueError(f"Unsupported overload_case_type={case_type!r} for sp_id={df.at[idx, 'sp_id']}")
            df.at[idx, "overload_case_type"] = case_type

            if pd.isna(df.at[idx, "expected_route"]) or str(df.at[idx, "expected_route"]).strip() == "":
                df.at[idx, "expected_route"] = DEFAULT_EXPECTED_ROUTE
            if pd.isna(df.at[idx, "seed_memory_json"]) or str(df.at[idx, "seed_memory_json"]).strip() == "":
                df.at[idx, "seed_memory_json"] = _default_seed_memory(idx)
            if pd.isna(df.at[idx, "seed_ocean_json"]) or str(df.at[idx, "seed_ocean_json"]).strip() == "":
                df.at[idx, "seed_ocean_json"] = _default_seed_ocean(idx)
            if pd.isna(df.at[idx, "seed_narrative"]) or str(df.at[idx, "seed_narrative"]).strip() == "":
                df.at[idx, "seed_narrative"] = _default_seed_narrative(case_type)
            if pd.isna(df.at[idx, "why_secondary_should_be_ignored"]) or str(df.at[idx, "why_secondary_should_be_ignored"]).strip() == "":
                df.at[idx, "why_secondary_should_be_ignored"] = _default_secondary_reason(case_type)
        else:
            df.at[idx, "overload_case_type"] = None if pd.isna(case_type) or str(case_type).strip() == "" else str(case_type).strip().lower()
            if pd.isna(df.at[idx, "expected_route"]) or str(df.at[idx, "expected_route"]).strip() == "":
                df.at[idx, "expected_route"] = None
            for column in ["seed_memory_json", "seed_ocean_json", "seed_narrative", "why_secondary_should_be_ignored"]:
                if pd.isna(df.at[idx, column]) or str(df.at[idx, column]).strip() == "":
                    df.at[idx, column] = None

    return df.reset_index(drop=True)


def load_or_create_seeker_set(sample_size: int | None = None, seekers_path: str | None = None):
    sample_size = sample_size or get_b1_sample_size()
    seekers_path = seekers_path or get_b1_seekers_path()

    if os.path.exists(seekers_path):
        df = _normalize_seeker_df(pd.read_csv(seekers_path))
        if df["sp_id"].nunique() == sample_size:
            return df
        if seekers_path != SEEKERS_PATH:
            raise ValueError(
                f"Custom B1_SEEKERS_PATH={seekers_path!r} has {df['sp_id'].nunique()} unique rows; expected {sample_size}."
            )

    er_path = os.path.join(BACKEND_DIR, "data", "epitome", "emotional-reactions-reddit.csv")
    seekers = pd.read_csv(er_path)
    seekers = seekers[["sp_id", "seeker_post"]].drop_duplicates(subset="sp_id")
    seekers = seekers.sample(n=sample_size, random_state=RANDOM_SEED).sort_values("sp_id").reset_index(drop=True)
    seekers = _normalize_seeker_df(seekers)
    seekers.to_csv(seekers_path, index=False)
    return seekers


def select_seekers_for_mode(seekers_df: pd.DataFrame, benchmark_mode: str) -> pd.DataFrame:
    benchmark_mode = normalize_benchmark_mode(benchmark_mode)
    seekers_df = _normalize_seeker_df(seekers_df)

    if benchmark_mode == "overload":
        overload_rows = seekers_df[seekers_df["benchmark_mode"] == "overload"].copy()
        if not overload_rows.empty:
            return overload_rows.reset_index(drop=True)
        raise ValueError(
            "No overload rows found in seeker set. Set B1_SEEKERS_PATH to an overload pilot CSV or provide "
            "rows with benchmark_mode=overload."
        )

    if benchmark_mode == "clean":
        clean_rows = seekers_df[seekers_df["benchmark_mode"] == "clean"].copy()
        if not clean_rows.empty:
            return clean_rows.reset_index(drop=True)

    return seekers_df.drop_duplicates(subset="sp_id", keep="first").reset_index(drop=True)


def get_b1_output_paths() -> list[str]:
    paths = [
        GENERATED_PATH,
        SEEKERS_PATH,
        SCORED_PATH,
        SUMMARY_PATH,
        SUMMARY_BY_MODE_PATH,
        STATS_PATH,
        ROUTER_DECISIONS_PATH,
        ROUTER_ANALYSIS_PATH,
        SAFETY_ANALYSIS_PATH,
        PLOT_PATH,
        os.path.join(OUTPUT_DIR, "results_b1_500_clean.png"),
        os.path.join(OUTPUT_DIR, "results_b1_500_overload.png"),
    ]
    for benchmark_mode in BENCHMARK_MODES:
        paths.extend([
            get_mode_specific_path(SCORED_PATH, benchmark_mode),
            get_mode_specific_path(SUMMARY_PATH, benchmark_mode),
            get_mode_specific_path(SUMMARY_BY_MODE_PATH, benchmark_mode),
            get_mode_specific_path(STATS_PATH, benchmark_mode),
            get_mode_specific_path(ROUTER_DECISIONS_PATH, benchmark_mode),
            get_mode_specific_path(ROUTER_ANALYSIS_PATH, benchmark_mode),
            get_mode_specific_path(SAFETY_ANALYSIS_PATH, benchmark_mode),
        ])
    return paths


def clean_benchmark_users(system, prefixes: Iterable[str] | None = None) -> dict:
    prefixes = tuple(prefixes or B1_USER_PREFIXES)
    if not system.memory or not system.memory.driver:
        print("No Neo4j connection, skipping benchmark-user cleanup.")
        return {"prefixes": list(prefixes), "users_deleted": 0, "nodes_deleted": 0}

    query = """
    MATCH (u:User)
    WHERE any(prefix IN $prefixes WHERE u.id STARTS WITH prefix)
    WITH collect(u.id) AS user_ids, collect(u) AS users
    FOREACH (node IN users | DETACH DELETE node)
    RETURN user_ids
    """
    with system.memory.driver.session() as session:
        result = session.run(query, prefixes=list(prefixes))
        record = result.single()
        summary = result.consume()

    user_ids = record["user_ids"] if record and record["user_ids"] else []
    print(
        "Cleaned B1 benchmark users: "
        f"{len(user_ids)} users, {summary.counters.nodes_deleted} nodes "
        f"for prefixes {', '.join(prefixes)}"
    )
    return {
        "prefixes": list(prefixes),
        "users_deleted": len(user_ids),
        "deleted_user_ids": user_ids,
        "nodes_deleted": summary.counters.nodes_deleted,
    }


def build_benchmark_user_id(benchmark_mode: str, config: str, sp_id: str) -> str:
    mode = normalize_benchmark_mode(benchmark_mode)
    slug_map = {
        "RAG": "rag",
        "RAG+Memory": "ragmem",
        "RAG+OCEAN": "ragocean",
        "Agentic": "agentic",
        "Full pipeline": "full",
    }
    slug = slug_map[config]
    if config == "RAG" and mode == "clean":
        return f"bench_b1_clean_rag_{sp_id}"
    return f"bench_b1_{mode}_{slug}_{sp_id}"


def _normalize_generated_df(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=GENERATED_COLUMNS)

    df = df.copy()
    if "benchmark_mode" not in df.columns:
        df["benchmark_mode"] = DEFAULT_BENCHMARK_MODE
    if "overload_case_type" not in df.columns:
        df["overload_case_type"] = None
    if "expected_route" not in df.columns:
        df["expected_route"] = None
    if "why_secondary_should_be_ignored" not in df.columns:
        df["why_secondary_should_be_ignored"] = None

    for column in GENERATED_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[GENERATED_COLUMNS].copy()
    df["benchmark_mode"] = df["benchmark_mode"].fillna(DEFAULT_BENCHMARK_MODE).astype(str).str.lower()
    df = df.drop_duplicates(subset=["benchmark_mode", "sp_id", "config"], keep="last")
    return df


def _normalize_scored_df(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=SCORED_COLUMNS)

    df = df.copy()
    if "benchmark_mode" not in df.columns:
        df["benchmark_mode"] = DEFAULT_BENCHMARK_MODE

    for column in SCORED_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df = df[SCORED_COLUMNS].copy()
    df["benchmark_mode"] = df["benchmark_mode"].fillna(DEFAULT_BENCHMARK_MODE).astype(str).str.lower()
    df = df.drop_duplicates(subset=["benchmark_mode", "sp_id", "config"], keep="last")
    return df


def load_existing_generated():
    if not os.path.exists(GENERATED_PATH):
        return pd.DataFrame(columns=GENERATED_COLUMNS)
    return _normalize_generated_df(pd.read_csv(GENERATED_PATH))


def _save_generated_checkpoint(df):
    df = _normalize_generated_df(df)
    df = df.sort_values(["benchmark_mode", "sp_id", "config"]).reset_index(drop=True)
    df.to_csv(GENERATED_PATH, index=False)
    build_router_decisions(df).to_csv(ROUTER_DECISIONS_PATH, index=False)


def build_router_decisions(generated_df):
    agentic = generated_df[generated_df["config"] == "Agentic"].copy()
    if agentic.empty:
        return pd.DataFrame(columns=[
            "benchmark_mode",
            "sp_id",
            "overload_case_type",
            "expected_route",
            "emotion",
            "use_rag",
            "use_memory",
            "use_ocean",
            "reasoning",
            "risk_type",
            "risk_level",
        ])

    cols = [
        "benchmark_mode",
        "sp_id",
        "overload_case_type",
        "expected_route",
        "emotion",
        "use_rag",
        "use_memory",
        "use_ocean",
        "reasoning",
        "risk_type",
        "risk_level",
    ]
    return (
        agentic[cols]
        .drop_duplicates(subset=["benchmark_mode", "sp_id"], keep="last")
        .sort_values(["benchmark_mode", "sp_id"])
        .reset_index(drop=True)
    )


def build_safety_analysis(generated_df):
    if generated_df.empty:
        return pd.DataFrame(columns=["scope", "benchmark_mode", "config", "risk_type", "risk_level", "count"])

    overall = generated_df.groupby(["config", "risk_type", "risk_level"]).size().reset_index(name="count")
    overall["scope"] = "overall"
    overall["benchmark_mode"] = "overall"

    by_mode = generated_df.groupby(["benchmark_mode", "config", "risk_type", "risk_level"]).size().reset_index(name="count")
    by_mode["scope"] = "by_benchmark_mode"

    safety = pd.concat([overall, by_mode], ignore_index=True, sort=False)
    safety["config"] = pd.Categorical(safety["config"], categories=RUN_CONFIGS, ordered=True)
    safety = safety.sort_values(["scope", "benchmark_mode", "config", "risk_type", "risk_level"]).reset_index(drop=True)
    return safety[["scope", "benchmark_mode", "config", "risk_type", "risk_level", "count"]]


def _baseline_response(client, seeker_post):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an empathetic support assistant. Respond warmly, clearly, and briefly. "
                    "Offer emotional support without sounding clinical."
                ),
            },
            {"role": "user", "content": seeker_post},
        ],
    )
    return completion.choices[0].message.content.strip()


async def _run_fixed_pipeline(
    system,
    seeker_post,
    user_id,
    emotion,
    use_memory,
    use_ocean,
    use_rag,
):
    safety = system.safety.classifier.classify(seeker_post, emotion, mode="messaging")

    if safety.risk_type == "self_harm_or_suicide":
        response = system.safety.policy.immediate_response(safety.risk_type, seeker_post, emotion)
        return response, asdict(safety), {
            "use_rag": False,
            "use_memory": False,
            "use_ocean": False,
            "reasoning": "safety override",
        }

    response = await system.process_brain(
        user_input=seeker_post,
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


def _row_from_result(
    sp_id,
    seeker_post,
    benchmark_mode,
    overload_case_type,
    expected_route,
    why_secondary_should_be_ignored,
    config,
    response,
    emotion,
    safety_info=None,
    routing_info=None,
):
    safety_info = safety_info or {}
    routing_info = routing_info or {}
    return {
        "sp_id": sp_id,
        "seeker_post": seeker_post,
        "benchmark_mode": benchmark_mode,
        "overload_case_type": overload_case_type,
        "expected_route": expected_route,
        "why_secondary_should_be_ignored": why_secondary_should_be_ignored,
        "config": config,
        "response": response,
        "emotion": emotion,
        "risk_type": safety_info.get("risk_type"),
        "risk_level": safety_info.get("risk_level"),
        "use_rag": routing_info.get("use_rag"),
        "use_memory": routing_info.get("use_memory"),
        "use_ocean": routing_info.get("use_ocean"),
        "reasoning": routing_info.get("reasoning"),
    }


def _parse_seed_memory(seed_memory_json: str) -> list[dict]:
    turns = json.loads(seed_memory_json)
    if not isinstance(turns, list) or not turns:
        raise ValueError("seed_memory_json must decode to a non-empty list of memory turns.")
    required = {"emotion", "user_input", "ai_response"}
    for turn in turns:
        if not isinstance(turn, dict) or not required.issubset(turn):
            raise ValueError("Each seed memory turn must include emotion, user_input, and ai_response.")
    return turns


def seed_overload_memory_context(system, user_id: str, seed_memory_json: str):
    if not system.memory or not system.memory.driver:
        return

    for turn in _parse_seed_memory(seed_memory_json):
        system.memory.add_turn(
            user_id=user_id,
            user_input=turn["user_input"],
            emotion=turn["emotion"],
            ai_response=turn["ai_response"],
            risk_level="low",
            risk_type="normal_support",
            raw_stored=True,
        )


def _parse_seed_ocean(seed_ocean_json: str) -> dict:
    profile = json.loads(seed_ocean_json)
    required = {"openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"}
    if not isinstance(profile, dict) or not required.issubset(profile):
        raise ValueError(
            "seed_ocean_json must decode to an object with openness, conscientiousness, "
            "extraversion, agreeableness, and neuroticism."
        )
    return profile


def seed_overload_ocean_profile(system, user_id: str, seed_ocean_json: str, seed_narrative: str):
    if not system.memory or not system.memory.driver:
        return
    profile = _parse_seed_ocean(seed_ocean_json)

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
            narrative=seed_narrative,
            timestamp=int(time.time()),
            **profile,
        )


def seed_overload_context(system, user_id: str, seeker_row: pd.Series):
    case_type = str(seeker_row["overload_case_type"]).strip().lower()
    if case_type not in OVERLOAD_CASE_TYPES:
        raise ValueError(f"Unsupported overload_case_type={case_type!r} for sp_id={seeker_row['sp_id']}")

    if case_type in {"memory_irrelevant", "conflict"}:
        seed_overload_memory_context(system, user_id, seeker_row["seed_memory_json"])
    if case_type in {"ocean_irrelevant", "conflict"}:
        seed_overload_ocean_profile(system, user_id, seeker_row["seed_ocean_json"], seeker_row["seed_narrative"])


def prepare_benchmark_user(system, benchmark_mode: str, config: str, seeker_row: pd.Series) -> str:
    mode = normalize_benchmark_mode(benchmark_mode)
    sp_id = seeker_row["sp_id"]
    user_id = build_benchmark_user_id(mode, config, sp_id)

    if mode == "overload":
        seed_overload_context(system, user_id, seeker_row)

    return user_id


async def generate_responses(system, seekers_df, benchmark_mode: str = DEFAULT_BENCHMARK_MODE):
    benchmark_mode = normalize_benchmark_mode(benchmark_mode)
    seekers_df = select_seekers_for_mode(seekers_df, benchmark_mode)
    client = OpenAI()
    generated_df = load_existing_generated()
    mode_existing = generated_df[generated_df["benchmark_mode"] == benchmark_mode].copy()
    existing_pairs = set(zip(mode_existing["sp_id"], mode_existing["config"]))

    new_post_count = 0
    t0 = time.time()

    for idx, seeker in seekers_df.iterrows():
        sp_id = seeker["sp_id"]
        seeker_post = seeker["seeker_post"]
        overload_case_type = seeker.get("overload_case_type")
        expected_route = seeker.get("expected_route")
        why_secondary_should_be_ignored = seeker.get("why_secondary_should_be_ignored")
        emotion = system.perception.detect_emotion(seeker_post).get("emotion", "neutral")
        inferred_safety = asdict(system.safety.classifier.classify(seeker_post, emotion, mode="messaging"))

        new_rows = []
        print(f"[{benchmark_mode}] [{idx + 1}/{len(seekers_df)}] sp_id={sp_id} | emotion={emotion}")

        for config in RUN_CONFIGS:
            pair = (sp_id, config)
            if pair in existing_pairs:
                continue

            if config == "Baseline":
                response = _baseline_response(client, seeker_post)
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        inferred_safety,
                    )
                )
                continue

            user_id = prepare_benchmark_user(system, benchmark_mode, config, seeker)

            if config == "RAG":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, seeker_post, user_id, emotion, False, False, True
                )
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        safety_info,
                        routing_info,
                    )
                )

            elif config == "RAG+Memory":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, seeker_post, user_id, emotion, True, False, True
                )
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        safety_info,
                        routing_info,
                    )
                )

            elif config == "RAG+OCEAN":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, seeker_post, user_id, emotion, False, True, True
                )
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        safety_info,
                        routing_info,
                    )
                )

            elif config == "Agentic":
                response, routing_info, safety_info = await system.process_brain_agentic(
                    seeker_post,
                    user_id,
                    emotion,
                    save_ai_response=False,
                    mode="messaging",
                )
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        safety_info,
                        routing_info,
                    )
                )

            elif config == "Full pipeline":
                response, safety_info, routing_info = await _run_fixed_pipeline(
                    system, seeker_post, user_id, emotion, True, True, True
                )
                routing_info["reasoning"] = "fixed full pipeline with safety constraints"
                new_rows.append(
                    _row_from_result(
                        sp_id,
                        seeker_post,
                        benchmark_mode,
                        overload_case_type,
                        expected_route,
                        why_secondary_should_be_ignored,
                        config,
                        response,
                        emotion,
                        safety_info,
                        routing_info,
                    )
                )

        if new_rows:
            generated_df = pd.concat([generated_df, pd.DataFrame(new_rows)], ignore_index=True)
            generated_df = _normalize_generated_df(generated_df)
            existing_pairs.update((row["sp_id"], row["config"]) for row in new_rows)
            new_post_count += 1

        if new_post_count and new_post_count % CHECKPOINT_EVERY == 0:
            _save_generated_checkpoint(generated_df)
            elapsed = time.time() - t0
            print(
                f"  [{benchmark_mode}] Checkpoint saved after {new_post_count} newly processed posts "
                f"({elapsed / 60:.1f}m elapsed)."
            )

    _save_generated_checkpoint(generated_df)
    build_safety_analysis(generated_df).to_csv(SAFETY_ANALYSIS_PATH, index=False)
    return generated_df


def score_generated_responses(generated_df, benchmark_mode: str | None = None):
    from epitome_scorer import EpitomeScorer

    generated_df = _normalize_generated_df(generated_df)
    if generated_df.empty:
        raise ValueError("No generated responses found to score.")
    if benchmark_mode is not None:
        generated_df = filter_to_benchmark_mode(generated_df, benchmark_mode, df_name="generated responses")

    if os.path.exists(SCORED_PATH):
        existing = _normalize_scored_df(pd.read_csv(SCORED_PATH))
    else:
        existing = pd.DataFrame(columns=SCORED_COLUMNS)

    scored_pairs = set(zip(existing["benchmark_mode"], existing["sp_id"], existing["config"]))
    generated_pairs = set(zip(generated_df["benchmark_mode"], generated_df["sp_id"], generated_df["config"]))

    if scored_pairs == generated_pairs:
        existing = existing.sort_values(["benchmark_mode", "sp_id", "config"]).reset_index(drop=True)
        if benchmark_mode is not None:
            mode_specific = filter_to_benchmark_mode(existing, benchmark_mode, df_name="scored responses")
            mode_specific.to_csv(get_mode_specific_path(SCORED_PATH, benchmark_mode), index=False)
            return mode_specific
        return existing

    scorer = EpitomeScorer(
        er_path=os.path.join(MODELS_DIR, "reddit_ER.pth"),
        ip_path=os.path.join(MODELS_DIR, "reddit_IP.pth"),
        ex_path=os.path.join(MODELS_DIR, "reddit_EX.pth"),
    )

    rows = []
    t0 = time.time()
    for row in generated_df.itertuples(index=False):
        pair = (row.benchmark_mode, row.sp_id, row.config)
        if pair in scored_pairs:
            continue

        scores = scorer.score(row.seeker_post, row.response)
        rows.append({
            "sp_id": row.sp_id,
            "benchmark_mode": row.benchmark_mode,
            "config": row.config,
            "seeker_post": row.seeker_post,
            "response": row.response,
            "emotion": row.emotion,
            "risk_type": row.risk_type,
            "risk_level": row.risk_level,
            "ER_score": scores["ER"],
            "IP_score": scores["IP"],
            "EX_score": scores["EX"],
            "total_score": scores["ER"] + scores["IP"] + scores["EX"],
        })

        if rows and len(rows) % 250 == 0:
            combined = pd.concat([existing, pd.DataFrame(rows)], ignore_index=True)
            combined = _normalize_scored_df(combined)
            combined.to_csv(SCORED_PATH, index=False)
            elapsed = time.time() - t0
            print(f"  Scoring checkpoint: {len(combined)}/{len(generated_df)} rows saved ({elapsed / 60:.1f}m elapsed).")

    combined = pd.concat([existing, pd.DataFrame(rows)], ignore_index=True)
    combined = _normalize_scored_df(combined)
    combined = combined.sort_values(["benchmark_mode", "sp_id", "config"]).reset_index(drop=True)
    combined.to_csv(SCORED_PATH, index=False)
    if benchmark_mode is not None:
        mode_specific = filter_to_benchmark_mode(combined, benchmark_mode, df_name="scored responses")
        mode_specific.to_csv(get_mode_specific_path(SCORED_PATH, benchmark_mode), index=False)
        return mode_specific
    return combined


def _summarize_group(df: pd.DataFrame) -> pd.DataFrame:
    return df.groupby("config").agg(
        N=("sp_id", "nunique"),
        ER=("ER_score", "mean"),
        IP=("IP_score", "mean"),
        EX=("EX_score", "mean"),
        Total=("total_score", "mean"),
        ER_std=("ER_score", "std"),
        IP_std=("IP_score", "std"),
        EX_std=("EX_score", "std"),
        Total_std=("total_score", "std"),
    ).reset_index()


def summarize_scores(scored_df, human_baseline, benchmark_mode: str | None = None):
    scored_df = _normalize_scored_df(scored_df)
    if benchmark_mode is not None:
        scored_df = filter_to_benchmark_mode(scored_df, benchmark_mode, df_name="scored responses")

    overall = _summarize_group(scored_df)
    overall["benchmark_mode"] = "overall"

    by_mode_frames = []
    for benchmark_mode, mode_df in scored_df.groupby("benchmark_mode"):
        summary = _summarize_group(mode_df)
        summary["benchmark_mode"] = benchmark_mode
        by_mode_frames.append(summary)

    by_mode = pd.concat(by_mode_frames, ignore_index=True) if by_mode_frames else pd.DataFrame(columns=overall.columns)

    overall_with_human = pd.concat([pd.DataFrame([human_baseline]), overall], ignore_index=True, sort=False)
    overall_with_human["config"] = pd.Categorical(overall_with_human["config"], categories=CONFIG_ORDER, ordered=True)
    overall_with_human = overall_with_human.sort_values("config").reset_index(drop=True)

    by_mode["config"] = pd.Categorical(by_mode["config"], categories=CONFIG_ORDER[1:], ordered=True)
    by_mode = by_mode.sort_values(["benchmark_mode", "config"]).reset_index(drop=True)

    overall_with_human.to_csv(SUMMARY_PATH, index=False)
    by_mode.to_csv(SUMMARY_BY_MODE_PATH, index=False)
    if benchmark_mode is not None:
        overall_with_human.to_csv(get_mode_specific_path(SUMMARY_PATH, benchmark_mode), index=False)
        by_mode.to_csv(get_mode_specific_path(SUMMARY_BY_MODE_PATH, benchmark_mode), index=False)
    return overall_with_human, by_mode


def run_statistical_tests(scored_df, benchmark_mode: str | None = None):
    scored_df = _normalize_scored_df(scored_df)
    if benchmark_mode is not None:
        scored_df = filter_to_benchmark_mode(scored_df, benchmark_mode, df_name="scored responses")

    comparisons = [
        ("Agentic", "Baseline"),
        ("Agentic", "Full pipeline"),
        ("RAG", "Baseline"),
        ("Full pipeline", "RAG"),
        ("Full pipeline", "Agentic"),
    ]
    metric_map = {
        "ER": "ER_score",
        "IP": "IP_score",
        "EX": "EX_score",
        "Total": "total_score",
    }

    rows = []
    if benchmark_mode is None:
        scopes = [("overall", scored_df)] + [
            (f"mode:{group_mode}", mode_df) for group_mode, mode_df in scored_df.groupby("benchmark_mode")
        ]
    else:
        scopes = [("overall", scored_df)]

    for scope, scope_df in scopes:
        scope_mode = "overall" if scope == "overall" else scope.split(":", 1)[1]
        for config_a, config_b in comparisons:
            subset = scope_df[scope_df["config"].isin([config_a, config_b])].copy()
            for metric, score_col in metric_map.items():
                pivot = subset.pivot(index="sp_id", columns="config", values=score_col).dropna()
                if pivot.empty:
                    continue

                diffs = pivot[config_a] - pivot[config_b]
                nonzero = int((diffs != 0).sum())
                if nonzero == 0:
                    p_value = 1.0
                    stat = 0.0
                else:
                    stat, p_value = wilcoxon(pivot[config_a], pivot[config_b], zero_method="wilcox")

                rows.append({
                    "scope": scope,
                    "benchmark_mode": scope_mode,
                    "config_a": config_a,
                    "config_b": config_b,
                    "metric": metric,
                    "test_name": "Wilcoxon signed-rank",
                    "p_value": p_value,
                    "statistic": stat,
                    "n_pairs": int(len(pivot)),
                    "n_nonzero_diffs": nonzero,
                    "mean_a": pivot[config_a].mean(),
                    "mean_b": pivot[config_b].mean(),
                    "mean_diff": diffs.mean(),
                })

    stats_df = pd.DataFrame(rows)
    stats_df.to_csv(STATS_PATH, index=False)
    if benchmark_mode is not None:
        stats_df.to_csv(get_mode_specific_path(STATS_PATH, benchmark_mode), index=False)
    return stats_df


def _combo_label(row):
    parts = []
    if bool(row.get("use_rag")):
        parts.append("RAG")
    if bool(row.get("use_memory")):
        parts.append("Memory")
    if bool(row.get("use_ocean")):
        parts.append("OCEAN")
    return "+".join(parts) if parts else "None"


def analyze_router(generated_df, benchmark_mode: str | None = None):
    generated_df = _normalize_generated_df(generated_df)
    if benchmark_mode is not None:
        generated_df = filter_to_benchmark_mode(generated_df, benchmark_mode, df_name="generated responses")

    router = generated_df[generated_df["config"] == "Agentic"].copy()
    if router.empty:
        analysis = pd.DataFrame(
            columns=[
                "scope",
                "benchmark_mode",
                "emotion",
                "risk_type",
                "overload_case_type",
                "combo",
                "count",
                "pct_of_scope",
            ]
        )
        analysis.to_csv(ROUTER_ANALYSIS_PATH, index=False)
        if benchmark_mode is not None:
            analysis.to_csv(get_mode_specific_path(ROUTER_ANALYSIS_PATH, benchmark_mode), index=False)
            build_router_decisions(generated_df).to_csv(
                get_mode_specific_path(ROUTER_DECISIONS_PATH, benchmark_mode), index=False
            )
        return analysis

    router["combo"] = router.apply(_combo_label, axis=1)

    rows = []

    overall = router["combo"].value_counts(dropna=False)
    total = len(router)
    for combo, count in overall.items():
        rows.append({
            "scope": "overall",
            "benchmark_mode": "overall",
            "emotion": None,
            "risk_type": None,
            "combo": combo,
            "count": int(count),
            "pct_of_scope": count / total,
        })

    for benchmark_mode, mode_df in router.groupby("benchmark_mode"):
        counts = mode_df["combo"].value_counts(dropna=False)
        denom = len(mode_df)
        for combo, count in counts.items():
            rows.append({
                "scope": "by_benchmark_mode",
                "benchmark_mode": benchmark_mode,
                "emotion": None,
                "risk_type": None,
                "combo": combo,
                "count": int(count),
                "pct_of_scope": count / denom,
            })

    for emotion, emo_df in router.groupby("emotion"):
        counts = emo_df["combo"].value_counts(dropna=False)
        denom = len(emo_df)
        for combo, count in counts.items():
            rows.append({
                "scope": "by_emotion",
                "benchmark_mode": "overall",
                "emotion": emotion,
                "risk_type": None,
                "combo": combo,
                "count": int(count),
                "pct_of_scope": count / denom,
            })

    if "risk_type" in router.columns:
        for risk_type, risk_df in router.groupby("risk_type"):
            counts = risk_df["combo"].value_counts(dropna=False)
            denom = len(risk_df)
            for combo, count in counts.items():
                rows.append({
                    "scope": "by_risk_type",
                    "benchmark_mode": "overall",
                    "emotion": None,
                    "risk_type": risk_type,
                    "combo": combo,
                    "count": int(count),
                    "pct_of_scope": count / denom,
                })

    if benchmark_mode == "overload" and "overload_case_type" in router.columns:
        for case_type, case_df in router.groupby("overload_case_type"):
            if pd.isna(case_type):
                continue
            counts = case_df["combo"].value_counts(dropna=False)
            denom = len(case_df)
            for combo, count in counts.items():
                rows.append({
                    "scope": "by_overload_case_type",
                    "benchmark_mode": "overload",
                    "emotion": None,
                    "risk_type": None,
                    "overload_case_type": case_type,
                    "combo": combo,
                    "count": int(count),
                    "pct_of_scope": count / denom,
                })

    analysis = pd.DataFrame(rows)
    analysis.to_csv(ROUTER_ANALYSIS_PATH, index=False)
    build_router_decisions(generated_df).to_csv(ROUTER_DECISIONS_PATH, index=False)
    if benchmark_mode is not None:
        analysis.to_csv(get_mode_specific_path(ROUTER_ANALYSIS_PATH, benchmark_mode), index=False)
        build_router_decisions(generated_df).to_csv(
            get_mode_specific_path(ROUTER_DECISIONS_PATH, benchmark_mode), index=False
        )
    return analysis


def _plot_summary_frame(summary_df: pd.DataFrame, output_path: str, title: str):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    metrics = ["ER", "IP", "EX", "Total"]
    x = np.arange(len(summary_df))
    width = 0.18
    colors = ["#4C72B0", "#55A868", "#C44E52", "#8172B2"]

    fig, ax = plt.subplots(figsize=(15, 7))
    for idx, metric in enumerate(metrics):
        bars = ax.bar(x + idx * width, summary_df[metric], width, label=metric, color=colors[idx])
        for bar in bars:
            height = bar.get_height()
            ax.annotate(
                f"{height:.2f}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=7,
            )

    ax.set_xlabel("Configuration")
    ax.set_ylabel("Mean score")
    ax.set_title(title)
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(summary_df["config"], rotation=15, ha="right")
    ax.legend()
    ax.set_ylim(0, max(summary_df["Total"].max() * 1.15, 2.5))
    plt.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def plot_summary(summary_df, summary_by_mode_df=None, benchmark_mode: str | None = None):
    title_suffix = "" if benchmark_mode is None else f" ({benchmark_mode})"
    _plot_summary_frame(summary_df, PLOT_PATH, f"Benchmark 1: EPITOME Empathy Results{title_suffix}")
    if benchmark_mode is not None:
        _plot_summary_frame(
            summary_df,
            get_mode_specific_path(PLOT_PATH, benchmark_mode),
            f"Benchmark 1: EPITOME Empathy Results ({benchmark_mode})",
        )

    if summary_by_mode_df is None or summary_by_mode_df.empty:
        return

    for summary_mode, mode_df in summary_by_mode_df.groupby("benchmark_mode"):
        mode_path = os.path.join(OUTPUT_DIR, f"results_b1_500_{summary_mode}.png")
        _plot_summary_frame(
            mode_df.reset_index(drop=True),
            mode_path,
            f"Benchmark 1: EPITOME Empathy Results ({summary_mode})",
        )


def finalize_outputs(benchmark_mode: str = DEFAULT_BENCHMARK_MODE):
    benchmark_mode = normalize_benchmark_mode(benchmark_mode)
    generated_df_all = load_existing_generated()
    if generated_df_all.empty:
        raise ValueError(f"No generated responses found at {GENERATED_PATH}")
    generated_df = filter_to_benchmark_mode(generated_df_all, benchmark_mode, df_name="generated responses")

    human_baseline = compute_human_baseline()
    scored_df = score_generated_responses(generated_df, benchmark_mode=benchmark_mode)
    summary_df, summary_by_mode_df = summarize_scores(scored_df, human_baseline, benchmark_mode=benchmark_mode)
    stats_df = run_statistical_tests(scored_df, benchmark_mode=benchmark_mode)
    router_analysis_df = analyze_router(generated_df, benchmark_mode=benchmark_mode)
    safety_df = build_safety_analysis(generated_df)
    safety_df.to_csv(SAFETY_ANALYSIS_PATH, index=False)
    safety_df.to_csv(get_mode_specific_path(SAFETY_ANALYSIS_PATH, benchmark_mode), index=False)
    plot_summary(summary_df, summary_by_mode_df, benchmark_mode=benchmark_mode)
    return {
        "generated": generated_df,
        "scored": scored_df,
        "summary": summary_df,
        "summary_by_mode": summary_by_mode_df,
        "stats": stats_df,
        "router_analysis": router_analysis_df,
        "safety_analysis": safety_df,
    }
