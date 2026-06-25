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

export const MOODS: Mood[] = [
  { id: 'radiant', label: 'Radiant', weather: 'sun', emoji: '☀️', word: 'light, open, alive', color: 'var(--mood-radiant)', v: 1 },
  { id: 'bright', label: 'Steady', weather: 'leaf', emoji: '🙂', word: 'calm, okay, grounded', color: 'var(--mood-calm)', v: 0.75 },
  { id: 'cloudy', label: 'Cloudy', weather: 'cloud', emoji: '😐', word: 'flat, unsure, in-between', color: 'var(--mood-cloudy)', v: 0.5 },
  { id: 'low', label: 'Low', weather: 'rain', emoji: '😔', word: 'tired, sad, heavy-ish', color: 'var(--mood-low)', v: 0.3 },
  { id: 'heavy', label: 'Heavy', weather: 'droplet', emoji: '😢', word: 'overwhelmed, hurting', color: 'var(--mood-heavy)', v: 0.1 },
];

// Local calendar date as YYYY-MM-DD. Used everywhere a check-in is keyed by
// "today" — must NOT use toISOString(), which returns the UTC date and so
// misassigns check-ins to the wrong day near midnight (e.g. before 07:00 in UTC+7).
export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Reads the last 7 calendar days of mood check-ins (with optional note) from
// localStorage (key: 'soulmate_moods'). Each returned day is { label, id, note },
// where id is the mood id for that day or null if there was no check-in, and label
// is the real weekday. Client-only — callers must render after mount so
// `localStorage` is available.
export function getWeekMoods(): { label: string; id: string | null; note: string }[] {
  const history = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
  const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const label = SHORT_DAYS[date.getDay()];
    const dateStr = localDateStr(date);
    const entry = history.findLast((e: { date: string; mood: string; note?: string }) => e.date === dateStr);
    return { label, id: entry?.mood || null, note: entry?.note || '' };
  });
}

export function moodById(id: string | null): Mood {
  return MOODS.find((m) => m.id === id) || MOODS[2];
}

export function greet(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
