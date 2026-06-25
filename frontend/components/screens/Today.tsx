'use client';
// components/screens/Today.tsx — Today dashboard + Mood check-in modal
import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, BreathingOrb, Skeleton } from '../ui/primitives';
import { OceanRadar, type OceanData } from '../ui/Ocean';
import { ScreenScroll } from '../ui/ScreenScroll';
import { MOODS, moodById, greet, getWeekMoods, localDateStr, type Mood } from '../../lib/moods';
import type { ScreenId } from '../SoulMateApp';
import { useUser } from '../../context/UserContext';
import { useTweaks } from '../../context/TweaksContext';

// Per-mood dot sizing for the week strip — size encodes "mood confidence",
// brighter/steadier days read larger, heavier days smaller + dimmer.
const WEEK_DOT: Record<string, { size: number; opacity: number; ring?: boolean }> = {
  radiant: { size: 44, opacity: 1, ring: true },
  bright:  { size: 40, opacity: 1 },
  cloudy:  { size: 36, opacity: 1 },
  low:     { size: 34, opacity: 0.75 },
  heavy:   { size: 32, opacity: 0.6 },
};

// Time-of-day copy for the daily check-in card. Pure — call once at render.
function getTimeGreeting(): { heading: string; sub: string; icon: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return {
    heading: 'How does the morning feel?',
    sub: 'A quick check — no pressure.',
    icon: 'sunrise',
  };
  if (h >= 12 && h < 17) return {
    heading: 'How are you, really?',
    sub: 'A 30-second check-in. No pressure to be anything in particular.',
    icon: 'sun',
  };
  if (h >= 17 && h < 21) return {
    heading: 'How did today land?',
    sub: 'Just a moment to notice how you feel.',
    icon: 'sunset',
  };
  return {
    heading: 'How are you ending the day?',
    sub: 'No right answer. Just whatever is true right now.',
    icon: 'moon',
  };
}

// Note-step prompt, tailored to the picked mood.
const MOOD_PROMPTS: Record<string, string> = {
  radiant: 'Was there a moment today that felt especially alive?',
  bright:  'What kept you steady today?',
  cloudy:  'Anything lingering that you want to put into words?',
  low:     'No pressure — even one sentence is enough.',
  heavy:   "What's been sitting with you today?",
};

// Static invitation line shown as the Today's weather card subtitle, per mood.
const MOOD_INVITATION: Record<string, string> = {
  radiant: 'A little sunshine found you today. Let it stay for a moment.',
  bright:  'There is a soft warmth in today. Maybe notice what feels okay.',
  cloudy:  'A small gentle thing might help the clouds feel less close.',
  low:     'Dim days happen too. Be gentle with yourself today.',
  heavy:   'This storm does not have to be carried all at once. Start with one breath.',
};

// Shared "Your week, gently" dot strip (used by Today + Insight). A dashed SVG
// line links centre-to-centre of consecutive days that both have a check-in;
// gaps around null days are skipped by drawing per-pair segments. Dot size +
// opacity encode the mood (see WEEK_DOT); null days render as a dashed outline.
export function WeekStrip({ days }: { days: { label: string; id: string | null; note: string }[] }) {
  const ROW_H = 52;           // dot-cell height; line + dot centres sit at ROW_H / 2
  const CY = ROW_H / 2;
  const cx = (i: number) => `${((i + 0.5) / days.length) * 100}%`;  // column centre, % of width
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={ROW_H} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
        {days.map((w, i) => {
          const next = days[i + 1];
          if (!w.id || !next?.id) return null;   // only connect two real check-ins
          return <line key={i} x1={cx(i)} y1={CY} x2={cx(i + 1)} y2={CY} stroke="var(--sage)" strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray="4 3" />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, position: 'relative', zIndex: 1 }}>
        {days.map((w, i) => {
          const m = w.id ? moodById(w.id) : null;
          const cfg = m ? WEEK_DOT[m.id] : null;
          const size = cfg?.size ?? 32;
          return (
            <div key={i} title={w.note || undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div aria-label={m ? undefined : 'No check-in yet'} style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: m ? m.color : 'transparent',
                  opacity: m ? cfg!.opacity : 0.4,
                  border: m ? 'none' : '1.5px dashed var(--line-strong)',
                  boxShadow: m && cfg?.ring ? `0 0 0 5px color-mix(in oklab, ${m.color} 20%, transparent)` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {m && <Icon name={m.weather} size={Math.round(size * 0.36)} style={{ color: '#fff' }} />}
                </div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-faint)' }}>{w.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TodayProps {
  name: string;
  todayMood: string | null;
  ocean: OceanData;
  narrative?: string;
  oceanLoaded?: boolean;
  oceanError?: string | null;
  onNavigate: (s: ScreenId) => void;
  onCheckIn: () => void;
}

export function TodayScreen({ name, todayMood: todayMoodProp, ocean, narrative = '', oceanLoaded = true, oceanError = null, onNavigate, onCheckIn }: TodayProps) {
  // Read today's check-in from localStorage only after mount — the parent seeds
  // todayMood to null and never reads storage, so on reload the card would revert
  // to the "How are you, really?" state. Initialising to null keeps SSR and the
  // first client paint identical (no hydration mismatch), then we hydrate from
  // storage. The prop is still synced below so the in-session check-in flips the
  // card immediately, and the 'reflection-saved' listener catches other writes.
  const [todayMood, setTodayMood] = useState<string | null>(null);
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
    const entry = history.findLast(
      (e: { date: string; mood: string }) => e.date === localDateStr()
    );
    if (entry) setTodayMood(entry.mood);

    const handler = () => {
      const h = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
      const e = h.findLast((e: { date: string; mood: string }) => e.date === localDateStr());
      if (e) setTodayMood(e.mood);
    };
    window.addEventListener('reflection-saved', handler);
    return () => window.removeEventListener('reflection-saved', handler);
  }, []);
  // Mirror in-session check-ins pushed down from the parent modal.
  useEffect(() => { if (todayMoodProp) setTodayMood(todayMoodProp); }, [todayMoodProp]);

  const mood = todayMood ? moodById(todayMood) : null;
  const { userId } = useUser();
  const { tweaks } = useTweaks();
  // Focus mode forces the calm single-column layout (minimal chrome).
  const dashboard = tweaks.focusMode ? 'calm' : tweaks.dashboard;
  const [reflectOpen, setReflectOpen] = useState(false);
  const greeting = getTimeGreeting();

  // Read the week's moods from localStorage only after mount — calling
  // getWeekMoods() during render runs on the server (no localStorage), so the
  // strip would hydrate empty and mismatch. The 'reflection-saved' listener
  // refreshes the strip the moment a new check-in lands, without a reload.
  const [weekMoods, setWeekMoods] = useState<ReturnType<typeof getWeekMoods>>([]);
  useEffect(() => {
    setWeekMoods(getWeekMoods());
    const handler = () => setWeekMoods(getWeekMoods());
    window.addEventListener('reflection-saved', handler);
    return () => window.removeEventListener('reflection-saved', handler);
  }, []);

  const Greeting = (
    <div style={{ marginBottom: 28 }}>
      <p className="label" style={{ marginBottom: 6 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <h1 className="serif" style={{ fontSize: 38, margin: 0, lineHeight: 1.1 }}>{`${greet()}, ${name}.`}</h1>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 520, lineHeight: 1.55 }}>
        {mood ? `You checked in as ${mood.label.toLowerCase()} today. Whatever you're carrying, there's room for it here.`
          : 'However today is landing for you, this is a place to slow down and notice it.'}
      </p>
    </div>
  );

  const CheckInCard = (
    <div className="card" style={{ padding: '28px 30px', position: 'relative', overflow: 'hidden', background: mood ? `linear-gradient(135deg, color-mix(in oklab, ${mood.color} 14%, var(--surface)), var(--surface))` : 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <BreathingOrb size={92} tone={mood ? mood.color : 'var(--sage)'}>
          {mood ? <Icon name={mood.weather} size={28} style={{ color: mood.color }} /> : <Icon name={greeting.icon} size={26} style={{ color: 'var(--sage)' }} />}
        </BreathingOrb>
        <div style={{ flex: 1 }}>
          <p className="label" style={{ marginBottom: 6 }}>{mood ? 'Today’s weather' : 'Daily check-in'}</p>
          <h2 className="serif" style={{ fontSize: 'calc(var(--text-base) * 1.5)', margin: '0 0 4px' }}>{mood ? `Feeling ${mood.label.toLowerCase()}` : greeting.heading}</h2>
          <p style={{ fontSize: 'calc(var(--text-base) * 0.875)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>{mood ? (MOOD_INVITATION[mood.id] ?? 'How are you really feeling today?') : greeting.sub}</p>
          <Button variant={mood ? 'soft' : 'primary'} iconRight={mood ? 'refresh' : 'arrowR'} onClick={onCheckIn}>{mood ? 'Update check-in' : 'Check in'}</Button>
        </div>
      </div>
    </div>
  );

  const TalkCard = (
    <button className="card" onClick={() => onNavigate('companion')} style={{ padding: '24px 26px', textAlign: 'left', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
      <IconBadge name="chat" tone="sage" size={48} iconSize={22} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Talk it through</div>
        <div style={{ fontSize: 'calc(var(--text-base) * 0.84)', color: 'var(--ink-soft)', marginTop: 2 }}>Say whatever’s on your mind. I’m listening.</div>
      </div>
      <Icon name="arrowR" size={18} style={{ color: 'var(--ink-faint)' }} />
    </button>
  );

  const ReflectCard = (
    <button className="card" onClick={() => setReflectOpen(true)} style={{ padding: '24px 26px', textAlign: 'left', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
      <IconBadge name="feather" tone="clay" size={48} iconSize={22} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Write a reflection</div>
        <div style={{ fontSize: 'calc(var(--text-base) * 0.84)', color: 'var(--ink-soft)', marginTop: 2 }}>Put the day into words, just for you.</div>
      </div>
      <Icon name="arrowR" size={18} style={{ color: 'var(--ink-faint)' }} />
    </button>
  );

  const WeekCard = (
    <div className="card" style={{ padding: '24px 26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p className="label">Your week, gently</p>
      </div>
      <WeekStrip days={weekMoods} />
    </div>
  );

  const InsightCard = (
    <button className="card" onClick={() => onNavigate('insights')} style={{ padding: '24px 26px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 18, alignItems: 'center' }}>
      <div style={{ width: 96, height: 96, flexShrink: 0 }}><OceanRadar data={ocean} size={96} showLabels={false} /></div>
      <div style={{ flex: 1 }}>
        <p className="label" style={{ marginBottom: 6 }}>How I’m getting to know you</p>
        {!oceanLoaded && !oceanError ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton height={12} /><Skeleton height={12} width="68%" />
          </div>
        ) : oceanError || !narrative.trim() ? (
          <div style={{ fontSize: 'calc(var(--text-base) * 0.9)', color: 'var(--ink-faint)', lineHeight: 1.5 }}>Not enough conversations yet.</div>
        ) : (
          <div style={{ fontSize: 'calc(var(--text-base) * 0.9)', color: 'var(--ink)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{narrative}</div>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 600, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>See your insight<Icon name="chevR" size={14} /></span>
      </div>
    </button>
  );

  const reflectionModal = reflectOpen ? <QuickReflection userId={userId} onClose={() => setReflectOpen(false)} /> : null;

  if (dashboard === 'bento') {
    return (
      <ScreenScroll>
        {Greeting}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          <div style={{ gridColumn: '1 / 2', gridRow: '1 / 3' }}>{CheckInCard}</div>
          <div>{TalkCard}</div>
          <div>{ReflectCard}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>{WeekCard}{InsightCard}</div>
        {reflectionModal}
      </ScreenScroll>
    );
  }
  return (
    <ScreenScroll>
      {Greeting}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
        {CheckInCard}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{TalkCard}{ReflectCard}</div>
        {WeekCard}
        {InsightCard}
      </div>
      {reflectionModal}
    </ScreenScroll>
  );
}

/* ============================================================
   MOOD CHECK-IN FLOW (modal overlay) — 4 input styles
   ============================================================ */
// Keyed by the real mood ids (radiant/bright/cloudy/low/heavy). 'bright' is the
// "Steady" label, so it gets the steady-toned lines.
const AUTO_NOTES: Record<string, string[]> = {
  radiant: ["Something lit you up today.", "A bright day — good.", "You're glowing today."],
  bright:  ["Steady as you go.", "A calm, even kind of day.", "Grounded and present."],
  cloudy:  ["A cloudy kind of day — that's okay.", "Foggy, but still here.", "Not every day is clear."],
  low:     ["Feeling low today. That's valid.", "Some days just weigh more.", "Low tide. It'll come back."],
  heavy:   ["Carrying something heavy. That takes strength.", "A hard day. You showed up anyway.", "Heavy, but still here."]
};

// A gentle mock note for a mood — used ONLY when the user leaves the note blank
// AND there is no existing saved note for today to preserve.
const autoNote = (moodId: string): string => {
  const options = AUTO_NOTES[moodId] || ["A quiet kind of day."];
  return options[Math.floor(Math.random() * options.length)];
};

export function MoodCheckIn({ style = 'weather', onClose, onComplete }: { style?: string; onClose: () => void; onComplete: (id: string, next: 'talk' | 'done') => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const mood = picked ? moodById(picked) : null;

  // Persist the check-in (mood + note) to localStorage, then hand control back to
  // close/navigate. The user-written note always wins; if it's empty/whitespace we
  // fall back to today's previously-saved note, and only then to a mock note — so a
  // blank re-check-in can never overwrite a real note the user already wrote.
  const commit = (next: 'talk' | 'done') => {
    if (!picked) return;
    const today = localDateStr();
    const history = JSON.parse(localStorage.getItem('soulmate_moods') || '[]');
    const existing = history.findLast((e: { date: string; note?: string }) => e.date === today);
    const cleanNote = note.trim();
    const finalNote = cleanNote.length > 0 ? cleanNote : (existing?.note || autoNote(picked));
    const entry = { date: today, mood: picked, note: finalNote };
    // Replace today's entry instead of appending — avoids duplicate same-day rows
    // and keeps every reader (which use findLast) consistent.
    const updated = history.filter((e: { date: string }) => e.date !== today);
    updated.push(entry);
    localStorage.setItem('soulmate_moods', JSON.stringify(updated));
    // Notify in-page listeners (WeekStrip + the TODAY'S WEATHER card) so they
    // re-read localStorage immediately — no reload or navigation needed.
    window.dispatchEvent(new Event('reflection-saved'));
    onComplete(picked, next);
  };

  const reflectBack = mood ? ({
    radiant: 'That’s lovely to hear. Let’s hold onto what made today feel light.',
    bright: 'Steady is a good place to be. Thank you for checking in with yourself.',
    cloudy: 'In-between days are completely valid. You don’t have to figure it all out right now.',
    low: 'That sounds tender. I’m glad you told me — you don’t have to carry it quietly.',
    heavy: 'I’m really glad you’re here. That’s a lot to feel. Let’s take it gently, together.',
  } as Record<string, string>)[mood.id] : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'color-mix(in oklab, var(--ink) 32%, transparent)', backdropFilter: 'blur(6px)' }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 560, padding: '34px 36px', boxShadow: 'var(--shadow-lift)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 20, right: 20, background: 'var(--surface-2)', border: 'none', borderRadius: 99, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}><Icon name="x" size={17} /></button>

        {step === 0 && (
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Daily check-in</p>
            <h2 className="serif" style={{ fontSize: 'calc(var(--text-base) * 1.69)', margin: '0 0 4px' }}>How are you, really?</h2>
            <p style={{ fontSize: 'calc(var(--text-base) * 0.875)', color: 'var(--ink-soft)', marginBottom: 26 }}>There’s no right answer. Just whatever’s true right now.</p>
            <MoodPicker style={style} picked={picked} onPick={setPicked} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }}>Maybe later</button>
              <Button variant="primary" iconRight="arrowR" disabled={!picked} onClick={() => setStep(1)}>Next</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="label" style={{ marginBottom: 8 }}>A little more, if you’d like</p>
            <h2 className="serif" style={{ fontSize: 'calc(var(--text-base) * 1.56)', margin: '0 0 18px' }}>Want to say what’s behind it?</h2>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={(picked && MOOD_PROMPTS[picked]) ?? 'Anything you want to add?'} rows={4}
              style={{ width: '100%', padding: 16, borderRadius: 'var(--r-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.6, resize: 'none', fontFamily: 'var(--font-body)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
              <Button variant="ghost" icon="arrowL" onClick={() => setStep(0)}>Back</Button>
              <Button variant="primary" iconRight="check" onClick={() => setStep(2)}>{note.trim() ? 'Save check-in' : 'Skip & save'}</Button>
            </div>
          </div>
        )}

        {step === 2 && mood && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <BreathingOrb size={96} tone={mood.color} active><Icon name={mood.weather} size={28} style={{ color: mood.color }} /></BreathingOrb>
            </div>
            <h2 className="serif" style={{ fontSize: 'calc(var(--text-base) * 1.5)', margin: '0 0 10px' }}>{`Checked in: ${mood.label.toLowerCase()}`}</h2>
            <p style={{ fontSize: 'calc(var(--text-base) * 0.94)', color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 24px' }}>{reflectBack}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="soft" icon="chat" onClick={() => commit('talk')}>Talk about it</Button>
              <Button variant="primary" onClick={() => commit('done')}>Done for now</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodPicker({ style, picked, onPick }: { style: string; picked: string | null; onPick: (id: string) => void }) {
  if (style === 'slider') {
    const idx = picked ? MOODS.findIndex((m) => m.id === picked) : 2;
    const cur: Mood = MOODS[4 - idx] || MOODS[2];
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <BreathingOrb size={90} tone={cur.color}><Icon name={cur.weather} size={26} style={{ color: cur.color }} /></BreathingOrb>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 16, fontFamily: 'var(--font-display)', fontSize: 20 }}>{cur.label}</div>
        <input type="range" min={0} max={4} step={1} value={4 - idx} onChange={(e) => onPick(MOODS[4 - Number(e.target.value)].id)} style={{ width: '100%', accentColor: cur.color, height: 6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>
          <span>Heavy</span><span>Radiant</span>
        </div>
      </div>
    );
  }
  if (style === 'words') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MOODS.map((m) => {
          const on = picked === m.id;
          return (
            <button key={m.id} onClick={() => onPick(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 'var(--r-md)', textAlign: 'left', border: `1.5px solid ${on ? m.color : 'var(--line)'}`, background: on ? `color-mix(in oklab, ${m.color} 12%, var(--surface))` : 'var(--surface)', transition: 'all .2s var(--ease)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 15, width: 92 }}>{m.label}</span>
              <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{m.word}</span>
            </button>
          );
        })}
      </div>
    );
  }
  // weather (default) & emoji share a row layout
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
      {MOODS.map((m) => {
        const on = picked === m.id;
        return (
          <button key={m.id} onClick={() => onPick(m.id)} aria-pressed={on} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 6px', borderRadius: 'var(--r-md)', border: `1.5px solid ${on ? m.color : 'var(--line)'}`, background: on ? `color-mix(in oklab, ${m.color} 14%, var(--surface))` : 'var(--surface)', transition: 'all .2s var(--ease)', transform: on ? 'translateY(-2px)' : 'none' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: on ? m.color : `color-mix(in oklab, ${m.color} 16%, var(--surface-2))`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
              {style === 'emoji' ? <span style={{ fontSize: 22 }}>{m.emoji}</span> : <Icon name={m.weather} size={22} style={{ color: on ? '#fff' : m.color }} />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-soft)' }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   QUICK REFLECTION (modal overlay) — writes straight to the backend
   without leaving the Today screen.
   ============================================================ */
function QuickReflection({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() && !body.trim()) { onClose(); return; }
    setSaving(true);
    // Never POST an empty title — fall back to the start of the body, then a default.
    const finalTitle = title.trim() || body.trim().slice(0, 30) || 'A quiet moment';
    try {
      await fetch(`http://localhost:8000/api/reflections/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: finalTitle, body, mood: '' }),
      });
      window.dispatchEvent(new Event('reflection-saved'));  // tell the Reflections screen to refetch
    } catch { /* swallow network errors — still close the modal */ }
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'color-mix(in oklab, var(--ink) 32%, transparent)', backdropFilter: 'blur(6px)' }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 560, padding: '28px 30px', boxShadow: 'var(--shadow-lift)', position: 'relative', borderLeft: '3px solid var(--clay)' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 18, right: 18, background: 'var(--surface-2)', border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}><Icon name="x" size={16} /></button>
        <p className="label" style={{ marginBottom: 12 }}>Write a reflection</p>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, if you like…"
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 'calc(var(--text-base) * 1.375)', color: 'var(--ink)', marginBottom: 10 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s on your mind?" rows={5}
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 'calc(var(--text-base) * 0.97)', lineHeight: 1.65, color: 'var(--ink)', resize: 'none', fontFamily: 'var(--font-body)' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
