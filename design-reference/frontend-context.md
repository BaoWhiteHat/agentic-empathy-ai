# SoulMate Frontend Context

> Verbatim code documentation for all frontend files. Generated from the feature/new-design branch.
> Format per file: Purpose → Types/Interfaces → Key logic → ARIA attributes found.

---

## Table of Contents

- [Context & State](#context--state)
  - [TweaksContext](#contexttweakscontexttsx)
  - [UserContext](#contextusercontexttsx)
- [Hooks](#hooks)
  - [useTweaks](#hooksusetweaksts)
  - [useChat](#hooksusechats)
  - [useOcean](#hooksuseoceanis)
  - [useVoiceMonitor](#hooksusevoicemonitors)
- [Lib & Utils](#lib--utils)
  - [lib/moods](#libmoodsts)
  - [lib/safetyRouter](#libsafetyrouterts)
  - [utils/contrastCheck](#utilscontrastcheckts)
- [App Shell](#app-shell)
  - [app/layout.tsx](#applayouttsx)
  - [app/page.tsx](#apppagetsx)
  - [app/globals.css](#appglobalscss)
- [Root Components](#root-components)
  - [SoulMateApp](#componentssoulemateapptsx)
  - [Sidebar](#componentssidebartsx)
  - [EmotionBadge](#componentsemotionbadgetsx)
  - [StatusChip](#componentsstatuschiptsx)
- [Screens](#screens)
  - [Today](#componentsscreenstodaytsx)
  - [Companion](#componentsscreenscompaniontsx)
  - [Insight](#componentsscreensinsighttsx)
  - [Reflections](#componentsscreensreflectionstsx)
  - [Settings](#componentsscreenssettingstsx)
  - [Memory](#componentsscreensmemorytsx)
  - [Onboarding](#componentsscreensoncboardingtsx)
  - [Safety](#componentsscreenssafetytsx)
- [Safety Components](#safety-components)
  - [safety/Modals](#componentssafetymodalstsx)
  - [safety/SafetyBits](#componentssafetysafetybitstsx)
- [UI Primitives](#ui-primitives)
  - [ui/Icon](#componentsuiicontsx)
  - [ui/Ocean](#componentsuioceantsx)
  - [ui/ScreenScroll](#componentsuiscreenscolltsx)
  - [ui/primitives](#componentsuiprimitivestsx)

---

## Context & State

### context/TweaksContext.tsx

**Purpose:** 14-field personalisation state; persisted to localStorage `soulmate_tweaks`; propagated to `:root` as CSS custom properties via `applyToDocument()`. SSR-safe hydration.

**Types/Interfaces:**
```ts
export interface TweaksState {
  textSize:      'S' | 'M' | 'L' | 'XL';
  font:          'sans' | 'dyslexic' | 'serif';
  lineSpacing:   'compact' | 'normal' | 'relaxed';
  letterSpacing: 'default' | 'wide';
  reduceMotion:  boolean;
  colorMode:     'calm' | 'vibrant' | 'high-contrast';
  accent:        string;          // hex
  focusMode:     boolean;
  explainDetail: 'plain' | 'plain+how';
  dashboard:     'calm' | 'bento';
  chatStyle:     'bubbles' | 'minimal';
  voiceScreen:   'idle' | 'live-transcript';
  oceanInsight:  'bars' | 'pentagon';
  darkMode:      boolean;
}

export const TWEAKS_DEFAULTS: TweaksState = {
  textSize: 'M', font: 'sans', lineSpacing: 'normal', letterSpacing: 'default',
  reduceMotion: false, colorMode: 'calm', accent: '#4A9B7F',
  focusMode: false, explainDetail: 'plain', dashboard: 'calm',
  chatStyle: 'bubbles', voiceScreen: 'idle', oceanInsight: 'bars', darkMode: false,
};
```

**Key logic:**
```ts
function applyToDocument(t: TweaksState) {
  const root = document.documentElement;
  const sizeMap = { S: '14px', M: '15.5px', L: '17px', XL: '19px' };
  root.style.setProperty('--text-base', sizeMap[t.textSize]);
  // font, line-height, letter-spacing, accent, color-mode class, reduce-motion class, etc.
  root.classList.toggle('reduce-motion', t.reduceMotion);
  root.classList.toggle('focus-mode', t.focusMode);
  root.setAttribute('data-color-mode', t.colorMode);
  root.setAttribute('data-theme', t.darkMode ? 'dark' : 'light');
}

// SSR-safe hydration: reads localStorage only after mount
useEffect(() => {
  const saved = localStorage.getItem('soulmate_tweaks');
  if (saved) { const merged = { ...TWEAKS_DEFAULTS, ...JSON.parse(saved) }; setTweaks(merged); applyToDocument(merged); }
  else { applyToDocument(TWEAKS_DEFAULTS); }
}, []);

// Context value: { tweaks, set, resetToDefaults }
```

**ARIA attributes found:** none directly — propagates CSS classes used by ARIA-related styling (`.reduce-motion`, `.focus-mode`)

---

### context/UserContext.tsx

**Purpose:** `userId` string persisted to localStorage key `soulmate_user_id`; becomes the backend WebSocket session identifier.

**Types/Interfaces:**
```ts
interface UserContextValue {
  userId: string;
  setUserId: (id: string) => void;
}
```

**Key logic:**
```ts
const [userId, setUserIdState] = useState('');

useEffect(() => {
  const stored = localStorage.getItem('soulmate_user_id');
  if (stored) setUserIdState(stored);
}, []);

const setUserId = (id: string) => {
  localStorage.setItem('soulmate_user_id', id);
  setUserIdState(id);
};
```

**ARIA attributes found:** none

---

## Hooks

### hooks/useTweaks.ts

**Purpose:** Re-export barrel — re-exports `useTweaks` from `TweaksContext` for ergonomic imports.

```ts
export { useTweaks } from '../context/TweaksContext';
```

**ARIA attributes found:** none

---

### hooks/useChat.ts

**Purpose:** WebSocket to `ws://localhost:8000/ws/chat/{userId}`; per-mode message histories; Web Audio API assembly of base64 MP3 chunks; 3 s auto-reconnect.

**Types/Interfaces:**
```ts
interface Message { role: 'user' | 'ai'; content: string; mode: string }
interface ChatHook {
  messages: Message[];
  sendMessage: (text: string, mode: string, useVoice?: boolean) => void;
  connected: boolean;
  emotion: string | null;
  emotionConfidence: number;
  status: string;
}
```

**Key logic:**
```ts
// WebSocket URL:
const WS_URL = `ws://localhost:8000/ws/chat/${userId}`;

// Per-mode histories — mode key isolates messaging / voice / empty-chair histories
const histories = useRef<Record<string, Message[]>>({});

// Base64 MP3 chunk assembly via Web Audio API:
const audioChunks = useRef<Uint8Array[]>([]);
// On type==='audio_chunk': decode base64, push to audioChunks
// On type==='audio_end': concatenate all chunks → AudioBuffer → AudioContext.decodeAudioData → play

// Auto-reconnect (3 s):
ws.current.onclose = () => {
  setTimeout(() => connect(), 3000);
};

// Handles server message types: message, emotion_status, status, user_speech, audio_chunk, audio_end,
// safety_decision, crisis_mode, elevated_mode, re_entry_choice, system_message, safety_summary
```

**ARIA attributes found:** none (hook, no JSX)

---

### hooks/useOcean.ts

**Purpose:** Polls `GET http://localhost:8000/api/ocean/{userId}` every 5 s; returns `OceanData` + narrative + loaded/error.

**Types/Interfaces:**
```ts
interface OceanProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  narrative: string;
}

interface UseOceanResult {
  data: OceanProfile | null;
  loaded: boolean;
  error: boolean;
}
```

**Key logic:**
```ts
const POLL_INTERVAL = 5000;

useEffect(() => {
  if (!userId) return;
  const fetch = () => { /* GET /api/ocean/{userId} → setData */ };
  fetch();
  const timer = setInterval(fetch, POLL_INTERVAL);
  return () => clearInterval(timer);
}, [userId]);
```

**ARIA attributes found:** none

---

### hooks/useVoiceMonitor.ts

**Purpose:** Read-only WebSocket to `ws://localhost:8000/ws/voice-monitor/{userId}`; 6-state pipeline.

**Types/Interfaces:**
```ts
export type VoiceMonitorStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'disconnected';

export interface VoiceMonitorEvent {
  status: VoiceMonitorStatus;
  transcript?: string;
  response?: string;
}
```

**Key logic:**
```ts
const WS_URL = `ws://localhost:8000/ws/voice-monitor/${userId}`;

// WS messages set status + latest transcript/response
// Reconnects on close with exponential backoff
// Returns { status, transcript, response, connected }
```

**ARIA attributes found:** none

---

## Lib & Utils

### lib/moods.ts

**Purpose:** 5-item mood spectrum (radiant/bright/cloudy/low/heavy) with CSS variable colour references; localStorage week reader.

**Types/Interfaces:**
```ts
export interface Mood {
  id:      string;   // 'radiant' | 'bright' | 'cloudy' | 'low' | 'heavy'
  label:   string;
  weather: string;   // icon name
  color:   string;   // CSS var or hex
  text:    string;   // short copy
}

export const MOODS: Mood[] = [
  { id: 'radiant', label: 'Radiant',  weather: 'sun',      color: 'var(--gold)',      text: 'Glowing today' },
  { id: 'bright',  label: 'Bright',   weather: 'cloud-sun', color: 'var(--sage)',     text: 'Doing well'    },
  { id: 'cloudy',  label: 'Cloudy',   weather: 'cloud',    color: 'var(--lavender)',  text: 'Getting by'    },
  { id: 'low',     label: 'Low',      weather: 'rain',     color: 'var(--clay)',      text: 'A bit heavy'   },
  { id: 'heavy',   label: 'Heavy',    weather: 'storm',    color: 'var(--care)',      text: 'Struggling'    },
];
```

**Key logic:**
```ts
export function getWeekMoods(): { label: string; id: string | null; note: string }[] {
  const history = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((label, i) => { /* date lookup in history */ });
}

export function moodById(id: string): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[2]; // default cloudy
}

export function greet(mood: Mood): string { /* returns greeting copy based on mood id */ }
```

**ARIA attributes found:** none

---

### lib/safetyRouter.ts

**Purpose:** Three-level `Assessment` (normal/extra/urgent) mapped from backend `safety_decision` WS events via `fromBackendDecision()`; local regex keyword fallback.

**Types/Interfaces:**
```ts
export type SafetyLevel    = 'normal' | 'extra' | 'urgent';
export type RoleplayMode   = 'normal_roleplay' | 'safe_roleplay' | 'stop_roleplay';
export type SafetyTone     = 'sage' | 'clay' | 'care';

export interface Assessment {
  level:   SafetyLevel;
  tone:    SafetyTone;
  label:   string;
  message: string;
}

export interface BackendDecision {
  action:                  RoleplayMode;
  method:                  string;
  risk_level:              string;
  suicidewatch_probability: number;
}

export interface SupportOption {
  action: string;
  label:  string;
  sub:    string;
}

export const LEVELS: Record<SafetyLevel, Omit<Assessment, 'level'>> = {
  normal: { tone: 'sage', label: 'Safe space',       message: 'Continuing gently.' },
  extra:  { tone: 'clay', label: 'Extra support',    message: 'Taking this gently with you.' },
  urgent: { tone: 'care', label: 'Reaching out now', message: 'Pausing — your wellbeing comes first.' },
};
```

**Key logic:**
```ts
// Local regex fallback (runs before backend decision arrives):
const URGENT_PATTERNS: RegExp[] = [ /\bkill myself\b/i, /\bend (my|this) life\b/i, ... ];
const EXTRA_PATTERNS:  RegExp[] = [ /\bcan't cope\b/i, /\boverwhelmed\b/i, ... ];

export function classifyMessage(text: string): Assessment {
  if (URGENT_PATTERNS.some((r) => r.test(text))) return { level: 'urgent', ...LEVELS.urgent };
  if (EXTRA_PATTERNS.some((r) => r.test(text)))  return { level: 'extra',  ...LEVELS.extra  };
  return { level: 'normal', ...LEVELS.normal };
}

export function fromBackendDecision(d: BackendDecision): Assessment {
  if (d.action === 'stop_roleplay')    return { level: 'urgent', ...LEVELS.urgent };
  if (d.action === 'safe_roleplay')    return { level: 'extra',  ...LEVELS.extra  };
  return { level: 'normal', ...LEVELS.normal };
}

export const SUPPORT_OPTIONS: SupportOption[] = [
  { action: 'try_grounding', label: 'Grounding exercise', sub: '5-4-3-2-1 sense check'     },
  { action: 'try_breathing', label: 'Breathing with me',  sub: 'Slow the body down'         },
  { action: 'play_sounds',   label: 'Calming sounds',     sub: 'Rain, ocean or forest'      },
  { action: 'open_safety',   label: 'Support resources',  sub: 'Crisis lines and tools'     },
  { action: 'end_session',   label: 'End here, gently',   sub: 'Close the session softly'   },
];
```

**ARIA attributes found:** none

---

### utils/contrastCheck.ts

**Purpose:** WCAG 2.x relative-luminance `getContrastRatio()` + `passesAA()` (4.5:1 threshold).

**Types/Interfaces:** none — pure functions

**Key logic:**
```ts
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function linearise(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

export function passesAA(fg: string, bg: string): boolean {
  return getContrastRatio(fg, bg) >= 4.5;
}

export function formatRatio(ratio: number): string {
  return ratio.toFixed(2);
}
```

**ARIA attributes found:** none

---

## App Shell

### app/layout.tsx

**Purpose:** Provider nesting order — `TweaksProvider > UserProvider`; sets HTML lang and viewport meta.

**Key logic:**
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TweaksProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </TweaksProvider>
      </body>
    </html>
  );
}
```

**ARIA attributes found:** none

---

### app/page.tsx

**Purpose:** Trivial root page — renders `<SoulMateApp />`.

```tsx
export default function Home() { return <SoulMateApp />; }
```

---

### app/globals.css

**Purpose:** All CSS custom properties (light + dark), colour modes, animations, `.reduce-motion`, `.focus-mode`, `.sr-only`.

**Key custom properties (light theme):**
```css
:root {
  /* Colours */
  --sage: #4A9B7F; --sage-deep: #2E7D5E; --sage-soft: #C8E6DA; --sage-tint: #EEF7F3;
  --clay: #C77B5E; --clay-deep: #9E5A3F; --clay-soft: #F0CBBC; --clay-tint: #FBF0EB;
  --lavender: #87859F; --lavender-deep: #5C5A7A; --lavender-soft: #D5D4E8; --lavender-tint: #F2F2F8;
  --gold: #CCA24F; --gold-soft: #F0E0B0; --gold-tint: #FAF4E4;
  --care: #E05C5C; --care-deep: #B03535; --care-soft: #F5C0C0; --care-tint: #FEF0F0;

  /* Surface */
  --bg: #F3F7EE; --surface: #FFFFFF; --surface-2: #EEF3E9; --surface-3: #E5EDE0;
  --ink: #1A2B22; --ink-soft: #4A6057; --ink-faint: #8AAA96;
  --line: #D8E8D0; --line-strong: #C0D8B5;

  /* Typography */
  --font-body: 'Inter', sans-serif;
  --font-display: 'Newsreader', serif;
  --text-base: 15.5px;
  --line-height: 1.65;
  --letter-spacing: normal;

  /* Spacing / radius */
  --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-pill: 999px;

  /* Shadows */
  --shadow-soft: 0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04);
  --shadow-lift: 0 8px 32px rgba(0,0,0,.12);

  /* Easing */
  --ease: cubic-bezier(.4, 0, .2, 1);

  /* Dynamic (set by applyToDocument) */
  --accent: #4A9B7F;
}

/* Dark theme */
[data-theme="dark"] {
  --bg: #181D17; --surface: #1F2A1F; --surface-2: #263026; --surface-3: #2E3A2E;
  --ink: #E8F0E5; --ink-soft: #9AB89A; --ink-faint: #5A7A5A;
  --line: #2E3A2E; --line-strong: #3A4A3A;
}

/* Colour modes */
[data-color-mode="vibrant"]       { --sage: #2EBF87; --care: #FF4545; /* saturated */ }
[data-color-mode="high-contrast"] { --bg: #000; --surface: #0A0A0A; --ink: #FFFFFF; }

/* Utility classes */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.reduce-motion * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }

.focus-mode .sidebar-label,
.focus-mode .status-chip,
.focus-mode .ocean-mini { display: none !important; }

/* Animations */
@keyframes ripple  { 0% { transform: scale(1); opacity: .5 } 100% { transform: scale(1.8); opacity: 0 } }
@keyframes breathe { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.06) } }
@keyframes fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes soft-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .5 } }

.fade-up   { animation: fade-up   .35s var(--ease) both }
.scale-in  { animation: scale-in  .22s var(--ease) both }
.fade-in   { animation: fade-in   .25s var(--ease) both }

/* Focus visible */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
```

---

## Root Components

### components/SoulMateApp.tsx

**Purpose:** Top-level SPA router — manages `ScreenId`, onboarding gate, mood modal, and sidebar navigation.

**Types/Interfaces:**
```ts
type ScreenId = 'today' | 'companion' | 'insight' | 'reflections' | 'memory' | 'settings' | 'safety';
```

**Key logic:**
```tsx
// Onboarding gate — if no userId, show OnboardingShell (style="guided" hardcoded):
if (!userId) return <OnboardingShell style="guided" onComplete={(name) => setUserId(name)} />;

// Screen routing:
const SCREENS: Record<ScreenId, React.ReactNode> = {
  today:       <TodayScreen />,
  companion:   <CompanionScreen />,
  insight:     <InsightScreen ocean={ocean} narrative={narrative} loaded={loaded} error={error} />,
  reflections: <ReflectionsScreen />,
  memory:      <MemoryScreen />,
  settings:    <SettingsScreen onOpenSafety={() => setScreen('safety')} onLogout={logout} />,
  safety:      <SafetyScreen onBack={() => setScreen('today')} />,
};

// Mood modal — shown once per day, stored to localStorage soulmate_moods:
const [showMoodModal, setShowMoodModal] = useState(false);
```

**ARIA attributes found:** none directly (delegates to screens and sidebar)

---

### components/Sidebar.tsx

**Purpose:** Left navigation bar — NAV array of screen buttons, mini OCEAN radar in footer.

**Types/Interfaces:**
```ts
const NAV = [
  { id: 'today',       label: 'Today',       icon: 'home'     },
  { id: 'companion',   label: 'Companion',   icon: 'chat'     },
  { id: 'insight',     label: 'Insight',     icon: 'compass'  },
  { id: 'reflections', label: 'Reflections', icon: 'feather'  },
  { id: 'memory',      label: 'Memory',      icon: 'archive'  },
  { id: 'settings',    label: 'Settings',    icon: 'gear'     },
];
```

**Key logic:**
```tsx
// Active nav item styled with accent border + sage-tint background.
// Mini radar (OceanRadar size={80} showLabels={false}) shows in footer.
// .focus-mode hides sidebar labels and mini radar via CSS.

<nav aria-label="Main navigation">
  {NAV.map((item) => (
    <button key={item.id} aria-current={screen === item.id ? 'page' : undefined}
      onClick={() => setScreen(item.id as ScreenId)}>
      <Icon name={item.icon} size={20} />
      <span className="sidebar-label">{item.label}</span>
    </button>
  ))}
</nav>
```

**ARIA attributes found:**
```tsx
aria-label="Main navigation"          // <nav> element
aria-current={screen === item.id ? 'page' : undefined}  // active nav item
```

---

### components/EmotionBadge.tsx

**Purpose:** Small chip displaying detected emotion + confidence; colour-coded by emotion category.

**Types/Interfaces:**
```ts
const EMOTION_COLORS: Record<string, string> = {
  joy:       'var(--gold)',
  sadness:   'var(--lavender)',
  anger:     'var(--clay)',
  fear:      'var(--care)',
  surprise:  'var(--sage)',
  disgust:   'var(--clay-deep)',
  neutral:   'var(--ink-faint)',
  // ...
};
```

**Key logic:**
```tsx
export function EmotionBadge({ emotion, confidence }: { emotion: string; confidence: number }) {
  if (!emotion || emotion === 'neutral') return null;
  const color = EMOTION_COLORS[emotion] ?? 'var(--ink-faint)';
  return (
    <span style={{ background: `color-mix(in oklab, ${color} 14%, var(--surface))`,
      color, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
      borderRadius: 'var(--r-pill)', padding: '3px 10px', fontSize: 11.5, fontWeight: 600 }}>
      {emotion} · {Math.round(confidence * 100)}%
    </span>
  );
}
```

**ARIA attributes found:** none

---

### components/StatusChip.tsx

**Purpose:** A/B/C tier badge with hover popover — shows connection / processing status.

**Types/Interfaces:**
```ts
type Tier = 'A' | 'B' | 'C';

const TIER_STYLES: Record<Tier, { bg: string; color: string; label: string }> = {
  A: { bg: 'var(--sage-soft)',     color: 'var(--sage-deep)',     label: 'Agentic'  },
  B: { bg: 'var(--lavender-soft)', color: 'var(--lavender-deep)', label: 'Standard' },
  C: { bg: 'var(--surface-2)',     color: 'var(--ink-faint)',     label: 'Minimal'  },
};
```

**Key logic:**
```tsx
// Hover shows popover with tier description.
// Used in Companion screen to show which pipeline tier processed the last message.
```

**ARIA attributes found:** none (uses title attribute for tooltip)

---

## Screens

### components/screens/Today.tsx

**Purpose:** Home dashboard — 3-step mood check-in modal, QuickReflection modal, bento/calm layout switch via `tweaks.dashboard`.

**Types/Interfaces:**
```ts
// Mood check-in: 3 steps: pick mood → add note → confirm
// Step state: 'pick' | 'note' | 'done'

// Persists to localStorage 'soulmate_moods':
type MoodEntry = { date: string; mood: string; note: string }
```

**Key logic:**
```tsx
// Layout switch:
{tweaks.dashboard === 'bento'
  ? <BentoLayout />     // 2-column masonry grid
  : <CalmLayout />}     // single column, spacious

// Mood saved to localStorage and dispatches cross-screen event:
window.dispatchEvent(new Event('reflection-saved'));

// Quick reflection modal — lightweight textarea that POSTs to /api/reflections/{userId}
```

**useTweaks() consumed:** `tweaks.dashboard`

**ARIA attributes found:**
```tsx
role="dialog" aria-modal="true" aria-label="Mood check-in"
aria-label={`Select mood: ${mood.label}`}  // mood option buttons
aria-live="polite"                          // step announcement
```

---

### components/screens/Companion.tsx

**Purpose:** Tri-mode chat screen — ChatView (text messaging), VoiceView (push-to-talk), EmptyChairView (full safety lifecycle).

**Types/Interfaces:**
```ts
type CompanionMode = 'chat' | 'voice' | 'empty-chair';
type OverlayType   = 'safety' | 'grounding' | 'breathing' | 'sounds' | 'page' | null;
```

**Key logic:**
```tsx
// Mode tabs: Chat / Voice / Empty Chair

// ChatView — chatStyle: bubbles or minimal
{tweaks.chatStyle === 'bubbles'
  ? <BubblesLayout messages={messages} />
  : <MinimalLayout messages={messages} />}

// VoiceView — keyboard shortcuts:
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') toggleRecording();
    if (e.code === 'KeyQ')  endSession();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);

// EmptyChairView — safety lifecycle:
// safety_decision WS event → fromBackendDecision() → Assessment
// action === 'stop_roleplay' → setOverlay('safety')
// action === 'safe_roleplay' → setSafeRoleplay(true) → SafetyBanner shown
// ambience audio loops: new Audio('/audio/ambient.mp3'); a.loop = true; a.play();

// Overlay routing:
{overlay === 'safety'    && <SafetySupportPanel ... />}
{overlay === 'grounding' && <GroundingExercise  ... />}
{overlay === 'breathing' && <BreathingModal     ... />}
{overlay === 'sounds'    && <CalmingSounds      ... />}
{overlay === 'page'      && <SafetyPage         ... />}
```

**useTweaks() consumed:** `tweaks.chatStyle`, `tweaks.voiceScreen`

**ARIA attributes found:**
```tsx
role="tablist"                              // mode tabs container
role="tab" aria-selected={mode === 'chat'}  // each mode tab
aria-label="Send message"                   // send button
aria-label="Start/stop recording"           // voice push-to-talk
```

---

### components/screens/Insight.tsx

**Purpose:** OCEAN personality insight screen with radar/bars chart switch, narrative, mood week strip, and OCEAN trait cards.

**Types/Interfaces:**
```ts
// Imported: OceanData, OCEAN from ui/Ocean

const TRAIT_COPY: Record<string, { plain: string; soft: string }> = {
  openness:         { plain: 'You\'re curious and open to new ways of seeing things.', soft: 'open & curious' },
  conscientiousness:{ plain: 'You like a sense of order, and you follow through on what matters to you.', soft: 'thoughtful & steady' },
  extraversion:     { plain: 'You recharge more in quiet, and warm up once you feel safe.', soft: 'gently reserved' },
  agreeableness:    { plain: 'You\'re warm and considerate, often putting others first.', soft: 'warm & caring' },
  neuroticism:      { plain: 'You feel things deeply — a sensitivity that\'s also a kind of depth.', soft: 'deeply feeling' },
};

// Props:
{ ocean: OceanData; narrative?: string; loaded?: boolean; error?: boolean }
```

**Key logic:**
```tsx
const { tweaks } = useTweaks();
const [why, setWhy] = useState(false);
const sorted = [...OCEAN].sort((a, b) => (ocean[b.key] ?? 0) - (ocean[a.key] ?? 0));

// WCAG text alternative for the chart:
const oceanAria = `OCEAN profile: ${OCEAN.map((o) =>
  `${o.label} ${Math.round((ocean[o.key] ?? 0.5) * 100)}%`
).join(', ')}`;

// Chart switch (tweaks.oceanInsight):
{tweaks.oceanInsight === 'pentagon'
  ? <OceanRadar data={ocean} size={240} />
  : <OceanBars  data={ocean} />}

// explainDetail conditional copy:
{tweaks.explainDetail === 'plain+how' && (
  <span style={{ color: 'var(--ink-faint)' }}>
    Technically: a lightweight OCEAN inference runs on your messages; values are
    smoothed across sessions and never shared.{' '}
  </span>
)}

// Week mood strip (same getWeekMoods() as lib/moods — inlined locally):
function getWeekMoods(): { label: string; id: string | null; note: string }[] {
  const history = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((label, i) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    const entry = history.findLast((e: { date: string; mood: string; note?: string }) => e.date === dateStr);
    return { label, id: entry?.mood || null, note: entry?.note || '' };
  });
}

// Narrative loading states:
{!loaded && !error   ? <Skeleton /> : null}
{error || !narrative ? <p>Not enough conversations yet.</p> : <p>{narrative}</p>}

// Two-column layout: left = chart card (320px), right = trait cards
// Top-2 traits shown in display-font summary line:
"Right now, you read as {TRAIT_COPY[sorted[0].key].soft} and {TRAIT_COPY[sorted[1].key].soft}."
```

**useTweaks() consumed:** `tweaks.oceanInsight`, `tweaks.explainDetail`

**ARIA attributes found:**
```tsx
<div role="img" aria-label={oceanAria}>   // wraps OceanRadar or OceanBars

// Per-day mood dot when no check-in:
aria-label="No check-in yet"
```

---

### components/screens/Reflections.tsx

**Purpose:** Journal screen — real backend integration via `GET/POST /api/reflections/{userId}`; 2-column CSS masonry; cross-screen sync via `reflection-saved` custom event.

**Types/Interfaces:**
```ts
interface Entry { id: string; title: string; body: string; mood: string; timestamp: number }
```

**Key logic:**
```tsx
const { userId } = useUser();
const [entries, setEntries] = useState<Entry[]>([]);
const [editing, setEditing] = useState(false);

const fetchReflections = useCallback(() => {
  if (!userId) { setEntries([]); setLoading(false); return; }
  setLoading(true);
  fetch(`http://localhost:8000/api/reflections/${userId}`)
    .then(r => r.json())
    .then(data => setEntries(data.reflections || []))
    .catch(() => setEntries([]))
    .finally(() => setLoading(false));
}, [userId]);

// Cross-screen sync — Today quick-write dispatches this event:
useEffect(() => {
  const handler = () => fetchReflections();
  window.addEventListener('reflection-saved', handler);
  return () => window.removeEventListener('reflection-saved', handler);
}, [fetchReflections]);

// Timestamp — backend sends Unix SECONDS (float) → multiply by 1000 for Date:
const formatDate = (ts: number) => {
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return 'Today';
  const diff = Math.floor((new Date().getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
};

// Save — never POST empty title, fall back to body prefix or default:
const save = async () => {
  if (!title.trim() && !body.trim()) return;
  const finalTitle = title.trim() || body.trim().slice(0, 30) || 'A quiet moment';
  const res = await fetch(`http://localhost:8000/api/reflections/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: finalTitle, body, mood: '' })
  });
  const entry = await res.json();
  setEntries(prev => [{ id: entry.id, title: entry.title, body: entry.body,
    mood: entry.mood ?? '', timestamp: entry.timestamp }, ...prev]);
  setTitle(''); setBody(''); setEditing(false);
};

// CSS masonry:
<div style={{ columnCount: 2, columnGap: 18 }}>
  {entries.map((e) => (
    <div className="card" style={{ marginBottom: 18, breakInside: 'avoid' }}>
```

**ARIA attributes found:** none explicit (standard semantic `<input>`, `<textarea>`, `<button>` elements)

---

### components/screens/Settings.tsx

**Purpose:** Accessible personalisation — all 14 tweaks wired; `fieldset`/`legend`/`radiogroup` grouping; roving tabindex; `aria-live="polite"` region; `role="alert"` contrast warning; live font preview.

**Types/Interfaces:**
```ts
interface SettingsProps { name: string; onConsentReview: () => void; onOpenSafety: () => void; onLogout: () => void }

interface Opt<T extends string> { value: T; label: string; ariaLabel?: string }

const ACCENTS: { hex: string; name: string }[] = [
  { hex: '#4A9B7F', name: 'Sea green'    },
  { hex: '#2E9E6E', name: 'Forest green' },
  { hex: '#3F8FA8', name: 'Teal'         },
  { hex: '#C77B5E', name: 'Clay'         },
  { hex: '#87859F', name: 'Lavender'     },
  { hex: '#CCA24F', name: 'Gold'         },
];
```

**Key logic:**
```tsx
const { tweaks, set, resetToDefaults } = useTweaks();
const [lastChanged, setLastChanged] = useState('');

// Announce each change to the sr-only live region:
function update<K extends keyof TweaksState>(key: K, value: TweaksState[K], label: string) {
  set(key, value);
  setLastChanged(`${label} updated`);
}

// Contrast check for accent colour:
const bgHex = backgroundHex(tweaks.darkMode, tweaks.colorMode);  // '#181D17' or '#F3F7EE'
const accentRatio = getContrastRatio(tweaks.accent, bgHex);
const accentFails = !passesAA(tweaks.accent, bgHex);

// OptionGroup — roving tabindex (ArrowLeft/Right/Up/Down):
function OptionGroup<T extends string>({ legend, value, options, onChange }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKeyDown = (e: React.KeyboardEvent) => {
    const fwd  = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const back = e.key === 'ArrowLeft'  || e.key === 'ArrowUp';
    if (!fwd && !back) return;
    e.preventDefault();
    const next = (idx + (fwd ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}>
      <legend ...>{legend}</legend>
      <div role="radiogroup" aria-label={legend} onKeyDown={onKeyDown}>
        {options.map((o, i) => (
          <button ref={(el) => { refs.current[i] = el; }}
            role="radio" aria-checked={o.value === value}
            aria-label={o.ariaLabel || o.label}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Live font preview reflects CSS vars in real time (no JS — CSS vars update immediately):
<div aria-label="Font preview" style={{ background: 'var(--surface-2)', ... }}>
  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)',
    lineHeight: 'var(--line-height)', letterSpacing: 'var(--letter-spacing)' }}>
    The quick brown fox jumps over the lazy dog.
  </p>
</div>

// 14 tweaks wired: textSize, font, lineSpacing, letterSpacing, reduceMotion, darkMode,
// colorMode, accent, focusMode, explainDetail, dashboard, chatStyle, voiceScreen, oceanInsight
```

**useTweaks() consumed:** all 14 fields

**ARIA attributes found:**
```tsx
// Live region:
aria-live="polite" aria-atomic="true"         // sr-only div, announces each setting change

// OptionGroup (radio groups):
role="radiogroup" aria-label={legend}          // wrapping div
role="radio" aria-checked={on}                 // each option button
aria-label={o.ariaLabel || o.label}            // individual option label
tabIndex={i === idx ? 0 : -1}                 // roving tabindex

// Accent fieldset:
role="radiogroup" aria-label="Accent colour"
role="radio" aria-checked={on} aria-label={`Accent colour: ${a.name}`}  // swatch buttons
aria-label="Custom accent colour"              // hidden color input
aria-hidden                                    // "+" span inside custom label

// Font preview:
aria-label="Font preview"                      // preview div

// Contrast warning:
role="alert"                                   // low-contrast warning paragraph

// Toggle (via Toggle primitive):
// role="switch" aria-checked={on} — inherited from Toggle primitive
```

---

### components/screens/Memory.tsx

**Purpose:** Memory control screen — displays seeded people/facts/themes memory items with per-item toggle (forget temporarily) and delete; frontend-only local state, no backend calls.

**Types/Interfaces:**
```ts
interface MemItem { id: number; t: string; d: string; on: boolean }
type MemKey = 'people' | 'facts' | 'themes';

const SEED_MEMORY: Record<MemKey, MemItem[]> = {
  people: [
    { id: 1, t: 'Mai',  d: 'Close friend you confide in',       on: true },
    { id: 2, t: 'Dad',  d: 'Relationship feels distant lately', on: true },
  ],
  facts: [
    { id: 3, t: 'Final exams',          d: 'Coming up this month — a big source of stress',  on: true },
    { id: 4, t: 'Lives away from home', d: 'Moved cities for university',                    on: true },
    { id: 5, t: 'Loves early walks',    d: 'Mornings by the river help you reset',           on: true },
  ],
  themes: [
    { id: 6, t: 'Pressure to perform', d: 'A recurring theme in our talks', on: true },
    { id: 7, t: 'Wanting to feel seen', d: 'Comes up around family',        on: true },
  ],
};
```

**Key logic:**
```tsx
const [mem, setMem] = useState(SEED_MEMORY);
const groups: { key: MemKey; label: string; icon: string; tone: Tone }[] = [
  { key: 'people', label: 'People in your life', icon: 'heart',    tone: 'clay'     },
  { key: 'facts',  label: 'Things about you',    icon: 'bookmark', tone: 'sage'     },
  { key: 'themes', label: 'Themes we return to', icon: 'waves',    tone: 'lavender' },
];

const toggle = (g: MemKey, id: number) =>
  setMem((m) => ({ ...m, [g]: m[g].map((x) => x.id === id ? { ...x, on: !x.on } : x) }));

const remove = (g: MemKey, id: number) =>
  setMem((m) => ({ ...m, [g]: m[g].filter((x) => x.id !== id) }));

const total = Object.values(mem).reduce((s, a) => s + a.length, 0);

// Per-item opacity = 0.5 when toggled off (forgotten temporarily):
<div style={{ opacity: item.on ? 1 : 0.5 }}>
  <Toggle on={item.on} onChange={() => toggle(g.key, item.id)} />
  <button onClick={() => remove(g.key, item.id)} aria-label="Forget">
    <Icon name="trash" size={16} />
  </button>
</div>

// "Clear everything" button — UI only, no handler wired:
<Button variant="outline" size="sm" icon="trash" style={{ color: 'var(--care)', borderColor: 'var(--care-soft)' }}>
  Clear everything
</Button>
```

**ARIA attributes found:**
```tsx
aria-label="Forget"   // trash button per memory item
// Toggle uses role="switch" aria-checked internally
```

---

### components/screens/Onboarding.tsx

**Purpose:** Two-variant onboarding (guided 7-step paged cards or conversational scripted chat); captures name → `userId`, consent, reasons, rhythm.

**Types/Interfaces:**
```ts
const REASONS = [
  'Daily reflection', 'Stress & overwhelm', 'Feeling lonely',
  'Sleep & rest', 'Understanding myself', 'Just curious'
];

// Guided steps:
const steps = ['welcome', 'about', 'consent', 'name', 'reasons', 'rhythm', 'ready'];

// Consent state:
const [consent, setConsent] = useState({ memory: true, personality: true, anonymised: false });

// Rhythm options:
const opts = [
  { id: 'gentle',  t: 'A gentle presence',        d: 'A calm space that greets you warmly when you arrive.', icon: 'leaf' },
  { id: 'minimal', t: 'Only when I open the app', d: 'SoulMate waits quietly until you come to it.',         icon: 'moon' },
  { id: 'present', t: 'A little more present',    d: 'A soft morning and evening check-in to return to.',    icon: 'sun'  },
];
```

**Key logic:**
```tsx
// Entry point — style prop selects variant:
export function OnboardingShell({ style, onComplete }) {
  return style === 'conversational'
    ? <OnboardingConversational onComplete={onComplete} />
    : <OnboardingGuided onComplete={onComplete} />;
}
// NOTE: style="guided" hardcoded in SoulMateApp — conversational variant exists but is unused.

// Guided — animated progress bar (step 1+):
{step > 0 && steps.slice(1).map((_, i) => (
  <div style={{
    height: 4, width: i + 1 <= step ? 26 : 14,
    background: i + 1 <= step ? 'var(--sage)' : 'var(--line-strong)',
  }} />
))}

// CTA label varies by step:
{cur === 'consent' ? 'I agree' : 'Continue'}

// Final CTA:
<Button onClick={() => onComplete(name.trim() || 'friend')}>Enter SoulMate</Button>

// Conversational — scripted chat, 5 beats:
const script = [
  "Hi — I'm SoulMate. I'm really glad you're here.",
  "Before anything else: I'm a companion for everyday reflection...",
  "Everything you share stays private to you...",
  "Wonderful. What should I call you?",
  "It's lovely to meet you. Whenever you're ready, we can begin.",
];
// Name input appears inline at beat 4.
```

**ARIA attributes found:**
```tsx
// Toggle (role="switch" aria-checked) used in ConsentRow for memory + personality consent
```

---

### components/screens/Safety.tsx

**Purpose:** Static crisis-support resource screen — regional crisis lines, grounding technique cards, disclaimer.

**Types/Interfaces:**
```ts
const lines = [
  { region: 'Vietnam',       name: 'Vietnam: 096 306 1414',           num: '',                hours: 'Public support number' },
  { region: 'Vietnam',       name: 'Crisis text & chat support',      num: 'text via app',    hours: 'Always on'           },
  { region: 'US',            name: 'US: 988 (Suicide & Crisis Lifeline)', num: '',            hours: '24/7'                },
  { region: 'International', name: 'Befrienders Worldwide',           num: 'befrienders.org', hours: 'Find a local line'   },
];

const grounding = [
  { icon: 'wind',   t: 'Breathe with me',      d: 'A slow 4–7–8 breath, for one minute.'             },
  { icon: 'waves',  t: '5–4–3–2–1 grounding',  d: 'Name what you can see, touch, hear, smell, taste.' },
  { icon: 'volume', t: 'Calming sounds',        d: 'Soft rain or warm tones to settle the body.'      },
];
```

**Key logic:**
```tsx
export function SafetyScreen({ onBack }: { onBack?: () => void }) {
  // Emergency banner → crisis lines grid → 3-up grounding card row → disclaimer
  // Grounding cards are <button> elements (no handler wired — UI only in this screen;
  // actual interactive versions are in safety/Modals.tsx via Companion.tsx)
}
```

**ARIA attributes found:** none

---

## Safety Components

### components/safety/Modals.tsx

**Purpose:** Full-screen EmptyChair safety overlays — 5-4-3-2-1 grounding exercise, guided breathing, calming sounds floating card, and full safety-resources page.

**Types/Interfaces:**
```ts
const GROUNDING_STEPS = [
  { icon: 'eye',     sense: 'SEE',   count: 5, title: 'Name 5 things you can see',    hint: 'Look slowly around you...'           },
  { icon: 'hand',    sense: 'FEEL',  count: 4, title: 'Name 4 things you can feel',   hint: 'The chair beneath you...'            },
  { icon: 'ear',     sense: 'HEAR',  count: 3, title: 'Name 3 things you can hear',   hint: 'Listen out past the obvious...'      },
  { icon: 'wind',    sense: 'SMELL', count: 2, title: 'Name 2 things you can smell',  hint: 'Take a gentle breath in...'          },
  { icon: 'droplet', sense: 'TASTE', count: 1, title: 'Name 1 thing you can taste',   hint: 'Or simply take one slow, full breath...' },
];

const BREATH_PHASES = [
  { key: 'in',   label: 'Breathe in',  hint: 'Slowly fill your lungs', dur: 4000, scale: 1.34 },
  { key: 'hold', label: 'Hold',        hint: 'Let it settle',          dur: 4000, scale: 1.34 },
  { key: 'out',  label: 'Breathe out', hint: 'Release, all the way',   dur: 6000, scale: 0.82 },
];

const SOUND_TRACKS = [
  { id: 'rain',   label: 'Rain',   icon: 'cloud-rain' },
  { id: 'ocean',  label: 'Ocean',  icon: 'waves'      },
  { id: 'forest', label: 'Forest', icon: 'trees'      },
];

const SAFETY_RESOURCES = [
  { country: 'Vietnam: 096 306 1414', service: 'Public support number',       phone: '096 306 1414', primary: true  },
  { country: 'US: 988 (Suicide & Crisis Lifeline)', service: 'Call or text',   phone: '988',         primary: true  },
  { country: 'UK · Ireland',service: 'Samaritans',                              phone: '116 123'                    },
  { country: 'Australia',   service: 'Lifeline',                                phone: '13 11 14'                   },
];
```

**Key logic:**
```tsx
// GroundingExercise — keyboard nav (Escape=skip, ArrowLeft/Right=prev/next), focus on mount:
const overlayRef = useRef<HTMLDivElement>(null);
useEffect(() => { overlayRef.current?.focus(); }, []);
const onKey = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape')     onSkip();
  if (e.key === 'ArrowLeft')  back();
  if (e.key === 'ArrowRight') next();
};

// BreathingModal — CSS transform:scale driven by phase duration:
useEffect(() => {
  if (!running) return;
  const p = BREATH_PHASES[phase];
  setScale(p.scale);
  timeoutRef.current = setTimeout(() => setPhase((i) => (i + 1) % BREATH_PHASES.length), p.dur);
}, [running, phase]);

// CalmingSounds — HTMLAudioElement, src = /audio/{id}.mp3:
useEffect(() => {
  const a = new Audio(); a.loop = true; a.preload = 'metadata'; a.volume = 0.7;
  a.addEventListener('error', () => { setUnavailable(true); setPlaying(false); });
  audioRef.current = a;
  return () => { a.pause(); a.src = ''; };
}, []);

// SafetyPage — SAFETY_RESOURCES as <a href="tel:..."> tappable phone links:
<a href={`tel:${r.phone.replace(/\s/g, '')}`} ...>

// External IASP link:
<a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer">
```

**ARIA attributes found:**
```tsx
// GroundingExercise:
role="dialog" aria-modal="true" aria-label={`Grounding exercise: ${s.title}`}
tabIndex={-1}                               // focus on mount
role="status" aria-live="polite"            // sr-only step announcement
aria-label="Skip grounding exercise"
aria-label="Previous step"
aria-label={isLast ? 'Finish' : 'Next step'}

// BreathingModal:
role="dialog" aria-modal="true" aria-label="Breathing exercise"
aria-hidden="true"                          // animated orb (decorative)
aria-live="polite"                          // phase label
aria-label={running ? 'Pause breathing' : 'Start breathing'}
aria-label="Finish breathing exercise"

// CalmingSounds:
role="dialog" aria-label="Calming sounds"
aria-label={`${active && playing ? 'Pause' : 'Play'} ${tr.label} sounds`}
aria-pressed={active}                       // track buttons
aria-label={playing ? 'Pause' : 'Play'}
aria-label={volume === 0 ? 'Unmute' : 'Mute'}
aria-label="Volume"                         // range input
aria-label="Close calming sounds"

// SafetyPage:
role="dialog" aria-modal="true" aria-label="Support resources"
tabIndex={-1}                               // focus on mount
```

---

### components/safety/SafetyBits.tsx

**Purpose:** Inline EmptyChair safety UI fragments — status chip, elevated-support banner, support-option panel (modal), confirm-resume dialog, post-crisis footer strip.

**Types/Interfaces:**
```ts
// Imported: Assessment, SafetyTone, SupportOption from lib/safetyRouter

export function toneVars(tone: SafetyTone) {
  const map: Record<SafetyTone, { bg: string; bd: string; fg: string; dot: string }> = {
    sage: { bg: 'var(--sage-tint)', bd: 'color-mix(in oklab, var(--sage) 28%, transparent)', fg: 'var(--sage-deep)', dot: 'var(--sage)'  },
    clay: { bg: 'var(--clay-tint)', bd: 'color-mix(in oklab, var(--clay) 32%, transparent)', fg: 'var(--clay-deep)', dot: 'var(--clay)'  },
    care: { bg: 'var(--care-tint)', bd: 'color-mix(in oklab, var(--care) 34%, transparent)', fg: 'var(--care-deep)', dot: 'var(--care)'  },
  };
  return map[tone] || map.sage;
}

const LEVEL_ICON: Record<string, string> = {
  normal: 'shield-check',
  extra:  'shield-alert',
  urgent: 'life-buoy',
};

const OPTION_ICON: Record<string, string> = {
  try_grounding: 'eye',
  try_breathing: 'wind',
  play_sounds:   'waves',
  open_safety:   'heart-handshake',
  end_session:   'leaf',
};
```

**Key logic:**
```tsx
// SafetyStatusChip — pulsing dot when level !== 'normal':
export function SafetyStatusChip({ assessment }: { assessment: Assessment | null }) {
  if (!assessment) return null;
  const t = toneVars(assessment.tone);
  const pulse = assessment.level !== 'normal';
  return (
    <div role="status" aria-label={`Support level: ${assessment.label}`} ...>
      <span style={{ animation: pulse ? 'so-pulse-dot 1.8s ease-in-out infinite' : 'none' }} />
      <Icon name={LEVEL_ICON[assessment.level]} size={15} />
      {assessment.label}
    </div>
  );
}

// SafetySupportPanel — modal, focuses on mount, SUPPORT_OPTIONS list:
export function SafetySupportPanel({ targetName, options, onChoose, onRequestResume }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { cardRef.current?.focus(); }, []);
  // Options: try_grounding, try_breathing, play_sounds, open_safety, end_session
  // "I'm okay — continue" button calls onRequestResume
}

// ConfirmResume — confirmation dialog, focuses on mount:
export function ConfirmResume({ targetName, onConfirm, onCancel }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
}

// SupportFooter — persistent post-crisis strip with tel emergency advice:
export function SupportFooter({ onOpenSafety }) {
  // "If you're in immediate danger, contact your local emergency services..."
}
```

**ARIA attributes found:**
```tsx
// SafetyStatusChip:
role="status" aria-label={`Support level: ${assessment.label}`}

// SafetyBanner:
role="complementary" aria-label="Extra support available"

// SafetySupportPanel:
role="dialog" aria-modal="true" aria-labelledby="sp-title"
tabIndex={-1}
id="sp-title"                    // h2 referenced by aria-labelledby

// ConfirmResume:
role="dialog" aria-modal="true" aria-labelledby="cr-title"
tabIndex={-1}
id="cr-title"                    // h3 referenced by aria-labelledby

// SupportFooter:
role="complementary" aria-label="Immediate support"
```

---

## UI Primitives

### components/ui/Icon.tsx

**Purpose:** Unified SVG icon component — compact hand-encoded main set (camelCase names) + Lucide inner-markup set (kebab-case names); all icons render `aria-hidden="true"`.

**Types/Interfaces:**
```ts
export interface IconProps {
  name:        string;
  size?:       number;
  stroke?:     number;
  strokeWidth?: number;   // alias used by safety components
  fill?:       string;
  className?:  string;
  style?:      React.CSSProperties;
}
```

**Key logic:**
```ts
// Two dictionaries:
const ICON_PATHS: Record<string, string> = {
  // Pipe-separated path descriptors. Prefixes: circle: rect: dot: poly: gear:
  sun:         'M12 4V2M12 22v-2M4 12H2M22 12h-2...|circle:12,12,4',
  chat:        'M21 11.5a8.38 8.38 0 0 1-8.5 8.5...',
  compass:     'M14.31 8 9.69 16M16.62 12 7.38 12|circle:12,12,9|poly:13.5,10.5 16,8...',
  gear:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|gear',
  shieldHeart: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 13.2...',
  // ...
};

const LUCIDE_PATHS: Record<string, string> = {
  // Raw SVG innerHTML strings:
  'arrow-left':     '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-right':    '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'chevron-right':  '<path d="m9 18 6-6-6-6"/>',
  'shield-check':   '<path d="M20 13c0 5-3.5 7.5-7.66 8.95..."/><path d="m9 12 2 2 4-4"/>',
  'shield-alert':   '<path d="M20 13c0 5-3.5 7.5-7.66 8.95..."/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  'life-buoy':      '<circle cx="12" cy="12" r="10"/>...<circle cx="12" cy="12" r="4"/>',
  'heart-handshake':'<path d="M19 14c1.49-1.46 3-3.21 3-5.5..."/>',
  'external-link':  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6..."/>',
  // ...
};

// Rendering:
export function Icon({ name, size = 20, stroke, strokeWidth, fill = 'none', className = '', style }: IconProps) {
  const sw = strokeWidth ?? stroke ?? 1.75;

  // Lucide path → dangerouslySetInnerHTML:
  const lucide = LUCIDE_PATHS[name];
  if (lucide) {
    return <svg ... aria-hidden="true" dangerouslySetInnerHTML={{ __html: lucide }} />;
  }

  // Main set — pipe-separated descriptor parsing:
  const def = ICON_PATHS[name];
  if (!def) return null;
  const parts = def.split('|');
  parts.forEach((p) => {
    if (p.startsWith('circle:')) { /* <circle cx cy r /> */ }
    else if (p.startsWith('rect:'))   { /* <rect /> */ }
    else if (p.startsWith('dot:'))    { /* <circle r={1} fill="currentColor" /> */ }
    else if (p.startsWith('poly:'))   { /* <polygon /> */ }
    else if (p === 'gear')            { /* gear cog teeth <path /> */ }
    else                              { /* <path d={p} /> */ }
  });

  return <svg ... aria-hidden="true">{els}</svg>;
}
```

**ARIA attributes found:**
```tsx
aria-hidden="true"   // on every <svg> — both Lucide and main-set variants
```

---

### components/ui/Ocean.tsx

**Purpose:** OCEAN personality visualisation primitives — `OceanRadar` (SVG pentagon), `OceanBars` (horizontal bars), `OceanRings` (circular ring charts).

**Types/Interfaces:**
```ts
export interface OceanData {
  openness:          number;  // 0–1
  conscientiousness: number;
  extraversion:      number;
  agreeableness:     number;
  neuroticism:       number;
}

export interface OceanTrait { key: keyof OceanData; label: string; short: string }

export const OCEAN: OceanTrait[] = [
  { key: 'openness',          label: 'Openness',          short: 'O' },
  { key: 'conscientiousness', label: 'Conscientiousness', short: 'C' },
  { key: 'extraversion',      label: 'Extraversion',      short: 'E' },
  { key: 'agreeableness',     label: 'Agreeableness',     short: 'A' },
  { key: 'neuroticism',       label: 'Sensitivity',       short: 'N' },
];
```

**Key logic:**
```tsx
// OceanRadar — pure SVG, radialGradient fill, React.useId() for unique gradient IDs:
export function OceanRadar({ data, size = 220, color = 'var(--sage)', showLabels = true }) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const gid = React.useId();   // unique per instance — avoids gradient ID collisions
  // Renders: grid rings (×3) + spoke lines + value polygon + value dots + optional axis labels
}

// OceanBars — animated width transition (0.8s ease):
export function OceanBars({ data, color = 'var(--sage)' }) {
  // Per trait: label + percentage text + progress bar
  // <div style={{ width: `${v}%`, transition: 'width .8s var(--ease)' }} />
}

// OceanRings — SVG strokeDashoffset circles, one per trait:
export function OceanRings({ data }) {
  const C = 2 * Math.PI * 22;   // circumference
  // strokeDashoffset = C * (1 - v)
  // transform="rotate(-90 26 26)"  — starts at 12 o'clock
}
```

**ARIA attributes found:** none directly — caller in Insight.tsx wraps in `<div role="img" aria-label={oceanAria}>`

---

### components/ui/ScreenScroll.tsx

**Purpose:** Scroll wrapper primitive — constrains content to a centred max-width column with consistent vertical padding; hides scrollbar chrome.

**Types/Interfaces:**
```ts
{ children: React.ReactNode; max?: number }
```

**Key logic:**
```tsx
export function ScreenScroll({ children, max = 980 }: { children: React.ReactNode; max?: number }) {
  return (
    <div className="no-scrollbar" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: max, margin: '0 auto', padding: '40px 40px 64px' }}>
        {children}
      </div>
    </div>
  );
}
```

**ARIA attributes found:** none

---

### components/ui/primitives.tsx

**Purpose:** Shared SoulMate UI primitives — `Button`, `IconBadge`, `Pill`, `Toggle`, `BreathingOrb`, `Skeleton`.

**Types/Interfaces:**
```ts
export type ButtonVariant = 'primary' | 'clay' | 'lavender' | 'soft' | 'outline' | 'ghost' | 'care';
export type ButtonSize    = 'sm' | 'md' | 'lg';
export type Tone          = 'sage' | 'clay' | 'lavender' | 'gold' | 'care' | 'neutral';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  icon?:     string;
  iconRight?: string;
  full?:     boolean;
  style?:    React.CSSProperties;
}

const TONE_MAP: Record<Tone, [string, string]> = {
  sage:     ['var(--sage-soft)',     'var(--sage-deep)'    ],
  clay:     ['var(--clay-soft)',     'var(--clay-deep)'    ],
  lavender: ['var(--lavender-soft)', 'var(--lavender-deep)'],
  gold:     ['var(--gold-soft)',     'var(--gold)'         ],
  care:     ['var(--care-soft)',     'var(--care)'         ],
  neutral:  ['var(--surface-2)',     'var(--ink-soft)'     ],
};

const PILL_MAP: Record<Tone, [string, string, string]> = {
  neutral:  ['var(--surface-2)',     'var(--ink-soft)',      'var(--line)'  ],
  sage:     ['var(--sage-soft)',     'var(--sage-deep)',     'transparent'  ],
  clay:     ['var(--clay-soft)',     'var(--clay-deep)',     'transparent'  ],
  lavender: ['var(--lavender-soft)', 'var(--lavender-deep)', 'transparent' ],
  care:     ['var(--care-soft)',     'var(--care)',          'transparent'  ],
  gold:     ['var(--gold-soft)',     'var(--gold)',          'transparent'  ],
};
```

**Key logic:**
```tsx
// Button — 7 variants, scale-on-mousedown press:
export function Button({ variant = 'primary', size = 'md', icon, iconRight, full, children, style = {}, ...rest }) {
  const sz = {
    sm: { padding: '8px 14px',   fontSize: 13,   gap: 7  },
    md: { padding: '12px 20px',  fontSize: 14.5, gap: 9  },
    lg: { padding: '15px 26px',  fontSize: 15.5, gap: 10 },
  }[size];

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary:  { background: 'linear-gradient(135deg, var(--sage), var(--sage-deep))', color: '#fff',
                boxShadow: '0 6px 18px color-mix(in oklab, var(--sage) 38%, transparent)' },
    clay:     { background: 'var(--clay)',     color: '#fff' },
    lavender: { background: 'var(--lavender)', color: '#fff' },
    soft:     { background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line)' },
    outline:  { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
    ghost:    { background: 'transparent', color: 'var(--ink-soft)' },
    care:     { background: 'var(--care)',     color: '#fff' },
  };

  // Scale press feedback:
  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.97)'; }}
  onMouseUp={(e)   => { e.currentTarget.style.transform = 'scale(1)';   }}
}

// Toggle — role="switch" aria-checked, animated knob:
export function Toggle({ on, onChange, tone = 'var(--sage)' }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ background: on ? tone : 'var(--surface-2)', ... }}>
      <span style={{ left: on ? 21 : 2, transition: 'left .25s var(--ease)' }} />
    </button>
  );
}

// BreathingOrb — two ripple rings + inner pulsing disc:
export function BreathingOrb({ size = 120, tone = 'var(--sage)', active = true, children }) {
  // [0,1].map → ripple animation, animationDelay staggered by 1.4s
  // Inner disc: breathe keyframe (scale 1 → 1.06 → 1), 5s cycle
}

// Skeleton — soft-pulse placeholder:
export function Skeleton({ width = '100%', height = 12, radius = 6, style = {} }) {
  return <div aria-hidden style={{ background: 'var(--surface-2)',
    animation: 'soft-pulse 1.4s ease-in-out infinite' }} />;
}
```

**ARIA attributes found:**
```tsx
// Toggle:
role="switch" aria-checked={on}

// Skeleton:
aria-hidden    // decorative loading placeholder
```

---

*End of SoulMate Frontend Context — all files across feature/new-design branch.*
