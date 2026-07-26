// lib/seedMoods.ts — demo-only mock data for the mood UI (localStorage, no backend).
// Fills a fixed project-defense range on a fresh device. Client-only — call
// after mount so localStorage is available.
import { loadMoodEntries, saveMoodEntries, type MoodEntry } from './moods';

const REMOVED_DEMO_ENTRY: MoodEntry = {
  date: '2026-07-02',
  mood: 'radiant',
  note: 'A confident day. The demo flow felt clearer.',
};

const DEMO_SEED: MoodEntry[] = [
  { date: '2026-06-01', mood: 'cloudy', note: 'A slow start to the month, with a few loose ends on my mind.' },
  { date: '2026-06-02', mood: 'bright', note: 'Found a comfortable rhythm and finished a small task.' },
  { date: '2026-06-03', mood: 'cloudy', note: 'Felt a little scattered, so I kept the day simple.' },
  { date: '2026-06-04', mood: 'bright', note: 'A steadier day with enough energy to keep moving.' },
  { date: '2026-06-05', mood: 'radiant', note: 'Good momentum today; a few ideas finally clicked.' },
  { date: '2026-06-06', mood: 'bright', note: 'Calm progress and a little time to reset.' },
  { date: '2026-06-07', mood: 'low', note: 'Energy dipped, so I took the day one step at a time.' },
  { date: '2026-06-08', mood: 'cloudy', note: 'Some uncertainty lingered, but the day stayed manageable.' },
  { date: '2026-06-09', mood: 'bright', note: 'A clearer plan made the work feel lighter.' },
  { date: '2026-06-10', mood: 'bright', note: 'Stayed focused and made quiet, steady progress.' },
  { date: '2026-06-11', mood: 'cloudy', note: 'A mixed day with a few plans still taking shape.' },
  { date: '2026-06-12', mood: 'radiant', note: 'Felt encouraged after seeing the pieces come together.' },
  { date: '2026-06-13', mood: 'bright', note: 'A balanced day with room to work and breathe.' },
  { date: '2026-06-14', mood: 'heavy', note: 'A demanding day, so I gave myself a slower pace.' },
  { date: '2026-06-15', mood: 'low', note: 'Felt worn out and kept expectations gentle.' },
  { date: '2026-06-16', mood: 'cloudy', note: 'Still finding my footing, but things felt less tangled.' },
  { date: '2026-06-17', mood: 'bright', note: 'A small win helped me feel more settled.' },
  { date: '2026-06-18', mood: 'bright', note: 'Steady progress and a clearer sense of direction.' },
  { date: '2026-06-19', mood: 'cloudy', note: 'A few doubts came up, though I kept moving.' },
  { date: '2026-06-20', mood: 'bright', note: 'The plan felt more manageable after another careful pass.' },
  { date: '2026-06-21', mood: 'cloudy', note: 'A reflective day before starting the final preparation stretch.' },
  { date: '2026-06-22', mood: 'low', note: 'Felt tired and a little drained, but still checked in.' },
  { date: '2026-06-23', mood: 'cloudy', note: 'A quiet, uncertain day. Not bad, just a little unclear.' },
  { date: '2026-06-24', mood: 'bright', note: 'Felt steadier after breaking work into smaller steps.' },
  { date: '2026-06-25', mood: 'radiant', note: 'A lighter day. I felt proud after making progress.' },
  { date: '2026-06-26', mood: 'bright', note: 'Calm and focused. Things felt more manageable.' },
  { date: '2026-06-27', mood: 'cloudy', note: 'A slower day with some mixed feelings.' },
  { date: '2026-06-28', mood: 'radiant', note: 'Felt good preparing the demo and seeing the project come together.' },
  { date: '2026-06-29', mood: 'bright', note: 'A steady day for polishing the interface.' },
  { date: '2026-06-30', mood: 'cloudy', note: 'A bit uncertain, but I kept moving through the checklist.' },
  { date: '2026-07-01', mood: 'bright', note: 'Felt more grounded after rehearsing the presentation.' },
  { date: '2026-07-03', mood: 'bright', note: 'Calm and ready. A good day to present the work.' },
];

// Existing dates always win. This populates missing demo days without replacing
// real check-ins or removing mood history outside the demo range.
export function seedDemoMoods(): void {
  const existing = loadMoodEntries();
  // Remove only the previously seeded July 2 mock. A real or edited check-in
  // has an updatedAt timestamp and is deliberately preserved.
  const retainedExisting = existing.filter((entry) => !(
    entry.date === REMOVED_DEMO_ENTRY.date &&
    entry.mood === REMOVED_DEMO_ENTRY.mood &&
    entry.note === REMOVED_DEMO_ENTRY.note &&
    entry.updatedAt === undefined
  ));
  const existingDates = new Set(retainedExisting.map((entry) => entry.date));
  const missingDemoEntries = DEMO_SEED.filter((entry) => !existingDates.has(entry.date));

  if (retainedExisting.length !== existing.length || missingDemoEntries.length > 0) {
    saveMoodEntries([...retainedExisting, ...missingDemoEntries]);
  }

  // Nudge the week strip, Today card, and mood journal to re-read localStorage.
  window.dispatchEvent(new Event('reflection-saved'));
}
