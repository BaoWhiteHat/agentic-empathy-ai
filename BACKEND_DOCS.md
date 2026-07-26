# BACKEND_DOCS.md

Technical reference for the **SoulMate** Python/FastAPI backend (`backend/`).
Generated from a verbatim reading of the backend source — every statement below is
traceable to a specific file/function. Where source behaviour differs from the
README/CLAUDE.md prose, the source is authoritative and the divergence is noted.

> **Secrets note:** `backend/.env` contains live API keys in this checkout. Only
> the *names* of the required variables are documented here; never commit or paste
> the values. Rotate them if they have been shared.

---

## Table of Contents

0. [System context (backend ↔ frontend ↔ ESP32)](#0-system-context-backend--frontend--esp32)
1. [Architecture overview](#1-architecture-overview)
2. [API endpoints](#2-api-endpoints)
3. [Agents](#3-agents)
4. [Router logic](#4-router-logic)
5. [OCEAN inference](#5-ocean-inference)
6. [Safety system](#6-safety-system)
7. [Memory module (Neo4j)](#7-memory-module-neo4j)
8. [ChromaDB / RAG](#8-chromadb--rag)
9. [WebSocket protocol](#9-websocket-protocol)
10. [External services](#10-external-services)
11. [Configuration & dependencies](#11-configuration--dependencies)
12. [Tooling / scripts](#12-tooling--scripts)

---

## 0. System context (backend ↔ frontend ↔ ESP32)

> **Companion document:** this file documents the backend. The browser client is
> documented in **[FRONTEND_DOCS.md](FRONTEND_DOCS.md)**; the two docs share the
> same diagram, the same names, and the same cross-boundary contract. **This
> section (§0) is the authoritative source for the cross-component picture and the
> end-to-end lifecycles** — FRONTEND_DOCS.md §0 mirrors the diagram and divergences
> and points back here for the lifecycle detail. The WebSocket message protocol
> itself is specified in [§9](#9-websocket-protocol).

SoulMate is one system made of **three components**:

1. **Backend** — Python/FastAPI (`backend/`). Owns the multi-agent empathy
   pipeline (`AgenticEmpathySystem` in `core/engine.py`), all model calls, Neo4j
   graph memory, and the ChromaDB RAG store. Serves the browser over a **chat
   WebSocket** (`/ws/chat/{user_id}`) and **REST** (`/api/*`), and serves a
   read-only **voice-monitor WebSocket** (`/ws/voice-monitor/{user_id}`).
2. **Frontend** — Next.js/React (`frontend/`). The single-page app
   (`SoulMateApp`) the user interacts with: text chat, Empty-Chair therapy with
   the crisis-safety lifecycle, OCEAN insights, reflections, and a read-only
   voice-companion monitor. Talks to the backend via the chat WebSocket
   (`hooks/useChat.ts`), REST (`hooks/useOcean.ts`, reflections fetches), and the
   voice-monitor WebSocket (`hooks/useVoiceMonitor.ts`).
3. **ESP32 firmware** — `esp32/soulmate_speaker/soulmate_speaker.ino`. The
   physical voice companion's microcontroller. Receives PCM audio + an emotion
   tag from `backend/voice_companion.py` over **USB serial** and plays it through
   a MAX98357A I²S amplifier while animating emotion "eyes" on an SH1106 OLED.

The standalone `backend/voice_companion.py` is the bridge to the hardware: it runs
the **same** `AgenticEmpathySystem` pipeline locally with a laptop mic, streams
synthesized PCM to the ESP32 over serial, and POSTs pipeline events to the
backend's voice-monitor endpoint so a browser can observe the physical session.
It can be launched standalone or spawned by the web UI via the
`/api/companion/*` routes ([§2](#2-api-endpoints)).

```
+---------------------------------------------------------------+
|                        SoulMate system                        |
+---------------------------------------------------------------+

   [ Frontend ]              [ Backend ]               [ ESP32 ]
   Next.js / React           FastAPI                   firmware (.ino)
   frontend/                 backend/main.py           esp32/soulmate_speaker/
   - useChat        ==WS===> AgenticEmpathySystem
   - useOcean       ==REST=> (core/engine.py)
   - useVoiceMonitor <=WS===   api/chat.py
                             perception -> safety
                             -> router -> memory/RAG
                             -> dialogue -> store
                             Neo4j + ChromaDB
                                   |
                                   | spawns subprocess (companion_control)
                                   v
                             voice_companion.py
                             laptop mic + full pipeline
                             - POSTs events -> voice-monitor WS
                                   |
                                   | USB serial @921600
                                   | "SOUL"+len+PCM   -->
                                   | <-- 'A' ACK (credit-based)
                                   | "EMOTION:<label>\n" -->
                                   v
                             ESP32: I2S -> MAX98357A speaker
                                    SH1106 OLED emotion eyes
```

### Integration contract (where each cross-boundary interface is documented)

| Interface | URL / shape | Backend (authoritative) | Frontend client |
|-----------|-------------|-------------------------|-----------------|
| Chat WebSocket | `ws://…/ws/chat/{user_id}` | [§9](#9-websocket-protocol), `api/chat.py` | `hooks/useChat.ts`, `screens/Companion.tsx` — FRONTEND_DOCS §10 |
| Voice-monitor WebSocket | `ws://…/ws/voice-monitor/{user_id}` | [§9](#9-websocket-protocol) end, `api/voice_monitor.py` | `hooks/useVoiceMonitor.ts` — FRONTEND_DOCS §6 |
| OCEAN REST | `GET /api/ocean/{user_id}` | [§2](#2-api-endpoints), `api/profile.py` | `hooks/useOcean.ts` — FRONTEND_DOCS §6 |
| Reflections REST | `GET/POST /api/reflections/{user_id}`, `DELETE …/{id}` | [§2](#2-api-endpoints), `api/reflections.py` | `screens/Reflections.tsx` — FRONTEND_DOCS §3 |
| Companion control REST | `GET/POST /api/companion/{status,start,stop}` | [§2](#2-api-endpoints), `api/companion_control.py` | (manual / no first-party UI caller) |
| Serial audio | `"SOUL"+len+PCM`, `'A'` ACK, `EMOTION:` line | [§10](#10-external-services) → *Physical companion* | n/a (hardware) |

**`user_id` semantics (consistent everywhere):** the `user_id` in every URL **is
the user's display name** entered at onboarding. The frontend stores it in
`localStorage['soulmate_user_id']` (`UserContext`) and uses it verbatim as the
WebSocket/REST path segment; the backend uses that same string as the **Neo4j
`User.id` key**. So name = path segment = graph key — one identity across chat,
REST, the physical companion (`COMPANION_USER_ID`), and the voice monitor.

**`mode` values (consistent everywhere):** `messaging` | `voice` | `empty-chair`.
A single chat socket multiplexes all three; the client tags each `send_text` with
`mode` and the server echoes `mode` back on `message` frames so the client can
route history. `voice` over the chat socket is legacy (see divergence D1 below);
live voice now runs through `voice_companion.py`.

### End-to-end lifecycle: a typed chat message

Naming the file/function as control crosses each boundary:

1. **UI send** — `ChatView`/`EmptyChairView` (`frontend/components/screens/Companion.tsx`)
   call `sendMessage(text)` from `hooks/useChat.ts`, which sends
   `{"action":"send_text","text":…,"mode":…}` over `/ws/chat/{userId}`.
2. **Backend receive** — the websocket handler in `api/chat.py` `json.loads` the
   frame and branches on `action`/`mode`.
3. **Perception** — `PerceptionAgent.detect_emotion` (`agent/perception.py`);
   server emits `emotion_status {emotion, confidence}`.
4. **Safety** — inside `AgenticEmpathySystem.process_brain_agentic`
   (`core/engine.py`), `SafetyGuardrail.classify` (`agent/safety.py`). A
   `self_harm_or_suicide` verdict short-circuits to
   `SafetyPolicy.immediate_response` (**no LLM**, sanitized turn stored).
5. **Router** — `RouterAgent.decide` (`agent/router.py`) → `{use_memory, use_ocean,
   use_rag}`, then safety post-overrides ([§4](#4-router-logic)).
6. **Retrieval / memory** — `process_brain` calls `GraphMemory.get_context` /
   `get_user_profile` / `get_narrative_profile` (`agent/memory.py`) and
   `KnowledgeAgent.retrieve_examples` (`agent/knowledge.py`).
7. **Dialogue** — `DialogueAgent.generate_response` (`agent/dialogue.py`).
8. **Store** — `GraphMemory.add_turn`; fire-and-forget `background_learning`
   (OCEAN) and `manage_reflection` (every 10th turn).
9. **Server frames** — `api/chat.py` emits `message {content, mode}`, then (voice)
   `audio_chunk*` + `audio_end`, then `status:"idle"`.
10. **Frontend render** — `useChat`'s `onmessage` dispatches: `message` →
    `chatHistories[mode]`, `emotion_status` → `emotion` (shown by `EmotionBadge`),
    `audio_chunk`/`audio_end` → Web Audio playback, `status` → `status`;
    `Companion.tsx` renders the bubbles.

### End-to-end lifecycle: Empty-Chair safety (spans both sides)

1. **Setup** — `EmptyChairView.begin()` (`Companion.tsx`) sends a `send_text`
   whose text is the `[SYSTEM_INIT] TARGET: … | RELATIONSHIP: … | UNSPOKEN_NEED: …
   | MESSAGE: …` payload. `api/chat.py` parses it by regex into
   `empty_chair_sessions` and **bypasses safety for the init turn** (`init_bypass`).
2. **Per-turn safety** — `api/chat.py` runs `EmptyChairHybridSafety.decide`
   (`agent/emptychair_safety.py`, DistilBERT, wrapped in `asyncio.wait_for`,
   `DISTILBERT_TIMEOUT_SECONDS=3.0`) and emits `safety_decision {action, method,
   risk_level, suicidewatch_probability}`. Frontend `fromBackendDecision`
   (`lib/safetyRouter.ts`) maps it to an `Assessment`; `safe_roleplay` shows the
   reassurance banner.
3. **Stop / crisis** — on `stop_roleplay` the backend emits `crisis_mode
   {lockout_seconds:15, show_breathing:true}` **and** `elevated_mode {active:true,
   until_timestamp, reason:"crisis_detected"}` (30-min window,
   `ELEVATED_MODE_DURATION_SECONDS=1800`). The frontend immediately renders and
   preserves the crisis card, waits for the following crisis-safe `message` frame,
   then opens the app-level `SafetyScreen` and overlays `SafetySupportPanel` there;
   breathing is one optional panel action.
4. **Re-entry** — the panel can also be opened by backend
   `re_entry_choice {prompt, buttons[]}`. Resume → `resume_roleplay`; end →
   `end_session` → backend `safety_summary {session_duration, crisis_count}`.

### Known protocol divergences (frontend ↔ backend ↔ code)

These are documented identically in FRONTEND_DOCS §0. The **code** is authoritative;
each item is the gap between what is on the wire and what each side actually uses.

- **D1 — voice PTT actions.** `start_recording` / `stop_recording` (client→server,
  `mode:"voice"`) are still accepted by `api/chat.py`, but the browser no longer
  emits them. Push-to-talk now happens only inside `voice_companion.py`.
- **D2 — Empty-Chair lifecycle actions.** `api/chat.py` accepts **five**
  (`resume_roleplay`, `switch_to_support`, `end_session`, `show_reentry_options`,
  `check_elevated_mode`); the browser (`Companion.tsx`) currently emits only
  **three** (`resume_roleplay`, `end_session`, `show_reentry_options`).
  `switch_to_support` and `check_elevated_mode` are reachable on the wire but
  unused by the current UI.
- **D3 — `re_entry_choice` payload.** The backend sends `{prompt, buttons[]}`
  (`buttons` = `play_sounds`, `try_grounding`, `resume_roleplay`,
  `switch_to_support`, `end_session`). The frontend handler **ignores `prompt` and
  `buttons`** and instead hands off to the app-level `SafetyScreen`, which opens
  `SafetySupportPanel` with local `SUPPORT_OPTIONS` (`try_grounding`, `try_breathing`, `play_sounds`,
  `open_safety`, `end_session`) plus a separate "I'm okay — continue" → `resume_roleplay`
  link. The option set the user sees is frontend-defined, not backend-driven.
- **D4 — `status` content range.** The chat socket (`/ws/chat`) only ever emits
  `listening` / `speaking` / `idle`. The richer set (`processing`, `transcribing`,
  `thinking`) appears **only** on the voice-monitor channel, POSTed by
  `voice_companion.py` to `/api/voice-monitor/{user_id}/event`.

---

## 1. Architecture overview

### Entry point & wiring

`backend/main.py` builds the FastAPI app:

- Applies a Windows fix: `asyncio.WindowsSelectorEventLoopPolicy()` and wraps
  `stdout`/`stderr` in UTF-8 `TextIOWrapper` (only on `win32`).
- `lifespan` context manager calls `get_system()` on startup and `system.close()`
  on shutdown/reload.
- CORS: `allow_origins=["http://localhost:3000"]`, all methods/headers, credentials on.
- Mounts **five** routers: `chat`, `profile`, `voice_monitor`, `reflections`, `companion_control`.

`backend/core/dependencies.py` holds a **module-global singleton**
`system_instance` of `AgenticEmpathySystem`, returned by `get_system()` (the
FastAPI dependency). One "brain" is shared across all requests/sockets.

### The orchestrator — `AgenticEmpathySystem` (`backend/core/engine.py`)

On `__init__` it eagerly constructs the always-on agents (in this order):

```
PerceptionAgent, InferenceAgent, KnowledgeAgent(reset_db=False),
DialogueAgent, VoiceInterface, RouterAgent, SafetyGuardrail
```

It then connects the optional/failable subsystems and — still inside the same
`__init__` — constructs `EmptyChairAgent` once `memory`/`emptychair_safety` are
resolved:

| Subsystem | Failure behaviour |
|-----------|-------------------|
| `GraphMemory` (Neo4j) | Requires `NEO4J_PASSWORD` or raises `ValueError`. On any connection error, `self.memory = None` and the system runs memory-less. |
| `EmptyChairHybridSafety` (DistilBERT) | Constructed with `suicide_threshold=0.2, max_length=256`. On any exception (e.g. missing weights → `OSError`), `self.emptychair_safety = None`; EmptyChair runs without DistilBERT routing. |
| `EmptyChairAgent` | Always constructed, injected with `memory` and `emptychair_safety`. |

`self.user_turn_counters` is an in-memory `{user_id: int}` used for the
every-10-turns reflection trigger.

### Two processing paths

```
process_brain_agentic()   ← used by the web app (chat.py)
        │  RouterAgent decides Memory/OCEAN per turn; safety classified first
        ▼
process_brain()           ← the actual generation pipeline
        │  also called directly by benchmarks with explicit ablation flags
        ▼
DialogueAgent.generate_response()
```

### Request lifecycle (agentic path, `mode="messaging"`)

```
WS receive_text → json.loads
  ├─ (new user?) onboarding 3-question flow → warm-start OCEAN, return
  ├─ PerceptionAgent.detect_emotion(text)         → {emotion, confidence}
  │     emit emotion_status
  ├─ process_brain_agentic(text, user_id, emotion, mode)
  │     1. SafetyGuardrail.classifier.classify(text, emotion, mode)
  │        └─ if risk_type == self_harm_or_suicide:
  │              return policy.immediate_response(...) (NO LLM, store safe summary)
  │     2. gather has_history / has_ocean / narrative / ocean_profile_str from memory
  │     3. RouterAgent.decide(...)                 → {use_memory, use_ocean, use_rag, reasoning}
  │     4. safety post-overrides (high_distress → OCEAN off; clinical_boundary → RAG+OCEAN off)
  │     5. process_brain(...)
  │          ├─ re-gate router choices vs SafetyDecision flags:
  │          │     use_memory &= allow_memory, use_ocean &= allow_ocean, use_rag &= allow_rag
  │          ├─ memory.get_context()/get_narrative_profile()/get_user_profile()
  │          ├─ knowledge.retrieve_examples()      (asyncio.to_thread)
  │          ├─ dialogue.generate_response()        (asyncio.to_thread)
  │          └─ memory.add_turn(...) (sanitized if safety_decision.store_raw_turn is False)
  ├─ emit message {content, mode}
  ├─ (use_voice) stream TTS chunks → audio_chunk* + audio_end
  ├─ emit status idle
  └─ background tasks (fire-and-forget asyncio.create_task):
        background_learning() → InferenceAgent OCEAN update (skipped on self-harm)
        manage_reflection()   → every 10th turn, narrative reflection
```

Blocking calls (HF model inference, Neo4j I/O, LLM HTTP, ElevenLabs, mic) are
pushed off the event loop via `asyncio.to_thread`.

---

## 2. API endpoints

All routers are included in `main.py`. There is **no global path prefix**; paths
below are absolute.

### REST

| Method | Path | Source | Path params | Body | Response shape |
|--------|------|--------|-------------|------|----------------|
| GET | `/api/v1/profile/{user_id}` | `api/profile.py` | `user_id` | — | `{"user_id": str, "traits": {ocean...}}` or `{"error": "Memory DB chưa sẵn sàng"}` if memory down |
| GET | `/profile/ocean/{user_id}` | `api/profile.py` | `user_id` | — | Raw OCEAN dict `{openness, conscientiousness, extraversion, agreeableness, neuroticism}` (floats) or `{"error": str}` |
| GET | `/api/ocean/{user_id}` | `api/profile.py` | `user_id` | — | OCEAN dict **+** `"narrative": str`. Narrative is `""` until reflection has run (or if value is `"No narrative yet."`). Returns all-0.5 default + `narrative:""` if memory down |
| POST | `/api/reflections/{user_id}` | `api/reflections.py` | `user_id` | `ReflectionCreate{title:str, body:str, mood:str=""}` | The created entry: `{id, title, body, mood, timestamp}` (or `{}` on write error) |
| GET | `/api/reflections/{user_id}` | `api/reflections.py` | `user_id` | — | `{"reflections": [ {id,title,body,mood,timestamp}, ... ]}` (most-recent first, limit 20) |
| DELETE | `/api/reflections/{user_id}/{reflection_id}` | `api/reflections.py` | `user_id`, `reflection_id` | — | `{"deleted": true, "id": reflection_id}`. `404` if not found, `500` if memory store unavailable / delete fails |
| POST | `/api/voice-monitor/{user_id}/event` | `api/voice_monitor.py` | `user_id` | `VoiceMonitorEvent` (see below) | `{"ok": true, "user_id": str, "connected_clients": int}` |
| GET | `/api/companion/status` | `api/companion_control.py` | — | — | `{"running": bool}` — `true` only while the spawned subprocess exists and `poll()` is `None` (auto-clears a dead handle) |
| POST | `/api/companion/start` | `api/companion_control.py` | — | `StartRequest{user_id: str = "Ghostman"}` (whole body optional) | `{"ok": true}`. Spawns `uv run python voice_companion.py` (cwd `backend/`) with env `ESP32_PORT="COM5"`, `USE_ESP32="True"`, `COMPANION_USER_ID=<user_id>`; no-op if already running |
| POST | `/api/companion/stop` | `api/companion_control.py` | — | — | `{"ok": true}`. Terminates the subprocess if alive, then clears the handle |

`VoiceMonitorEvent` (pydantic, `voice_monitor.py`):

```python
type: "status" | "emotion_status" | "user_speech" | "message"
content: str | None
status: "listening"|"processing"|"transcribing"|"thinking"|"speaking"|"idle" | None
emotion: str | None
confidence: float | None
mode: str = "voice"
```

The POST handler dumps the event with `exclude_none=True`, forces `mode="voice"`,
and — when `type=="status"` with only a `status` field — copies `status` into
`content`. It then **broadcasts** the payload to all connected voice-monitor
sockets for that `user_id` via a fire-and-forget `asyncio.create_task`.

The `companion_control` routes wrap the standalone `backend/voice_companion.py` so
the web UI can start/stop the physical hardware companion as a subprocess (it
spawns via `uv run`, not `sys.executable` — the module docstring is stale on this
point). A module-level `_process` handle (in-memory, lost on restart) tracks the
running companion; `start` is a no-op when one is already running.

### WebSocket

| Path | Source | Purpose |
|------|--------|---------|
| `/ws/chat/{user_id}` | `api/chat.py` | Main chat socket (messaging / voice / empty-chair) |
| `/ws/voice-monitor/{user_id}` | `api/voice_monitor.py` | Read-only monitor; the physical companion POSTs events that are fan-out broadcast to browser monitors. The socket itself only `receive_text()`s to detect disconnect. |

See [§9](#9-websocket-protocol) for the chat message protocol.

---

## 3. Agents

All agents live in `backend/agent/`. Most system prompts are centralized in
`agent/prompts.py`; two are defined inline next to their agents —
`ROUTER_SYSTEM_PROMPT` in `router.py` and `REFLECTION_SYSTEM_PROMPT` in
`inference.py`. The onboarding strings (`ONBOARDING_QUESTIONS`,
`ONBOARDING_COMPLETE_MSG`) live in `api/chat.py`.

### Agent I/O summary

| Agent | File | Model / tech | Input | Output |
|-------|------|--------------|-------|--------|
| PerceptionAgent | `perception.py` | RoBERTa `SamLowe/roberta-base-go_emotions` + keyword voting | `text` | `{"emotion": str, "confidence": float}` |
| RouterAgent | `router.py` | GPT-4o-mini (temp 0) + regex guardrails | `seeker_post, emotion, has_history, has_ocean, narrative, ocean_profile` | `{"use_memory","use_ocean","use_rag":True,"reasoning"}` |
| GraphMemory | `memory.py` | Neo4j bolt driver | `user_id`, turns, traits | conversation context string, OCEAN dict, narrative str, reflections list |
| KnowledgeAgent | `knowledge.py` | Chroma + `text-embedding-3-small` | `query_transcript, current_emotion, k=3` | formatted RAG examples string |
| DialogueAgent | `dialogue.py` | GPT-4o-mini (temp 0) via LangChain | emotion, memory, RAG, OCEAN, safety | response string |
| InferenceAgent | `inference.py` | GPT-4o-mini (temp 0.1, OCEAN) + GPT-4o (temp 0.4, reflection) | text/history | OCEAN dict / narrative paragraph |
| SafetyGuardrail | `safety.py` | keyword/emotion rules | `user_input, emotion, mode` | `SafetyDecision` dataclass |
| EmptyChairAgent | `emptychair_agent.py` | GPT-4o-mini (temp 0.7) | target/relationship/need/input | in-character reply string |
| EmptyChairHybridSafety | `emptychair_safety.py` | keyword + DistilBERT + threshold | `user_input` | `SafetyDecision` (EmptyChair variant) |
| VoiceInterface | `voice_io.py` | Whisper STT + ElevenLabs TTS | audio file / text | transcript / MP3 / PCM bytes |

### 3.1 PerceptionAgent (`perception.py`)

`detect_emotion(text)` runs a 3-step fusion:

1. **Keyword voting** (`_score_keywords`): lowercases, strips punctuation,
   tokenizes. For each token matching `data/emotion_keywords.json`, adds points
   (2 for `strong_words` like *devastated/furious*, else 1). A negation word
   (`not/no/never/don't/cant/hardly/shouldnt`) within the **2 preceding tokens**
   subtracts `points+1`. Top-scoring emotion wins if its score > 0; baseline
   confidence `0.7`.
2. **Model reinforcement** (if RoBERTa loaded): takes top label, maps it via
   `_map_model_emotion`. Agreement with keyword → confidence `max(0.95, model_conf)`.
   Disagreement but model `>0.7` → model wins. No keyword → model decides outright.
3. **Shout check**: if `text.isupper()` and `len>5` and emotion not already
   high-energy (`happy/love/surprise/angry`) → force `angry`.

`_map_model_emotion` collapses GoEmotions' 28 labels into SoulMate's set
(`love/happy/surprise/sad/depressed/ashamed/angry/disgust/fearful/confusion/neutral`).
If the model fails to load, `use_model=False` and it runs keyword-only.

### 3.2 DialogueAgent (`dialogue.py`)

Builds two LangChain chains at init:

- `normal_chain` = `SOULMATE_SYSTEM_PROMPT` + `SOULMATE_USER_PROMPT`
- `safe_chain`   = `SOULMATE_SAFETY_SYSTEM_PROMPT` + `SOULMATE_USER_PROMPT`

`generate_response(...)` selects `safe_chain` when `safe_mode=True`, else
`normal_chain`. OCEAN values arrive via `**kwargs` (default 0.5 each). The reply
is `.strip()`ped and **double-quotes are removed** (`.replace('"', "")`). On any
exception it returns a Vietnamese fallback: *"Mình đang lắng nghe đây. Bạn kể tiếp đi..."*.

The system prompt encodes per-trait adaptation thresholds (e.g. Neuroticism
`>0.6` → lead with reassurance/"we" language; `<0.4` → be direct), an emotion
strategy table, a memory/consistency check (factual/social conflict + a
SELF-REFERENCE rule), and non-clinical safety boundaries.

### 3.3 EmptyChairAgent (`emptychair_agent.py`)

`generate_response(user_id, target_name, relationship, unspoken_need, user_input,
emotion, _precomputed_safety=None)`:

1. Pulls `conflict_history = memory.get_conflict_history(user_id, target_name)`.
2. Safety: uses `_precomputed_safety` if supplied (chat.py precomputes it),
   otherwise calls `self.emptychair_safety.decide(user_input)` if available.
   - `stop_roleplay` → returns `emptychair_safety.crisis_response()`, stores a
     **redacted** turn (`raw_stored=False`), no LLM call.
   - `safe_roleplay` → prepends `safe_instruction()` to the user input, still
     roleplays.
3. Invokes the GPT-4o-mini (temp 0.7) chain with target/relationship/need/
   conflict_history/emotion/input.
4. Stores the turn (`raw_stored=True`) with the safety decision's risk fields.

---

## 4. Router logic

`RouterAgent.decide(seeker_post, emotion, has_history, has_ocean, narrative,
ocean_profile)` (`router.py`). **RAG is always on** — the router only ever adds
**at most one** secondary component (Memory **or** OCEAN), never both.

### Step 0 — deterministic regex guardrails (`_apply_router_guardrails`)

Run *before* the LLM. They short-circuit to RAG-only when a message is a
fully-specified, self-contained concrete incident:

- `_is_self_contained_concrete_incident`: `len(text) >= 80` **and** first-person
  marker **and** an event marker (`_EVENT_MARKER_RE`: today/forgot/spilled/...)
  **and** a feeling marker (`_FEELING_RE`) **and** a consequence marker
  (`_CONSEQUENCE_RE`).
- `_has_unresolved_referents`: leading/embedded dangling pronouns
  (`it/this/that/they/he/she`, "she finally", "about that", ...).
- `_requests_personalization`: phrases like "fits me", "how I operate",
  "tailored", "my style".

Guardrail decision table (only when incident is self-contained **and** no
unresolved referent):

| Condition | Result |
|-----------|--------|
| `has_ocean` and **not** personalization request | `{memory:F, ocean:F, rag:T}` — "do not use Memory/OCEAN unless personalization explicitly requested" |
| `has_history` (no OCEAN case) | `{memory:F, ocean:F, rag:T}` — "Memory is not needed" |
| self-contained incident + `has_ocean` + no personalization (referent state aside) | `{memory:F, ocean:F, rag:T}` — "OCEAN should remain off" |

If no guardrail fires, returns `None` and the LLM path runs.

### Step 1 — LLM decision

Builds a context block (history present? + `narrative`; OCEAN present? +
`ocean_profile` + a **significance hint**). `_profile_significance_hint` parses
OCEAN values with `_OCEAN_VALUE_RE` and computes the max `|value − 0.5|`;
`>= 0.15` → "clearly non-default", else "near default".

Calls `gpt-4o-mini`, `temperature=0`, with `ROUTER_SYSTEM_PROMPT` (a long rubric
distinguishing RAG-only / RAG+Memory / RAG+OCEAN), expecting JSON
`{"use_memory","use_ocean","use_rag":true,"reasoning"}`. Markdown fences are
stripped before `json.loads`.

### Step 2 — hard post-processing (always enforced)

```python
decisions["use_rag"] = True                       # never deactivated
if use_memory and use_ocean: use_ocean = False    # Memory wins ties
if not has_history: use_memory = False
if not has_ocean:   use_ocean  = False
```

On any exception → fallback `{memory:F, ocean:F, rag:T, reasoning:"fallback"}`.

### Step 3 — safety overrides (applied in `engine.process_brain_agentic`, after the router)

| `safety.risk_type` | Override |
|--------------------|----------|
| `high_distress` | `use_ocean = False` (reasoning appended) |
| `clinical_boundary` | `use_ocean = False` **and** `use_rag = False` |

> Selection rubric (from the rules + examples in `ROUTER_SYSTEM_PROMPT`):
> **RAG+Memory** when the current message has unresolved referents/continuity
> that need prior turns. **RAG+OCEAN** when self-contained *and* a non-default
> profile would improve tone/pacing/framing (coaching, routines, coping-fit).
> **RAG only** when self-contained and the profile is default/irrelevant.

---

## 5. OCEAN inference

Five traits, each `0.0–1.0`, default `0.5`. Two LLM modes plus EMA smoothing in
Neo4j.

### Scoring (`InferenceAgent.infer_traits`, `inference.py`)

- Model `gpt-4o-mini`, **temperature 0.1**, output parsed into the
  `PersonalityProfile` pydantic model via `JsonOutputParser`.
- Prompt `INFERENCE_SYSTEM_PROMPT` gives per-trait increase/decrease cues
  (e.g. anxious/sad/overthinking → Neuroticism ↑; angry/disgust/rude →
  Agreeableness ↓).
- On error returns all-0.5 dict.

### EMA smoothing (`GraphMemory.update_user_profile`, `memory.py`)

Reads the current profile, then for each of the five keys:

```python
ALPHA = 0.15
smoothed = new_input * ALPHA + old * (1 - ALPHA)   # rounded to 3 dp
delta    = smoothed - old                          # kept if |delta| >= 0.001
```

The new profile is written to the `Profile` node (`SET p += traits`,
`p.last_updated`), and a timestamped `PersonalitySnapshot` node is appended via
`HAS_HISTORY` (time-series). Returns `(smoothed_traits, deltas)`; deltas are
pretty-printed by `engine._print_stat_changes`. Returns `({}, {})` if the driver
is down.

### When inference runs

- **Per turn**: `engine.background_learning()` fires as a background task after
  each reply (skipped on self-harm). It reads the current profile, calls
  `infer_traits`, and applies the EMA update.
- **New-user warm start** (`chat.py._warm_start_ocean_from_text`): after the
  3-question onboarding, the combined answers are run through `infer_traits`
  (with an all-0.5 `past_profile`) and `update_user_profile` seeds initial scores.
  A user is "new" when every stored OCEAN value is within `0.01` of `0.5`
  (`_is_new_user`).

### Narrative reflection (`InferenceAgent.reflect_on_history`)

- Model **`gpt-4o`, temperature 0.4**, `StrOutputParser`. Synthesizes the last 20
  turns + existing narrative into a single 3–5 sentence third-person paragraph.
- Triggered every 10th turn per user: `engine.manage_reflection` increments
  `user_turn_counters[user_id]`; on `% 10 == 0` it runs
  `_run_reflection_logic` → `get_context(limit=20)` →
  `reflect_on_history` → `save_narrative_profile`.

---

## 6. Safety system

There are **two independent safety subsystems**.

### 6.1 Global guardrail — `SafetyGuardrail` (`agent/safety.py`)

Used by the standard chat path (`process_brain_agentic`). Composed of
`SafetyClassifier`, `SafetyPolicy`, `MemorySanitizer`. `SafetyClassifier.classify`
is **keyword/emotion rule-based** (no model) and returns a `SafetyDecision`
dataclass with these allow-flags + behaviour:

| risk_type | Trigger | level | router | memory | ocean | rag | safe_mode | store_raw |
|-----------|---------|-------|--------|--------|-------|-----|-----------|-----------|
| `self_harm_or_suicide` | any of `SELF_HARM_PHRASES` (kill myself, want to die, suicide, overdose, ...) | critical | F | F | F | F | T | **F** |
| `clinical_boundary` | any of `CLINICAL_BOUNDARY_PHRASES` (diagnose me, am i bipolar, prescribe, ...) | medium | T | T | F | F | T | T |
| `high_distress` | emotion ∈ {depressed, fearful, anxious, ashamed} **or** any `HIGH_DISTRESS_PHRASES` (hopeless, worthless, panic, ...) | medium | T | T | F | T | T | T |
| `normal_support` | default | low | T | T | T | T | F | T |

**Crisis routing in `process_brain_agentic`:** if `risk_type ==
self_harm_or_suicide`, it returns `SafetyPolicy.immediate_response(...)` *without
calling the LLM*, and stores a `MemorySanitizer.build_safe_summary` turn
(`raw_stored=False`). The hard-coded crisis reply urges contacting a trusted
person / emergency services / crisis line.

`SafetyPolicy.safe_instruction(risk_type)` injects tone guidance into the safe
dialogue prompt (gentle/grounding for high_distress; non-diagnostic for
clinical_boundary).

**Memory sanitization in `process_brain`:** when `safety_decision.store_raw_turn`
is `False`, the stored user text is replaced by a generic safe summary instead of
the raw message.

### 6.2 EmptyChair safety — `EmptyChairHybridSafety` (`agent/emptychair_safety.py`)

A separate three-/four-stage pipeline used only in `empty-chair` mode. Returns a
`SafetyDecision` (aliased `EmptyChairSafetyDecision`) with
`action ∈ {normal_roleplay, safe_roleplay, stop_roleplay}`.

Constructor (`suicide_threshold=0.2`, `max_length=256`) validates the model dir
(`models/emptychair_distilbert/`) requiring `config.json`, `model.safetensors`,
`tokenizer.json`, `tokenizer_config.json`, `label_encoder.joblib` — **raises
`OSError`** if any are missing (weights are gitignored, ~267 MB). Loads the
DistilBERT seq-classification model + tokenizer + a joblib `label_encoder`
(classes include `Anxiety`, `SuicideWatch`, `Bipolar`, `Depression`, `OffMyChest`).
The SuicideWatch column is located by case-insensitive substring match on those
classes (`_find_label_index`, raising `ValueError` if none match); the model runs
on CUDA when available, else CPU.

`decide(user_input)` stages:

1. **Keyword override** (`_check_keywords`): 15 `CRISIS_KEYWORDS` matched with
   `\b...\b` word-boundary regex → `stop_roleplay`, method `keyword_override`,
   `sw_prob=1.0`.
2. **DistilBERT inference** (`_predict`): softmax over logits → per-label probs +
   top label. (`return_token_type_ids=False` is passed to the tokenizer.)
3. **Threshold rule**: if `SuicideWatch` prob `>= 0.2` → `stop_roleplay`, method
   `distilbert_threshold`.
4. **Label routing**: top label in `{Anxiety, Depression, Bipolar}` →
   `safe_roleplay` (de-escalation); otherwise `normal_roleplay`.

```python
RISK_TYPE_MAP  = {stop:self_harm_or_suicide, safe:high_distress, normal:normal_support}
RISK_LEVEL_MAP = {stop:critical, safe:medium, normal:low}
```

- `crisis_response()` — scripted crisis text including `Vietnam: 096 306 1414`
  and `US: 988 (Suicide & Crisis Lifeline)` lines.
- `safe_instruction()` — a `[SAFETY NOTE: ...]` prefix prepended to user input in
  `safe_roleplay`.

**In `chat.py`** the DistilBERT call is wrapped in `asyncio.wait_for(..., timeout=
DISTILBERT_TIMEOUT_SECONDS=3.0)`; on timeout it falls back to a synthetic
`safe_roleplay` decision (`_build_timeout_synthetic_decision`, method
`timeout_fallback`). The `[SYSTEM_INIT]` setup payload bypasses safety entirely
(`_build_init_synthetic_decision`, method `init_bypass`).

**Crisis lifecycle (chat.py):** a `stop_roleplay` sets per-session state:
`crisis_timestamp`, `elevated_mode_until = now + 30 min`
(`ELEVATED_MODE_DURATION_SECONDS = 1800`), `post_crisis_lockout = True`,
`crisis_count += 1`, and emits `crisis_mode` (15-second breathing lockout,
`BREATHING_LOCKOUT_SECONDS = 15`) + `elevated_mode`. While locked out, further
free-text turns are refused and re-entry options are re-sent.

---

## 7. Memory module (Neo4j)

`agent/memory.py` → `GraphMemory(uri, auth)`. On construction it opens a bolt
driver and runs `RETURN 1`; on failure `self.driver = None` and every method
degrades gracefully (returns `""`, defaults, or empty containers). `close()`
closes the driver.

### Graph schema

```
(:User {id})
   ├─[:HAS_TURN]→     (:Turn {user_input, ai_response, emotion, timestamp,
   │                          risk_level, risk_type, raw_stored})
   ├─[:HAS_PROFILE]→  (:Profile {openness, conscientiousness, extraversion,
   │                             agreeableness, neuroticism, last_updated,
   │                             narrative})
   ├─[:HAS_HISTORY]→  (:PersonalitySnapshot {timestamp, date_str,
   │                          openness, conscientiousness, extraversion,
   │                          agreeableness, neuroticism})
   └─[:HAS_REFLECTION]→ (:Reflection {id, title, body, mood, timestamp})
```

`timestamp` uses `time.time()` (float epoch); snapshots also store a
`date_str`. There is a single `Profile` node per user (MERGE), accumulating both
OCEAN props and the `narrative` string.

### Stored / queried operations

| Method | What it does |
|--------|--------------|
| `add_turn(user_id, user_input, emotion, ai_response, risk_level, risk_type, raw_stored)` | MERGE user, CREATE Turn, link `HAS_TURN`. |
| `get_context(user_id, limit=10, current_emotion=None, current_message=None)` | **Default** (no emotion/message): last `limit` turns chronological. **Filtered**: always the 3 most recent turns + up to `max(limit-3,4)` older turns matching the current emotion and/or keyword overlap (Cypher `CONTAINS`). Dedupes by user input (`_format_turns`) and drops `"System: Acknowledged"` AI lines. |
| `_extract_keywords(message)` | lowercases, keeps tokens `len>=3` not in `_STOPWORDS`. |
| `get_conflict_history(user_id, target_name, limit=5)` | Turns whose input/response `CONTAINS` `target_name` (case-insensitive), tagged with emotion — fed to EmptyChair (GraphRAG). Returns a Vietnamese "no data, roleplay from given personality" fallback when no rows match; `"Không có dữ liệu lịch sử."` if the driver is down; `"Lỗi khi truy xuất dữ liệu lịch sử."` on query error. |
| `update_user_profile(user_id, input_traits)` | EMA update (see [§5](#5-ocean-inference)) + snapshot. Returns `(smoothed, deltas)`. |
| `get_user_profile(user_id)` | Returns the 5 OCEAN floats, defaulting missing keys to 0.5; all-0.5 default if no node / driver down. |
| `save_narrative_profile` / `get_narrative_profile` | Set/read `Profile.narrative`; getter returns `"No narrative yet."` when absent. |
| `add_reflection(user_id, title, body, mood="")` | CREATE Reflection (UUID id) linked `HAS_REFLECTION`; returns the dict. |
| `get_reflections(user_id, limit=20)` | Reflections newest-first. |

`api/reflections.py._delete_reflection_node` does a scoped
`MATCH (:User)-[:HAS_REFLECTION]->(:Reflection {id})` + `DETACH DELETE`, so a user
can only delete their own reflections.

> Note: source comments and some fallback strings are Vietnamese; behaviour above
> reflects the actual Cypher/logic.

---

## 8. ChromaDB / RAG

### Retrieval — `KnowledgeAgent` (`agent/knowledge.py`)

- Connects to a persisted Chroma collection `soulmate_knowledge_base` at
  `./chroma_db` (relative to backend CWD), embeddings via
  `OpenAIEmbeddings("text-embedding-3-small")`. **No inline data load** — if the
  collection is empty it only prints a warning to run the build script.
- `retrieve_examples(query_transcript, current_emotion, k=3)`:
  1. Builds a search query `"{transcript} (Emotion: {emotion})"` (or `"User is
     silent"` if empty).
  2. **Hard-filters** on metadata `{"emotion": target_emotion}` via
     `similarity_search`.
  3. **Fallback**: if the filtered search returns nothing, repeats without the
     filter.
  4. Formats each hit into `Example N:` blocks with `Situation`
     (`original_transcript`), `User Emotion`, `User Traits` (`traits_str`),
     `Ideal Response` (`response`). Returns the joined string; `""` on error.

The emotion label must match how docs were indexed (SoulMate labels, see mapping).

### What is indexed — build scripts (`backend/scripts/`)

Both scripts wipe `./chroma_db`, embed with `text-embedding-3-small`, and upload
in batches of 200. Long supporter responses (`>512` chars) are split with
`RecursiveCharacterTextSplitter(chunk_size=512, overlap=64)`.

| Script | Sources | Notes |
|--------|---------|-------|
| `build_rag_combined.py` (recommended) | 100% ESConv (`thu-coai/esconv`, train) **+** EPITOME Reddit `level==2` rows (ER/IP/EX CSVs in `data/epitome/`) | ESConv docs carry `source:"esconv"`; EPITOME docs carry `emotion:"mental_health"`, `source:"epitome"`, `empathy_type`. |
| `build_rag_from_esconv.py` | First **80%** of ESConv only (last 20% reserved for benchmark test) | ESConv-only. |

**Document shape** (ESConv): each `usr → sys` turn pair becomes a doc where
`page_content = "SEEKER: {seeker} | EMOTION: {emotion} | PROBLEM: {problem} |
STRATEGY: {strategy}"` and `metadata = {response, emotion, original_transcript,
strategy, problem_type, situation, traits_str:""}`. `build_rag_combined.py` also
adds `source:"esconv"`; `build_rag_from_esconv.py` omits the `source` key.

**Document shape** (EPITOME, combined script only):
`page_content = "SEEKER: {seeker_post} | SOURCE: EPITOME | TYPE: {empathy_type}"`
with `metadata = {response, emotion:"mental_health", source:"epitome",
empathy_type, strategy:"epitome_level2", ...}`.

**Emotion normalization** (ESConv → SoulMate label) differs between scripts:

| ESConv | combined.py | from_esconv.py |
|--------|-------------|----------------|
| anxiety | anxious | anxious |
| sadness | sad | sad |
| anger | angry | angry |
| fear | **fearful** | **anxious** |
| depression | **depressed** | **sad** |
| shame | **ashamed** | **sad** |
| disgust | disgust | disgust |

There is also a legacy `data/empatheticdialogues/knowledge.py` — an older
`KnowledgeAgent` that loads from a JSON file (`data/conversation_data.json`) and
self-populates if the DB is empty. It is **not** imported by the engine (the
engine uses `agent/knowledge.py`); documented here only because it exists.

---

## 9. WebSocket protocol

> This section is the **authoritative** chat-protocol spec. The browser-side
> handlers (which frames `useChat` / `EmptyChairView` actually consume, and which
> actions the UI actually sends) are in **FRONTEND_DOCS.md §10**; known gaps
> between the two are catalogued in [§0 → divergences](#0-system-context-backend--frontend--esp32).

Endpoint: `WS /ws/chat/{user_id}` (`api/chat.py`). On connect it accepts, records
`session_start_time`, and — if the user is new — immediately starts onboarding
(emits `message` with the first of three `ONBOARDING_QUESTIONS`). Per-user
ephemeral state lives in module dicts `empty_chair_sessions` and
`onboarding_sessions` (in-memory, lost on restart).

### Client → Server

```jsonc
{"action": "send_text", "mode": "messaging|voice|empty-chair", "text": "...", "use_voice": false}
{"action": "start_recording", "mode": "voice"}   // begins PTT capture
{"action": "stop_recording",  "mode": "voice"}   // stops, transcribes, then processes
```

`action` defaults to `"send_text"`, `mode` defaults to `"messaging"`. Voice replies
also stream when `use_voice` is true **or** `mode == "voice"`.

EmptyChair init (sent as a `send_text` whose text starts with `[SYSTEM_INIT]`):

```
[SYSTEM_INIT] TARGET: {name} | RELATIONSHIP: {relation} | UNSPOKEN_NEED: {need} | MESSAGE: {message}
```

Parsed with regex into the session; the trailing `MESSAGE` becomes the first
user turn (safety-bypassed via `init_bypass`).

EmptyChair lifecycle actions (no `mode` needed; matched against
`EMPTY_CHAIR_LIFECYCLE_ACTIONS`):

```jsonc
{"action": "resume_roleplay"}      // clears lockout + support_mode
{"action": "switch_to_support"}    // clears lockout, support_mode=True (talk normally)
{"action": "end_session"}          // emits safety_summary, drops the session
{"action": "show_reentry_options"} // emits re_entry_choice
{"action": "check_elevated_mode"}  // re-emits elevated_mode / re_entry_choice if applicable
```

### Server → Client message types

| `type` | Fields | Emitted when |
|--------|--------|--------------|
| `message` | `content`, `mode` | Every AI reply; also onboarding questions |
| `emotion_status` | `emotion`, `confidence` | After perception, each user turn |
| `status` | `content`: `listening`/`speaking`/`idle` | Recording start, before TTS, after each turn / on empty input |
| `user_speech` | `content` | After `stop_recording` transcription |
| `audio_chunk` | `data` (base64 MP3) | Per streamed TTS chunk |
| `audio_end` | — | End of TTS stream |
| `safety_decision` | `action`, `method`, `risk_level`, `suicidewatch_probability` | EmptyChair, each non-init turn (when DistilBERT present) |
| `crisis_mode` | `lockout_seconds` (15), `show_breathing` | EmptyChair `stop_roleplay` |
| `elevated_mode` | `active`, `until_timestamp`, `reason` | On crisis (`crisis_detected`) / on `check_elevated_mode` (`crisis_persisted`) |
| `re_entry_choice` | `prompt`, `buttons[]` | Post-crisis options sheet (`_send_reentry_choices`) |
| `system_message` | `text` | Inline session notifications (resume/support/lockout) |
| `safety_summary` | `session_duration`, `crisis_count` | `end_session` |

`re_entry_choice.buttons` (verbatim from `_send_reentry_choices`):
`play_sounds`, `try_grounding`, `resume_roleplay`, `switch_to_support`,
`end_session` (each `{action, label, tone}`).

### Connection lifecycle & error handling

- The handler loops on `receive_text()` until `WebSocketDisconnect`.
- Recording uses a `threading.Event` + an `asyncio.to_thread` task for PTT
  (`VoiceInterface.record_audio_ptt`).
- Generation errors are caught per-turn: a friendly *"Sorry — I hit a system
  error..."* message is sent and the loop continues; the traceback is printed to
  `stderr`.
- After each reply, `background_learning` (unless self-harm) and
  `manage_reflection` are launched fire-and-forget.

**Voice-monitor socket** (`/ws/voice-monitor/{user_id}`): `VoiceMonitorManager`
keeps `{user_id: set[WebSocket]}`. `broadcast` sends to all sockets for a user and
prunes ones that raise. The physical companion POSTs events to
`/api/voice-monitor/{user_id}/event`, which broadcasts to connected browser
monitors. The socket only reads (for disconnect detection); it sends nothing
itself.

---

## 10. External services

| Service | Where | Model / IDs | Usage |
|---------|-------|-------------|-------|
| **OpenAI Chat** | `dialogue.py`, `inference.py`, `router.py`, `emptychair_agent.py` | `gpt-4o-mini` (dialogue temp 0, inference-OCEAN temp 0.1, router temp 0, EmptyChair temp 0.7); `gpt-4o` (reflection, temp 0.4) | Response generation, OCEAN scoring, narrative reflection, routing, roleplay |
| **OpenAI Embeddings** | `knowledge.py`, build scripts | `text-embedding-3-small` | RAG vector embeddings |
| **OpenAI Whisper** | `voice_io.py` | `whisper-1`, `language="vi"` | STT (`transcribe`) |
| **ElevenLabs** | `voice_io.py` | voice `EXAVITQu4vr4xnSDxMaL` (Sarah), model `eleven_turbo_v2_5` | TTS — streaming MP3 (`stream_speech_chunks`, `mp3_44100_128`), full MP3 bytes (`generate_speech_bytes`), and raw 16 kHz mono PCM for ESP32 (`generate_speech_pcm16_stereo_bytes`, `pcm_16000`, with trim/fade) |
| **Neo4j** | `memory.py` | bolt driver | Graph memory, OCEAN, reflections |
| **ChromaDB** | `knowledge.py` | local persisted dir | RAG vector store |
| **HuggingFace Transformers** | `perception.py`, `emptychair_safety.py` | `SamLowe/roberta-base-go_emotions`; local DistilBERT | Emotion detection; EmptyChair risk classification |

### VoiceInterface notes (`voice_io.py`)

- `record_audio_ptt(stop_event, fs=24000)`: push-to-talk capture to
  `agent/temp_input.wav` until `stop_event` is set.
- `transcribe` returns `""` for a missing file or on error.
- `generate_speech_pcm16_stereo_bytes` despite its name returns **mono** PCM
  (one MAX98357A); applies trailing-silence trim, 5 ms fade-in, 30 ms fade-out.
- Streaming TTS to the browser: `chat.py._stream_tts_to_ws` runs the blocking
  ElevenLabs generator in a producer thread, pushing chunks onto an
  `asyncio.Queue` (base64) and finishing with `audio_end`.

> `engine.close()` calls `self.voice_io.stop_all_audio()`, but `VoiceInterface`
> in the current source does **not** define `stop_all_audio` — noted as-is.

### Physical companion — `voice_companion.py` (standalone, no server)

Runs the full `AgenticEmpathySystem` locally with laptop mic + ESP32 speaker over
USB serial (or pygame laptop-speaker fallback). Config at top:
`USER_ID` (env `COMPANION_USER_ID`, default `Ghostman`), `ESP32_PORT` (env, default
`COM5`), `BAUD_RATE=921600`. `USE_ESP32=True` is a hardcoded constant (not
env-driven) that auto-flips to `False` at runtime if the ESP32 serial port cannot
be opened.

- Serial audio protocol: header `b"SOUL" + struct.pack("<I", len)` then PCM
  streamed under **credit-based ACK flow control** (`WINDOW_BYTES=32768`,
  `ACK_CHUNK=4096`, `CHUNK_SIZE=2048`, `ACK_TIMEOUT=2.0`; ESP32 sends `'A'` per
  4 KB played).
- Emotion is sent first as `EMOTION:{label}\n` (drives OLED "eyes").
- CLI flags: `--test-tone` (3 s 440 Hz mono), `--test-eyes` (cycles 7 states).
- Controls: SPACE = start/stop PTT, Q = quit. Uses `process_brain_agentic(...,
  mode="voice")`.
- While running it POSTs pipeline events (`status`, `emotion_status`,
  `user_speech`, `message`) to `POST /api/voice-monitor/{user_id}/event`, which the
  backend fan-out broadcasts to any browser monitor ([§9](#9-websocket-protocol)
  end). This is the only path by which a browser observes a physical session.

### ESP32 firmware — the third system component (`esp32/soulmate_speaker/soulmate_speaker.ino`)

The firmware is the **receiving end** of the serial contract above (verified
against the `.ino`; do not duplicate logic — this documents the wire format both
sides must agree on). Hardware: **SH1106 128×64 OLED** (I²C, U8g2) + **MAX98357A**
I²S amplifier. I²S pins in firmware: `DOUT=GPIO27`, `BCLK=GPIO26`, `LRC=GPIO25`;
status LED on `GPIO2`. Audio format: **16 kHz, 16-bit, mono** (`ONLY_LEFT`) —
matches `voice_io.generate_speech_pcm16_stereo_bytes` (`pcm_16000`). Serial at
**921600** baud, 64 KB RX buffer.

Serial contract it implements (three interleaved message kinds on one stream):

| From host (`voice_companion.py`) | Firmware behaviour |
|----------------------------------|--------------------|
| `EMOTION:<label>\n` | `feedEmotionParser` reads the label, lowercases it, and sets the OLED "eye" state via `parseEmotionName`. Sent **before** each audio stream. |
| `"SOUL"` + 4-byte **little-endian uint32** length + PCM bytes | `serialReaderTask` syncs on the `SOUL` magic, reads the length, then streams PCM into a 64 KB ring buffer (`RING_SIZE=65536`); `i2sWriterTask` drains it to the amp. |
| (flow control, firmware→host) | For every `ACK_CHUNK_SIZE=4096` bytes of **real** audio actually played (silence padding excluded), the firmware writes one `'A'` byte back. The host's credit window (`WINDOW_BYTES=32768 = ½ ring`) keeps `sent − acked ≤ WINDOW_BYTES` so the ring can never overflow. |

OLED behaviour: `parseEmotionName` maps labels to seven eye states —
`happy`/`joy`→happy, `love`→love, `sad`/`depressed`/`ashamed`→sad,
`anxious`/`fearful`/`fear`→anxious, `angry`/`disgust`→angry,
`surprise`/`confusion`→surprise, else neutral. Eyes revert to neutral after
`EMOTION_IDLE_TIMEOUT_MS=8000` of no audio; `GPIO2` LED is high while speaking. The
host emotion label originates from `PerceptionAgent` upstream, so the OLED face
tracks the same per-turn emotion the browser shows via `emotion_status`.

> The firmware lives outside `backend/` and is **not** modified by the backend
> build; it is documented here as the contract `voice_companion.py` must satisfy.
> (Wiring note: `CLAUDE.md` lists the amp DIN on GPIO 22, but the firmware uses
> `I2S_DOUT=GPIO27` — see the suggestions in the change summary.)

---

## 11. Configuration & dependencies

### Required environment (`backend/.env`, loaded via `python-dotenv`)

| Var | Used by | Required? |
|-----|---------|-----------|
| `OPENAI_API_KEY` | all OpenAI calls + embeddings | Yes |
| `NEO4J_URI` | memory | defaults `bolt://localhost:7687` |
| `NEO4J_USER` | memory | defaults `neo4j` |
| `NEO4J_PASSWORD` | memory | **Yes** — engine raises `ValueError` if unset |
| `ELEVEN_API_KEY` | TTS | needed for voice |
| `COMPANION_USER_ID`, `ESP32_PORT` | `voice_companion.py` | optional (have defaults) |

`audit_pipeline.py` checks `OPENAI_API_KEY`, `NEO4J_URI`, `NEO4J_USER`,
`NEO4J_PASSWORD`.

### Python deps (`pyproject.toml`, project root; `requires-python >= 3.12`)

Managed with `uv`. Key libraries: `fastapi`, `uvicorn[standard]`, `websockets`,
`langchain-openai`, `langchain-chroma`, `langchain-text-splitters`, `chromadb`,
`neo4j`, `transformers`, `torch`, `peft`, `accelerate`, `bitsandbytes`,
`elevenlabs`, `sounddevice`, `soundfile`, `pygame`, `pyserial`, `openai`,
`datasets`, `scikit-learn`, `bert-score`, `rouge-score`, `evaluate`, `nltk`,
`matplotlib`, `pandas`, `numpy`, `openpyxl`, `python-dotenv`.

(There is no `Dockerfile`, `docker-compose`, `requirements.txt`, or migration
script in the repo — dependency management is `uv` + `pyproject.toml` only.)

### Run commands

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000   # API (port 8000)
uv run python audit_pipeline.py                               # system self-check
uv run python voice_companion.py                              # standalone hardware companion
```

---

## 12. Tooling / scripts

| File | Purpose |
|------|---------|
| `audit_pipeline.py` | Sequential PASS/FAIL/WARN self-test: env vars, prompt-variable presence, perception, dialogue (RAG/OCEAN/memory effect), inference (OCEAN range/direction), knowledge (retrieval + emotion filtering), Neo4j ops, and full `process_brain` (incl. ablation flags). Creates and uses `*_DELETE_ME` test users. |
| `scripts/build_rag_combined.py` | Build ChromaDB from ESConv (100%) + EPITOME level-2. **Recommended.** |
| `scripts/build_rag_from_esconv.py` | Build ChromaDB from ESConv train 80% only. |
| `evaluate/benchmark/epitome_scorer.py` | Reimplements the EPITOME bi-encoder (two RoBERTa-base encoders + 1-head cross-attention + classification head) loading `reddit_ER/IP/EX.pth`; `score(seeker, response)` → `{ER,IP,EX}` each in `{0,1,2}`. |
| `evaluate/benchmark/run_benchmark_v5.py` / `run_benchmark_full.py` / `run_benchmark_b1_500.py` / `run_benchmark_b2_200.py` / `run_benchmark_b3.py` / `run_baseline_35.py` | Ablation/full benchmark runners (5 configs: Baseline, RAG, RAG+Memory, RAG+OCEAN, Agentic). |
| `evaluate/benchmark/finalize_*.py` | Score existing responses & render CSV/PNG without new API calls. |
| `evaluate/benchmark/*_utils.py`, `reset_b1_500.py`, `run_stability_test.py` | Benchmark helpers, Neo4j reset, 3-run stability test. |

> The benchmark runners are evaluation tooling outside the request-serving path;
> see CLAUDE.md → *Evaluation / Benchmarks* for the methodology and published
> results. They were not deep-documented here as they fall outside the runtime
> backend surface.
