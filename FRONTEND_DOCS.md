# SoulMate Frontend Documentation

Comprehensive reference for the `frontend/` directory. Every statement is based on the source files listed in the header of this document.

---

## 0. System Context (frontend ↔ backend ↔ ESP32)

> **Companion document:** this file documents the browser client. The Python
> backend and the ESP32 firmware are documented in
> **[BACKEND_DOCS.md](BACKEND_DOCS.md)**. The two docs share the same diagram, the
> same names, and the same cross-boundary contract. The **authoritative**
> specification of the WebSocket/REST/serial contract and the end-to-end
> lifecycles lives in **BACKEND_DOCS.md §0 and §9** — this section mirrors the
> diagram and the divergence list and points there for the per-step lifecycle.

SoulMate is one system made of **three components**:

1. **Frontend** — Next.js/React (`frontend/`). The single-page app
   (`SoulMateApp`) the user interacts with: text chat, Empty-Chair therapy with
   the crisis-safety lifecycle, OCEAN insights, reflections, and a read-only
   voice-companion monitor. Talks to the backend via the chat WebSocket
   (`hooks/useChat.ts`), REST (`hooks/useOcean.ts`, reflections fetches), and the
   read-only voice-monitor WebSocket (`hooks/useVoiceMonitor.ts`).
2. **Backend** — Python/FastAPI (`backend/`). Owns the multi-agent empathy
   pipeline (`AgenticEmpathySystem` in `core/engine.py`), all model calls, Neo4j
   graph memory, and the ChromaDB RAG store. Serves the chat WebSocket
   (`/ws/chat/{user_id}`), REST (`/api/*`), and the read-only voice-monitor
   WebSocket (`/ws/voice-monitor/{user_id}`).
3. **ESP32 firmware** — `esp32/soulmate_speaker/soulmate_speaker.ino`. The
   physical voice companion's microcontroller. Receives PCM audio + an emotion
   tag from `backend/voice_companion.py` over **USB serial** and plays it through
   a MAX98357A I²S amplifier while animating emotion "eyes" on an SH1106 OLED. The
   browser never talks to the ESP32 directly — it can only *observe* a physical
   session through the voice-monitor WebSocket (`useVoiceMonitor`), which receives
   events that `voice_companion.py` POSTs to the backend.

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

### Integration contract (frontend client view)

The backend is authoritative for every wire format; see BACKEND_DOCS.md §9 for the
full message spec. The frontend touchpoints:

| Interface | URL | Frontend client | Backend |
|-----------|-----|-----------------|---------|
| Chat WebSocket | `ws://localhost:8000/ws/chat/{userId}` | `hooks/useChat.ts`, `screens/Companion.tsx` ([§6](#usechat), [§3](#companion-componentsscreenscompaniontsx)) | `api/chat.py` — BACKEND §9 |
| Voice-monitor WebSocket | `ws://localhost:8000/ws/voice-monitor/{userId}` | `hooks/useVoiceMonitor.ts` ([§6](#usevoicemonitor)) | `api/voice_monitor.py` — BACKEND §9 |
| OCEAN REST | `GET /api/ocean/{userId}` (every 5 s) | `hooks/useOcean.ts` ([§6](#useocean)) | `api/profile.py` — BACKEND §2 |
| Reflections REST | `GET/POST /api/reflections/{userId}`, `DELETE …/{id}` | `screens/Reflections.tsx`, `Today.tsx` ([§3](#reflections-componentsscreensreflectionstsx)) | `api/reflections.py` — BACKEND §2 |

**`userId` semantics (consistent everywhere):** the `userId` is the user's display
name entered at onboarding. `UserContext` stores it in
`localStorage['soulmate_user_id']` and it is used verbatim as the WebSocket/REST
path segment; the backend uses that same string as the **Neo4j `User.id` key**. So
name = path segment = graph key — one identity across chat, REST, and the voice
monitor.

**`mode` values (consistent everywhere):** `messaging` | `voice` | `empty-chair`.
`useChat` opens a single chat socket and tags each `send_text` with `mode`; the
server echoes `mode` back on `message` frames so the client routes history into
the right per-mode list. The `voice` mode over the chat socket is legacy (see D1
below).

### End-to-end lifecycles

The two cross-boundary lifecycles — (a) a typed chat message and (b) the
Empty-Chair safety flow — are specified step-by-step, naming the file/function on
each side, in **BACKEND_DOCS.md §0**. The frontend half of each lifecycle is in
[§3 Companion](#companion-componentsscreenscompaniontsx) (the `EmptyChairView`
event handler) and [§6 `useChat`](#usechat) (frame dispatch / audio playback).

### Known protocol divergences (frontend ↔ backend ↔ code)

These are documented identically in BACKEND_DOCS.md §0. The **code** is
authoritative; each item is the gap between what is on the wire and what each side
actually uses.

- **D1 — voice PTT actions.** `start_recording` / `stop_recording` (client→server,
  `mode:"voice"`) are still accepted by `api/chat.py`, but the browser no longer
  emits them (the old VoiceView was removed). Push-to-talk now happens only inside
  `voice_companion.py`.
- **D2 — Empty-Chair lifecycle actions.** `api/chat.py` accepts **five**
  (`resume_roleplay`, `switch_to_support`, `end_session`, `show_reentry_options`,
  `check_elevated_mode`); `Companion.tsx` currently emits only **three**
  (`resume_roleplay`, `end_session`, `show_reentry_options`). `switch_to_support`
  and `check_elevated_mode` are reachable on the wire but unused by the current UI.
- **D3 — `re_entry_choice` payload.** The backend sends `{prompt, buttons[]}`
  (`buttons` = `play_sounds`, `try_grounding`, `resume_roleplay`,
  `switch_to_support`, `end_session`). The frontend handler (`Companion.tsx`)
  **ignores `prompt` and `buttons`** and instead hands off to `SafetyScreen`, which
  opens `SafetySupportPanel` with local `SUPPORT_OPTIONS` (`try_grounding`, `try_breathing`,
  `play_sounds`, `open_safety`, `end_session`) plus a separate "I'm okay —
  continue" → `resume_roleplay` link. The option set the user sees is
  frontend-defined, not backend-driven.
- **D4 — `status` content range.** The chat socket (`/ws/chat`, `useChat`) only
  ever receives `listening` / `speaking` / `idle`. The richer set (`processing`,
  `transcribing`, `thinking`) handled by `useVoiceMonitor` arrives **only** on the
  voice-monitor channel, POSTed by `voice_companion.py` to
  `/api/voice-monitor/{userId}/event`.

---

## 1. Architecture Overview

### Folder Tree (source files only)

```
frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── EmotionBadge.tsx
│   ├── Sidebar.tsx
│   ├── SoulMateApp.tsx
│   ├── StatusChip.tsx
│   ├── safety/
│   │   ├── Modals.tsx
│   │   └── SafetyBits.tsx
│   ├── screens/
│   │   ├── Companion.tsx
│   │   ├── Insight.tsx
│   │   ├── Memory.tsx
│   │   ├── Onboarding.tsx
│   │   ├── PhysicalCompanion.tsx
│   │   ├── Reflections.tsx
│   │   ├── Safety.tsx
│   │   ├── Settings.tsx
│   │   └── Today.tsx
│   └── ui/
│       ├── Icon.tsx
│       ├── Ocean.tsx
│       ├── ScreenScroll.tsx
│       └── primitives.tsx
├── context/
│   ├── TweaksContext.tsx
│   └── UserContext.tsx
├── hooks/
│   ├── useChat.ts
│   ├── useOcean.ts
│   ├── useTweaks.ts
│   └── useVoiceMonitor.ts
├── lib/
│   ├── moods.ts
│   ├── safetyRouter.ts
│   └── seedMoods.ts
├── utils/
│   └── contrastCheck.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

### Next.js App Router Routing

The project uses the Next.js App Router. There is exactly one route:

| File | URL | Notes |
|------|-----|-------|
| `app/page.tsx` | `/` | Renders `<SoulMateApp />` — the entire application lives at the root |
| `app/layout.tsx` | All routes | Root layout: wraps children in `TweaksProvider` and `UserProvider`, imports `globals.css` |

No other `app/*/page.tsx` files exist in the source tree. The old `messaging/`, `voice/`, and `empty-chair/` page files were deleted (shown as `D` in git status) and their functionality was absorbed into `SoulMateApp`'s internal screen routing.

### Layout Hierarchy

```
app/layout.tsx  (HTML shell, TweaksProvider → UserProvider)
  └─ app/page.tsx  (renders SoulMateApp)
       └─ components/SoulMateApp.tsx  (root shell)
            ├─ Sidebar  (nav, mini OCEAN radar, theme toggle)
            └─ <main>  (renders the active screen)
                 ├─ screens/Today.tsx        (screen='today')
                 ├─ screens/Companion.tsx    (screen='companion')
                 ├─ screens/Reflections.tsx  (screen='reflections')
                 ├─ screens/Insight.tsx      (screen='insights')
                 ├─ screens/Settings.tsx     (screen='settings')
                 ├─ screens/Safety.tsx       (screen='safety')
                 └─ screens/Memory.tsx       (screen='memory')
```

Additionally, `SoulMateApp` mounts the `OnboardingShell` instead of the sidebar+screen layout when `userId` is empty.

### CSS Design System

`globals.css` defines a token system entirely through CSS custom properties on `:root` (light) and `.dark` (dark mode overrides). There are also two `data-color-mode` attribute overrides for `vibrant` and `high-contrast` modes.

**Token Groups**

| Group | Variables | Description |
|-------|-----------|-------------|
| Type families | `--font-display`, `--font-body` | Overridable by TweaksContext |
| Accessible personalisation | `--text-base`, `--line-height`, `--letter-spacing`, `--transition-speed`, `--accent` | Set by TweaksContext on `:root` |
| Background / surface | `--bg`, `--bg-tint`, `--surface`, `--surface-2`, `--surface-3` | Layered card system |
| Ink / text | `--ink`, `--ink-soft`, `--ink-faint` | Three levels of text emphasis |
| Lines | `--line`, `--line-strong` | Border colors |
| Sage (primary accent) | `--sage`, `--sage-deep`, `--sage-soft`, `--sage-tint` | Green; primary action color |
| Clay | `--clay`, `--clay-deep`, `--clay-soft`, `--clay-tint` | Warm orange-brown; secondary |
| Lavender | `--lavender`, `--lavender-deep`, `--lavender-soft`, `--lavender-tint` | Muted purple |
| Gold | `--gold`, `--gold-soft` | Warm yellow |
| Mood / weather spectrum | `--mood-radiant`, `--mood-calm`, `--mood-cloudy`, `--mood-low`, `--mood-heavy` | Color-coded per mood state |
| Care (crisis-aware) | `--care`, `--care-deep`, `--care-soft`, `--care-tint` | Red-warning; used in crisis UI |
| Voice pipeline | `--v-listen`, `--v-transcribe`, `--v-prepare`, `--v-speak`, `--v-connected` | Status-coded colors for voice UI |
| Geometry | `--r-xs`, `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`, `--r-pill` | Border radius scale |
| Shadows | `--shadow-soft`, `--shadow-card`, `--shadow-lift` | Elevation scale |
| Easing | `--ease` | `cubic-bezier(.22,.61,.36,1)` |

**Font Setup**

Loaded via Google Fonts `@import`:
- `Newsreader` (optical-size 6–72, weights 400/500/600, including italic) → `--font-display`
- `Hanken Grotesk` (weights 400–700) → `--font-body` (default body)
- `Inter` (weights 400–700) → available for the `sans` Tweaks option

Self-hosted via `@font-face`:
- `OpenDyslexic` from `/public/fonts/OpenDyslexic-Regular.otf` → used when TweaksContext font = `'dyslexic'`

**Utility Classes**

| Class | Effect |
|-------|--------|
| `.serif` | Applies `--font-display`, weight 500, letter-spacing -0.01em |
| `.serif-i` | Applies `--font-display`, italic, weight 400 |
| `.label` | 11px, weight 600, letter-spacing 0.16em, uppercase, `--ink-faint` color |
| `.card` | `--surface` background, `--line` border, `--r-lg` radius, `--shadow-card` shadow |
| `.hair` | `--line` border only |
| `.no-scrollbar` | Hides scrollbar (webkit + IE + Firefox) |
| `.sr-only` | Visually hidden but accessible to screen readers |
| `.fade-up` | Entrance: `float-in` animation (translateY 10px → 0) |
| `.fade-in` | Entrance: `so-fade-in` animation |
| `.scale-in` | Entrance: `so-scale-in` animation (scale .97 → 1) |
| `.rise` | Entrance: `so-rise` animation (translateY 22px → 0) |
| `.reduce-motion` | Collapses all durations to 0.001ms (mirrors `prefers-reduced-motion`) |
| `.focus-mode` | Activates the low-distraction presentation: compact icon sidebar, flat card elevation, smaller mood markers, tighter journal/Insights/chat spacing, and quieter decorative badges while preserving core controls and safety UI |
| `.so-range` | 4px height for `<input type="range">` |

**Animations Defined**

`breathe`, `float-in`, `soft-pulse`, `ripple`, `shimmer-dot`, `wave-bar`, `conn-pulse`, `caret-blink`, `so-fade-up`, `so-fade-in`, `so-scale-in`, `so-rise`, `so-pulse-dot`

**`prefers-reduced-motion` Support**

Both the OS media query and a `.reduce-motion` class (toggled by TweaksContext) collapse all animation and transition durations to 0.001ms.

---

## 2. Entry Points & Layout

### `app/layout.tsx`

- Imports `globals.css` globally.
- Sets `<html lang="en" className="scroll-smooth" suppressHydrationWarning>`.
- Exports `metadata`: `title: 'SoulMate — a calm companion'`, `description: 'A multi-agent AI companion…'`.
- Wraps children in `TweaksProvider` (outer) then `UserProvider` (inner).
- `TweaksProvider` must be outer because it sets CSS variables on `document.documentElement`, which affects the entire page including UserProvider.

### `app/page.tsx`

```tsx
import { SoulMateApp } from '../components/SoulMateApp';
export default function Home() {
  return <SoulMateApp />;
}
```

A pure entry point. No props, no state. All logic lives in `SoulMateApp`.

### `components/SoulMateApp.tsx`

The root application shell. Exported as both named and default export.

**State managed**

| State | Type | Purpose |
|-------|------|---------|
| `mounted` | `boolean` | Gate to avoid SSR hydration mismatch; set to `true` on mount |
| `screen` | `ScreenId` | Currently active screen (`'today'` default) |
| `todayMood` | `string \| null` | The mood id selected during the current session's check-in |
| `moodOpen` | `boolean` | Whether the MoodCheckIn modal overlay is open |
| `safetyOverlay` | `{id, crisisSupport?} \| null` | App-level Safety screen handoff that preserves the mounted EmptyChair session underneath |

**Type exported**

```ts
export type ScreenId = 'today' | 'companion' | 'reflections' | 'insights' | 'settings' | 'safety' | 'memory';
```

**Hooks consumed**

- `useUser()` → `userId`, `setUserId`
- `useTweaks()` → `tweaks`, `set`
- `useOcean(userId)` → `ocean`, `narrative`, `oceanLoaded`, `oceanError`

**Routing logic**

1. Before mount (`!mounted`): renders `null` (avoids hydration mismatch).
2. If `!userId`: renders `<OnboardingShell style="guided" />`.
3. Otherwise: renders `Sidebar` + `<main>` with the active screen.

During an EmptyChair crisis, `onOpenSafety` mounts the real `SafetyScreen` as an app-level overlay above the still-mounted Companion screen. The hidden Companion tree retains its crisis card, paused/stopped state, and live socket callbacks. Closing the support popup leaves this Safety screen visible; the Safety Back button removes the app-level overlay.

**`renderScreen()` switch**

| `screen` value | Component rendered | Props passed |
|---------------|-------------------|--------------|
| `'today'` | `TodayScreen` | `name`, `todayMood`, `ocean`, `narrative`, `oceanLoaded`, `oceanError`, `onNavigate`, `onCheckIn` |
| `'companion'` | `CompanionScreen` | `name`, `onExit`, `onOpenSafety` |
| `'reflections'` | `ReflectionsScreen` | none |
| `'insights'` | `InsightScreen` | `ocean`, `narrative`, `loaded`, `error` |
| `'settings'` | `SettingsScreen` | `name`, `onConsentReview`, `onOpenSafety`, `onLogout` |
| `'safety'` | `SafetyScreen` | `onBack` |
| `'memory'` | `MemoryScreen` | none |

**Side effects**

- `seedWeekMoods()` is called once when `userId` becomes truthy (seeds demo mood data into localStorage).
- `toggleTheme()` calls `set('darkMode', !tweaks.darkMode)`.
- Logout: removes `'soulmate_user_id'` from localStorage and sets `userId` to `''`.

**`MoodCheckIn` modal**

Rendered as a sibling of the app-shell `<div>` inside the component's returned Fragment (with props `style="weather"`, `onClose`, `onComplete`) when `moodOpen` is true. On complete:
- Sets `todayMood` to the selected mood id.
- Closes the modal.
- If `nextAction === 'talk'`, navigates to `'companion'` screen.

**Focus mode**

When `tweaks.focusMode` is true, the app shell div gets class `'focus-mode'`. CSS then creates a low-distraction presentation without changing screen data or behavior: the sidebar collapses to an accessible icon rail, its mini OCEAN preview is hidden, card elevation and decorative backgrounds are flattened, Today and Mood Journal markers become smaller, Insights and Settings spacing tightens, and chat chrome/avatars become quieter. Navigation, mood words/dates, journal controls, OCEAN data, chat input, and EmptyChair safety UI remain visible and operable. Today also forces its calm single-column layout while focus mode is active.

---

## 3. Screens

### Today (`components/screens/Today.tsx`)

**Purpose**

The home/dashboard screen. Shows a daily check-in card, a week mood strip, a quick-reflection entry point, and a mini OCEAN insight card.

**Data sources**

| Source | Key / Endpoint | Usage |
|--------|---------------|-------|
| `localStorage` | `'soulmate_moods'` | Read to hydrate today's mood on mount and listen for `'reflection-saved'` events to refresh |
| Props | `ocean: OceanData`, `narrative: string` | Passed from `SoulMateApp` (fetched by `useOcean`) |
| Custom event | `window`, `'reflection-saved'` | Triggers re-read of localStorage for mood strip and today card |

**Key state**

| Variable | Type | Purpose |
|----------|------|---------|
| `todayMood` | `string \| null` | Today's mood id, hydrated from localStorage after mount |
| `weekMoods` | `ReturnType<typeof getWeekMoods>` | 7-day array, hydrated from localStorage after mount |
| `reflectOpen` | `boolean` | Controls `QuickReflection` modal visibility |

**Rendered structure**

Two layout variants controlled by `tweaks.dashboard` (forced to `'calm'` in focus mode):

- **`calm`** (default): Single-column stack: Greeting → CheckInCard → 2-col grid (TalkCard + ReflectCard) → WeekCard → InsightCard.
- **`bento`**: CSS grid with CheckInCard spanning 2 rows on the left, TalkCard and ReflectCard stacked on the right, then a 2-col grid for WeekCard and InsightCard below.

**Notable sub-components**

- `WeekStrip` (exported): renders a 7-day dot strip with an SVG dashed connector line between consecutive check-in days. Dot size and opacity encode mood intensity (radiant = 44px/1.0 with ring, heavy = 32px/0.6).
- `MoodCheckIn` (exported): a 3-step fixed modal overlay. Step 0 picks a mood; step 1 optionally adds a note; step 2 shows a reflection and offers "Talk about it" or "Done". Persists to `localStorage['soulmate_moods']` and dispatches `'reflection-saved'`.
- `QuickReflection`: inline modal for writing a quick reflection, POSTs to `http://localhost:8000/api/reflections/{userId}` and dispatches `'reflection-saved'`.

**`MoodPicker` variants**

The `style` prop controls which picker UI is rendered: `'weather'` (icon buttons, default), `'emoji'` (emoji inside circle buttons), `'slider'` (range input), `'words'` (full-width list buttons showing the mood's `word` field).

**Mood prompts and invitations**

`MOOD_PROMPTS` provides per-mood textarea placeholder text for the note step. `MOOD_INVITATION` provides per-mood subtitle text for the CheckInCard when a mood has been recorded. `AUTO_NOTES` provides fallback note text when the user saves without typing a note.

---

### Companion (`components/screens/Companion.tsx`)

**Purpose**

Three-tab view: **Chat** (text conversation), **Physical** (a static setup guide for the hardware voice companion — internal tab id `'voice'`), and **Empty Chair** (therapeutic roleplay with full safety lifecycle).

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | — | User's display name |
| `initialTab` | `'chat' \| 'voice' \| 'empty'` | `'chat'` | Which tab is active on mount |
| `onExit` | `() => void` | optional | Declared in `CompanionProps` and passed by `SoulMateApp`, but not currently consumed |
| `onOpenSafety` | `(crisisSupport?: CrisisSupportSession) => void` | optional | Opens the app-level Safety screen; a crisis payload also opens its five-option panel |

**Key state (CompanionScreen)**

| Variable | Type | Purpose |
|----------|------|---------|
| `tab` | `'chat' \| 'voice' \| 'empty'` | Currently active sub-view |

**ChatView**

- Calls `useChat('messaging')`.
- `busy` = `status !== 'idle'` → locks input and shows typing dots.
- Auto-scrolls to bottom on new messages.
- Two chat styles: `'bubbles'` (speech bubbles) and `'minimal'` (inline text with left-border on user messages). Controlled by `tweaks.chatStyle`.

**PhysicalCompanionView** (the `'voice'` tab, labeled **"Physical"**)

A **static instructional guide** — it does **not** call `useChat`, open any socket, record audio, or handle keyboard shortcuts. It explains how to run the standalone hardware companion (`backend/voice_companion.py`):

- **Hardware** card: `ESP32 · MAX98357A · SH1106 OLED`, serial port `COM5`, baud `921600`, laptop mic (default).
- **How to start** (3 numbered steps): `cd backend` → `uv run python voice_companion.py` → wait for the "SoulMate" ready signal on the OLED / terminal.
- **Controls** cards (documentation only, not wired to key handlers): `SPACE` = push-to-talk, `Q` = quit / free `COM5`.
- **Footer** note: falls back to laptop speakers via pygame if no ESP32; set `COMPANION_USER_ID` in `.env` to change the user name (default `Ghostman`).

> The earlier live-voice "VoiceView" (push-to-talk over the chat socket, `unlockAudio()`, `VoiceWave`, `tweaks.voiceScreen` display modes) no longer exists in the browser UI. Voice now runs only through the standalone `voice_companion.py` process and can be observed via the Voice-Monitor socket (`useVoiceMonitor`). The standalone `components/screens/PhysicalCompanion.tsx` (`PhysicalCompanionScreen`) is an **unused near-duplicate** of this view — not imported or routed anywhere.

**EmptyChairView**

- Calls `useChat('empty-chair')`.
- Setup form: Who, Relationship, Unspoken need. Sends a `[SYSTEM_INIT]`-prefixed message on begin.
- Full safety lifecycle driven by WebSocket server events. State variables:

| Variable | Type | Purpose |
|----------|------|---------|
| `started` | `boolean` | Whether the session has begun |
| `form` | `{who, rel, words}` | Setup form values |
| `assessment` | `Assessment` | Current safety level (from safetyRouter) |
| `paused` | `boolean` | Input is locked |
| `hadCrisis` | `boolean` | At least one crisis event occurred |
| `ended` | `boolean` | Session ended (shows end card) |
| `elevated` | `boolean` | 30-min elevated support mode is active |
| `sysNotif` | `string \| null` | Auto-dismissed system notification text |
| `stopped` | `boolean` | Roleplay stopped by safety system |
| `showSafeBanner` | `boolean` | Gentle reassurance banner visible |
| `ambience` | `string \| null` | Currently playing ambient track id |

- Ambient audio: loops at 0.3 volume, tracks: `forest`, `ocean`, `rain` from `/audio/{id}.mp3`.
- Safety events handled: `safety_decision`, `crisis_mode`, `elevated_mode`, `re_entry_choice`, `system_message`, `safety_summary`.
- Starting from the setup form calls `useChat.resetSession()`, clearing only the persisted/in-memory `empty-chair` history plus the current EmptyChair emotion/status/audio buffer, then resets all local crisis/session UI state before sending the new `[SYSTEM_INIT]` message. Messaging, voice, profile, memory, OCEAN, and reflections are untouched.
- `stop_roleplay` immediately sets stopped/paused/had-crisis state and renders the crisis card. EmptyChair records the current AI-message count, waits for the next AI `message` frame so only the new crisis-safe response moves into the card, then uses a short handoff delay before opening the app-level `SafetyScreen` and its five-option panel. A fallback opens Safety if the response frame is delayed. Breathing is an optional panel action.

---

### Reflections (`components/screens/Reflections.tsx`)

**Purpose**

Journal screen. Shows written reflections (from backend) and mood check-in notes (from localStorage) merged and sorted by date.

**Data sources**

| Source | Endpoint / Key | Method | Description |
|--------|---------------|--------|-------------|
| Backend | `GET http://localhost:8000/api/reflections/{userId}` | fetch | List all written reflections |
| Backend | `POST http://localhost:8000/api/reflections/{userId}` | fetch | Create new reflection |
| Backend | `DELETE http://localhost:8000/api/reflections/{userId}/{id}` | fetch | Delete a reflection |
| `localStorage` | `'soulmate_moods'` | read/write | Mood check-in entries (as read-only journal entries) |

**Key state**

| Variable | Type | Purpose |
|----------|------|---------|
| `entries` | `Entry[]` | Merged list of written + mood entries, sorted by `timestamp` descending |
| `loading` | `boolean` | Fetch in progress |
| `editing` | `boolean` | New-reflection inline editor is open |
| `title`, `body`, `selectedMood` | `string` | New reflection form values (`title`/`body` start empty; `selectedMood` defaults to `'bright'`, and the create-POST sends `mood: selectedMood`) |
| `errorId` | `string \| null` | ID of entry whose delete failed |
| `hoveredId` | `string \| null` | Hovered entry (reveals delete button on hover-capable devices) |
| `canHover` | `boolean` | Detected via `window.matchMedia('(hover: hover)')` |
| `announcement` | `string` | `aria-live="polite"` text for screen-reader announcements |

**Entry interface**

```ts
interface Entry {
  id: string;
  title: string;
  body: string;
  mood: string;
  timestamp: number;  // Unix seconds
  from: 'Written' | 'Mood check-in';
}
```

**Notable behaviors**

- Re-fetches when a `'reflection-saved'` window event fires (e.g., QuickReflection modal saves from Today screen).
- Delete is optimistic: entry removed immediately, reverted with error state if the HTTP request fails. Re-insert puts the entry back at its original index.
- Mood check-in entries (id starts with `'mood-'`) are deleted by rewriting `localStorage['soulmate_moods']`.
- `formatDate` converts Unix seconds to `'Today'`, `'Yesterday'`, or short weekday (`en-GB` locale).
- Entries render in a 2-column CSS grid.

---

### Memory (`components/screens/Memory.tsx`)

**Purpose**

Shows what SoulMate "remembers" about the user across three categories: People, Facts, Themes. Allows toggling and deleting individual items.

**Data sources**

No API calls. All state is initialized from `SEED_MEMORY` (hardcoded) and managed locally.

**Key state**

| Variable | Type | Purpose |
|----------|------|---------|
| `mem` | `Record<MemKey, MemItem[]>` | Current memory items per category |

**`MemItem` interface**

```ts
interface MemItem { id: number; t: string; d: string; on: boolean }
```

**`SEED_MEMORY`**

Pre-populated with example entries:
- `people`: Mai (close friend), Dad (distant relationship)
- `facts`: Final exams, Lives away from home, Loves early walks
- `themes`: Pressure to perform, Wanting to feel seen

**Rendered structure**

Header with total item count and "Clear everything" button (no handler implemented). Three groups rendered as labeled card sections. Each item row has: title, description, a delete button, and a `Toggle` switch. Below the groups: a privacy reassurance note with a lock icon.

**Notable behaviors**

`toggle(g, id)` flips `item.on` to reduce opacity. `remove(g, id)` filters the item out entirely. Neither action calls any API; changes are purely in-memory.

---

### Insight (`components/screens/Insight.tsx`)

**Purpose**

Displays the user's OCEAN personality profile as a radar chart and five trait insight cards, with compact, always-visible non-clinical context and an optional backend narrative.

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ocean` | `OceanData` | — | OCEAN scores 0–1 |
| `narrative` | `string` | `''` | Narrative from backend `reflect_on_history()` |
| `loaded` | `boolean` | `true` | Whether ocean data has been fetched |
| `error` | `string \| null` | `null` | Error from ocean fetch |

**Rendered structure**

`ScreenScroll` wrapper (max 1180px). A compact header and reflection banner provide always-visible context, including loading/error/empty narrative states and a reminder that the signals are not labels, diagnoses, or fixed scores. The primary responsive grid places `OceanRadar` at `size={244}` (with a WCAG text alternative via `aria-label`) beside five trait cards in stable OCEAN order. Each trait card has an icon, supportive copy, a subtle percentage, and an ARIA-labelled progress indicator. A compact "How this shapes support" card follows the profile.

**Per-trait colors (`TRAIT_COLORS`)**

| Trait | Accent |
|-------|--------|
| openness | `--gold` |
| conscientiousness | `--sage` |
| agreeableness | `--clay` |
| extraversion | `--lavender` |
| neuroticism | `--mood-low` |

---

### Safety (`components/screens/Safety.tsx`)

**Purpose**

Standalone crisis-support resource page accessible from the sidebar's settings or from the Companion screen.

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onBack` | `() => void` | optional | Called when the "Back" button is clicked |
| `crisisSupport` | `CrisisSupportSession` | optional | Opens the five-option popup and supplies EmptyChair end/resume callbacks |

**Data sources**

No API calls. All content is hardcoded.

**Crisis lines (hardcoded)**

| Displayed text | Dial value |
|----------------|------------|
| Vietnam: 096 306 1414 | 096 306 1414 |
| US: 988 (Suicide & Crisis Lifeline) | 988 |
| International: Befrienders Worldwide | befrienders.org |

**Rendered structure**

Scrollable container (max 760px). Header with `IconBadge` (care tone) and title. Red emergency notice card. Crisis lines grid. Section "Settle your body" with 3 grounding option buttons (breathing, 5-4-3-2-1, calming sounds — rendered as visual buttons with no action handlers in the base screen). When `crisisSupport` is present, the screen owns `SafetySupportPanel`, optional grounding/breathing/sounds overlays, and `ConfirmResume`. Dismissing the popup leaves the phone/resource cards visible and does not call EmptyChair or the backend.

---

### Settings (`components/screens/Settings.tsx`)

**Purpose**

Accessible personalisation screen organized into four medium preference cards with a consistent vertical reading flow. All changes are written to `TweaksContext` (and thereby to localStorage). WCAG 2.2 AA-minded with `fieldset`/`legend` grouping, roving arrow-key navigation, `aria-pressed`/`aria-checked`, ≥44px targets, a polite live region, and a live type preview.

**Props**

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Declared in `SettingsProps` and passed (`name={userId}`), but **not destructured/used** in the component |
| `onConsentReview` | `() => void` | Declared and passed (→ Memory screen), but **currently unwired** — no control in Settings invokes it |
| `onOpenSafety` | `() => void` | Navigates to Safety screen (Support section link) |
| `onLogout` | `() => void` | Calls back to `SoulMateApp`, which clears the session |

**Key state**

| Variable | Type | Purpose |
|----------|------|---------|
| `lastChanged` | `string` | Announced to `aria-live="polite"` region after each tweak update |

**Sections**

1. **Reading**: Text size (S/M/L/XL), Font (sans/dyslexic/serif), Line spacing (compact/normal/relaxed), Letter spacing (default/wide), and a live type preview.
2. **Theme**: Dark mode, Colour mode (calm/vibrant/high-contrast), and Accent colour (6 presets + custom `<input type="color">`). A subtle inline warning appears when the accent fails WCAG AA 4.5:1 against the current background.
3. **Focus & interaction**: Reduce animations, Focus mode, Dashboard style (calm/bento), and Chat style (bubbles/minimal).
4. **Support & account**: Support resources link, Reset to defaults, and Sign out.

**Accent color presets**

Sea green `#4A9B7F`, Forest green `#2E9E6E`, Teal `#3F8FA8`, Clay `#C77B5E`, Lavender `#87859F`, Gold `#CCA24F`.

**Notable behaviors**

- `backgroundHex()` derives the approximate background hex for contrast checking based on `darkMode` and `colorMode`.
- `OptionGroup` implements roving tabindex navigation (arrow keys move focus between options).
- "Reset to defaults" button calls `resetToDefaults()` from TweaksContext.

---

### Onboarding (`components/screens/Onboarding.tsx`)

**Purpose**

First-run onboarding flow to collect the user's name. The captured name becomes the `userId` for backend sessions.

**Props (OnboardingShell)**

| Prop | Type | Description |
|------|------|-------------|
| `style` | `string` | `'conversational'` renders `OnboardingConversational`; any other value (including `'guided'`) renders `OnboardingGuided` (the default) |
| `onComplete` | `(name: string) => void` | Called with the user's entered name when onboarding finishes |

**`SoulMateApp` always passes `style="guided"`.**

**OnboardingGuided**

A 6-step paged flow with a progress indicator. The progress indicator, card, and bottom navigation share a centered responsive column capped at `560px`; the card padding reduces on small screens and reason options switch from a two-column grid to one column at `430px`.

| Step | Content |
|------|---------|
| `welcome` | Breathing orb, tagline, Begin button |
| `about` | What SoulMate is and isn't (3 icon rows) |
| `consent` | Explanation of how conversation text supports replies, continuity, memory, personality signals, and safety-aware responses |
| `name` | Text input: "What should I call you?" |
| `reasons` | Multi-select pill buttons from `REASONS` array |
| `ready` | Confirmation with the user's name |

**State (OnboardingGuided)**

| Variable | Type | Purpose |
|----------|------|---------|
| `step` | `number` | Current step index |
| `name` | `string` | User's entered name |
| `reasons` | `string[]` | Selected reasons |

**OnboardingConversational**

A scripted chat bubble flow (5 messages from SoulMate). Shows a text input at step 4 to collect the user's name. The `onComplete` callback is called with the entered name.

**Notable behaviors**

- The Continue button is disabled at the `'name'` step if `name.trim()` is empty.
- On the `'ready'` step, the button reads "Enter SoulMate" and calls `onComplete(name.trim() || 'friend')`.

---

## 4. Shared Components

### Sidebar

**File**: `frontend/components/Sidebar.tsx`

**Props**

| Prop | Type | Description |
|------|------|-------------|
| `screen` | `ScreenId` | Currently active screen (used to highlight nav item) |
| `onNavigate` | `(s: ScreenId) => void` | Called when a nav button is clicked |
| `ocean` | `OceanData` | Passed to the mini `OceanRadar` |
| `dark` | `boolean` | Current dark mode state (toggles sun/moon icon) |
| `onToggleTheme` | `() => void` | Called when the theme toggle button is clicked |
| `name` | `string` | User's display name (shown in footer, first letter as avatar) |
| `onOpenSettings` | `() => void` | Called when the Settings button is clicked |

**Purpose**

Left navigation rail. Contains: brand logo (heart icon + "SoulMate"), a clickable mini OCEAN radar that navigates to `'insights'`, vertical nav buttons, and a footer with theme toggle, settings link, and user avatar.

**`NAV` constant (exported)**

```ts
export const NAV = [
  { id: 'today',       label: 'Today',       icon: 'sun',     status: 'B' },
  { id: 'companion',   label: 'Companion',   icon: 'chat',    status: 'A' },
  { id: 'reflections', label: 'Reflections', icon: 'feather', status: 'B' },
  { id: 'insights',    label: 'Insights',    icon: 'compass', status: 'A' },
];
```

`status` is a `'A' | 'B' | 'C'` tier used by `StatusChip` (not rendered by Sidebar itself).

**Used by**: `SoulMateApp`

---

### EmotionBadge

**File**: `frontend/components/EmotionBadge.tsx`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `emotion` | `string` | `'neutral'` | Emotion label from the backend `emotion_status` WebSocket frame |

**Purpose**

Pill-shaped badge showing the latest detected emotion. Color-codes via `EMOTION_COLORS` map.

**Emotion → Color mapping**

| Emotion | Color | Visual |
|---------|-------|--------|
| neutral | `#9e9e9e` | grey |
| happy | `#f4c430` | yellow |
| love | `#e91e8c` | pink |
| sad | `#5b8dee` | blue |
| depressed | `#3a5a8c` | dark blue |
| anxious | `#ff9800` | orange |
| angry | `#e53935` | red |
| fearful | `#7b1fa2` | purple |
| ashamed | `#795548` | brown |
| surprise | `#00bcd4` | teal |
| disgust | `#827717` | olive |
| confusion | `#78909c` | grey-purple |

Has class `emotion-badge` (used by `.focus-mode` CSS rule to reduce it to 42% opacity).

**Used by**: `ChatView` and `EmptyChairView` inside `Companion.tsx`

---

### StatusChip

**File**: `frontend/components/StatusChip.tsx`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tier` | `Tier` (`'A' \| 'B' \| 'C'`) | optional | Feature maturity tier; renders nothing if not provided |

**Purpose**

Academic feature-maturity badge positioned absolutely at top-right. On hover/click, expands a tooltip listing all three tiers with descriptions.

**Tier definitions**

| Tier | Label | Tone |
|------|-------|------|
| A | Implemented core feature | sage |
| B | High-fidelity prototype | gold |
| C | Future work | lavender |

Has class `status-chip` (hidden by `.focus-mode` CSS rule).

**Used by**: not imported by any screen in the current codebase (exported for potential use)

---

### safety/Modals

**File**: `frontend/components/safety/Modals.tsx`

Exports the grounding, breathing, calming-sounds, and legacy `SafetyPage` overlays. The first three are used by the app-level `SafetyScreen` crisis flow.

#### `GroundingExercise`

| Prop | Type | Description |
|------|------|-------------|
| `onComplete` | `() => void` | Called when user finishes step 5 |
| `onSkip` | `() => void` | Called when user clicks Skip or presses Escape |

5-step 5-4-3-2-1 grounding exercise. Full-screen overlay with blurred background. Keyboard navigation: ← back, → next, Escape skip. Progress bar shows completed steps. Auto-focuses on mount. Uses `role="dialog" aria-modal="true"`.

#### `BreathingModal`

| Prop | Type | Description |
|------|------|-------------|
| `onComplete` | `() => void` | Called when user clicks Finish |

Guided breathing with an animated SVG circle that scales through `in → hold → out` phases (4s/4s/6s). Timer counts elapsed seconds. Start/Pause toggle button. Full-screen overlay.

#### `CalmingSounds`

| Prop | Type | Description |
|------|------|-------------|
| `onClose` | `() => void` | Called when the close button is clicked |

Floating card (bottom-right, position absolute). Three tracks: Rain, Ocean, Forest. Audio sourced from `/audio/{id}.mp3` via `new Audio()`. Volume range input (0–100, default 70). Mute toggle. `unavailable` state shown when `Audio.play()` rejects. Uses `role="dialog" aria-label="Calming sounds"`.

#### `SafetyPage`

| Prop | Type | Description |
|------|------|-------------|
| `onBack` | `() => void` | Back button handler |
| `onTryGrounding` | `() => void` | Launches grounding exercise |
| `onTryBreathing` | `() => void` | Launches breathing exercise |

Full-screen safety resource page listing crisis hotlines. Hardcoded lines: Vietnam: 096 306 1414 (primary), US: 988 (Suicide & Crisis Lifeline, primary), UK Samaritans (116 123), Australia Lifeline (13 11 14). External link to IASP crisis centres. Bottom section with Grounding and Breathing shortcut buttons. Auto-focuses on mount.

---

### safety/SafetyBits

**File**: `frontend/components/safety/SafetyBits.tsx`

Exports 5 components and 1 utility function. Status/banner/footer components are used by `EmptyChairView`; the panel and resume confirmation are hosted by `SafetyScreen`.

#### `toneVars(tone: SafetyTone)` (utility)

Returns `{ bg, bd, fg, dot }` CSS variable strings for sage/clay/care tones.

#### `SafetyStatusChip`

| Prop | Type | Description |
|------|------|-------------|
| `assessment` | `Assessment \| null` | Current safety assessment; renders nothing if null |

Pill chip with animated pulsing dot (non-normal levels only). Icons: `shield-check` (normal), `shield-alert` (extra), `life-buoy` (urgent).

#### `SafetyBanner`

| Prop | Type | Description |
|------|------|-------------|
| `onOpenSafety` | `() => void` | Opens safety resource page |

Clay-tinted top banner with leaf icon and "Support resources" button. Shown during elevated mode.

#### `SafetySupportPanel`

| Prop | Type | Description |
|------|------|-------------|
| `targetName` | `string` | Name of the empty-chair target person |
| `options` | `SupportOption[]` | List of support options to render |
| `onChoose` | `(action: SupportOption['action']) => void` | Called when user selects an option |
| `onRequestResume` | `() => void` | Called when user clicks "I'm okay — continue" |
| `onClose` | `() => void` | Dismisses only the panel, preserving the Safety page and crisis state |
| `overSafetyPage` | `boolean` (optional) | Raises the modal above the Safety resource page |

Compact, focusable modal titled "Choose what helps right now" with five icon buttons. During a hard stop it appears above the existing Safety resource page; backend-triggered re-entry uses the same centered overlay presentation. Backdrop click, Escape, and the close button dismiss only the panel and restore focus. Clicks inside the card do not dismiss it. "I'm okay — continue" remains at the bottom.

#### `ConfirmResume`

| Prop | Type | Description |
|------|------|-------------|
| `targetName` | `string` | Name of empty-chair target |
| `onConfirm` | `() => void` | Confirmed resume |
| `onCancel` | `() => void` | Stay on pause |

Small centered dialog (dark blurred backdrop). Two buttons: "Not yet" / "Yes, continue".

#### `SupportFooter`

| Prop | Type | Description |
|------|------|-------------|
| `onOpenSafety` | `() => void` | Opens safety resource page |

Care-tinted footer bar with heart-handshake icon and emergency text. Shown persistently after a crisis event.

---

## 5. UI Primitives (`components/ui/`)

### `Icon.tsx`

**How it works**

Two icon sets are merged in a single component:

1. **Main set** (`ICON_PATHS`): compact camelCase names (e.g., `'arrowR'`, `'shieldHeart'`). Values are `|`-separated path fragment strings. Fragment prefixes:
   - No prefix → `<path d="..."/>`
   - `circle:cx,cy,r` → `<circle>`
   - `rect:x,y,w,h,rx` → `<rect>`
   - `dot:cx,cy` → `<circle r={1} fill="currentColor">`
   - `poly:points` → `<polygon>`
   - Literal `gear` → a hardcoded complex `<path>` for the gear cog

2. **Lucide/safety set** (`LUCIDE_PATHS`): kebab-case names (e.g., `'arrow-left'`, `'shield-check'`). Values are raw inner SVG markup strings, rendered via `dangerouslySetInnerHTML`.

The component checks `LUCIDE_PATHS[name]` first; if not found, falls back to `ICON_PATHS[name]`. Returns `null` if the name is in neither set.

**All icons render as `aria-hidden="true"` SVGs.**

**`IconProps`**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | — | Icon name (camelCase for main set, kebab for Lucide set) |
| `size` | `number` | `20` | Width and height in pixels |
| `stroke` | `number` | optional | Stroke width alias |
| `strokeWidth` | `number` | optional | Stroke width (alias, takes priority if both provided) |
| `fill` | `string` | `'none'` | SVG fill attribute |
| `className` | `string` | `''` | Additional CSS class |
| `style` | `React.CSSProperties` | optional | Inline styles |

Effective strokeWidth: `strokeWidth ?? stroke ?? 1.75`.

---

### `primitives.tsx`

#### `Button`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `ButtonVariant` | `'primary'` | Visual style |
| `size` | `ButtonSize` | `'md'` | Padding/font size preset |
| `icon` | `string` | optional | Left icon name |
| `iconRight` | `string` | optional | Right icon name |
| `full` | `boolean` | optional | `width: 100%` |
| `style` | `React.CSSProperties` | `{}` | Additional inline styles |
| + all HTML button attrs | | | Forwarded to `<button>` |

**Variants**

| Variant | Background | Color |
|---------|-----------|-------|
| `primary` | Linear gradient `--sage` → `--sage-deep` | white |
| `clay` | `--clay` | white |
| `lavender` | `--lavender` | white |
| `soft` | `--surface-2` | `--ink` |
| `outline` | transparent | `--ink` |
| `ghost` | transparent | `--ink-soft` |
| `care` | `--care` | white |

Sizes: `sm` (8/14px pad, 13px font), `md` (12/20px pad, 14.5px font), `lg` (15/26px pad, 15.5px font). Scale-down on mousedown (0.97), brightness hover on filled variants.

#### `IconBadge`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | — | Icon name |
| `tone` | `Tone` | `'sage'` | Color tone |
| `size` | `number` | `44` | Width/height |
| `iconSize` | `number` | `20` | Icon size |

Tonal rounded container. `border-radius` uses `--r-md` when `size > 40`, else `--r-sm`.

**`Tone`**: `'sage' | 'clay' | 'lavender' | 'gold' | 'care' | 'neutral'`

#### `Pill`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | — | Content |
| `tone` | `Tone` | `'neutral'` | Color tone |
| `icon` | `string` | optional | Left icon name |
| `onClick` | `() => void` | optional | If provided, renders as `<button>`, else `<span>` |
| `style` | `React.CSSProperties` | `{}` | Additional styles |

#### `Toggle`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `on` | `boolean` | — | Current state |
| `onChange` | `(v: boolean) => void` | — | Change handler |
| `tone` | `string` | `'var(--sage)'` | Active track color (CSS value) |

Standard toggle switch. `role="switch" aria-checked={on}`. 46×27px, 21px knob.

#### `BreathingOrb`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `120` | Diameter in px |
| `tone` | `string` | `'var(--sage)'` | Accent color (CSS value) |
| `active` | `boolean` | `true` | Enables ripple and breathe animations |
| `children` | `React.ReactNode` | optional | Content inside the orb |

Two ripple rings + a central breathing disc. Uses `breathe` and `ripple` animations from `globals.css`.

#### `Skeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| string` | `'100%'` | Width |
| `height` | `number \| string` | `12` | Height |
| `radius` | `number` | `6` | Border radius |
| `style` | `React.CSSProperties` | `{}` | Additional styles |

Pulsing placeholder block using `soft-pulse` animation. `aria-hidden`.

---

### `ScreenScroll.tsx`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | — | Screen content |
| `max` | `number` | `980` | Max content width in pixels |

Renders a full-height, vertically scrolling container (hidden scrollbar) with a centered content wrapper at `max` width and `40px 40px 64px` padding.

**Used by**: `InsightScreen`, `MemoryScreen`, `ReflectionsScreen`, `TodayScreen`

---

### `Ocean.tsx`

Exports three OCEAN visualisation components and the `OCEAN` trait array.

**`OceanData` interface**

```ts
interface OceanData {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}
```

**`OCEAN` array** (exported)

```ts
[
  { key: 'openness',          label: 'Openness',          short: 'O' },
  { key: 'conscientiousness', label: 'Conscientiousness',  short: 'C' },
  { key: 'extraversion',      label: 'Extraversion',       short: 'E' },
  { key: 'agreeableness',     label: 'Agreeableness',      short: 'A' },
  { key: 'neuroticism',       label: 'Sensitivity',        short: 'N' },
]
```

Note: `neuroticism` is labeled "Sensitivity" in the UI.

#### `OceanRadar`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `OceanData` | — | OCEAN scores 0–1 |
| `size` | `number` | `220` | SVG width/height |
| `color` | `string` | `'var(--sage)'` | Fill/stroke color |
| `showLabels` | `boolean` | `true` | Whether to render trait labels |

Pure SVG pentagon radar chart. Three concentric grid rings at 33%/66%/100% radius. Axis lines from center to each vertex. Filled polygon at actual score positions with gradient fill and colored stroke. Dot markers at score positions. Labels at `R+22` from center if `showLabels`. Uses `React.useId()` for gradient ID uniqueness.

#### `OceanBars`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `OceanData` | — | OCEAN scores 0–1 |
| `color` | `string` | `'var(--sage)'` | Bar fill color |

Vertical list of labeled progress bars (height 8px, `--surface-2` track, animated width on change).

#### `OceanRings`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `OceanData` | — | OCEAN scores 0–1 |

Five circular ring gauges (SVG stroke-dasharray technique). Each ring 52×52px with a centered short label. Always uses `--sage` stroke color.

---

## 6. Hooks

### `useChat`

**File**: `frontend/hooks/useChat.ts`

**Signature**

```ts
export const useChat = (modeOverride?: ChatMode) => { ... }
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `modeOverride` | `'messaging' \| 'voice' \| 'empty-chair'` | optional | If provided, overrides URL-based mode detection |

**Returns**

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `Message[]` | Chat history for the current mode only |
| `sendMessage` | `(text: string) => void` | Sends a text message to the backend |
| `emotion` | `string` | Latest detected emotion from `emotion_status` frames |
| `status` | `string` | Backend pipeline status from `status` frames |
| `socket` | `WebSocket \| null` | The live WebSocket instance |
| `unlockAudio` | `() => void` | Creates/resumes `AudioContext` (call on user gesture) |
| `resetSession` | `() => void` | Clears only the current hook mode's UI history and resets its emotion/status/audio buffer |

**Mode determination**

If `modeOverride` is given, it is used directly. Otherwise, the current pathname is checked: `/voice` → `'voice'`, `/empty-chair` → `'empty-chair'`, otherwise → `'messaging'`.

**WebSocket management**

- Connects to `ws://localhost:8000/ws/chat/{userId}` when `userId` is set.
- Reconnects automatically after 3 seconds on unintentional close.
- Cleanup on unmount: sets `intentionalCloseRef` to true, clears reconnect timer, closes socket.
- A single socket serves all three modes simultaneously; messages are dispatched to the correct mode history by their `mode` field.

**Message handling**

| Server frame `type` | Action |
|---------------------|--------|
| `message` | Appends `{role:'ai', content}` to `chatHistories[data.mode || 'messaging']` |
| `user_speech` | Appends `{role:'user', content}` to `chatHistories[data.mode || 'voice']` |
| `audio_chunk` | Decodes base64, accumulates `Uint8Array` in `audioChunksRef` |
| `audio_end` | Concatenates all chunks, decodes via `AudioContext.decodeAudioData`, plays via `BufferSource` |
| `emotion_status` | Sets `emotion` state |
| `status` | Sets `status` state |

**Side effects**

- Creates a single `AudioContext` lazily on first `unlockAudio()` call.
- `audioChunksRef` is a ref (not state), so collecting audio chunks never triggers re-renders.
- Persists `messaging` and `empty-chair` histories together under the current user's versioned localStorage key. `resetSession()` replaces only the active mode array, so clearing EmptyChair does not affect normal Chat.

---

### `useOcean`

**File**: `frontend/hooks/useOcean.ts`

**Signature**

```ts
export function useOcean(userId: string): OceanProfile
```

**Returns (`OceanProfile`)**

| Field | Type | Description |
|-------|------|-------------|
| `ocean` | `OceanData` | OCEAN scores 0–1 (defaults all to 0.5) |
| `narrative` | `string` | Narrative text from backend; empty until ~10 turns |
| `loaded` | `boolean` | False until first successful fetch |
| `error` | `string \| null` | Error message or null |

**Fetches / manages**

- Polls `GET {NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/ocean/{userId}` on mount and every 5 seconds.
- Expected response shape: `{ openness, conscientiousness, extraversion, agreeableness, neuroticism, narrative, error? }`.
- Uses `AbortController` to cancel in-flight requests on cleanup or userId change.
- `AbortError` is silently swallowed; `TypeError` sets a "server unreachable" error message.

**Side effects**

- `setInterval` at 5000ms, cleared on cleanup.
- `AbortController` aborted on cleanup.

---

### `useTweaks`

**File**: `frontend/hooks/useTweaks.ts`

A convenience re-export file. All logic lives in `TweaksContext.tsx`. Exports: `useTweaks`, `TweaksProvider`, `TWEAKS_DEFAULTS`, and all Tweaks type aliases.

See [Section 7 — TweaksContext](#tweakscontexttsx) for full documentation.

---

### `useVoiceMonitor`

**File**: `frontend/hooks/useVoiceMonitor.ts`

**Signature**

```ts
export const useVoiceMonitor = (userId: string) => { ... }
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User ID; hook does nothing if empty |

**Returns**

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `VoiceMonitorMessage[]` | Transcript messages (user + AI) |
| `emotion` | `string` | Latest detected emotion (`'Neutral'` default) |
| `status` | `VoiceMonitorStatus` | Current pipeline status (`'idle'` default) |
| `isConnected` | `boolean` | Whether the WebSocket is open |

**`VoiceMonitorStatus` type**

`'listening' | 'processing' | 'transcribing' | 'thinking' | 'speaking' | 'idle'`

**Fetches / manages**

Connects to `ws://localhost:8000/ws/voice-monitor/{encodeURIComponent(userId)}`.

| Server frame `type` | Action |
|---------------------|--------|
| `status` | Updates `status` state (validated via `isVoiceMonitorStatus` guard) |
| `emotion_status` | Updates `emotion` state |
| `user_speech` | Appends `{role:'user', content}` to `messages` |
| `message` | Appends `{role:'ai', content}` to `messages` |

**Side effects**

- `ws.onclose` sets `isConnected` to false and `status` to `'idle'`.
- No auto-reconnect logic (unlike `useChat`).
- Cleanup: `ws.close()`.

---

## 7. Context

### `UserContext.tsx`

**What it provides**

```ts
{ userId: string; setUserId: (id: string) => void }
```

**How `userId` is stored**

- Initialized to `''`.
- On mount: reads `localStorage.getItem('soulmate_user_id')` and sets state if present.
- `setUserId(id)` writes to both React state and `localStorage.setItem('soulmate_user_id', id)`.
- Logout (in `SoulMateApp`): `localStorage.removeItem('soulmate_user_id'); setUserId('')`.

**The Provider**

`UserProvider` wraps children. The `userId` acts as the user's name (entered during onboarding) and also as the Neo4j user key sent to the backend.

**Hook**: `useUser()` — returns the context value directly.

---

### `TweaksContext.tsx`

**What "tweaks" are**

Accessible personalisation settings that control visual and interaction behavior. Every setting is applied immediately to `document.documentElement` as CSS variables, classes (`dark`, `reduce-motion`), or attributes (`data-color-mode`).

**`TweaksState` fields**

| Field | Type | Default | Effect |
|-------|------|---------|--------|
| `textSize` | `'S' \| 'M' \| 'L' \| 'XL'` | `'M'` | Sets `--text-base` (0.875/1/1.125/1.3125rem) |
| `font` | `'sans' \| 'dyslexic' \| 'serif'` | `'sans'` | Sets `--font-body` |
| `lineSpacing` | `'compact' \| 'normal' \| 'relaxed'` | `'normal'` | Sets `--line-height` (1.4/1.6/1.9) |
| `letterSpacing` | `'default' \| 'wide'` | `'default'` | Sets `--letter-spacing` (normal/0.04em) |
| `reduceMotion` | `boolean` | `false` | Toggles `.reduce-motion` class; sets `--transition-speed` to 0ms |
| `colorMode` | `'vibrant' \| 'calm' \| 'high-contrast'` | `'calm'` | Sets `data-color-mode` attribute |
| `accent` | `string` (hex) | `'#4A9B7F'` | Sets `--accent` and `--sage` simultaneously |
| `focusMode` | `boolean` | `false` | Adds `'focus-mode'` to the app shell for the low-distraction visual treatment; Today also uses it to force the calm layout |
| `dashboard` | `'calm' \| 'bento'` | `'calm'` | Controls Today screen layout |
| `chatStyle` | `'bubbles' \| 'minimal'` | `'bubbles'` | Controls ChatView message rendering |
| `voiceScreen` | `'idle' \| 'live-transcript'` | `'idle'` | Still settable in Settings, but **no longer consumed** by any screen (the VoiceView it controlled was removed) |
| `oceanInsight` | `'bars' \| 'pentagon'` | `'bars'` | Not currently wired to any screen |
| `darkMode` | `boolean` | `true` | Toggles `.dark` class on `<html>` |

**Storage key**: `'soulmate_tweaks'` (localStorage)

**Hydration pattern**

Starts from `TWEAKS_DEFAULTS` (ensures SSR/client render parity), then reads localStorage after mount. Newly-added keys are merged with defaults so old saved blobs don't break.

**OS `prefers-reduced-motion` integration**

`TweaksProvider` listens to `window.matchMedia('(prefers-reduced-motion: reduce)')` and sets `osReducedMotion` state. The effective `prefersReducedMotion` value is `tweaks.reduceMotion || osReducedMotion`.

**What the context provides**

```ts
{
  tweaks: TweaksState;
  set: <K extends keyof TweaksState>(key: K, value: TweaksState[K]) => void;
  resetToDefaults: () => void;
  prefersReducedMotion: boolean;
}
```

**Hook**: `useTweaks()` — throws if used outside `TweaksProvider`.

---

## 8. Lib Utilities

### `moods.ts`

**`Mood` interface**

```ts
interface Mood {
  id: string;       // unique key
  label: string;    // display name
  weather: string;  // Icon name from Icon.tsx
  emoji: string;    // emoji character
  word: string;     // descriptive phrase
  color: string;    // CSS value (--mood-* variable)
  v: number;        // numeric value 0–1
}
```

**`MOODS` array (all 5 moods)**

| id | label | weather icon | emoji | word | color | v |
|----|-------|-------------|-------|------|-------|---|
| `radiant` | Radiant | `sun` | ☀️ | light, open, alive | `--mood-radiant` | 1 |
| `bright` | Steady | `leaf` | 🙂 | calm, okay, grounded | `--mood-calm` | 0.75 |
| `cloudy` | Cloudy | `cloud` | 😐 | flat, unsure, in-between | `--mood-cloudy` | 0.5 |
| `low` | Low | `rain` | 😔 | tired, sad, heavy-ish | `--mood-low` | 0.3 |
| `heavy` | Heavy | `droplet` | 😢 | overwhelmed, hurting | `--mood-heavy` | 0.1 |

**Helper functions**

| Function | Signature | Description |
|----------|-----------|-------------|
| `localDateStr` | `(d?: Date) => string` | Returns local calendar date as `YYYY-MM-DD` (uses local time, not UTC) |
| `getWeekMoods` | `() => { label: string; id: string \| null; note: string }[]` | Returns 7-day array from localStorage, oldest first. Client-only. |
| `moodById` | `(id: string \| null) => Mood` | Finds mood by id; falls back to `MOODS[2]` (cloudy) if not found |
| `greet` | `() => string` | Returns time-of-day greeting: "Good morning" / "Good afternoon" / "Good evening" |

---

### `seedMoods.ts`

**Purpose**

Demo-only seed function. Fills the past 6 days of `localStorage['soulmate_moods']` with hardcoded mood entries so the WeekStrip and Insight views have content on a fresh device. Preserves any real check-in for today.

**`SEED` data**

| Days ago | Mood | Note |
|----------|------|------|
| 6 | `low` | "Carried a lot today" |
| 5 | `cloudy` | "Getting through it" |
| 4 | `bright` | "Things felt lighter" |
| 3 | `radiant` | "One of those rare good days" |
| 2 | `bright` | "Steady and present" |
| 1 | `cloudy` | "Quiet but okay" |

**When called**

`SoulMateApp` calls `seedWeekMoods()` in a `useEffect` once `userId` becomes truthy. After seeding, dispatches `'reflection-saved'` to refresh any mounted listeners.

---

### `safetyRouter.ts`

**Purpose**

Type-safe safety routing for the EmptyChair feature. Maps raw backend decisions to user-safe levels. The backend is authoritative; classifier internals (model name, probabilities, thresholds) are never exposed to the UI.

**Types exported**

```ts
type SafetyLevel = 'normal' | 'extra' | 'urgent'
type RoleplayMode = 'normal_roleplay' | 'safe_roleplay' | 'stop_roleplay'
type SafetyTone = 'sage' | 'clay' | 'care'

interface Assessment {
  level: SafetyLevel;
  mode: RoleplayMode;
  label: string;
  tone: SafetyTone;
  blurb: string;
}
```

**`LEVELS` constant**

| Level | Mode | Label | Tone | Blurb |
|-------|------|-------|------|-------|
| `normal` | `normal_roleplay` | "Normal support" | sage | "Holding space for you" |
| `extra` | `safe_roleplay` | "Extra support" | clay | "Here with a little more care" |
| `urgent` | `stop_roleplay` | "Urgent support" | care | "Let's pause and take care of you" |

**Functions exported**

| Function | Signature | Description |
|----------|-----------|-------------|
| `classifyMessage` | `(text: string) => Assessment` | Local keyword fallback classifier. Checks `URGENT_PATTERNS` then `EXTRA_PATTERNS`. Used when no backend is running. |
| `fromBackendDecision` | `(raw: BackendDecision \| null) => Assessment` | Maps backend `action` field to an `Assessment`. `stop_roleplay` → urgent, `safe_roleplay` → extra, else → normal. |

**`SupportOption` type and `SUPPORT_OPTIONS` constant**

```ts
interface SupportOption {
  action: 'try_grounding' | 'try_breathing' | 'play_sounds' | 'open_safety' | 'end_session';
  label: string;
  sub: string;
}
```

The 5 options: Try grounding, Try breathing, Open calming sounds, Support resources, End this session.

---

## 9. Utils

### `contrastCheck.ts`

**Purpose**

WCAG 2.x relative-luminance contrast ratio calculator. Used by Settings screen to warn when a chosen accent colour fails the 4.5:1 AA threshold.

**Exports**

| Function | Signature | Description |
|----------|-----------|-------------|
| `getContrastRatio` | `(hex: string, bgHex: string) => number` | Contrast ratio between two hex colors, range 1–21. Returns 1 if either color is unparseable. Accepts `#rgb` and `#rrggbb`. |
| `passesAA` | `(hex: string, bgHex: string, largeText?: boolean) => boolean` | Returns `true` if ratio ≥ 4.5 (normal text) or ≥ 3 (large text). |
| `formatRatio` | `(ratio: number) => string` | Rounds to 1 decimal place and returns as string (e.g., `'2.8'`). |

**Algorithm**: linearises sRGB channels per WCAG (`c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), computes relative luminance (`0.2126R + 0.7152G + 0.0722B`), then `(lighter + 0.05) / (darker + 0.05)`.

---

## 10. Data Flows

### localStorage Keys

| Key | Component(s) | Format | Description |
|-----|-------------|--------|-------------|
| `'soulmate_user_id'` | `UserContext` (read/write), `SoulMateApp` (delete on logout) | `string` (user's name) | Persists login across sessions |
| `'soulmate_tweaks'` | `TweaksContext` (read/write) | JSON blob of `TweaksState` | All personalisation settings |
| `'soulmate_moods'` | `Today.tsx`, `Reflections.tsx`, `moods.ts`, `seedMoods.ts` | JSON array of `{date: string, mood: string, note: string}` | Daily mood check-in history |

### HTTP API Endpoints

| Method | URL | Request body | Response shape | Used by |
|--------|-----|-------------|----------------|---------|
| `GET` | `http://localhost:8000/api/reflections/{userId}` | — | `{ reflections: Array<{id, title, body, mood?, timestamp}> }` | `ReflectionsScreen.fetchReflections()` |
| `POST` | `http://localhost:8000/api/reflections/{userId}` | `{ title, body, mood }` | `{ id, title, body, mood, timestamp }` | `ReflectionsScreen.save()`, `QuickReflection.save()` |
| `DELETE` | `http://localhost:8000/api/reflections/{userId}/{entryId}` | — | not specified in source | `ReflectionsScreen.handleDelete()` |
| `GET` | `{NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/ocean/{userId}` | — | `{ openness, conscientiousness, extraversion, agreeableness, neuroticism, narrative, error? }` | `useOcean` (every 5s) |

### WebSocket Endpoints

| Endpoint | Used by |
|----------|---------|
| `ws://localhost:8000/ws/chat/{userId}` | `useChat` |
| `ws://localhost:8000/ws/voice-monitor/{userId}` | `useVoiceMonitor` |

### WebSocket Messages — Client → Server

> Authoritative wire spec: **BACKEND_DOCS.md §9**. The backend accepts more
> client actions than the browser currently sends — see the divergence list in
> [§0](#0-system-context-frontend--backend--esp32) (D1, D2).

`useChat.sendMessage` emits only `send_text`:

| Action | Payload | When sent |
|--------|---------|-----------|
| `send_text` | `{ action: 'send_text', text: string, mode: ChatMode }` | User sends a text message (also carries the `[SYSTEM_INIT]` empty-chair init payload) |

> `start_recording` / `stop_recording` are **no longer emitted by the browser UI** (the old VoiceView was removed). The backend still accepts them; in the current frontend, push-to-talk happens only in the standalone `voice_companion.py` process.

Additional messages sent directly via `socket.send()` in `EmptyChairView`:

| Action | Payload | When sent |
|--------|---------|-----------|
| `resume_roleplay` | `{ action: 'resume_roleplay' }` | User confirms resume in `ConfirmResume` |
| `end_session` | `{ action: 'end_session' }` | User chooses "End session" from support panel |
| `show_reentry_options` | `{ action: 'show_reentry_options' }` | Legacy fallback when breathing completes after a crisis without an open panel |

### WebSocket Messages — Server → Client (handled by `useChat` and `EmptyChairView`)

> The full set of server frames (and exactly when each is emitted) is specified in
> **BACKEND_DOCS.md §9**. The table below is the **client's** view: which frames
> these components actually handle. See [§0](#0-system-context-frontend--backend--esp32)
> D3/D4 for the `re_entry_choice` and `status` divergences.

| `type` | Handler | Fields | Description |
|--------|---------|--------|-------------|
| `message` | `useChat` | `content, mode` | AI response text |
| `user_speech` | `useChat` | `content, mode` | Transcribed user speech (voice mode) |
| `audio_chunk` | `useChat` | `data` (base64 MP3) | Streaming TTS audio chunk |
| `audio_end` | `useChat` | — | Signals end of TTS stream; triggers playback |
| `emotion_status` | `useChat` | `emotion` | Backend-detected emotion string |
| `status` | `useChat` | `content` (`'idle' \| 'speaking' \| 'listening'`) | Pipeline state |
| `safety_decision` | `EmptyChairView` | `action, method, risk_level, suicidewatch_probability` | Per-turn EmptyChair safety assessment |
| `crisis_mode` | `EmptyChairView` | `lockout_seconds, show_breathing` | Hard crisis stop |
| `elevated_mode` | `EmptyChairView` | `active, until_timestamp, reason` | 30-min enhanced support mode |
| `re_entry_choice` | `EmptyChairView` | `prompt, buttons` | Post-crisis options sheet trigger |
| `system_message` | `EmptyChairView` | `text` | Auto-dismissed inline notification (5s) |
| `safety_summary` | `EmptyChairView` | `session_duration, crisis_count` | Session end summary |

**`useVoiceMonitor` (separate socket)**

| `type` | Fields | Action |
|--------|--------|--------|
| `status` | `status` or `content` | Sets status state |
| `emotion_status` | `emotion` | Sets emotion state |
| `user_speech` | `content` | Appends user message |
| `message` | `content` | Appends AI message |

---

## 11. State Management Map

| State | Location | Scope | Persisted? |
|-------|----------|-------|------------|
| `userId` | `UserContext` + `localStorage['soulmate_user_id']` | App-wide | localStorage |
| `tweaks` (all settings) | `TweaksContext` + `localStorage['soulmate_tweaks']` | App-wide | localStorage |
| `osReducedMotion` | `TweaksContext` (internal) | App-wide | No (OS preference) |
| `screen` | `SoulMateApp` | App shell | No |
| `todayMood` | `SoulMateApp` | App shell | Via `localStorage['soulmate_moods']` |
| `moodOpen` | `SoulMateApp` | App shell | No |
| `ocean` | `useOcean` (inside `SoulMateApp`) | App shell | No (polled from backend) |
| `narrative` | `useOcean` (inside `SoulMateApp`) | App shell | No (polled from backend) |
| `oceanLoaded` | `useOcean` | App shell | No |
| `oceanError` | `useOcean` | App shell | No |
| `tab` | `CompanionScreen` | Companion screen | No |
| `messages` (per mode) | `useChat` | Companion screen | No |
| `emotion` | `useChat` | Companion screen | No |
| `status` | `useChat` | Companion screen | No |
| `socket` | `useChat` | Companion screen | No |
| `input` | `ChatView` / `EmptyChairView` | Chat/Empty tab | No |
| `started`, `form` | `EmptyChairView` | Empty Chair tab | No |
| `assessment` | `EmptyChairView` | Empty Chair tab | No |
| `paused`, `panelOpen`, `overlay`, etc. | `EmptyChairView` | Empty Chair tab | No |
| `ambience` | `EmptyChairView` | Empty Chair tab | No |
| `entries` | `ReflectionsScreen` | Reflections screen | Backend + localStorage |
| `editing` | `ReflectionsScreen` | Reflections screen | No |
| `mem` | `MemoryScreen` | Memory screen | No (local only) |
| `why` | `InsightScreen` | Insight screen | No |
| `lastChanged` | `SettingsScreen` | Settings screen | No |
| `todayMood` (Today) | `TodayScreen` | Today screen | Via localStorage |
| `weekMoods` | `TodayScreen` | Today screen | Via localStorage |
| `reflectOpen` | `TodayScreen` | Today screen | No |
| `step`, `picked`, `note` | `MoodCheckIn` | Modal | No |
| Mood history | `localStorage['soulmate_moods']` | All mood readers | localStorage |

---

## 12. Dependencies & Config

### `package.json` — Key Dependencies

**Framework**

| Package | Version |
|---------|---------|
| `next` | 16.1.6 |
| `react` | 19.2.3 |
| `react-dom` | 19.2.3 |

**UI / Motion**

| Package | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | ^12.35.2 | Animation library (installed but not directly imported in the source files read) |
| `lucide-react` | ^0.577.0 | Icon library (installed but icons are handled inline in `Icon.tsx` via `LUCIDE_PATHS`, not via the package's React components) |

**Dev dependencies**

| Package | Version | Purpose |
|---------|---------|---------|
| `@tailwindcss/postcss` | ^4 | PostCSS plugin for Tailwind CSS v4 |
| `tailwindcss` | ^4 | CSS utility framework |
| `typescript` | ^5 | TypeScript compiler |
| `eslint` | ^9 | Linter |
| `eslint-config-next` | 16.1.6 | Next.js ESLint rules |
| `@types/node`, `@types/react`, `@types/react-dom` | ^20 / ^19 | TypeScript type definitions |

Note: There is no `recharts` dependency; the OCEAN radar chart is pure hand-written SVG in `Ocean.tsx`.

### `tsconfig.json` — Path Aliases

| Alias | Maps to |
|-------|---------|
| `@/*` | `./*` (frontend root) |

Other notable options: `target: ES2017`, `strict: true`, `moduleResolution: bundler`, `jsx: react-jsx`, `incremental: true`.

### `next.config.ts`

Contains only the default empty config object:
```ts
const nextConfig: NextConfig = {};
export default nextConfig;
```

No rewrites, redirects, custom headers, or environment variable exposure is configured.

### `postcss.config.mjs`

Uses `@tailwindcss/postcss` plugin only:
```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```
