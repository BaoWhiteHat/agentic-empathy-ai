"""
SoulMate Pipeline Audit
Checks every agent and data connection for correctness.

Usage:
    cd backend
    uv run python audit_pipeline.py

Output: A clear PASS/FAIL/WARN report for every component.
"""

import os
import sys
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

# ── Helpers ────────────────────────────────────────────────────────────────

PASS  = "✅ PASS"
FAIL  = "❌ FAIL"
WARN  = "⚠️  WARN"
SKIP  = "⏭️  SKIP"

results = []

def report(name: str, status: str, detail: str = ""):
    icon = status
    line = f"  {icon}  {name}"
    if detail:
        line += f"\n         → {detail}"
    print(line)
    results.append({"name": name, "status": status, "detail": detail})

def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ── 1. ENVIRONMENT ──────────────────────────────────────────────────────────

section("1. ENVIRONMENT VARIABLES")

required_env = ["OPENAI_API_KEY", "NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"]
for key in required_env:
    val = os.environ.get(key)
    if val:
        report(f"ENV: {key}", PASS, f"Set ({val[:6]}...)")
    else:
        report(f"ENV: {key}", FAIL, "Missing from .env — agent will fail silently")


# ── 2. PROMPT TEMPLATE VARIABLES ───────────────────────────────────────────

section("2. PROMPT TEMPLATE — VARIABLE AUDIT")

try:
    from agent.prompts import SOULMATE_SYSTEM_PROMPT, SOULMATE_USER_PROMPT

    combined_prompt = SOULMATE_SYSTEM_PROMPT + SOULMATE_USER_PROMPT

    # Variables that dialogue.py passes into chain.invoke()
    expected_vars = [
        "user_input", "emotion", "memory", "long_term_profile",
        "rag_examples", "openness", "conscientiousness",
        "extraversion", "agreeableness", "neuroticism"
    ]

    for var in expected_vars:
        placeholder = "{" + var + "}"
        if placeholder in combined_prompt:
            report(f"PROMPT var: {{{var}}}", PASS, "Found in prompt template")
        else:
            report(
                f"PROMPT var: {{{var}}}", FAIL,
                f"NOT in prompt — dialogue.py passes it but it is silently discarded"
            )
except Exception as e:
    report("PROMPT import", FAIL, str(e))


# ── 3. PERCEPTION AGENT ────────────────────────────────────────────────────

section("3. PERCEPTION AGENT")

try:
    from agent.perception import PerceptionAgent
    perception = PerceptionAgent()
    report("PerceptionAgent: init", PASS)

    # Test emotion detection
    test_inputs = [
        ("I feel so sad and hopeless", "sad"),
        ("I'm so excited about my promotion!", "happy"),
        ("I'm really anxious about the exam", "anxious"),
    ]

    for text, expected_category in test_inputs:
        try:
            result = perception.detect_emotion(text)

            # Check return format
            if not isinstance(result, dict):
                report(
                    f"PerceptionAgent: detect_emotion()", FAIL,
                    f"Returns {type(result).__name__}, expected dict"
                )
                break

            # Find what key holds the emotion label
            emotion_val = result.get("emotion", result.get("label", result.get("emotion_label", None)))
            score_val   = result.get("score",   result.get("confidence", None))

            if emotion_val is None:
                report(
                    f"PerceptionAgent: return keys", FAIL,
                    f"No 'emotion' or 'label' key found. Actual keys: {list(result.keys())}"
                )
            else:
                report(
                    f"PerceptionAgent: '{text[:40]}...'", PASS,
                    f"emotion='{emotion_val}', score={score_val} | Keys: {list(result.keys())}"
                )
        except Exception as e:
            report(f"PerceptionAgent: detect_emotion()", FAIL, str(e))
            break

except Exception as e:
    report("PerceptionAgent: init", FAIL, str(e))


# ── 4. DIALOGUE AGENT ──────────────────────────────────────────────────────

section("4. DIALOGUE AGENT — RAG & OCEAN EFFECT TEST")

try:
    from agent.dialogue import DialogueAgent
    dialogue = DialogueAgent()
    report("DialogueAgent: init", PASS)

    base_kwargs = dict(
        user_input="I feel so stressed today",
        emotion="anxious",
        response_time="normal",
        memory="",
        long_term_profile="No history",
        rag_examples="",
        openness=0.5, conscientiousness=0.5,
        extraversion=0.5, agreeableness=0.5, neuroticism=0.5
    )

    # Test A: RAG effect
    r_no_rag = dialogue.generate_response(**{**base_kwargs, "rag_examples": ""})
    r_with_rag = dialogue.generate_response(**{
        **base_kwargs,
        "rag_examples": "Example: User felt overwhelmed → Supporter said: Let's break this down step by step. What's the biggest thing on your mind right now?"
    })

    if r_no_rag == r_with_rag:
        report(
            "DialogueAgent: RAG effect", FAIL,
            "Response identical with and without rag_examples — {rag_examples} is missing from prompt"
        )
    else:
        report("DialogueAgent: RAG effect", PASS, "Response changes when rag_examples is provided")

    # Test B: OCEAN effect (high vs low neuroticism)
    r_high_n = dialogue.generate_response(**{**base_kwargs, "neuroticism": 0.95})
    r_low_n  = dialogue.generate_response(**{**base_kwargs, "neuroticism": 0.05})

    if r_high_n == r_low_n:
        report(
            "DialogueAgent: OCEAN neuroticism effect", WARN,
            "Response identical for neuroticism=0.95 vs 0.05 — OCEAN adaptation may be too weak"
        )
    else:
        report("DialogueAgent: OCEAN neuroticism effect", PASS, "Response changes with different neuroticism")

    # Test C: Memory effect
    r_no_mem = dialogue.generate_response(**{**base_kwargs, "memory": ""})
    r_with_mem = dialogue.generate_response(**{
        **base_kwargs,
        "memory": "User previously said: I have a big exam tomorrow. User also mentioned: I haven't slept in 2 days."
    })

    if r_no_mem == r_with_mem:
        report(
            "DialogueAgent: Memory effect", WARN,
            "Response identical with and without memory context"
        )
    else:
        report("DialogueAgent: Memory effect", PASS, "Response changes when memory is provided")

    # Test D: Basic response sanity
    if len(r_no_rag) < 10:
        report("DialogueAgent: response length", FAIL, f"Response too short: '{r_no_rag}'")
    else:
        report("DialogueAgent: response sanity", PASS, f"Sample: '{r_no_rag[:80]}...'")

except Exception as e:
    report("DialogueAgent", FAIL, str(e))


# ── 5. INFERENCE AGENT ─────────────────────────────────────────────────────

section("5. INFERENCE AGENT — OCEAN SCORING")

try:
    from agent.inference import InferenceAgent
    inference = InferenceAgent()
    report("InferenceAgent: init", PASS)

    # Test infer_traits returns valid OCEAN dict
    result = inference.infer_traits(
        text="I'm so anxious and can't stop worrying",
        emotion="anxious",
        response_time="normal",
        past_profile="openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5"
    )

    ocean_keys = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]

    if not isinstance(result, dict):
        report("InferenceAgent: infer_traits return type", FAIL, f"Got {type(result).__name__}, expected dict")
    else:
        missing = [k for k in ocean_keys if k not in result]
        if missing:
            report("InferenceAgent: OCEAN keys", FAIL, f"Missing keys: {missing}")
        else:
            invalid = [k for k in ocean_keys if not (0.0 <= result[k] <= 1.0)]
            if invalid:
                report("InferenceAgent: score range", FAIL, f"Scores out of 0-1 range: {invalid}")
            else:
                report("InferenceAgent: infer_traits", PASS, f"Result: {result}")

        # Check neuroticism increases for anxious input
        if result.get("neuroticism", 0.5) > 0.5:
            report("InferenceAgent: neuroticism direction", PASS, "neuroticism > 0.5 for anxious input ✓")
        else:
            report(
                "InferenceAgent: neuroticism direction", WARN,
                f"Expected neuroticism > 0.5 for anxious input, got {result.get('neuroticism')}"
            )

except Exception as e:
    report("InferenceAgent", FAIL, str(e))


# ── 6. KNOWLEDGE AGENT (RAG) ───────────────────────────────────────────────

section("6. KNOWLEDGE AGENT — RAG RETRIEVAL")

try:
    from agent.knowledge import KnowledgeAgent
    knowledge = KnowledgeAgent(reset_db=False)
    report("KnowledgeAgent: init", PASS)

    # Test retrieval returns non-empty string
    result = knowledge.retrieve_examples(
        query_transcript="I feel so stressed and overwhelmed",
        current_emotion="anxious",
        k=3
    )

    if not result or not result.strip():
        report(
            "KnowledgeAgent: retrieve_examples", FAIL,
            "Returns empty string — ChromaDB may be empty or data not loaded"
        )
    elif len(result) < 50:
        report(
            "KnowledgeAgent: retrieve_examples", WARN,
            f"Result suspiciously short ({len(result)} chars): '{result}'"
        )
    else:
        report(
            "KnowledgeAgent: retrieve_examples", PASS,
            f"Returned {len(result)} chars | Preview: '{result[:100]}...'"
        )

    # Test different emotions return different results
    r_sad     = knowledge.retrieve_examples("I am sad", "sad", k=1)
    r_happy   = knowledge.retrieve_examples("I am happy", "happy", k=1)
    r_anxious = knowledge.retrieve_examples("I am anxious", "anxious", k=1)

    unique = len({r_sad, r_happy, r_anxious})
    if unique == 1:
        report(
            "KnowledgeAgent: emotion filtering", WARN,
            "Same result for sad/happy/anxious — emotion filter may not be working"
        )
    else:
        report("KnowledgeAgent: emotion filtering", PASS, f"{unique}/3 unique results for different emotions")

except Exception as e:
    report("KnowledgeAgent", FAIL, str(e))


# ── 7. GRAPH MEMORY ────────────────────────────────────────────────────────

section("7. GRAPH MEMORY — NEO4J CONNECTION & OPS")

try:
    from agent.memory import GraphMemory
    neo4j_uri  = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USER", "neo4j")
    neo4j_pass = os.getenv("NEO4J_PASSWORD", "")
    memory = GraphMemory(neo4j_uri, (neo4j_user, neo4j_pass))

    if not memory.driver:
        report("GraphMemory: Neo4j connection", FAIL, "driver is None — Neo4j not running or wrong credentials")
    else:
        report("GraphMemory: Neo4j connection", PASS)

        test_user = "audit_test_user_DELETE_ME"

        # Test add_turn
        try:
            memory.add_turn(test_user, "test input", "neutral", "test response")
            report("GraphMemory: add_turn", PASS)
        except Exception as e:
            report("GraphMemory: add_turn", FAIL, str(e))

        # Test get_context
        try:
            ctx = memory.get_context(test_user)
            if test_user and isinstance(ctx, str):
                report("GraphMemory: get_context", PASS, f"Returned {len(ctx)} chars")
            else:
                report("GraphMemory: get_context", WARN, f"Unexpected return: {type(ctx)}")
        except Exception as e:
            report("GraphMemory: get_context", FAIL, str(e))

        # Test update_user_profile
        try:
            traits = {"openness": 0.8, "conscientiousness": 0.6, "extraversion": 0.4,
                      "agreeableness": 0.7, "neuroticism": 0.3}
            profile, deltas = memory.update_user_profile(test_user, traits)
            if isinstance(profile, dict) and "openness" in profile:
                report("GraphMemory: update_user_profile (EMA)", PASS, f"Profile: {profile}")
            else:
                report("GraphMemory: update_user_profile (EMA)", FAIL, f"Unexpected return: {profile}")
        except Exception as e:
            report("GraphMemory: update_user_profile", FAIL, str(e))

        # Test get_user_profile
        try:
            p = memory.get_user_profile(test_user)
            if isinstance(p, dict) and "openness" in p:
                report("GraphMemory: get_user_profile", PASS, f"Profile: {p}")
            else:
                report("GraphMemory: get_user_profile", FAIL, f"Unexpected: {p}")
        except Exception as e:
            report("GraphMemory: get_user_profile", FAIL, str(e))

        # Test narrative profile
        try:
            memory.save_narrative_profile(test_user, "Test narrative.")
            narrative = memory.get_narrative_profile(test_user)
            if "Test narrative" in narrative:
                report("GraphMemory: narrative profile save/load", PASS)
            else:
                report("GraphMemory: narrative profile save/load", WARN, f"Got: '{narrative}'")
        except Exception as e:
            report("GraphMemory: narrative profile", FAIL, str(e))

        memory.close()

except Exception as e:
    report("GraphMemory: init", FAIL, str(e))


# ── 8. ENGINE — FULL PIPELINE ──────────────────────────────────────────────

section("8. ENGINE — FULL PIPELINE (process_brain)")

try:
    from core.engine import AgenticEmpathySystem
    engine = AgenticEmpathySystem()
    report("AgenticEmpathySystem: init", PASS)

    async def test_engine():
        test_user = "audit_engine_test_DELETE_ME"
        result = await engine.process_brain(
            user_input="I'm feeling really stressed about work",
            user_id=test_user,
            emotion="anxious",
        )
        if isinstance(result, str) and len(result) > 10:
            report("process_brain: returns string", PASS, f"Sample: '{result[:80]}...'")
        else:
            report("process_brain: returns string", FAIL, f"Got: {type(result)} = '{result}'")

        # Test ablation params exist
        try:
            result2 = await engine.process_brain(
                user_input="test",
                user_id=test_user,
                emotion="neutral",
                use_memory=False,
                use_ocean=False,
                use_rag=False,
            )
            report("process_brain: ablation params accepted", PASS)
        except TypeError as e:
            report(
                "process_brain: ablation params accepted", FAIL,
                f"process_brain() does not accept use_memory/use_ocean/use_rag yet: {e}"
            )

    asyncio.run(test_engine())

except Exception as e:
    report("AgenticEmpathySystem", FAIL, str(e))


# ── FINAL SUMMARY ──────────────────────────────────────────────────────────

section("SUMMARY")

passed  = [r for r in results if PASS in r["status"]]
failed  = [r for r in results if FAIL in r["status"]]
warned  = [r for r in results if WARN in r["status"]]

print(f"\n  Total checks : {len(results)}")
print(f"  ✅ Passed    : {len(passed)}")
print(f"  ❌ Failed    : {len(failed)}")
print(f"  ⚠️  Warnings : {len(warned)}")

if failed:
    print(f"\n  FAILED CHECKS (fix these first):")
    for r in failed:
        print(f"    ❌ {r['name']}")
        if r["detail"]:
            print(f"       {r['detail']}")

if warned:
    print(f"\n  WARNINGS (investigate these):")
    for r in warned:
        print(f"    ⚠️  {r['name']}")
        if r["detail"]:
            print(f"       {r['detail']}")

print()
