// lib/seedMoods.ts — demo-only mock data for the mood UI (localStorage, no backend).
// Seeds the past 6 days of check-ins so the WeekStrip / Insight views have
// something to show on a fresh device. Client-only — call after mount.
import { MOODS, localDateStr } from './moods';

interface MoodEntry {
  date: string; // YYYY-MM-DD
  mood: string;
  note: string;
}

// index 0 = furthest back (day -6), index 5 = yesterday (day -1).
const SEED: { daysAgo: number; mood: string; note: string }[] = [
  { daysAgo: 6, mood: MOODS[3].id, note: 'Carried a lot today' },
  { daysAgo: 5, mood: MOODS[2].id, note: 'Getting through it' },
  { daysAgo: 4, mood: MOODS[1].id, note: 'Things felt lighter' },
  { daysAgo: 3, mood: MOODS[0].id, note: 'One of those rare good days' },
  { daysAgo: 2, mood: MOODS[1].id, note: 'Steady and present' },
  { daysAgo: 1, mood: MOODS[2].id, note: 'Quiet but okay' },
];

// Date string for `daysAgo` days before today, in the same local-calendar
// format every reader keys check-ins by.
function dateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDateStr(d);
}

// Demo-only: always overwrite the past 6 days with seed data, preserving only
// today's real check-in if one exists.
export function seedWeekMoods(): void {
  const existing: MoodEntry[] = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
  const today = localDateStr();
  const todayEntry = existing.filter((e) => e.date === today);

  const seedEntries: MoodEntry[] = SEED.map((s) => ({
    date: dateDaysAgo(s.daysAgo),
    mood: s.mood,
    note: s.note,
  }));

  const merged = [...seedEntries, ...todayEntry];
  localStorage.setItem('soulmate_moods', JSON.stringify(merged));
  // Nudge WeekStrip + the today-card to re-read localStorage right away.
  window.dispatchEvent(new Event('reflection-saved'));
}
