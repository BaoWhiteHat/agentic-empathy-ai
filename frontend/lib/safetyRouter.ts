// lib/safetyRouter.ts
// Plain-language, non-clinical safety routing for EmptyChair.
// Ported from design-reference/safety/safety-router.js (typed).
//
// NOTHING about the underlying classifier (model name, thresholds,
// probabilities, internal labels) is ever surfaced to the UI — callers only
// see { level, mode, label, ... }. The backend is authoritative: it emits a
// raw decision per turn which fromBackendDecision() maps to a user-safe level.

export type SafetyLevel = 'normal' | 'extra' | 'urgent';
export type RoleplayMode = 'normal_roleplay' | 'safe_roleplay' | 'stop_roleplay';
export type SafetyTone = 'sage' | 'clay' | 'care';

export interface Assessment {
  level: SafetyLevel;
  mode: RoleplayMode;
  label: string;
  tone: SafetyTone;
  blurb: string;
}

export const LEVELS: Record<SafetyLevel, Assessment> = {
  normal: { level: 'normal', mode: 'normal_roleplay', label: 'Normal support', tone: 'sage', blurb: 'Holding space for you' },
  extra: { level: 'extra', mode: 'safe_roleplay', label: 'Extra support', tone: 'clay', blurb: 'Here with a little more care' },
  urgent: { level: 'urgent', mode: 'stop_roleplay', label: 'Urgent support', tone: 'care', blurb: 'Let’s pause and take care of you' },
};

// Local keyword fallback so the flow is testable with no backend running.
// The backend decision (fromBackendDecision) takes priority when present.
const URGENT_PATTERNS = [
  /\bkill myself\b/, /\bend (my|it all)\b/, /\bsuicid/, /\bwant to die\b/,
  /\bdon'?t want to (be alive|live)\b/, /\bno reason to live\b/,
  /\bharm myself\b/, /\bhurt myself\b/, /\bself[-\s]?harm\b/,
  /\bgive up on (life|everything)\b/, /\bbetter off (dead|without me)\b/,
  /\bcan'?t go on\b/, /\bnothing left\b/,
];
const EXTRA_PATTERNS = [
  /\bhopeless\b/, /\bworthless\b/, /\bempty inside\b/, /\bnumb\b/,
  /\bcan'?t (cope|breathe|stop crying)\b/, /\boverwhelm/, /\bpanic/,
  /\bbreaking down\b/, /\bfalling apart\b/, /\bso alone\b/, /\bunbearable\b/,
  /\bi (hate|can'?t stand) myself\b/, /\bexhausted\b/, /\bdespair\b/,
];

export function classifyMessage(text: string): Assessment {
  const t = (text || '').toLowerCase().replace(/[‘’ʼ]/g, "'");
  if (URGENT_PATTERNS.some((re) => re.test(t))) return { ...LEVELS.urgent };
  if (EXTRA_PATTERNS.some((re) => re.test(t))) return { ...LEVELS.extra };
  return { ...LEVELS.normal };
}

export interface BackendDecision {
  action?: RoleplayMode;
  method?: string;
  risk_level?: string;
  suicidewatch_probability?: number;
}

export function fromBackendDecision(raw: BackendDecision | null | undefined): Assessment {
  if (!raw) return { ...LEVELS.normal };
  switch (raw.action) {
    case 'stop_roleplay': return { ...LEVELS.urgent };
    case 'safe_roleplay': return { ...LEVELS.extra };
    case 'normal_roleplay':
    default: return { ...LEVELS.normal };
  }
}

export interface SupportOption {
  action: 'try_grounding' | 'try_breathing' | 'play_sounds' | 'open_safety' | 'end_session';
  label: string;
  sub: string;
}

export const SUPPORT_OPTIONS: SupportOption[] = [
  { action: 'try_grounding', label: 'Grounding', sub: 'A short 5-4-3-2-1 exercise' },
  { action: 'try_breathing', label: 'Breathing', sub: 'Settle your body, one breath at a time' },
  { action: 'play_sounds', label: 'Calming sounds', sub: 'Rain, ocean or forest' },
  { action: 'open_safety', label: 'Support resources', sub: 'People you can reach right now' },
  { action: 'end_session', label: 'End session', sub: 'You can always come back' },
];
