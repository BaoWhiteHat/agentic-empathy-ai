'use client';
// context/TweaksContext.tsx
// Accessible personalisation state for SoulMate (WCAG 2.2 AA-minded).
// Owns the full Tweaks state, persists to localStorage, and applies the result
// to document.documentElement as CSS variables + classes/attributes so every
// screen reacts without prop-drilling.
//
// NOTE: this replaces the older lib/tweaks.tsx hook-based system.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type TextSize = 'S' | 'M' | 'L' | 'XL';
export type FontChoice = 'sans' | 'dyslexic' | 'serif';
export type LineSpacing = 'compact' | 'normal' | 'relaxed';
export type LetterSpacing = 'default' | 'wide';
export type ColorMode = 'vibrant' | 'calm' | 'high-contrast';
export type DashboardVariant = 'calm' | 'bento';
export type ChatStyle = 'bubbles' | 'minimal';
export type OceanInsight = 'bars' | 'pentagon';

export type TweaksState = {
  // --- DISPLAY ---
  textSize: TextSize;
  font: FontChoice;
  lineSpacing: LineSpacing;
  letterSpacing: LetterSpacing;

  // --- MOTION & SENSORY ---
  reduceMotion: boolean;
  colorMode: ColorMode;
  accent: string;

  // --- COGNITIVE ---
  focusMode: boolean;
  dashboard: DashboardVariant;

  // --- LAYOUT VARIANTS ---
  chatStyle: ChatStyle;
  oceanInsight: OceanInsight;

  // --- DARK MODE ---
  darkMode: boolean;
};

export const TWEAKS_DEFAULTS: TweaksState = {
  textSize: 'M',
  font: 'sans',
  lineSpacing: 'normal',
  letterSpacing: 'default',
  reduceMotion: false,
  colorMode: 'calm',      // calm is default — safer for anxiety/sensory users
  accent: '#4A9B7F',
  focusMode: false,
  dashboard: 'calm',
  chatStyle: 'bubbles',
  oceanInsight: 'bars',
  darkMode: true,
};

const STORAGE_KEY = 'soulmate_tweaks';

const TEXT_SIZE_REM: Record<TextSize, string> = { S: '0.875rem', M: '1rem', L: '1.125rem', XL: '1.3125rem' };
const LINE_HEIGHT: Record<LineSpacing, string> = { compact: '1.4', normal: '1.6', relaxed: '1.9' };
const LETTER_SPACING: Record<LetterSpacing, string> = { default: 'normal', wide: '0.04em' };
const FONT_FAMILY: Record<FontChoice, string> = {
  sans: "'Inter', 'Hanken Grotesk', system-ui, sans-serif",
  dyslexic: "'OpenDyslexic', 'Hanken Grotesk', sans-serif",
  serif: "'Newsreader', Georgia, serif",
};

interface TweaksContextValue {
  tweaks: TweaksState;
  set: <K extends keyof TweaksState>(key: K, value: TweaksState[K]) => void;
  resetToDefaults: () => void;
  /** Effective motion preference (in-app toggle OR OS prefers-reduced-motion). */
  prefersReducedMotion: boolean;
}

const TweaksContext = createContext<TweaksContextValue | null>(null);

/** Apply the full state to :root as CSS variables + classes/attributes. */
function applyToDocument(t: TweaksState, osReducedMotion: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const reduce = t.reduceMotion || osReducedMotion;

  root.style.setProperty('--text-base', TEXT_SIZE_REM[t.textSize]);
  root.style.setProperty('--font-body', FONT_FAMILY[t.font]);
  root.style.setProperty('--line-height', LINE_HEIGHT[t.lineSpacing]);
  root.style.setProperty('--letter-spacing', LETTER_SPACING[t.letterSpacing]);
  root.style.setProperty('--transition-speed', reduce ? '0ms' : '200ms');

  // The codebase colours its UI from --sage; mirror the accent into both so the
  // user's accent actually recolours buttons/charts. (high-contrast mode forces
  // its own accent via CSS, overriding these.)
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--sage', t.accent);

  root.classList.toggle('dark', t.darkMode);
  root.classList.toggle('reduce-motion', reduce);
  root.setAttribute('data-color-mode', t.colorMode);
}

function readStored(): TweaksState {
  if (typeof localStorage === 'undefined') return TWEAKS_DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return TWEAKS_DEFAULTS;
    // Merge so newly-added keys never break older saved blobs.
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return TWEAKS_DEFAULTS;
    const supportedEntries = Object.entries(parsed).filter(([key]) => key in TWEAKS_DEFAULTS);
    return { ...TWEAKS_DEFAULTS, ...Object.fromEntries(supportedEntries) } as TweaksState;
  } catch {
    return TWEAKS_DEFAULTS;
  }
}

export function TweaksProvider({ children }: { children: React.ReactNode }) {
  // Start from defaults so SSR and first client render agree; hydrate from
  // localStorage after mount to avoid a hydration mismatch.
  const [tweaks, setTweaks] = useState<TweaksState>(TWEAKS_DEFAULTS);
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const hydrated = useRef(false);

  // Hydrate persisted prefs once, after mount.
  useEffect(() => {
    const stored = readStored();
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
    setTweaks(stored);
  }, []);

  // Track OS reduced-motion preference and react to changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read initial media state
    setOsReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply to the document on every change (and once hydrated).
  useEffect(() => {
    applyToDocument(tweaks, osReducedMotion);
  }, [tweaks, osReducedMotion]);

  // Persist on change (skip the very first render before hydration).
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks)); } catch { /* ignore */ }
  }, [tweaks]);

  const set = useCallback(<K extends keyof TweaksState>(key: K, value: TweaksState[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setTweaks(TWEAKS_DEFAULTS);
  }, []);

  return (
    <TweaksContext.Provider value={{ tweaks, set, resetToDefaults, prefersReducedMotion: tweaks.reduceMotion || osReducedMotion }}>
      {children}
    </TweaksContext.Provider>
  );
}

export function useTweaks(): TweaksContextValue {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error('useTweaks must be used within a TweaksProvider');
  return ctx;
}
