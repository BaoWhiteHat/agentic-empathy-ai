// lib/moods.ts — shared mood spectrum + small date helpers
export interface Mood {
  id: string;
  label: string;
  weather: string;
  emoji: string;
  word: string;
  color: string;
  v: number;
}

export interface MoodEntry {
  date: string;
  mood: string;
  note: string;
  updatedAt?: number;
}

export interface MoodDay {
  date: string;
  label: string;
  id: string | null;
  note: string;
  entry: MoodEntry | null;
}

export interface MoodSummary {
  checkInDays: number;
  mostCommonMood: string | null;
  latestMood: string | null;
  latestDate: string | null;
}

export const MOODS: Mood[] = [
  { id: 'radiant', label: 'Radiant', weather: 'sun', emoji: '☀️', word: 'light, open, alive', color: 'var(--mood-radiant)', v: 1 },
  { id: 'bright', label: 'Steady', weather: 'leaf', emoji: '🙂', word: 'calm, okay, grounded', color: 'var(--mood-calm)', v: 0.75 },
  { id: 'cloudy', label: 'Cloudy', weather: 'cloud', emoji: '😐', word: 'flat, unsure, in-between', color: 'var(--mood-cloudy)', v: 0.5 },
  { id: 'low', label: 'Low', weather: 'rain', emoji: '😔', word: 'tired, sad, heavy-ish', color: 'var(--mood-low)', v: 0.3 },
  { id: 'heavy', label: 'Heavy', weather: 'droplet', emoji: '😢', word: 'overwhelmed, hurting', color: 'var(--mood-heavy)', v: 0.1 },
];

export const MOOD_STORAGE_KEY = 'soulmate_moods';
const MOOD_IDS = new Set(MOODS.map((m) => m.id));

// Local calendar date as YYYY-MM-DD. Used everywhere a check-in is keyed by
// "today" — must NOT use toISOString(), which returns the UTC date and so
// misassigns check-ins to the wrong day near midnight (e.g. before 07:00 in UTC+7).
export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) return null;
  return parsed;
}

function isMoodEntry(value: unknown): value is MoodEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MoodEntry>;
  return (
    typeof candidate.date === 'string' &&
    !!parseLocalDate(candidate.date) &&
    typeof candidate.mood === 'string' &&
    MOOD_IDS.has(candidate.mood) &&
    (candidate.note === undefined || typeof candidate.note === 'string')
  );
}

function normalizeUpdatedAt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeMoodEntries(entries: MoodEntry[]): MoodEntry[] {
  const byDate = new Map<string, MoodEntry>();
  entries.forEach((entry) => {
    const updatedAt = normalizeUpdatedAt((entry as { updatedAt?: unknown }).updatedAt);
    const normalized: MoodEntry = { date: entry.date, mood: entry.mood, note: entry.note || '' };
    if (updatedAt) normalized.updatedAt = updatedAt;
    byDate.set(entry.date, normalized);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function loadMoodEntries(): MoodEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(MOOD_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeMoodEntries(parsed.filter(isMoodEntry));
  } catch {
    return [];
  }
}

export function saveMoodEntries(entries: MoodEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(normalizeMoodEntries(entries)));
  } catch { /* ignore quota/private-mode storage failures */ }
}

export function getMoodEntryForDate(dateStr: string, entries = loadMoodEntries()): MoodEntry | null {
  return entries.find((entry) => entry.date === dateStr) ?? null;
}

export function saveOrUpdateTodayMoodEntry(mood: string, note: string): MoodEntry | null {
  if (!MOOD_IDS.has(mood)) return null;
  const today = localDateStr();
  const entries = loadMoodEntries().filter((entry) => entry.date !== today);
  const entry = { date: today, mood, note, updatedAt: Date.now() };
  saveMoodEntries([...entries, entry]);
  return entry;
}

function dateDaysFrom(start: Date, days: number): Date {
  const next = new Date(start);
  next.setDate(start.getDate() + days);
  return next;
}

function dayFromEntry(date: Date, label: string, entries: MoodEntry[]): MoodDay {
  const dateStr = localDateStr(date);
  const entry = getMoodEntryForDate(dateStr, entries);
  return {
    date: dateStr,
    label,
    id: entry?.mood ?? null,
    note: entry?.note ?? '',
    entry,
  };
}

// Reads the current Monday-to-Sunday calendar week of mood check-ins from
// localStorage (key: 'soulmate_moods'). Client-only — callers must render after
// mount so `localStorage` is available.
export function getWeekMoods(): { label: string; id: string | null; note: string }[] {
  return getMoodEntriesForWeek().map((day) => ({ label: day.label, id: day.id, note: day.note }));
}

export function getMoodEntriesForWeek(anchor = new Date()): MoodDay[] {
  const history = loadMoodEntries();
  const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = dateDaysFrom(start, i);
    return dayFromEntry(date, SHORT_DAYS[date.getDay()], history);
  });
}

export function getMoodEntriesForMonth(anchor = new Date()): MoodDay[] {
  const history = loadMoodEntries();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return dayFromEntry(date, String(i + 1), history);
  });
}

export function summarizeMoodEntries(days: MoodDay[]): MoodSummary {
  const entries = days.flatMap((day) => day.entry ? [day.entry] : []);
  if (entries.length === 0) {
    return { checkInDays: 0, mostCommonMood: null, latestMood: null, latestDate: null };
  }

  const counts = new Map<string, number>();
  entries.forEach((entry) => counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1));
  const mostCommonMood = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    checkInDays: entries.length,
    mostCommonMood,
    latestMood: latest?.mood ?? null,
    latestDate: latest?.date ?? null,
  };
}

export function moodById(id: string | null): Mood {
  return MOODS.find((m) => m.id === id) || MOODS[2];
}

export function greet(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
