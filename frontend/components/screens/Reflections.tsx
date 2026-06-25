'use client';
// components/screens/Reflections.tsx — journal (wired to the real backend)
import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/primitives';
import { ScreenScroll } from '../ui/ScreenScroll';
import { moodById, MOODS } from '../../lib/moods';
import { useUser } from '../../context/UserContext';

interface Entry { id: string; title: string; body: string; mood: string; timestamp: number; from: 'Written' | 'Mood check-in' }

// Mood check-in notes (localStorage) surfaced as read-only journal entries. Only
// entries with a non-empty note are shown; date string → Unix seconds for sorting.
function readMoodEntries(): Entry[] {
  if (typeof window === 'undefined') return [];
  const moods = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
  return moods
    .filter((e: { note?: string }) => e.note && e.note.trim())
    .map((e: { date: string; mood: string; note: string }) => ({
      id: `mood-${e.date}`,
      title: moodById(e.mood).label,
      body: e.note,
      mood: e.mood,
      timestamp: new Date(e.date).getTime() / 1000,
      from: 'Mood check-in' as const,
    }));
}

export function ReflectionsScreen() {
  const { userId } = useUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errorId, setErrorId] = useState<string | null>(null);            // card whose delete failed
  const [hoveredId, setHoveredId] = useState<string | null>(null);        // desktop hover reveal
  const [canHover, setCanHover] = useState(false);                        // false on touch → button always visible
  const [announcement, setAnnouncement] = useState('');                   // aria-live polite text
  const [selectedMood, setSelectedMood] = useState<string>('bright');

  const fetchReflections = useCallback(() => {
    const moodEntries = readMoodEntries();
    const byNewest = (a: Entry, b: Entry) => b.timestamp - a.timestamp;
    if (!userId) { setEntries([...moodEntries].sort(byNewest)); setLoading(false); return; }
    setLoading(true);
    fetch(`http://localhost:8000/api/reflections/${userId}`)
      .then(r => r.json())
      .then(data => {
        const written: Entry[] = (data.reflections || []).map((e: { id: string; title: string; body: string; mood?: string; timestamp: number }) => ({
          id: e.id, title: e.title, body: e.body, mood: e.mood ?? '', timestamp: e.timestamp, from: 'Written' as const,
        }));
        setEntries([...written, ...moodEntries].sort(byNewest));
      })
      .catch(() => setEntries([...moodEntries].sort(byNewest)))
      .finally(() => setLoading(false));
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch syncs from the backend
  useEffect(() => { fetchReflections(); }, [fetchReflections]);

  // Re-fetch when a reflection is saved elsewhere (e.g. the Today quick-write modal).
  useEffect(() => {
    const handler = () => fetchReflections();
    window.addEventListener('reflection-saved', handler);
    return () => window.removeEventListener('reflection-saved', handler);
  }, [fetchReflections]);

  // entry.timestamp is a Unix float (seconds) from the backend.
  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);  // backend timestamp is Unix SECONDS → ms
    if (isNaN(d.getTime())) return 'Today';  // guard missing/invalid timestamps
    const diff = Math.floor((new Date().getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short' });
  };

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
    setTitle(''); setBody(''); setEditing(false); setSelectedMood('bright');
  };

  // Detect hover capability once. On touch devices (no hover) the delete button stays visible.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setCanHover(window.matchMedia('(hover: hover)').matches);
    }
  }, []);

  // Optimistic delete: remove immediately, revert to the original position if the request fails.
  const handleDelete = async (entry: Entry, index: number) => {
    setErrorId(null);
    setEntries(prev => prev.filter(x => x.id !== entry.id));  // optimistic removal
    try {
      const res = await fetch(`http://localhost:8000/api/reflections/${userId}/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setAnnouncement('Reflection deleted');
      setTimeout(() => setAnnouncement(''), 1500);  // clear so a repeat delete re-announces
    } catch {
      // Revert — reinsert the entry at its original index.
      setEntries(prev => {
        const copy = [...prev];
        copy.splice(index, 0, entry);
        return copy;
      });
      setErrorId(entry.id);
      setTimeout(() => setErrorId(curr => (curr === entry.id ? null : curr)), 4000);
    }
  };

  // Mood check-in notes live in localStorage (id is `mood-{date}`), not the backend,
  // so they delete by rewriting the 'soulmate_moods' array. The 'reflection-saved'
  // event lets WeekStrip + other readers refresh from storage immediately.
  const handleDeleteMood = (entry: Entry) => {
    setErrorId(null);
    const date = entry.id.replace('mood-', '');
    const existing = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
    localStorage.setItem('soulmate_moods', JSON.stringify(existing.filter((e: { date: string }) => e.date !== date)));
    window.dispatchEvent(new Event('reflection-saved'));
    setEntries(prev => prev.filter(x => x.id !== entry.id));
  };

  return (
    <ScreenScroll max={860}>
      {/* Polite live region — announces deletion to screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>Your reflections</p>
          <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>A quiet record of how you’ve been</h1>
          <p style={{ fontSize: 'calc(var(--text-base) * 0.94)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 520, lineHeight: 1.55 }}>Moments worth keeping — from check-ins, chats, or whenever you feel like writing. Only ever for you.</p>
        </div>
        <Button variant="primary" icon="pen" onClick={() => setEditing(true)}>New reflection</Button>
      </div>

      {editing && (
        <div className="card fade-up" style={{ padding: '24px 26px', marginBottom: 22, borderLeft: '3px solid var(--clay)' }}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, if you like…"
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 'calc(var(--text-base) * 1.375)', color: 'var(--ink)', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {MOODS.map(m => {
              const sel = selectedMood === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setSelectedMood(m.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, padding: '6px 4px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: sel ? 1 : 0.38, transition: 'opacity .15s' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: sel ? m.color : 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={m.weather} size={13} style={{ color: sel ? '#fff' : 'var(--ink-soft)' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: sel ? m.color : 'var(--ink-faint)', letterSpacing: '.03em' }}>{m.label}</span>
                </button>
              );
            })}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s on your mind?" rows={5}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 'calc(var(--text-base) * 0.97)', lineHeight: 1.65, color: 'var(--ink)', resize: 'none', fontFamily: 'var(--font-body)' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <Button variant="ghost" onClick={() => { setEditing(false); setTitle(''); setBody(''); setSelectedMood('bright'); }}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>Save</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--ink-faint)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 14.5, color: 'var(--ink-faint)', lineHeight: 1.6 }}>Nothing here yet. When you’re ready, write your first reflection.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          {entries.map((e, index) => {
            const m = moodById(e.mood);
            const errored = errorId === e.id;
            const showBtn = canHover ? hoveredId === e.id : true;
            return (
              <div key={e.id || index} className="card"
                onMouseEnter={() => setHoveredId(e.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ position: 'relative', padding: '20px 22px', minHeight: 140, boxShadow: 'var(--shadow-soft)' }}>

                {/* Delete — removes immediately, no confirmation. Written entries hit
                    the backend; Mood check-in notes are removed from localStorage. */}
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                  <button onClick={() => (e.from === 'Written' ? handleDelete(e, index) : handleDeleteMood(e))}
                    onFocus={() => setHoveredId(e.id)} onBlur={() => setHoveredId(null)}
                    aria-label={`Delete ${e.from === 'Written' ? 'reflection' : 'mood check-in'}: ${e.title || 'Untitled'}`}
                    style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--ink-faint)', cursor: 'pointer', opacity: showBtn ? 1 : 0, transition: 'opacity .18s var(--ease), color .15s, background .15s' }}
                    onMouseEnter={(ev) => { ev.currentTarget.style.color = 'var(--care)'; ev.currentTarget.style.background = 'var(--care-tint)'; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.color = 'var(--ink-faint)'; ev.currentTarget.style.background = 'transparent'; }}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingRight: 40 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={m.weather} size={13} style={{ color: '#fff' }} /></div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)' }}>{formatDate(e.timestamp)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{e.from}</span>
                </div>
                <h3 className="serif" style={{ fontSize: 'calc(var(--text-base) * 1.19)', margin: '0 0 8px' }}>{e.title || 'Untitled'}</h3>
                <p style={{ fontSize: 'calc(var(--text-base) * 0.9)', color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{e.body}</p>

                {errored && (
                  <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--care-deep)' }}>
                    <Icon name="x" size={14} /> Couldn’t delete that — please try again.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ScreenScroll>
  );
}
