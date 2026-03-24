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
- **Backend `.env`** must contain: `OPENAI_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `ELEVEN_API_KEY`

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

Processing flow per user message:
1. **PerceptionAgent** (`perception.py`) — Detects emotion using keyword matching + RoBERTa (`SamLowe/roberta-base-go_emotions`)
2. **GraphMemory** (`memory.py`) — Retrieves conversation context & user profile from Neo4j
3. **KnowledgeAgent** (`knowledge.py`) — RAG retrieval from ChromaDB (embeddings via `text-embedding-3-small`)
4. **DialogueAgent** (`dialogue.py`) — Generates empathetic response using GPT-4o-mini with emotion, memory context, OCEAN profile, and RAG examples
5. **Background async tasks**: InferenceAgent (`inference.py`) updates OCEAN personality scores; narrative reflection triggers every 10 turns

System prompts for all agents are centralized in `backend/agent/prompts.py`.

### Special Agents
- **EmptyChairAgent** (`emptychair_agent.py`) — Simulates empty chair psychotherapy; role-plays as a target person given relationship context
- **VoiceInterface** (`voice_io.py`) — STT via OpenAI Whisper, TTS via ElevenLabs

### API Layer
- `backend/api/chat.py` — WebSocket endpoint `WS /ws/chat/{user_id}` handling 3 modes: `messaging`, `voice`, `empty-chair`
- `backend/api/profile.py` — REST endpoints for OCEAN profile data (`GET /profile/ocean/{user_id}`)
- `backend/core/dependencies.py` — FastAPI dependency injection (singleton `AgenticEmpathySystem`)
- Entry point: `backend/main.py`

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

## Platform Notes

- Windows development environment — backend uses `asyncio.WindowsSelectorEventLoopPolicy()` in `main.py`
- TypeScript path alias: `@/*` maps to frontend root
- No test suite exists — use `audit_pipeline.py` for system validation and benchmarks for quality evaluation
