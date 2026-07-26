# SoulMate: Agentic Empathy AI Companion

SoulMate is a non-clinical emotional-support prototype that explores how an AI companion can manage context without overloading every response with every available memory, profile signal, and knowledge source. The project combines a browser app, a Python/FastAPI agentic backend, evaluation scripts, and an ESP32-based Physical AI prototype.

SoulMate does not diagnose, provide therapy, provide medical treatment, or replace professional or emergency support. It is designed as a supportive research and product prototype for everyday reflection and emotionally aware conversation.

## Project Purpose

Many companion systems accumulate long histories, user profiles, retrieval stores, and safety signals. A core research problem is context overload: adding more context can help when it is relevant, but can also distract a model when the current message is self-contained.

SoulMate tests a dynamic multi-agent context-routing design:

```text
User input
  -> PerceptionAgent
  -> SafetyGuardrail
  -> RouterAgent
  -> selected context route
  -> DialogueAgent
  -> response
  -> asynchronous memory, OCEAN, and narrative updates
```

In normal routed support, RAG is the base grounding layer. The router may add at most one secondary context source:

- `RAG only`: for self-contained turns.
- `RAG + Memory`: when prior conversation is needed for continuity or referent resolution.
- `RAG + OCEAN`: when a meaningful personality profile can improve tone, pacing, or framing.

Main contributions:

- A working multi-agent empathy companion with explicit context routing.
- Safety-aware routing constraints for non-clinical support.
- Neo4j graph memory with OCEAN-style profile updates and narrative reflection.
- ChromaDB RAG built from ESConv and EPITOME support examples.
- Evaluation tracks for empathy quality, memory utility, and router correctness.
- A standalone ESP32 Physical AI prototype with OLED emotion display and speaker playback.

Current status: research prototype. The web app, backend pipeline, benchmark scripts, committed result files, and firmware are present. Some product surfaces are backend-connected; others are localStorage-only, demo-oriented, or available only through standalone scripts.

## Documentation Map

- [`FRONTEND_DOCS.md`](FRONTEND_DOCS.md): detailed browser/frontend implementation reference.
- [`BACKEND_DOCS.md`](BACKEND_DOCS.md): detailed backend, AI, database, evaluation, voice, and Physical AI reference.

## Repository Structure

```text
agentic-empathy-ai/
|-- backend/
|   |-- agent/                 # AI agents, safety, memory, voice helpers
|   |-- api/                   # FastAPI REST and WebSocket routes
|   |-- core/                  # AgenticEmpathySystem orchestration
|   |-- data/                  # RAG/evaluation source data tracked in repo
|   |-- evaluate/benchmark/    # benchmark scripts and committed result files
|   |-- models/                # Empty Chair model metadata; weights are local
|   |-- scripts/               # RAG build scripts
|   `-- voice_companion.py     # standalone physical companion bridge
|-- frontend/
|   |-- app/                   # Next.js single-route app entry
|   |-- components/            # UI, screens, safety components
|   |-- context/               # user and accessibility/personalisation state
|   |-- hooks/                 # WebSocket/API hooks
|   |-- lib/                   # local mood and safety UI helpers
|   `-- public/                # fonts and calming audio assets
|-- esp32/
|   `-- soulmate_speaker/      # ESP32 firmware
|-- FRONTEND_DOCS.md
|-- BACKEND_DOCS.md
|-- pyproject.toml
|-- uv.lock
`-- README.md
```

Generated folders such as `.venv/`, `node_modules/`, `.next/`, caches, local ChromaDB stores, and local model weights are intentionally not part of the public source tree.

## Main User Features

Frontend features verified in `frontend/components/` and `frontend/hooks/`:

| Area | Status | Notes |
| --- | --- | --- |
| Onboarding | Functional, local session | Guided onboarding stores `soulmate_user_id` in localStorage. Backend chat also has a separate WebSocket onboarding warm-start for new users. |
| Today dashboard | Functional | Shows greeting, mood check-in entry point, week strip, OCEAN preview, and navigation cards. |
| Mood check-in | localStorage-only | Saves daily mood and note in localStorage through `frontend/lib/moods.ts`; not written to backend reflections. |
| Companion chat | Backend-connected | Uses `ws://localhost:8000/ws/chat/{userId}` and the backend agentic pipeline. |
| Physical companion screen | Informational UI | Explains the standalone hardware flow. The browser does not directly control the ESP32. |
| Empty Chair mode | Backend-connected via chat WebSocket | Sends `mode: "empty-chair"` messages and handles backend safety lifecycle frames. |
| Reflections | Backend-connected | Uses Neo4j-backed REST endpoints under `/api/reflections/{userId}`. |
| Insights and OCEAN profile | Backend-connected | Polls `/api/ocean/{userId}` every 5 seconds; shows defaults/errors when backend or Neo4j is unavailable. |
| Memory screen | UI/demo-oriented | Describes memory consent/controls; not a full memory-management API surface. |
| Settings/accessibility | localStorage-only | Text size, font, spacing, motion, color mode, accent, focus mode, dashboard style, chat style, dark mode. |
| Safety/support screen | Functional UI | Shows support numbers, grounding, breathing, and calming sounds from frontend assets. |
| Voice in browser | Partially implemented protocol | `useChat` can send legacy `start_recording`/`stop_recording` actions and receive TTS chunks, but the current visible Physical tab presents standalone hardware mode rather than browser push-to-talk. |
| Voice monitoring | Backend-connected observer | `useVoiceMonitor` listens to `/ws/voice-monitor/{userId}` for events published by backend code. |
| Standalone physical voice | Script-only runtime | Run `backend/voice_companion.py`; uses laptop mic, backend pipeline, ElevenLabs TTS, and ESP32 serial output or laptop speaker fallback. |

Implemented but not always exposed: `frontend/components/screens/PhysicalCompanion.tsx` is a standalone screen component, while the active Companion tab contains its own physical-companion view.

## AI System Overview

| Module | Source | Responsibility | Input -> output | Model/technique and limitations |
| --- | --- | --- | --- | --- |
| PerceptionAgent | `backend/agent/perception.py` | Detect current emotion. | text -> `{emotion, confidence}` | Keyword voting plus `SamLowe/roberta-base-go_emotions`; falls back to keyword-only if model load fails. |
| SafetyGuardrail | `backend/agent/safety.py` | Classify non-clinical support risk and constrain routing/storage. | text, emotion, mode -> `SafetyDecision` | Phrase lists and policy rules; not diagnosis or clinical risk prediction. |
| RouterAgent | `backend/agent/router.py` | Select RAG-only, Memory, or OCEAN route. | message, emotion, history/profile hints -> route booleans | `gpt-4o-mini` JSON decision plus deterministic guardrails; falls back to RAG-only on error. |
| KnowledgeAgent/RAG | `backend/agent/knowledge.py` | Retrieve support examples. | message, emotion -> formatted examples | ChromaDB collection `soulmate_knowledge_base`; OpenAI `text-embedding-3-small`; empty DB returns no context. |
| DialogueAgent | `backend/agent/dialogue.py` | Generate final response. | message plus selected context -> response string | LangChain `ChatOpenAI`, `gpt-4o-mini`, temp 0; safe prompt used when safety mode is active. |
| GraphMemory | `backend/agent/memory.py` | Store/retrieve turns, reflections, profile, and narrative. | user id + data -> Neo4j nodes/strings | Neo4j; returns defaults/empty strings if unavailable. |
| OCEAN profile | `backend/agent/memory.py`, `backend/agent/inference.py` | Maintain personality-style scores. | turn -> trait proposal -> EMA update | `gpt-4o-mini` inference with EMA alpha `0.15`; weak proxy, not psychological assessment. |
| Narrative profile | `backend/core/engine.py`, `backend/agent/inference.py` | Summarise long-term user pattern. | recent history + old narrative -> narrative text | `gpt-4o`; runs every 10 turns per user. |
| InferenceAgent | `backend/agent/inference.py` | Infer OCEAN and reflect on history. | text/profile -> JSON traits or narrative | LLM output parsed defensively; defaults to 0.5 on parse failure. |
| Background learning | `backend/core/engine.py` | Update OCEAN and narrative asynchronously. | completed turn -> background tasks | Skipped for self-harm/suicide path. |
| EmptyChairAgent | `backend/agent/emptychair_agent.py` | Generate bounded roleplay replies. | target, relationship, need, input, emotion -> reply | `gpt-4o-mini`, temp 0.7; uses memory conflict history when Neo4j is available. |
| EmptyChairHybridSafety | `backend/agent/emptychair_safety.py` | Safety route Empty Chair turns. | user text -> `normal_roleplay`, `safe_roleplay`, or `stop_roleplay` | 15 explicit keyword guardrails, local DistilBERT, SuicideWatch threshold `0.2`; model weights are gitignored. |
| VoiceInterface | `backend/agent/voice_io.py` | Browser/script voice I/O helpers. | audio/text -> transcript/audio bytes | OpenAI Whisper `whisper-1`, ElevenLabs TTS; depends on local mic/audio stack and API keys. |

## Empty Chair Safety

Empty Chair mode is a roleplay-style feature with a separate safety path:

1. Frontend sends a `[SYSTEM_INIT]` payload to set target name, relationship, unspoken need, and first message.
2. Non-init turns are checked by `EmptyChairHybridSafety.decide()` when the local DistilBERT model is available.
3. Explicit crisis keywords immediately produce `stop_roleplay`.
4. DistilBERT predicts a support-forum label; if the SuicideWatch probability is `>= 0.2`, roleplay stops.
5. Distress labels such as Anxiety, Depression, or Bipolar produce `safe_roleplay`.
6. Other labels produce `normal_roleplay`.
7. `stop_roleplay` sends `crisis_mode`, activates an elevated-mode window, stores a sanitized memory summary, and returns a crisis-safe supportive response.
8. The frontend shows breathing/support options and requires the user to choose how to continue before roleplay can resume.

This flow is a non-clinical safety guardrail. It should not be described as diagnosis or prediction of real-world clinical outcomes.

Known protocol differences:

- Backend still supports `start_recording` / `stop_recording` chat actions for browser audio, but the current visible Physical tab presents the standalone hardware script.
- Companion control endpoints can spawn `voice_companion.py` with `COM5`, but the Physical tab text emphasizes terminal startup and does not present fake browser push-to-talk control.

## Physical AI Prototype

Verified components:

- Board: ESP32 NodeMCU / ESP32-class board.
- Display: SH1106 128x64 OLED using U8g2.
- Audio: MAX98357A I2S amplifier and speaker.
- Input: laptop microphone through `backend/voice_companion.py`.
- Firmware: `esp32/soulmate_speaker/soulmate_speaker.ino`.
- Bridge script: `backend/voice_companion.py`.
- Baud rate: `921600`.
- Serial port default: `COM5` from `ESP32_PORT`, with `COM5` also hardcoded in `api/companion_control.py`.
- I2S pins: `GPIO27` data out, `GPIO26` BCLK, `GPIO25` LRC.
- LED: `GPIO2` is high while speaking.
- Serial protocol: `EMOTION:<label>\n` before audio, then `SOUL` + 4-byte little-endian PCM length + 16 kHz mono PCM data.
- Flow control: ESP32 sends byte `A` every 4096 consumed bytes; Python limits outstanding bytes.
- OLED states: neutral, happy, love, sad, anxious, angry, surprise, with blinking/look animation.
- Fallback: if ESP32 serial connection fails, the script tries laptop-speaker playback through pygame.

Separation of responsibilities:

```text
Browser frontend: shows chat, settings, safety, and physical-companion info
FastAPI backend: runs the agentic AI pipeline and optional monitor endpoints
Standalone process: voice_companion.py records mic input and bridges to hardware
USB serial: laptop sends emotion tags and PCM audio to ESP32
ESP32 firmware: displays eyes and plays speaker audio through I2S
```

The browser does not communicate directly with the ESP32 in the current source.

Hardware assets:

- Firmware is in `esp32/soulmate_speaker/`.
- No verified CAD/STL source file is tracked in the current tree.

Current hardware limitations:

- Laptop microphone is required.
- External OpenAI and ElevenLabs services are required for STT/TTS.
- `USE_ESP32` is a hardcoded `True` constant in `voice_companion.py`; failure falls back after connection attempt.
- Port defaults assume `COM5`; users may need to set `ESP32_PORT`.
- Wiring and USB serial latency affect playback reliability.

## Evaluation

Evaluation code and committed outputs live under `backend/evaluate/benchmark/`.

B1 clean, B2, and B3 are the current usable core benchmark set. Historical pilot, stability, full, and legacy result folders are preserved as evidence but should not be mixed into one headline result table.

| Benchmark | Purpose | Scripts | Committed accepted outputs | Configurations/metrics | Confirmed results |
| --- | --- | --- | --- | --- | --- |
| B1 clean EPITOME empathy | Response empathy quality on 500 EPITOME-style posts, following Sharma et al. (2020). | `run_benchmark_b1_500.py`, `finalize_b1_500.py` | `results/b1_500/*_clean.csv`, `results_b1_500_clean.png` | Baseline, RAG, RAG+Memory, RAG+OCEAN, Agentic, Full pipeline; ER/IP/EX and total score. | Mean total: Baseline `1.768`, RAG `2.258`, RAG+Memory `2.224`, RAG+OCEAN `2.232`, Agentic `2.182`, Full pipeline `2.246`. |
| B2 adapted LongMemEval | Memory utility on long-context QA, adapted from LongMemEval by Wu et al. (2024). | `run_benchmark_b2_200.py`, `finalize_b2_200.py` | `results/b2_200/summary_results_b2_200.csv` | Baseline, RAG, RAG+Memory, Full pipeline; exact/normalized answer accuracy. | Overall accuracy: Baseline `0.005`, RAG `0.085`, RAG+Memory `0.210`, Full pipeline `0.205`. |
| B3 controlled routing | Project-created route-selection benchmark, not an external public benchmark. | `run_benchmark_b3.py`, `finalize_b3.py` | `results/b3/summary_results_b3.csv`, `classification_report_b3.csv` | `rag_only`, `memory`, `ocean`; accuracy, macro-F1, confusion matrix. | Overall accuracy `1.0`, macro-F1 `1.0`, 20/20 per class in the committed controlled set. |
| Empty Chair safety | Source-level safety routing for Empty Chair, using SWMH-style subreddit labels as weak supervision. | Source-level classifier and chat lifecycle; no final standalone raw scored benchmark output is committed. | Model metadata in `backend/models/emptychair_distilbert/`; weights local. | Keyword override, DistilBERT label routing, SuicideWatch threshold. | Treat any included research-paper/report SWMH classification and safety-routing results as paper-reported evidence, separate from committed raw benchmark output files. |
| End-to-end/scenario tests | Manual/audit style checks. | `backend/audit_pipeline.py` | No single final numeric report. | Environment, imports, pipeline consistency checks. | Use as smoke/audit command rather than accepted benchmark result. |

Benchmark commands:

```bash
cd backend
uv run python audit_pipeline.py
uv run python evaluate/benchmark/run_benchmark_b1_500.py
uv run python evaluate/benchmark/finalize_b1_500.py
uv run python evaluate/benchmark/run_benchmark_b2_200.py
uv run python evaluate/benchmark/finalize_b2_200.py
uv run python evaluate/benchmark/run_benchmark_b3.py
uv run python evaluate/benchmark/finalize_b3.py
```

Notes:

- B2 requires `backend/data/LongMemEval/longmemeval_s_cleaned.json`, which is intentionally treated as a local large dataset.
- EPITOME scoring uses model files such as `reddit_ER.pth`, `reddit_IP.pth`, and `reddit_EX.pth`; large `.pth` files are ignored and must be provided locally if absent.
- Empty Chair DistilBERT requires `backend/models/emptychair_distilbert/model.safetensors`, which is ignored because it is large.

Evaluation notes:

- EPITOME defines the B1 dimensions: Emotional Reactions (ER), Interpretations (IP), and Explorations (EX).
- The B2 runner expects `backend/data/LongMemEval/longmemeval_s_cleaned.json`, so the committed setup uses an adapted/cleaned local LongMemEval subset rather than the full upstream dataset.
- B3 is generated by `backend/data/benchmark3/b3_cases.json` and validates the local router over 60 controlled cases, 20 each for `rag_only`, `memory`, and `ocean`.
- Empty Chair uses five source labels in local model metadata: `self.Anxiety`, `self.SuicideWatch`, `self.bipolar`, `self.depression`, and `self.offmychest`. The runtime maps them into three product actions: `normal_roleplay`, `safe_roleplay`, and `stop_roleplay`.
- SWMH-style labels are subreddit-derived weak supervision signals. They are not clinical diagnoses and should not be described as clinical risk assessment.

## Technology Stack

Frontend:

- Next.js `16.1.6`, React `19.2.3`, TypeScript, Tailwind CSS 4 tooling.
- Framer Motion and Lucide React.
- Browser localStorage for local identity, chat display history, mood check-ins, and accessibility settings.

Backend and AI:

- Python `>=3.12`, FastAPI, WebSockets, uvicorn.
- Package management with `uv`, `pyproject.toml`, and `uv.lock`.
- OpenAI chat models: `gpt-4o-mini` for dialogue/router/OCEAN inference; `gpt-4o` for narrative reflection.
- Embeddings: OpenAI `text-embedding-3-small`.
- Emotion model: Hugging Face `SamLowe/roberta-base-go_emotions`.
- Empty Chair safety model: local DistilBERT sequence classifier plus keyword and threshold rules.
- Neo4j for graph memory, profile, snapshots, narrative, and reflections.
- ChromaDB for local vector retrieval.
- Voice: OpenAI Whisper `whisper-1`; ElevenLabs TTS with voice id `EXAVITQu4vr4xnSDxMaL` and model `eleven_turbo_v2_5`.

Hardware:

- ESP32 Arduino firmware.
- U8g2 for SH1106 OLED.
- ESP32 I2S driver for MAX98357A speaker output.
- PySerial bridge from Python.

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+ recommended for the Next.js frontend
- `uv`
- Neo4j running locally or remotely
- OpenAI API key
- ElevenLabs API key only for voice/physical companion output
- ESP32 Arduino toolchain only for firmware upload

Install `uv` if needed:

```bash
pip install uv
```

### Clone

```bash
git clone https://github.com/BaoWhiteHat/agentic-empathy-ai.git
cd agentic-empathy-ai
```

### Backend environment

Create `backend/.env` or copy `backend/.env.example` if present:

```env
OPENAI_API_KEY=
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=
ELEVEN_API_KEY=
ESP32_PORT=COM5
COMPANION_USER_ID=Ghostman
```

Do not commit real `.env` files.

### Backend install

Backend dependencies are managed at the repository root:

```bash
uv sync
```

### Frontend install

```bash
cd frontend
npm install
cd ..
```

On Windows PowerShell, if script policy blocks `npm`, use `npm.cmd`.

### Build the ChromaDB RAG store

```bash
cd backend
uv run python scripts/build_rag_combined.py
cd ..
```

This builds `backend/chroma_db/` locally from ESConv and EPITOME data.

### Run locally

Open two terminals.

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

Open:

- Frontend: `http://localhost:3000`
- Backend Swagger UI: `http://localhost:8000/docs`

### Standalone physical companion

```bash
cd backend
uv run python voice_companion.py
```

Optional hardware checks:

```bash
uv run python voice_companion.py --test-tone
uv run python voice_companion.py --test-eyes
```

Firmware is in `esp32/soulmate_speaker/soulmate_speaker.ino`. Install ESP32 Arduino support and the required display library before uploading.

## Limitations

- Non-clinical prototype; not a diagnosis, therapy, medical, or crisis service.
- Depends on external services: OpenAI, ElevenLabs, Hugging Face model downloads, Neo4j, and ChromaDB.
- Local ChromaDB must be built before RAG is useful.
- Empty Chair DistilBERT weights and EPITOME `.pth` scoring weights are large and may be locally absent.
- Several defaults are machine-specific, especially `COM5`, port `8000`, and frontend port `3000`.
- Browser/physical companion integration is intentionally separated; the browser does not speak directly to ESP32.
- Mood check-ins, accessibility preferences, and visible chat history are localStorage-based prototype state, not secure account storage.
- Memory/profile modelling is a weak, experimental signal and should not be interpreted as psychological assessment.
- Empty Chair safety labels come from weakly supervised/support-forum style categories and are not clinical outcomes.
- Benchmark results are limited to committed experiments and should not be generalized to real-world longitudinal wellbeing impact.
- Hardware behavior depends on wiring, USB serial reliability, audio device availability, and local OS support.

## References

- Sharma, Ashish, Adam Miner, David Atkins, and Tim Althoff. 2020. "A Computational Approach to Understanding Empathy Expressed in Text-Based Mental Health Support." In *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP)*, 5263-5276. Online: Association for Computational Linguistics. DOI: `10.18653/v1/2020.emnlp-main.425`.
- Wu, Di, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, and Dong Yu. 2024. "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory." arXiv:`2410.10813`; listed as ICLR 2025 on the arXiv record.
- Ji, Shaoxiong, Xue Li, Zi Huang, and Erik Cambria. 2022. "Suicidal Ideation and Mental Disorder Detection with Attentive Relation Networks." *Neural Computing and Applications* 34:10309-10319. DOI: `10.1007/s00521-021-06208-y`.
- Ji, Shaoxiong, Xue Li, Zi Huang, and Erik Cambria. 2022. "Reddit SuicideWatch and Mental Health Collection (SWMH) for Suicidal Ideation and Mental Disorder Detection." Zenodo. DOI: `10.5281/zenodo.6476179`.
