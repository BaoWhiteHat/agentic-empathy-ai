# Repository Instructions for Codex

## 1. Project Overview

SoulMate is a non-clinical agentic AI companion for emotional and behavioural wellbeing. Keep the product language supportive and non-clinical; do not add diagnostic, therapeutic, or medical claims.

The system has three components:

- Frontend: Next.js / React single-root app in `frontend/`.
- Backend: Python / FastAPI multi-agent pipeline in `backend/`.
- ESP32 firmware: physical companion with SH1106 OLED emotion display and MAX98357A speaker output in `esp32/`.

## 2. Authoritative Docs

- `FRONTEND_DOCS.md` is authoritative for frontend structure, screens, hooks, state, styling, and frontend/backend divergence notes.
- `BACKEND_DOCS.md` is authoritative for backend agents, API endpoints, WebSocket protocol, safety flow, memory, RAG, voice companion, and ESP32 integration.
- If `CLAUDE.md`, `FRONTEND_DOCS.md`, and `BACKEND_DOCS.md` disagree, prefer `BACKEND_DOCS.md` for backend/protocol/runtime behavior and `FRONTEND_DOCS.md` for frontend behavior.
- If unsure, inspect the source code. Update docs only after confirmed source changes, not speculatively.

Known stale Claude-oriented guidance to avoid carrying forward blindly:

- Old `app/messaging`, `app/voice`, and `app/empty-chair` route descriptions.
- Old physical companion MP3 serial protocol notes; current backend docs/source use PCM with `SOUL` header and ACK flow control.
- Any claim that the browser directly controls the ESP32.

## 3. Development Workflow

- Make small, targeted changes.
- Do not redesign unrelated screens or refactor unrelated modules.
- Do not change backend safety, EmptyChair, router, memory, RAG, or voice logic unless explicitly requested.
- Do not update documentation speculatively.
- Preserve user changes in the worktree. Do not revert unrelated dirty files.
- After completing a change, report changed files, exact diff summary, verification commands run, and any commands that failed because of environment issues.

## 4. Frontend Current Architecture

- The frontend uses Next.js App Router with exactly one route: `frontend/app/page.tsx` renders `SoulMateApp`.
- The old `app/messaging`, `app/voice`, and `app/empty-chair` routes are removed.
- Internal navigation is handled inside `SoulMateApp`.
- Active screens include Today, Companion, Reflections, Insights, Settings, Safety, and Memory.
- Frontend state providers live in `frontend/context/`; WebSocket hooks live in `frontend/hooks/`.
- Use existing CSS tokens from `frontend/app/globals.css`, including `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--ink-soft)`, `var(--ink-faint)`, `var(--sage)`, and `var(--line)`.
- Avoid hard-coded white text because it can break light mode.
- Preserve both dark mode and light mode.

## 5. Companion, Voice, and Physical Companion Rules

- The Companion screen has Chat, Physical, and EmptyChair tabs.
- The Physical tab is a UI page explaining or presenting the standalone hardware companion. It is not browser push-to-talk.
- Browser `start_recording` / `stop_recording` actions are legacy and should not be reintroduced unless explicitly requested.
- Live voice runs through `backend/voice_companion.py`.
- The browser may observe physical companion events through the voice-monitor path if an active UI uses it.
- The Physical tab should present the hardware feature clearly, but must not imply browser-side control unless that control is actually implemented.
- Do not add fake Start/Stop buttons unless they are actually wired to backend endpoints.

## 6. Backend Current Architecture

- Backend is Python/FastAPI.
- `AgenticEmpathySystem` in `backend/core/engine.py` is the orchestrator.
- The main web path uses `process_brain_agentic()`.
- RAG is always on for routed normal support.
- The router may add at most one secondary source: Memory or OCEAN.
- Do not change this routing rule unless explicitly requested.

## 7. EmptyChair Safety Rules

- Do not change EmptyChair safety logic unless explicitly requested.
- `CRISIS_KEYWORDS` must remain 15 items unless the user explicitly asks to edit the list.
- The SuicideWatch threshold must remain `0.2` unless explicitly requested.
- Routing actions are `normal_roleplay`, `safe_roleplay`, and `stop_roleplay`.
- `stop_roleplay` should stop roleplay and use a crisis-safe response.
- Safety routing is non-clinical. Do not describe it as diagnosis or clinical risk assessment.

## 8. Hotline and Crisis Text Rule

- Keep visible hotline text consistent across backend, frontend, docs, and poster-related source if present.
- Current intended visible numbers:
  - `Vietnam: 096 306 1414`
  - `US: 988 (Suicide & Crisis Lifeline)`
- Do not change safety logic when editing hotline text.

## 9. Physical Companion and ESP32 Rules

- `backend/voice_companion.py` runs as the standalone hardware companion.
- It uses the laptop mic, backend pipeline, ESP32 OLED, and speaker output.
- Current backend docs are authoritative for serial protocol and hardware behavior.
- Do not assume the browser talks directly to the ESP32.
- Do not revert to the old MP3 serial protocol if backend docs/source use PCM with `SOUL` header and ACK flow control.

## 10. Verification Commands

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd backend
uv run python -m py_compile <touched_python_files>
uv run python audit_pipeline.py
```

Example:

```bash
uv run python -m py_compile agent/emptychair_safety.py
```

Notes:

- If PowerShell blocks `npm.ps1`, use `npm.cmd` or run through `cmd`.
- If `uv` cannot access cache due to sandbox permissions, report it as an environment issue, not a code issue.
- Do not invent successful verification. Be explicit if a command could not run.

## 11. Safe Editing Checklist

Before finishing any task, confirm:

- No unrelated files were changed.
- No safety-routing logic changed unless requested.
- No backend changes were made for frontend-only tasks.
- Light mode and dark mode still have readable text.
- For frontend visual changes, check both wide-screen layout and responsive/narrow layout.
- Removed UI settings are truly unused before deleting them.
- Any documentation updates match the actual source code.
