# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

After completing any feature or fix:
1. Commit and push to GitHub first
2. Only after a successful `git push`, update CLAUDE.md to reflect the change:
   - If it's a new feature/agent: add it under the relevant Architecture section
   - If it's a completed task: note it with the date
   - If it changes a command or setup step: update the relevant section
3. Never update CLAUDE.md speculatively — only document what has actually been pushed

## Project Overview

**SoulMate** — A multi-agent AI companion with empathy, graph memory, and personality awareness. Built by Lê Quốc Bảo (UIT). The project has two main parts: a Python/FastAPI backend and a Next.js/React frontend.

## Development Commands

### Backend (Python — uses `uv` package manager)
```bash
cd backend
uv sync                                                        # Install dependencies
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000   # Dev server (port 8000)
```

### Frontend (Next.js)
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Dev server (port 3000)
npm run build      # Production build
npm run lint       # ESLint
```

### Audit / Validation
```bash
cd backend && uv run python audit_pipeline.py   # Validates env vars, agent connectivity, Neo4j, ChromaDB, prompts
```

### Required Services
- **Neo4j** — Graph database for memory & user profiles (default: `bolt://localhost:7687`)
- **`backend/.env`** must contain: `OPENAI_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `ELEVEN_API_KEY`

## Building the RAG Knowledge Base

ChromaDB must be pre-built before running the app. KnowledgeAgent has no inline fallback — it requires a pre-populated `chroma_db/`.

```bash
cd backend && uv run python scripts/build_rag_from_esconv.py   # ESConv dataset only (80% train split)
cd backend && uv run python scripts/build_rag_combined.py      # ESConv 100% + EPITOME level=2 examples (recommended)
```
Output: `backend/chroma_db/` collection `soulmate_knowledge_base`.

## Architecture

### Multi-Agent Pipeline (backend)

All agents live in `backend/agent/`. The orchestrator is `backend/core/engine.py` (`AgenticEmpathySystem`).

**Two processing paths exist:**

**Agentic** (`process_brain_agentic()`): RouterAgent dynamically selects components per turn. **This is what the web app uses** (`api/chat.py`).
**Baseline** (`process_brain()`): All components always active. Used in benchmarks for ablation comparisons (RAG-only, RAG+Memory, etc.).

Processing flow per user message:
1. **PerceptionAgent** (`perception.py`) — Detects emotion using keyword matching + RoBERTa (`SamLowe/roberta-base-go_emotions`). Falls back to keyword-only if model fails to load. Emotion keywords loaded from `backend/data/emotion_keywords.json`.
2. **RouterAgent** (`router.py`) — *(agentic path only)* Decides which components to activate. RAG is always on; router selects at most ONE secondary: Memory OR OCEAN (never both). Memory gets priority if both are relevant. Uses GPT-4o-mini with temperature=0.
3. **GraphMemory** (`memory.py`) — Retrieves conversation context & user profile from Neo4j
4. **KnowledgeAgent** (`knowledge.py`) — RAG retrieval from ChromaDB (embeddings via `text-embedding-3-small`)
5. **DialogueAgent** (`dialogue.py`) — Generates empathetic response using GPT-4o-mini (temperature=0) with emotion, memory context, OCEAN profile, and RAG examples
6. **Background async tasks**: InferenceAgent (`inference.py`) updates OCEAN personality scores; narrative reflection triggers every 10 turns

System prompts for all agents are centralized in `backend/agent/prompts.py`. EmptyChairAgent uses temperature=0.7 for more creative roleplay; all other LLM agents use temperature=0.

**New-user onboarding**: When OCEAN scores are all 0.5 (default), the engine runs a 3-question warm-start flow before main chat begins, then infers initial OCEAN scores from the combined answers.

### Special Agents
- **EmptyChairAgent** (`emptychair_agent.py`) — Simulates empty chair psychotherapy; role-plays as a target person given relationship context
- **VoiceInterface** (`voice_io.py`) — STT via OpenAI Whisper, TTS via ElevenLabs

### API Layer
- `backend/api/chat.py` — WebSocket endpoint `WS /ws/chat/{user_id}` handling 3 modes: `messaging`, `voice`, `empty-chair`
- `backend/api/profile.py` — REST endpoints for OCEAN profile data (`GET /profile/ocean/{user_id}`)
- `backend/core/dependencies.py` — FastAPI dependency injection (singleton `AgenticEmpathySystem`)
- Entry point: `backend/main.py`

### WebSocket Message Protocol

**Client → Server:**
```json
{"action": "send_text", "mode": "messaging|voice|empty-chair", "text": "...", "use_voice": false}
{"action": "start_recording", "mode": "voice"}
```
Empty-chair sessions initialize with a special text format:
```
[SYSTEM_INIT] TARGET: {name} | RELATIONSHIP: {relation} | UNSPOKEN_NEED: {need} | MESSAGE: {message}
```

**Server → Client message types:**
- `{"type": "message", "content": "...", "mode": "..."}` — AI response
- `{"type": "emotion_status", "emotion": "...", "confidence": 0.0-1.0}` — Emotion detection result
- `{"type": "status", "content": "listening|speaking|idle"}` — Voice mode state
- `{"type": "user_speech", "content": "..."}` — Transcribed speech (voice mode)

### Frontend (Next.js App Router)

- **Pages**: `app/messaging/page.tsx` (text chat), `app/voice/page.tsx` (voice orb UI), `app/empty-chair/page.tsx` (therapy setup + chat)
- **Shared hook**: `hooks/useChat.ts` — WebSocket connection management, multi-mode chat history, emotion state
- **Components**: `Sidebar.tsx` (nav + OCEAN radar chart), `OceanChart.tsx` (Recharts radar, polls `/profile/ocean/{user_id}` every 5s)
- **Context**: `UserContext.tsx` (user ID, localStorage-backed), `ThemeContext.tsx` (dark/light mode)
- **Styling**: Tailwind CSS 4 + Framer Motion animations; color-coded by mode (blue=messaging, indigo=voice, purple=empty-chair)

### Key Tech
- **Backend**: Python 3.12+, FastAPI, LangChain (OpenAI + Chroma), Neo4j driver, Transformers (PyTorch)
- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Recharts, Framer Motion
- **LLM**: GPT-4o-mini (dialogue, inference), RoBERTa (emotion detection)
- **Databases**: Neo4j (graph memory/profiles), ChromaDB (vector store for RAG)

## Evaluation / Benchmarks

Benchmark scripts live in `backend/evaluate/benchmark/`. Uses the EPITOME framework from `behavioral-data/Empathy-Mental-Health` to measure empathy on 3 dimensions: Emotional Reactions (ER), Interpretations (IP), Explorations (EX). Each scored 0–2.

```bash
cd backend
uv run python evaluate/benchmark/run_benchmark_v5.py    # Ablation study: 5 configs
uv run python evaluate/benchmark/run_stability_test.py   # 3-run stability test
```

### How the benchmark works (7 steps)

1. **Clean Neo4j** — Deletes all `bench*` users to start fresh
2. **Human baseline** — Computes mean ER/IP/EX from EPITOME Reddit dataset (`data/epitome/`) as reference
3. **Load test seekers** — 50 seeker posts sampled from EPITOME (seed=42), cached in `test_seekers_v5.csv`
4. **Warm-up** — Sends 5 messages per benchmark user (`bench_ragmem`, `bench_ragocean`, `bench_agentic`) to build conversation history and OCEAN profiles before testing
5. **Generate responses** — Each of the 50 posts is processed through 5 configs:
   - **Baseline**: Raw GPT-4o-mini (no SoulMate pipeline, just a simple empathy prompt)
   - **RAG**: SoulMate with only KnowledgeAgent (ChromaDB)
   - **RAG+Memory**: SoulMate with KnowledgeAgent + GraphMemory
   - **RAG+OCEAN**: SoulMate with KnowledgeAgent + OCEAN personality
   - **Agentic**: SoulMate with RouterAgent deciding Memory/OCEAN per message
   - All configs use `save_ai_response=False` to avoid polluting memory during benchmark
6. **Score empathy** — Each (seeker_post, response) pair is scored by 3 EPITOME classifier models (bi-encoder RoBERTa with cross-attention, pre-trained weights: `reddit_ER.pth`, `reddit_IP.pth`, `reddit_EX.pth`). Output: 0/1/2 per dimension.
7. **Aggregate & visualize** — Mean scores per config → CSV table + grouped bar chart PNG. Also analyzes RouterAgent decisions (which components it chose, by emotion).

## Platform Notes

- Windows development environment — backend uses `asyncio.WindowsSelectorEventLoopPolicy()` and UTF-8 stdout/stderr wrapping in `main.py`
- TypeScript path alias: `@/*` maps to frontend root
- No test suite exists — use `audit_pipeline.py` for system validation
- RAG emotion mapping: anxiety→anxious, sadness→sad, anger→angry, fear→anxious, depression→sad, shame→sad, disgust→disgust
