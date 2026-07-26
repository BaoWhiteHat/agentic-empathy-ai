'use client';
// components/screens/Reflections.tsx — journal (wired to the real backend)
import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/primitives';
import { ScreenScroll } from '../ui/ScreenScroll';
import {
  getMoodEntriesForMonth,
  getMoodEntriesForWeek,
  localDateStr,
  moodById,
  MOODS,
  summarizeMoodEntries,
  type Mood,
  type MoodDay,
  type MoodEntry,
} from '../../lib/moods';
import { useUser } from '../../context/UserContext';

interface Entry { id: string; title: string; body: string; mood: string; timestamp: number; from: 'Written' }

type MoodJournalView = 'week' | 'month';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shiftDate(date: Date, amount: number, unit: MoodJournalView): Date {
  const next = new Date(date);
  if (unit === 'week') next.setDate(next.getDate() + amount * 7);
  else next.setMonth(next.getMonth() + amount);
  return next;
}

function formatMoodDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function weekRangeLabel(days: MoodDay[]): string {
  if (days.length === 0) return 'This week';
  return `${formatMoodDate(days[0].date)} - ${formatMoodDate(days[days.length - 1].date)}`;
}

function monthLabel(anchor: Date): string {
  return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="journal-summary-tile" style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      <div className="label" style={{ fontSize: 9.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

function RoundIconBadge({ icon, tone, size = 34, iconSize = 15 }: { icon: string; tone: string; size?: number; iconSize?: number }) {
  return (
    <div className="mood-marker" style={{ width: size, height: size, borderRadius: '50%', background: tone, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 4px color-mix(in oklab, ${tone} 16%, transparent)`, flex: '0 0 auto' }}>
      <Icon name={icon} size={iconSize} stroke={2} style={{ color: '#fff' }} />
    </div>
  );
}

function MoodIconBadge({ mood, size = 34, iconSize = 15 }: { mood: Mood; size?: number; iconSize?: number }) {
  return <RoundIconBadge icon={mood.weather} tone={mood.color} size={size} iconSize={iconSize} />;
}

function ReflectionIconBadge({ size = 34, iconSize = 15 }: { size?: number; iconSize?: number }) {
  return <RoundIconBadge icon="feather" tone="var(--clay)" size={size} iconSize={iconSize} />;
}

function EmptyIconBadge({ size = 34 }: { size?: number }) {
  return (
    <div className="mood-marker mood-marker-empty" style={{ width: size, height: size, borderRadius: '50%', background: 'transparent', border: '1px dashed var(--line-strong)', flex: '0 0 auto' }} />
  );
}

type WrittenReflectionEntry = Entry & { from: 'Written' };

type DailyJournalEntry = {
  date: string;
  label: string;
  mood: MoodEntry | null;
  reflections: WrittenReflectionEntry[];
};

function dateKeyFromTimestamp(timestamp: number): string | null {
  const parsed = new Date(timestamp * 1000);
  if (isNaN(parsed.getTime())) return null;
  return localDateStr(parsed);
}

function formatFullDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTimeFromTimestamp(timestamp: number): string | null {
  const parsed = new Date(timestamp * 1000);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatMoodUpdatedTime(mood: MoodEntry): string | null {
  if (!mood.updatedAt) return null;
  const parsed = new Date(mood.updatedAt);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function displayDayLabel(dateStr: string, fallback: string): string {
  const today = localDateStr();
  if (dateStr === today) return 'Today';
  return fallback;
}

function hasDailyActivity(entry: DailyJournalEntry): boolean {
  return Boolean(entry.mood || entry.reflections.length > 0);
}

function buildDailyJournal(days: MoodDay[], reflections: WrittenReflectionEntry[]): DailyJournalEntry[] {
  const byDate = new Map<string, DailyJournalEntry>();
  days.forEach((day) => {
    byDate.set(day.date, { date: day.date, label: day.label, mood: day.entry, reflections: [] });
  });
  reflections.forEach((reflection) => {
    const date = dateKeyFromTimestamp(reflection.timestamp);
    if (!date) return;
    const day = byDate.get(date);
    if (!day) return;
    day.reflections.push(reflection);
  });
  return days.map((day) => {
    const entry = byDate.get(day.date)!;
    entry.reflections.sort((a, b) => a.timestamp - b.timestamp);
    return entry;
  });
}

function MoodJournal({ reflections }: { reflections: Entry[] }) {
  const [view, setView] = useState<MoodJournalView>('week');
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [days, setDays] = useState<MoodDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setDays(view === 'week' ? getMoodEntriesForWeek(weekAnchor) : getMoodEntriesForMonth(monthAnchor));
  }, [monthAnchor, view, weekAnchor]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate mood journal from localStorage after mount/period changes
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('reflection-saved', handler);
    return () => window.removeEventListener('reflection-saved', handler);
  }, [refresh]);

  useEffect(() => {
    if (!selectedDate) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSelectedDate(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedDate]);

  const writtenReflections = reflections.filter((entry): entry is WrittenReflectionEntry => entry.from === 'Written');
  const journalEntries = buildDailyJournal(days, writtenReflections);
  const selectedEntry = selectedDate ? journalEntries.find((entry) => entry.date === selectedDate) ?? null : null;
  const selectedMood = selectedEntry?.mood ? moodById(selectedEntry.mood.mood) : null;
  const summary = summarizeMoodEntries(days);
  const activityDays = journalEntries.filter(hasDailyActivity).length;
  const mostCommon = summary.mostCommonMood ? moodById(summary.mostCommonMood).label : 'Not enough yet';
  const latest = summary.latestMood && summary.latestDate
    ? `${moodById(summary.latestMood).label} · ${formatMoodDate(summary.latestDate)}`
    : 'No check-in yet';
  const periodLabel = view === 'week' ? weekRangeLabel(days) : monthLabel(monthAnchor);
  const monthOffset = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1).getDay();

  const movePeriod = (amount: number) => {
    setSelectedDate(null);
    if (view === 'week') setWeekAnchor((current) => shiftDate(current, amount, 'week'));
    else setMonthAnchor((current) => shiftDate(current, amount, 'month'));
  };

  return (
    <section className="mood-journal card" style={{ padding: '24px 26px', marginBottom: 22, boxShadow: 'var(--shadow-soft)' }}>
      <div className="mood-journal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>Mood Journal</p>
          <h2 className="serif" style={{ fontSize: 26, margin: '0 0 6px', color: 'var(--ink)' }}>A quiet record of how your days have felt.</h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.55 }}>This is for reflection, not diagnosis.</p>
        </div>
        <div className="mood-journal-view-toggle" style={{ display: 'inline-flex', padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          {(['week', 'month'] as MoodJournalView[]).map((mode) => {
            const active = view === mode;
            return (
              <button key={mode} onClick={() => { setView(mode); setSelectedDate(null); }}
                style={{ border: 'none', borderRadius: 'var(--r-pill)', padding: '8px 13px', background: active ? 'var(--sage)' : 'transparent', color: active ? 'var(--surface)' : 'var(--ink-soft)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize' }}>
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <button aria-label={`Previous ${view}`} onClick={() => movePeriod(-1)}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="chevL" size={17} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{periodLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{activityDays > 0 ? `${activityDays} day${activityDays === 1 ? '' : 's'} with entries` : 'No mood or reflection entries in this period'}</div>
        </div>
        <button aria-label={`Next ${view}`} onClick={() => movePeriod(1)}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="chevR" size={17} />
        </button>
      </div>

      <div className="mood-journal-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        <SummaryTile label="Days with entries" value={`${activityDays} day${activityDays === 1 ? '' : 's'}`} />
        <SummaryTile label="Most common mood" value={mostCommon} />
        <SummaryTile label="Latest mood" value={latest} />
      </div>

      {view === 'week' ? (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div className="mood-journal-week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, minWidth: 700 }}>
            {journalEntries.map((entry) => {
              const mood = entry.mood ? moodById(entry.mood.mood) : null;
              const active = hasDailyActivity(entry);
              const isSelected = selectedDate === entry.date;
              const title = mood ? mood.label : 'Reflection';
              const cardStyle: React.CSSProperties = {
                height: 122,
                padding: 10,
                borderRadius: 'var(--r-md)',
                border: `1px solid ${isSelected ? 'var(--sage)' : 'var(--line)'}`,
                background: mood ? `linear-gradient(135deg, color-mix(in oklab, ${mood.color} 12%, var(--surface)), var(--surface))` : active ? 'var(--surface)' : 'var(--surface-2)',
                textAlign: 'left',
                boxShadow: isSelected ? '0 0 0 3px var(--sage-tint)' : 'none',
                display: 'grid',
                gridTemplateRows: '24px 42px 24px',
                alignItems: 'center',
              };
              const dateStyle: React.CSSProperties = {
                minWidth: 0,
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--ink-faint)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              };
              const iconSlotStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 42,
              };
              const labelStyle: React.CSSProperties = {
                minWidth: 0,
                fontSize: 13.5,
                fontWeight: 800,
                color: active ? 'var(--ink)' : 'var(--ink-faint)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              };
              if (!active) {
                return (
                  <div className="mood-journal-day" key={entry.date} style={cardStyle}>
                    <div style={dateStyle}>{displayDayLabel(entry.date, entry.label)} · {formatMoodDate(entry.date)}</div>
                    <div style={iconSlotStyle}><EmptyIconBadge /></div>
                    <div style={labelStyle}>No check-in</div>
                  </div>
                );
              }
              return (
                <button className="mood-journal-day" key={entry.date} onClick={() => setSelectedDate(entry.date)} aria-pressed={isSelected} aria-label={`View journal entry for ${formatFullDate(entry.date)}`}
                  style={{ ...cardStyle, cursor: 'pointer' }}>
                  <div style={dateStyle}>{displayDayLabel(entry.date, entry.label)} · {formatMoodDate(entry.date)}</div>
                  <div style={iconSlotStyle}>{mood ? <MoodIconBadge mood={mood} /> : <ReflectionIconBadge />}</div>
                  <div style={labelStyle}>{title}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(28px, 1fr))', gap: 6, marginBottom: 7 }}>
            {WEEKDAY_LABELS.map((label) => <div key={label} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-faint)' }}>{label}</div>)}
          </div>
          <div className="mood-journal-month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(34px, 1fr))', gap: 6 }}>
            {Array.from({ length: monthOffset }).map((_, i) => <div key={`blank-${i}`} aria-hidden="true" />)}
            {journalEntries.map((entry) => {
              const mood = entry.mood ? moodById(entry.mood.mood) : null;
              const active = hasDailyActivity(entry);
              const isSelected = selectedDate === entry.date;
              const cellStyle: React.CSSProperties = {
                minHeight: 68,
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${isSelected ? 'var(--sage)' : 'var(--line)'}`,
                background: mood ? `color-mix(in oklab, ${mood.color} 12%, var(--surface))` : active ? 'var(--surface)' : 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                boxShadow: isSelected ? '0 0 0 2px var(--sage-tint)' : 'none',
              };
              if (!active) {
                return (
                  <div className="mood-journal-month-cell" key={entry.date} title="No check-in" style={cellStyle}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)' }}>{entry.label}</span>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'transparent', border: '1px dashed var(--line-strong)' }} />
                  </div>
                );
              }
              return (
                <button className="mood-journal-month-cell" key={entry.date} title={mood ? mood.label : 'Reflection'} onClick={() => setSelectedDate(entry.date)} aria-pressed={isSelected} aria-label={`View ${mood ? `${mood.label} mood` : 'reflection'} journal entry for ${formatFullDate(entry.date)}`}
                  style={{ ...cellStyle, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)' }}>{entry.label}</span>
                  {mood ? <MoodIconBadge mood={mood} size={24} iconSize={11} /> : <ReflectionIconBadge size={24} iconSize={11} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activityDays === 0 && (
        <div style={{ marginTop: 16, padding: '13px 15px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.5 }}>
          Mood check-ins and written reflections will appear here by day.
        </div>
      )}

      {selectedEntry && hasDailyActivity(selectedEntry) && (
        <div className="journal-dialog-overlay" role="presentation" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setSelectedDate(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'color-mix(in oklab, var(--ink) 32%, transparent)', backdropFilter: 'blur(6px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="mood-journal-detail-title" tabIndex={-1}
            className="mood-journal-dialog card fade-up" style={{ width: '100%', maxWidth: 620, maxHeight: '82vh', overflowY: 'auto', padding: '26px 28px', position: 'relative', boxShadow: 'var(--shadow-lift)' }}>
            <p className="label" style={{ marginBottom: 6 }}>{formatFullDate(selectedEntry.date)}</p>
            <h2 id="mood-journal-detail-title" className="serif" style={{ fontSize: 28, margin: '0 0 18px', color: 'var(--ink)' }}>Daily journal</h2>

            {selectedMood && selectedEntry.mood && (
              <section className="mood-journal-detail-mood" style={{ padding: '16px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: `linear-gradient(135deg, color-mix(in oklab, ${selectedMood.color} 12%, var(--surface)), var(--surface))`, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 12 }}>
                  <MoodIconBadge mood={selectedMood} size={42} iconSize={19} />
                  <div>
                    <div style={{ color: 'var(--ink)', fontWeight: 800, fontSize: 16 }}>{selectedMood.label}</div>
                    {formatMoodUpdatedTime(selectedEntry.mood) && (
                      <div style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginTop: 2 }}>Updated {formatMoodUpdatedTime(selectedEntry.mood)}</div>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, color: selectedEntry.mood.note ? 'var(--ink-soft)' : 'var(--ink-faint)', fontSize: 13.5, lineHeight: 1.6 }}>
                  {selectedEntry.mood.note || 'No mood note added.'}
                </p>
              </section>
            )}

            {selectedEntry.reflections.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p className="label" style={{ margin: '6px 0 2px' }}>Written reflections</p>
                {selectedEntry.reflections.map((reflection) => {
                  const time = formatTimeFromTimestamp(reflection.timestamp);
                  return (
                    <article key={reflection.id} style={{ padding: '15px 16px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
                        <h3 className="serif" style={{ margin: 0, color: 'var(--ink)', fontSize: 18 }}>{reflection.title || 'Untitled'}</h3>
                        {time && <span style={{ color: 'var(--ink-faint)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{time}</span>}
                      </div>
                      <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.6, fontSize: 13.5 }}>{reflection.body || 'No written detail.'}</p>
                    </article>
                  );
                })}
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function ReflectionsScreen() {
  const { userId } = useUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('bright');

  const fetchReflections = useCallback(() => {
    if (!userId) { setEntries([]); return; }
    fetch(`http://localhost:8000/api/reflections/${userId}`)
      .then(r => r.json())
      .then(data => {
        const written: Entry[] = (data.reflections || []).map((e: { id: string; title: string; body: string; mood?: string; timestamp: number }) => ({
          id: e.id, title: e.title, body: e.body, mood: e.mood ?? '', timestamp: e.timestamp, from: 'Written' as const,
        }));
        setEntries(written.sort((a, b) => b.timestamp - a.timestamp));
      })
      .catch(() => setEntries([]));
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch syncs written reflections from the backend
  useEffect(() => { fetchReflections(); }, [fetchReflections]);

  // Re-fetch when a reflection is saved elsewhere (e.g. the Today quick-write modal).
  useEffect(() => {
    const handler = () => fetchReflections();
    window.addEventListener('reflection-saved', handler);
    return () => window.removeEventListener('reflection-saved', handler);
  }, [fetchReflections]);

  const closeEditor = useCallback(() => {
    setEditing(false);
    setTitle('');
    setBody('');
    setSelectedMood('bright');
  }, []);

  useEffect(() => {
    if (!editing) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeEditor();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeEditor, editing]);

  const save = async () => {
    if (!title.trim() && !body.trim()) return;
    // Never POST an empty title — fall back to the start of the body, then a default.
    const finalTitle = title.trim() || body.trim().slice(0, 30) || 'A quiet moment';
    const res = await fetch(`http://localhost:8000/api/reflections/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: finalTitle, body, mood: selectedMood })
    });
    const entry = await res.json();
    // Add to state using the exact field names the backend returns.
    setEntries(prev => [{
      id: entry.id,
      title: entry.title,
      body: entry.body,
      mood: entry.mood ?? '',
      timestamp: entry.timestamp,
      from: 'Written' as const,
    }, ...prev]);
    window.dispatchEvent(new Event('reflection-saved'));
    closeEditor();
  };

  return (
    <ScreenScroll max={860}>
      <div className="reflections-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>Your reflections</p>
          <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>A quiet record of how you’ve been</h1>
          <p style={{ fontSize: 'calc(var(--text-base) * 0.94)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 520, lineHeight: 1.55 }}>Moments worth keeping — from check-ins, chats, or whenever you feel like writing. Only ever for you.</p>
        </div>
        <Button variant="primary" icon="pen" onClick={() => setEditing(true)}>New reflection</Button>
      </div>

      {editing && (
        <div className="reflection-editor-overlay" role="presentation" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) closeEditor(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'color-mix(in oklab, var(--ink) 32%, transparent)', backdropFilter: 'blur(6px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reflection-editor-title" tabIndex={-1}
            className="reflection-editor-dialog card fade-up" style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', padding: '28px 30px', position: 'relative', boxShadow: 'var(--shadow-lift)', borderLeft: '3px solid var(--clay)' }}>
            <p className="label" style={{ marginBottom: 8 }}>New reflection</p>
            <h2 id="reflection-editor-title" className="serif" style={{ fontSize: 28, margin: '0 0 16px', color: 'var(--ink)' }}>Write a reflection</h2>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, if you like…"
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 'calc(var(--text-base) * 1.375)', color: 'var(--ink)', marginBottom: 12 }} />
            <div className="reflection-mood-options" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {MOODS.map(m => {
                const sel = selectedMood === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setSelectedMood(m.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, padding: '7px 4px', borderRadius: 'var(--r-sm)', border: `1px solid ${sel ? m.color : 'var(--line)'}`, background: sel ? `color-mix(in oklab, ${m.color} 14%, var(--surface))` : 'var(--surface-2)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: sel ? m.color : `color-mix(in oklab, ${m.color} 16%, var(--surface))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={m.weather} size={14} style={{ color: sel ? '#fff' : 'var(--ink-soft)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sel ? m.color : 'var(--ink-soft)', letterSpacing: '.03em' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s on your mind?" rows={5}
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', outline: 'none', padding: 14, fontSize: 'calc(var(--text-base) * 0.97)', lineHeight: 1.65, color: 'var(--ink)', resize: 'none', fontFamily: 'var(--font-body)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <MoodJournal reflections={entries} />
    </ScreenScroll>
  );
}
