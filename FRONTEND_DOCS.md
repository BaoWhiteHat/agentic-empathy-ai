# SoulMate Frontend Technical Reference

This document describes the current frontend implementation in `frontend/`. Source code is authoritative; this file intentionally documents the single application shell that exists now, not older page-based routes.

## 1. Application Structure

Frontend stack:

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS 4 tooling plus extensive CSS variables in `frontend/app/globals.css`
- Framer Motion and Lucide React

Entry points:

- `frontend/app/layout.tsx`: wraps the app with `UserProvider` and `TweaksProvider`.
- `frontend/app/page.tsx`: renders `SoulMateApp`.
- `frontend/components/SoulMateApp.tsx`: the single app shell, internal navigation, onboarding gate, mood modal, and safety overlay.

There is exactly one active Next.js route: `/`. Product navigation is internal React state, not separate URL routes.

## 2. Internal Navigation

`SoulMateApp` defines:

```ts
type ScreenId = "today" | "companion" | "reflections" | "insights" | "settings" | "safety" | "memory";
```

Screen state is persisted per user in localStorage:

- Key pattern: `soulmate_last_screen_v1_{userId}`.
- Invalid values fall back to `today`.

Navigation UI:

- `frontend/components/Sidebar.tsx`: desktop sidebar and mobile bottom navigation.
- Primary nav exposes Today, Companion, Reflections, and Insights.
- Settings is exposed in the footer/mobile nav.
- Safety and Memory are reached from Settings or safety overlay flows.

## 3. Context Providers and State

### UserContext

Source: `frontend/context/UserContext.tsx`

- Stores a prototype `userId`.
- Persists to localStorage key `soulmate_user_id`.
- There is no real authentication. The user id is a local session identifier used by frontend API/WebSocket calls.

### TweaksContext

Source: `frontend/context/TweaksContext.tsx`

Persists accessibility and personalisation settings to `soulmate_tweaks`:

- text size: `S`, `M`, `L`, `XL`
- font: `sans`, `dyslexic`, `serif`
- line spacing
- letter spacing
- reduce motion
- color mode: `vibrant`, `calm`, `high-contrast`
- accent color
- focus mode
- dashboard variant
- chat style
- OCEAN insight variant
- dark mode

The provider applies settings to `document.documentElement` as CSS variables, classes, and `data-color-mode`. It also respects OS `prefers-reduced-motion`.

## 4. Screens

### Onboarding

Source: `frontend/components/screens/Onboarding.tsx`

Two UI variants exist:

- `guided`: active in `SoulMateApp`.
- `conversational`: implemented but not active by default.

The frontend onboarding collects a display/session name and stores it as `userId`. It does not send the onboarding answers to the backend. Separately, the backend chat WebSocket has its own onboarding flow for new Neo4j users.

### Today

Source: `frontend/components/screens/Today.tsx`

Features:

- greeting based on local time
- daily mood check-in entry point
- "Talk it through" navigation
- "Write a reflection" navigation
- week mood strip
- OCEAN/narrative preview from backend polling
- calm and bento dashboard variants

Mood check-ins are stored in localStorage through `frontend/lib/moods.ts`. They are not sent to the backend reflections API. The screen listens for a local `reflection-saved` browser event to refresh mood/week UI.

### Companion

Source: `frontend/components/screens/Companion.tsx`

Tabs:

- Chat
- Physical
- Empty Chair

Chat tab:

- Uses `useChat("messaging")`.
- Sends text through `/ws/chat/{userId}`.
- Shows emotion status from backend `emotion_status` frames.
- Persists visible chat history for `messaging` mode in localStorage.

Physical tab:

- Presents hardware companion information, setup commands, controls, and limitations.
- It does not directly control the ESP32.
- It points users to the standalone backend command `uv run python voice_companion.py`.

Empty Chair tab:

- Uses `useChat("empty-chair")`.
- Sends a `[SYSTEM_INIT]` text payload to configure target name, relationship, unspoken need, and opening message.
- Handles backend frames such as `safety_decision`, `crisis_mode`, `elevated_mode`, `re_entry_choice`, and support choices.
- Uses frontend safety UI for breathing, grounding, calming sounds, and resume/end choices.

### Reflections

Source: `frontend/components/screens/Reflections.tsx`

Backend-connected via REST:

- `GET http://localhost:8000/api/reflections/{userId}`
- `POST http://localhost:8000/api/reflections/{userId}`
- `DELETE http://localhost:8000/api/reflections/{userId}/{id}`

Reflections are stored in Neo4j by the backend when the memory store is available.

### Insights

Source: `frontend/components/screens/Insight.tsx`

Uses `useOcean(userId)` data:

- OCEAN radar/bars
- narrative profile text when available
- local mood week data from `frontend/lib/moods.ts`
- loading and backend-error states

### Memory

Source: `frontend/components/screens/Memory.tsx`

This is a UI surface explaining memory, consent, and profile concepts. It does not expose a complete backend memory-management API. It should be documented as UI/demo-oriented unless future code adds concrete memory CRUD controls.

### Settings

Source: `frontend/components/screens/Settings.tsx`

Controls are localStorage-backed through `TweaksContext`:

- reading settings
- theme and accent settings
- motion and focus controls
- dashboard and chat variants
- support resources action
- reset to defaults
- sign out

Comments in the file note future work that is intentionally not exposed as controls: mood check-in style and onboarding style are implemented variants but hardcoded by the app shell.

### Safety

Source: `frontend/components/screens/Safety.tsx`

Features:

- visible support lines:
  - Vietnam: `096 306 1414`
  - US: `988 (Suicide & Crisis Lifeline)`
  - Befrienders Worldwide reference
- emergency-support copy
- grounding and breathing modals
- calming sounds
- crisis-support panel for Empty Chair re-entry

This UI is supportive and non-clinical.

## 5. Hooks and Backend Communication

### useChat

Source: `frontend/hooks/useChat.ts`

Connection:

```text
ws://localhost:8000/ws/chat/{userId}
```

Modes:

- `messaging`
- `voice`
- `empty-chair`

Send shape for normal text:

```json
{
  "action": "send_text",
  "text": "...",
  "mode": "messaging"
}
```

Received frames handled:

- `message`: appends AI message to the mode history.
- `user_speech`: appends transcribed user speech.
- `audio_chunk`: accumulates base64 MP3 chunks.
- `audio_end`: decodes and plays accumulated audio through Web Audio.
- `emotion_status`: updates current emotion label.
- `status`: updates status such as `idle`, `listening`, or `speaking`.

Local persistence:

- Key pattern: `soulmate_chat_history_v1_{userId}`.
- Persists `messaging` and `empty-chair` visible histories only.
- History limit: 100 messages per persisted mode.
- `voice` mode history is runtime-only.

Protocol divergence:

- The hook still supports legacy browser voice actions (`start_recording`, `stop_recording`) on the backend protocol.
- The visible Physical tab is not a browser push-to-talk control and should not be presented as direct ESP32 control.

### useOcean

Source: `frontend/hooks/useOcean.ts`

Base URL:

```ts
process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
```

Endpoint:

```text
GET /api/ocean/{userId}
```

Polling:

- on mount
- every 5 seconds

Fallback:

- defaults OCEAN scores to `0.5`
- returns a readable backend-unavailable error on network failure
- normalizes `"No narrative yet."` to an empty string

### useVoiceMonitor

Source: `frontend/hooks/useVoiceMonitor.ts`

Connection:

```text
ws://localhost:8000/ws/voice-monitor/{userId}
```

This is an observer for events broadcast through `POST /api/voice-monitor/{userId}/event`. It does not record audio by itself.

### useTweaks

Source: `frontend/hooks/useTweaks.ts`

Convenience re-export of `TweaksContext`.

## 6. LocalStorage Keys

Verified keys:

- `soulmate_user_id`: local prototype user id.
- `soulmate_tweaks`: accessibility/personalisation settings.
- `soulmate_last_screen_v1_{userId}`: last internal screen.
- `soulmate_chat_history_v1_{userId}`: visible chat history.
- Mood storage keys are defined and managed in `frontend/lib/moods.ts`.

These are convenience prototype stores, not secure account storage.

## 7. Static Assets

Tracked assets used by the frontend:

- `frontend/public/audio/forest.mp3`
- `frontend/public/audio/ocean.mp3`
- `frontend/public/audio/rain.mp3`
- `frontend/public/fonts/OpenDyslexic-Regular.otf`

Calming sound modals load `/audio/{id}.mp3`.

## 8. Frontend/Backend Divergences

- Frontend route structure is single-shell; old `/messaging`, `/voice`, or `/empty-chair` pages should not be documented as active routes.
- Frontend onboarding and backend WebSocket onboarding are separate flows.
- Mood check-ins are localStorage-only, while reflections are backend-connected.
- Browser voice protocol exists in `useChat` and `api/chat.py`, but the current UI emphasizes standalone physical companion mode.
- Memory screen is explanatory/UI-oriented and does not expose full memory deletion/export APIs.
- Companion control REST endpoints exist in the backend, but the active Physical tab does not expose direct start/stop controls.

## 9. Frontend Setup and Verification

Install:

```bash
cd frontend
npm install
```

Run dev server:

```bash
npm run dev
```

Verify:

```bash
npm run lint
npm run build
```

If PowerShell blocks `npm`, use `npm.cmd`.
