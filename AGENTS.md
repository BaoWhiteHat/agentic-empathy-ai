# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the FastAPI app, agent orchestration, data, and evaluation tooling. Core runtime code lives in `backend/agent/`, `backend/api/`, and `backend/core/`; `backend/main.py` is the API entrypoint. RAG builders are in `backend/scripts/`, and benchmark/evaluation scripts live in `backend/evaluate/`.

`frontend/` is a Next.js 16 App Router app. Route files are under `frontend/app/`, shared UI in `frontend/components/`, state providers in `frontend/context/`, and WebSocket logic in `frontend/hooks/useChat.ts`. `esp32/` contains Arduino firmware for the physical speaker companion.

## Build, Test, and Development Commands
Backend setup: `cd backend && uv sync`

Frontend setup: `cd frontend && npm install`

Run backend locally: `cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`

Run frontend locally: `cd frontend && npm run dev`

Lint frontend: `cd frontend && npm run lint`

Build RAG data: `cd backend && uv run python scripts/build_rag_combined.py`

Smoke-test the full pipeline: `cd backend && uv run python audit_pipeline.py`

## Coding Style & Naming Conventions
Follow existing conventions in each stack. Python uses 4-space indentation, snake_case for modules/functions, and small focused modules such as `router.py` or `memory.py`. TypeScript/React uses 2-space indentation, PascalCase for components (`OceanChart.tsx`), camelCase for hooks/helpers, and App Router folder names such as `app/messaging`.

Keep prompts and agent behavior centralized where possible, especially in `backend/agent/prompts.py`. Use ESLint in `frontend/eslint.config.mjs`; there is no repo-wide formatter config, so match surrounding style closely.

## Testing Guidelines
This repository does not currently have a dedicated unit-test suite. For backend changes, run `audit_pipeline.py` and, when relevant, the benchmark scripts in `backend/evaluate/benchmark/`. For frontend changes, run `npm run lint` and verify the affected route manually in `messaging`, `voice`, or `empty-chair`.

Name any new validation scripts by purpose, for example `run_stability_test.py` or `finalize_full.py`.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit messages such as `Add physical companion...`, `Switch web app...`, and `Refactor: clean up codebase...`. Keep commits scoped to one change set and lead with a verb.

PRs should include a concise summary, affected areas (`backend`, `frontend`, `esp32`), setup or migration notes, and screenshots for UI changes. Link related issues when available and note any required env vars, model keys, or Neo4j/ChromaDB prerequisites.

## Security & Configuration Tips
Store secrets in `backend/.env`; never commit API keys or local database credentials. Validate Neo4j and ChromaDB connectivity before merging changes that touch memory or RAG flows.
