# 1. Project status summary

SoulMate currently has a broader implemented product than the narrow benchmarked system that should appear in the paper. The safe paper direction is:

- main story = B1 clean + B2 + B3
- B1 overload is supplementary / diagnostic only
- the paper should not be framed as "Agentic beats Full pipeline"

Why this is the current direction:

- The current B1 clean design directly tests the claim that many empathy-style, self-contained seeker posts do not need secondary context beyond RAG.
- The latest usable B1 clean results do not support a strong "Agentic > Full pipeline" headline. On the current clean summary, `RAG` has the highest mean total score (`2.258`), `Full pipeline` is close (`2.246`), and `Agentic` is lower (`2.182`).
- B2 is the benchmark that actually isolates the usefulness of memory when the task requires prior context. That is the correct place to support the memory claim.
- B3 is the benchmark that directly evaluates the router's route selection among `rag_only`, `memory`, and `ocean`. That is the correct place to support routing claims.
- B1 overload was redesigned as a stress/diagnostic condition, but it is no longer the main benchmark claim and should stay out of the core argument unless it is explicitly revived and rerun for that purpose.

# 2. Full implemented system

The current repository implements a full conversational product, not just the benchmarked paper system.

Backend architecture:

- `backend/core/engine.py`: central orchestration in `AgenticEmpathySystem`
- `backend/agent/perception.py`: emotion detection from current text
- `backend/agent/safety.py`: safety classification, safe-response policy, memory sanitization
- `backend/agent/router.py`: decides whether routed generation uses `RAG only`, `RAG + Memory`, or `RAG + OCEAN`
- `backend/agent/memory.py`: Neo4j-backed graph memory for turns, profile, and narrative summary
- `backend/agent/inference.py`: OCEAN trait inference and periodic narrative reflection
- `backend/agent/knowledge.py`: ChromaDB retrieval for supportive examples
- `backend/agent/dialogue.py`: final response generation with standard or safety-aware prompt path
- `backend/api/chat.py`: WebSocket chat endpoint, onboarding, voice streaming, mode switching

Implemented runtime flow in messaging mode:

1. The WebSocket endpoint receives the user message.
2. `PerceptionAgent` predicts the current emotion.
3. `SafetyClassifier` labels the turn as `normal_support`, `high_distress`, `clinical_boundary`, or `self_harm_or_suicide`.
4. If risk is critical, the system bypasses routed generation and returns an immediate safety response.
5. Otherwise, `RouterAgent` decides which secondary capability to add on top of always-on RAG.
6. `GraphMemory` optionally retrieves relevant turn history and/or the current OCEAN/narrative profile.
7. `KnowledgeAgent` retrieves similar supportive examples from ChromaDB.
8. `DialogueAgent` generates the response from the current message plus injected context.
9. `GraphMemory` stores the turn, with raw-text storage disabled for the highest-risk path.
10. Background tasks update OCEAN traits and periodically refresh a narrative profile.

Additional implemented product features outside the narrow paper core:

- voice input/output through `voice_io`
- onboarding-based OCEAN warm-start in `backend/api/chat.py`
- `EmptyChairAgent` roleplay flow
- frontend web app with messaging / voice / empty-chair routes
- ESP32 physical companion path

# 3. Core paper architecture

The paper should describe only the benchmark-relevant core architecture:

- `Perception Agent`
- `Safety Guardrail`
- `Router Agent`
- `Graph Memory`
- `Inference Agent` for OCEAN/personality modeling
- `Knowledge Agent` for RAG
- `Dialogue Agent`

Core orchestration flow for the paper:

1. The user message is analyzed by the `Perception Agent`.
2. The `Safety Guardrail` classifies risk and constrains or bypasses downstream modules.
3. The `Router Agent` selects among three routed behaviors:
   - `rag_only`
   - `rag + memory`
   - `rag + ocean`
4. `Graph Memory` supplies conversation history when continuity is needed.
5. `Inference Agent` maintains a persistent OCEAN profile plus a short narrative summary.
6. `Knowledge Agent` retrieves empathy-oriented support examples from the vector store.
7. `Dialogue Agent` generates the final response from the current turn plus the selected contextual signals.

Two boundaries are important for the paper:

- RAG is the base layer in routed production mode.
- The router may add at most one secondary component: `Memory` or `OCEAN`, not both.

# 4. Out-of-scope implemented features

These are implemented in the repository but should not be presented as the core paper contribution:

- voice pipeline
- Whisper speech-to-text
- ElevenLabs text-to-speech
- ESP32 physical companion
- `EmptyChairAgent`
- onboarding warm-start / product UX features in the WebSocket layer

They can be mentioned briefly as auxiliary or product-level extensions, but they should not be treated as part of the main benchmarked architecture.

# 5. Router logic (current version)

Current invariants from `backend/agent/router.py`:

- `use_rag` is always forced to `True`
- the router may choose at most one secondary (`Memory` or `OCEAN`)
- `Memory` is disabled if the user has no history
- `OCEAN` is disabled if the profile is effectively default
- unresolved referents justify `Memory`; emotional intensity alone does not
- self-contained concrete incidents should default away from `Memory`
- acute concrete incidents should default away from `OCEAN` unless personalization is explicitly requested

Current route behavior:

- `RAG only`
  - for self-contained posts where the event, relevant person/thing, feeling, and consequence are already inside the current message
  - for single-turn distress posts where no prior context is needed for specificity
  - for concrete incidents unless the user explicitly asks for personalization
- `RAG + Memory`
  - when the current message contains true referential ambiguity
  - when the meaning depends on prior conversation history
  - examples: unresolved `she`, `it`, `that`, `the email`, `the result`, `the call`
- `RAG + OCEAN`
  - when the message is self-contained but tone, pacing, or framing should adapt to a clearly non-default stable profile
  - especially for style-fit, coping-fit, routine-fit, confidence, habit-building, or "what works for someone like me" requests

Recent tightening relevant to the paper:

- `_is_self_contained_concrete_incident(...)` now guards against over-triggering `Memory` on autobiographical single-turn incidents.
- unresolved pronouns only count if they are actually unresolved from the current text.
- `_requests_personalization(...)` explicitly looks for wording like `fit me`, `how I operate`, `my style`, `tailored`, or related phrases.
- the router prompt now says that self-contained distress posts and fully specified incidents should default to `RAG only`.
- the router also receives a profile significance hint derived from maximum deviation from `0.5` across OCEAN traits.

Implication for the paper:

- B1 clean is now aligned with the intended claim that many empathy posts are self-contained and should not automatically route to `Memory` or `OCEAN`.

# 6. Safety logic (current version)

Current risk categories from `backend/agent/safety.py`:

- `normal_support`
- `high_distress`
- `clinical_boundary`
- `self_harm_or_suicide`

Current policy effects:

- `normal_support`
  - router allowed
  - memory allowed
  - OCEAN allowed
  - RAG allowed
  - raw turn storage allowed
- `high_distress`
  - router allowed
  - memory allowed
  - OCEAN disabled
  - RAG allowed
  - safe mode enabled
  - raw turn storage allowed
- `clinical_boundary`
  - router allowed
  - memory allowed
  - OCEAN disabled
  - RAG disabled
  - safe mode enabled
  - raw turn storage allowed
- `self_harm_or_suicide`
  - router bypassed
  - memory disabled
  - OCEAN disabled
  - RAG disabled
  - safe mode enabled
  - raw turn storage disabled
  - immediate crisis-oriented reply returned

How safety interacts with routing and memory:

- Safety does not replace routing; it constrains routing after the router decision.
- In `high_distress`, the engine forces `use_ocean = False`.
- In `clinical_boundary`, the engine forces `use_ocean = False` and `use_rag = False`.
- In `self_harm_or_suicide`, the engine bypasses routed generation entirely.
- For turns where raw storage is disallowed, memory stores a sanitized summary instead of the raw user message.

Current B1 clean safety distribution from `safety_analysis_b1_500_clean.csv`:

- `normal_support`: `335/500`
- `high_distress`: `110/500`
- `self_harm_or_suicide`: `54/500`
- `clinical_boundary`: `1/500`

This matters for paper wording because B1 clean is not a pure low-risk set; the routed system is already being evaluated under current safety constraints.

# 7. Graph memory and personality modeling

Current production memory behavior from `backend/agent/memory.py`:

- Each user turn is stored as a Neo4j `Turn` node linked from a `User` node.
- Stored turn fields include:
  - `user_input`
  - `ai_response`
  - `emotion`
  - `timestamp`
  - `risk_level`
  - `risk_type`
  - `raw_stored`
- The current OCEAN profile is stored in a `Profile` node.
- Historical profile updates are also stored as `PersonalitySnapshot` nodes.
- A free-text `narrative` summary is saved on the `Profile` node.

Current retrieval logic:

- default retrieval returns the most recent `limit` turns
- filtered retrieval always keeps the 3 most recent turns, then supplements them with older turns that match:
  - the current emotion, or
  - keyword overlap with the current message
- duplicate user inputs are removed when formatting memory context

Current OCEAN update behavior:

- `InferenceAgent.infer_traits(...)` proposes new trait scores from the current turn
- `GraphMemory.update_user_profile(...)` applies exponential moving average smoothing with `alpha = 0.15`
- the current implementation keeps default profile values at `0.5` when no evidence exists

Current narrative behavior:

- every 10 user turns, the engine triggers `reflect_on_history(...)`
- the reflection prompt produces a short third-person narrative paragraph summarizing values, triggers, communication style, and hidden traits

Production behavior vs benchmark-local behavior:

- Production:
  - profile updates and reflection run asynchronously in the live system
  - retrieved memory is relevance-filtered and safety-aware
- Benchmark-local:
  - B2 replays LongMemEval conversation history into Neo4j for memory-enabled configs
  - B3 replays history into Neo4j for `memory` cases and seeds exact OCEAN profiles into Neo4j for `ocean` cases
  - these benchmark helpers do not redefine the production router; they prepare controlled conditions for evaluating it

# 8. Response generation

What reaches the `Dialogue Agent`:

- current user input
- detected emotion
- retrieved memory context string
- long-term profile string
- RAG examples string
- risk type
- safety instruction
- explicit OCEAN trait values

Current prompt structure from `backend/agent/prompts.py`:

- normal generation path:
  - `SOULMATE_SYSTEM_PROMPT`
  - `SOULMATE_USER_PROMPT`
- safety generation path:
  - `SOULMATE_SAFETY_SYSTEM_PROMPT`
  - `SOULMATE_USER_PROMPT`

Current prompt behavior:

- the normal system prompt instructs SoulMate to be warm, direct, and non-clinical
- it includes memory consistency checks, advice-giving behavior, emotion-specific response strategy, and OCEAN-based communication adaptation
- the user prompt injects:
  - `Current Emotion`
  - `Memory Context`
  - `Long-term Profile`
  - `Similar Response Examples`
  - `Risk Type`
  - `Safety Instruction`
- the prompt explicitly discourages generic empathy clichés and asks for specific, situation-grounded supportive language

How RAG / memory / profile are injected:

- memory arrives as a formatted turn transcript from `GraphMemory.get_context(...)`
- OCEAN/profile arrives as both:
  - explicit trait slots
  - a long-term profile string containing `OCEAN: ... | SUMMARY: ...`
- RAG examples are retrieved from ChromaDB and injected as reference examples, with explicit instruction not to copy them verbatim

# 9. Benchmark strategy (current)

## Benchmark 1

What B1 currently means:

- B1 is an EPITOME-style empathy generation benchmark
- the main claim should come from `clean`, not from `overload`
- `clean` now tests whether many self-contained empathy posts can be handled well without secondary context

What B1 clean supports:

- it supports a "secondary context is often unnecessary for self-contained empathy posts" story
- it does not support a broad "Agentic beats Full pipeline" story

Current B1 modes:

- `clean`
  - main benchmark story
- `overload`
  - supplementary / diagnostic only

## Benchmark 2

What B2 supports:

- whether memory helps when the task genuinely depends on prior conversational context
- B2 intentionally isolates memory usefulness on LongMemEval-style QA

Important current design facts:

- B2 uses `Baseline`, `RAG`, `RAG+Memory`, and `Full pipeline`
- B2 requires Neo4j-backed memory
- B2 does not use Agentic/router evaluation as its central claim

## Benchmark 3

What B3 supports:

- whether the router selects the correct route among:
  - `rag_only`
  - `memory`
  - `ocean`

Important current design facts:

- B3 is a controlled routing benchmark with 60 cases
- it uses benchmark-local history replay and OCEAN seeding to create known route conditions
- it requires Neo4j-backed memory to run

Main strategic point:

- B1 overload is not part of the main argument and should not be described as central evidence.

# 10. Current benchmark results snapshot

## B1 clean

Latest usable B1 clean result summary from `backend/evaluate/benchmark/results/b1_500/summary_results_b1_500_clean.csv`:

- `Baseline`: Total `1.768`
- `RAG`: Total `2.258`
- `RAG+Memory`: Total `2.224`
- `RAG+OCEAN`: Total `2.232`
- `Agentic`: Total `2.182`
- `Full pipeline`: Total `2.246`

Current interpretation:

- the fresh clean rerun supports the narrow claim that plain `RAG` is already very strong on self-contained empathy posts
- `Memory` and `OCEAN` do not appear universally necessary on B1 clean
- the current result should not be used to argue that the routed agentic system is categorically best overall

Additional routing snapshot from `router_analysis_b1_500_clean.csv`:

- `RAG`: `445/500` (`0.89`)
- `None`: `55/500` (`0.11`)

The `None` bucket is safety-bypass cases in the agentic path, not a real fourth route.

## B2

Latest usable B2 result summary from `backend/evaluate/benchmark/results/b2_200/summary_results_b2_200.csv`:

- overall `Baseline`: accuracy `0.005`
- overall `RAG`: accuracy `0.085`
- overall `RAG+Memory`: accuracy `0.210`
- overall `Full pipeline`: accuracy `0.205`

Current interpretation:

- B2 supports the claim that memory matters when the task actually depends on prior context
- `RAG+Memory` substantially improves over `RAG`
- `Full pipeline` is effectively comparable to `RAG+Memory` on the current B2 run, slightly lower by `0.005`

## B3

Current active B3 outputs show:

- overall accuracy: `1.0`
- macro-F1: `1.0`
- class accuracy:
  - `rag_only`: `1.0`
  - `memory`: `1.0`
  - `ocean`: `1.0`

Current interpretation:

- the latest active B3 files support the claim that the current router solves the controlled B3 routing set perfectly
- this should still be described as a controlled routing benchmark result, not as proof of general route perfection in all real conversations

Important operational caveat:

- B3 requires Neo4j-backed memory and may fail to run if Neo4j is unavailable, even though the latest active output files are present

# 11. Recent implementation changes relevant to the paper

Router tightening:

- router rules were tightened to prefer `RAG only` for fully specified, self-contained incidents
- memory is now more explicitly reserved for true continuity or referent-resolution needs
- OCEAN is now more explicitly reserved for genuine personalization-fit cases

Safety additions:

- explicit risk taxonomy was added / tightened
- high-distress now disables OCEAN
- clinical-boundary turns disable both OCEAN and RAG
- self-harm / suicide turns bypass routed generation and store only sanitized summaries

B1 redesign:

- B1 was split into `clean` and `overload`
- `clean` is now the main evidence path
- `overload` is a diagnostic stress condition, not the main headline benchmark

Overload de-prioritization:

- current benchmark strategy explicitly de-prioritizes B1 overload
- overload should only be referenced as supplementary or diagnostic unless intentionally revived later

# 12. Known caveats / limitations

Safe paper-wording caveats:

- B1 clean does not show agentic routing outperforming all alternatives
- B2 is a QA-style memory benchmark, not an empathy benchmark
- B3 is a controlled route-selection benchmark, not an end-to-end response-quality benchmark
- B3 and B2 both depend on Neo4j-backed memory being available
- the dialogue prompts are highly engineered and multi-purpose; the paper should describe the role of prompt conditioning, but not overclaim formal architectural novelty from prompt wording alone
- the project contains product features beyond the paper core, so the paper must be explicit about what was and was not benchmarked

Teardown / implementation caveat:

- `AgenticEmpathySystem.close()` calls `self.voice_io.stop_all_audio()`
- on the current code path, this can raise `AttributeError: 'VoiceInterface' object has no attribute 'stop_all_audio'`
- this teardown bug appeared after B1 outputs had already been written; it affects runtime cleanup, not the meaning of the generated benchmark files

Benchmark-specific caveat:

- the current B1 finalize path can also hit a statistical-test failure when Wilcoxon receives non-real input, although standalone `finalize_b1_500.py clean` completed successfully on the latest rerun

# 13. Paper-writing guide

What to say in Method:

- present SoulMate as a modular supportive dialogue system with perception, safety, routing, memory, profile modeling, retrieval, and response generation
- state that RAG is the base layer in routed mode and that the router may add at most one secondary signal: memory or OCEAN
- explain that graph memory stores turns, OCEAN traits, and a short narrative profile in Neo4j
- explain that safety policy can override or constrain routing decisions before generation

What to say in Experiments:

- B1 clean tests whether self-contained empathy posts need secondary context
- B2 tests whether memory helps when prior context is genuinely required
- B3 tests whether the router chooses the correct route on a controlled three-way routing set
- treat B1 overload as supplementary / diagnostic only

What NOT to claim:

- do not claim that the main contribution is "Agentic beats Full pipeline"
- do not claim that B1 proves memory or OCEAN are broadly harmful; it only shows they are often unnecessary on self-contained posts
- do not claim that B3 proves universal routing perfection beyond the controlled benchmark set
- do not present voice mode, ESP32, or empty-chair mode as the central experimental contribution
- do not present B2 as evidence about empathy quality

Safe one-paragraph paper framing:

SoulMate is a modular empathy-oriented dialogue system that combines emotion perception, safety guardrails, graph memory, personality modeling, retrieval-augmented prompting, and route selection among context sources. The current evidence supports a three-part story: on self-contained empathy posts, secondary context is often unnecessary (B1 clean); when tasks genuinely depend on prior interaction history, explicit memory improves performance (B2); and on a controlled routing benchmark, the router can reliably choose among `rag_only`, `memory`, and `ocean` routes (B3). This framing is stronger and safer than claiming that a generic agentic configuration uniformly outperforms all fixed pipelines.
