# SoulMate: Agentic Empathy AI Companion

SoulMate is a multi-agent conversational companion focused on emotionally supportive dialogue. It combines emotion detection, retrieval-augmented prompting, graph memory, personality adaptation, safety guardrails, and multimodal interfaces across web chat, voice, and empty-chair style interactions.

## Overview

SoulMate is built around a small set of specialized agents coordinated by a central engine:

- `PerceptionAgent` detects the user's emotion from the current message.
- `RouterAgent` decides whether the turn should use `RAG only`, `RAG + Memory`, or `RAG + OCEAN`.
- `GraphMemory` stores conversation turns, an OCEAN-style personality profile, and a narrative summary in Neo4j.
- `KnowledgeAgent` retrieves supportive examples from ChromaDB.
- `DialogueAgent` generates the final response.
- `InferenceAgent` updates the user profile over time with EMA-smoothed trait estimates.
- `SafetyGuardrail` constrains routing, retrieval, memory writes, and response style for elevated-risk cases.
- `EmptyChairAgent` supports a separate roleplay-based empty-chair flow.

RAG is always the base layer in routed production mode. The router may add at most one secondary component:

- `Memory`
- `OCEAN`

## Core Features

- Multi-agent backend with explicit routing and component-level control
- Neo4j graph memory for turns, OCEAN profile, and narrative summary
- ChromaDB RAG grounded in empathy-oriented support examples
- Real-time chat over FastAPI WebSockets
- Voice input/output with Whisper STT and ElevenLabs TTS
- Empty-chair interaction mode
- Benchmark suite covering empathy quality, long-context memory QA, and routing accuracy
- Optional physical companion flow via ESP32 speaker output

## Repository Structure

```text
agentic-empathy-ai/
├── backend/
│   ├── agent/
│   │   ├── dialogue.py
│   │   ├── emptychair_agent.py
│   │   ├── inference.py
│   │   ├── knowledge.py
│   │   ├── memory.py
│   │   ├── perception.py
│   │   ├── prompts.py
│   │   ├── router.py
│   │   ├── safety.py
│   │   └── voice_io.py
│   ├── api/
│   ├── core/
│   │   └── engine.py
│   ├── data/
│   ├── evaluate/
│   │   └── benchmark/
│   ├── scripts/
│   └── main.py
├── frontend/
│   ├── app/
│   ├── components/
│   ├── context/
│   └── hooks/
├── esp32/
└── README.md
```

## Architecture

High-level request flow:

1. User message arrives through chat or voice.
2. `PerceptionAgent` detects an emotion label.
3. `SafetyGuardrail` classifies the turn for risk.
4. In routed mode, `RouterAgent` decides which secondary capability to use on top of RAG.
5. `GraphMemory` optionally provides relevant conversation context and/or the user profile.
6. `KnowledgeAgent` retrieves empathy-support examples from ChromaDB.
7. `DialogueAgent` generates the response with the combined context.
8. `GraphMemory` stores the turn, subject to safety restrictions.
9. Background profile learning and periodic narrative reflection update the long-term user model.

## Safety Guardrails

Safety behavior is implemented in [`backend/agent/safety.py`](/D:/GitHub/agentic-empathy-ai/backend/agent/safety.py) and enforced from [`backend/core/engine.py`](/D:/GitHub/agentic-empathy-ai/backend/core/engine.py).

### Safety classifier outputs

Each turn is classified into one of four risk categories:

- `normal_support`
- `high_distress`
- `clinical_boundary`
- `self_harm_or_suicide`

Each decision includes:

- `risk_type`
- `risk_level`
- whether routing is allowed
- whether memory is allowed
- whether OCEAN is allowed
- whether RAG is allowed
- whether safe mode should be enabled
- whether the raw turn may be stored
- a short reason string

### Risk categories

#### `normal_support`

Default case when no elevated safety concern is detected.

- Memory allowed
- OCEAN allowed
- RAG allowed
- Raw turn storage allowed
- Normal response generation

#### `high_distress`

Triggered by strong distress wording or distress-heavy emotion labels. Current rules include phrases such as:

- `hopeless`
- `can't take this anymore`
- `falling apart`
- `panic`
- `empty inside`
- `worthless`

It also triggers on emotions in:

- `depressed`
- `fearful`
- `anxious`
- `ashamed`

Guardrail behavior:

- Router still runs
- Memory remains allowed
- OCEAN is disabled
- RAG remains allowed
- Safe mode is enabled
- Raw turn storage is still allowed
- The response is instructed to stay gentle, calm, grounding, and low-intensity

This matters because personality adaptation can be helpful in normal support, but under acute distress the system prioritizes steadiness over style personalization.

#### `clinical_boundary`

Triggered by requests that push the system into diagnostic or treatment territory, for example:

- `diagnose me`
- `do i have depression`
- `what disorder do i have`
- `am i bipolar`
- `prescribe`
- `treatment plan`
- `am i mentally ill`

Guardrail behavior:

- Router still runs
- Memory remains allowed
- OCEAN is disabled
- RAG is disabled
- Safe mode is enabled
- Raw turn storage is allowed
- The response is instructed to stay supportive without diagnosing or claiming clinical authority

The design goal is to preserve supportive conversation while preventing the model from acting like a clinician.

#### `self_harm_or_suicide`

Triggered by explicit self-harm or suicide language, including phrases such as:

- `kill myself`
- `want to die`
- `end my life`
- `suicide`
- `self harm`
- `hurt myself`
- `cut myself`
- `overdose`

Guardrail behavior:

- Router is bypassed
- Memory is disabled
- OCEAN is disabled
- RAG is disabled
- Safe mode is enabled
- Raw turn storage is not allowed
- The system returns an immediate crisis-oriented supportive response
- The stored memory entry is replaced with a safety-preserving summary rather than the raw message

This is the strictest path in the system.

### Memory sanitization

The memory sanitizer converts elevated-risk turns into safer summaries before storage when raw text should not be retained. Current summary styles include:

- severe distress needing immediate safety guidance
- clinical interpretation requests beyond the assistant's role
- elevated emotional distress requiring grounding support

This keeps memory useful for future continuity while reducing the risk of replaying dangerous or overly sensitive raw content.

### Safety interaction with routing

Production safety does not replace routing; it constrains routing.

- `self_harm_or_suicide`: bypasses routed generation entirely
- `high_distress`: disables OCEAN after routing
- `clinical_boundary`: disables OCEAN and RAG after routing

That means the router remains architecturally simple, while the engine enforces final policy.

## Routing Logic

The production router lives in [`backend/agent/router.py`](/D:/GitHub/agentic-empathy-ai/backend/agent/router.py).

Current invariants:

- `use_rag` is always forced to `True`
- at most one secondary is allowed
- no memory without history
- no OCEAN without a non-default profile

The router prompt is designed to separate three cases:

- `RAG only` for self-contained turns
- `RAG + Memory` when referent resolution or continuity from prior turns is needed
- `RAG + OCEAN` when the turn is self-contained but tone or framing should adapt to a meaningfully non-default profile

The router also receives a lightweight profile significance hint derived from the maximum absolute trait deviation from `0.5`.

## OCEAN Profile and Narrative Memory

Production profile updates live in [`backend/agent/memory.py`](/D:/GitHub/agentic-empathy-ai/backend/agent/memory.py).

Important behavior:

- The current OCEAN profile is stored in Neo4j.
- Profile updates use EMA smoothing with `alpha = 0.15`.
- Narrative reflection runs periodically and stores a free-text summary in the profile node.
- Dialogue can consume both the structured OCEAN scores and the narrative summary.

The benchmark suite deliberately does not modify this production behavior unless a benchmark-specific helper is explicitly isolated from the core system.

## Tech Stack

- Backend: Python, FastAPI, WebSockets
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Package managers: `uv` for backend, `npm` for frontend
- LLM backbone: `gpt-4o-mini`
- Emotion model: `SamLowe/roberta-base-go_emotions`
- Graph database: Neo4j
- Vector database: ChromaDB
- Speech-to-text: Whisper
- Text-to-speech: ElevenLabs

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- `uv`
- Neo4j

### Install

```bash
git clone https://github.com/BaoWhiteHat/agentic-empathy-ai.git
cd agentic-empathy-ai

cd backend
uv sync

cd ../frontend
npm install
```

### Environment

Create `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
ELEVEN_API_KEY=your_elevenlabs_api_key
```

### Build the RAG database

```bash
cd backend
uv run python scripts/build_rag_combined.py
```

### Run locally

Backend:

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Smoke test:

```bash
cd backend
uv run python audit_pipeline.py
```

## API

- `GET /docs`: Swagger UI
- `WS /ws/chat/{user_id}`: realtime chat channel
- `GET /profile/ocean/{user_id}`: current OCEAN profile as JSON

## Benchmark Suite

The project now has three benchmark tracks under [`backend/evaluate/benchmark`](/D:/GitHub/agentic-empathy-ai/backend/evaluate/benchmark).

### Benchmark 1: Empathy quality on EPITOME

Purpose:

- Evaluate response quality for empathy-style conversation generation
- Compare pipeline variants on EPITOME-derived seeker posts

Primary configs:

- `Baseline`
- `RAG`
- `RAG+Memory`
- `RAG+OCEAN`
- `Agentic`
- `Full pipeline`

Main outputs:

- generated responses
- scored responses
- summary results
- statistical tests
- router analysis
- safety analysis
- plot

Run:

```bash
cd backend
uv run python evaluate/benchmark/run_benchmark_b1_500.py
```

Finalize only:

```bash
cd backend
uv run python evaluate/benchmark/finalize_b1_500.py
```

### Benchmark 2: LongMemEval memory-effectiveness QA

Purpose:

- Evaluate whether memory improves long-context factual QA accuracy
- Measure the effect of replay-based history on answer correctness
- Keep router evaluation out of this benchmark

Dataset:

- `backend/data/LongMemEval/longmemeval_s_cleaned.json`

Current fixed configs:

- `Baseline`
- `RAG`
- `RAG+Memory`
- `Full pipeline`

Design notes:

- Uses a saved 200-case sample with `seed=42`
- Replays LongMemEval history into Neo4j for memory-enabled configs
- Scores answers deterministically with binary correctness
- Agentic/router outputs are intentionally excluded from B2

Main outputs:

- `test_cases_b2_200.csv`
- `generated_responses_b2_200.csv`
- `scored_responses_b2_200.csv`
- `summary_results_b2_200.csv`
- `statistical_tests_b2_200.csv`
- `results_b2_200.png`

Run:

```bash
cd backend
uv run python evaluate/benchmark/run_benchmark_b2_200.py
```

Finalize only:

```bash
cd backend
uv run python evaluate/benchmark/finalize_b2_200.py
```

### Benchmark 3: Controlled routing benchmark

Purpose:

- Evaluate whether the production router chooses the correct route
- Separate routing evaluation from generation quality and long-memory QA

Routes:

- `rag_only`
- `memory`
- `ocean`

Dataset:

- `backend/data/benchmark3/b3_cases.json`

Benchmark shape:

- 60 total cases
- 20 `rag_only`
- 20 `memory`
- 20 `ocean`

Design notes:

- Uses isolated `bench_b3_<case_id>` users
- Replays history into Neo4j for memory cases
- Seeds exact OCEAN profiles into Neo4j with a benchmark-local helper for ocean cases
- Calls the real production router decision path
- Computes route accuracy, macro-F1, confusion matrix, and per-class metrics

Main outputs:

- `loaded_cases_b3.csv`
- `router_predictions_b3.csv`
- `summary_results_b3.csv`
- `confusion_matrix_b3.csv`
- `classification_report_b3.csv`
- `error_analysis_b3.csv`
- `confusion_matrix_b3.png`
- `per_class_accuracy_b3.png`

Run:

```bash
cd backend
uv run python evaluate/benchmark/run_benchmark_b3.py
```

Finalize only:

```bash
cd backend
uv run python evaluate/benchmark/finalize_b3.py
```

## Voice and Physical Companion

The repository also supports a voice-first companion path and an ESP32 speaker setup.

Standalone voice companion:

```bash
cd backend
uv run python voice_companion.py
```

ESP32 firmware:

- [`esp32/soulmate_speaker/soulmate_speaker.ino`](/D:/GitHub/agentic-empathy-ai/esp32/soulmate_speaker/soulmate_speaker.ino)

## License

MIT
