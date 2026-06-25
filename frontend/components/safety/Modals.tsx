'use client';
// components/safety/Modals.tsx — grounding, breathing, calming sounds, safety page.
// Ported from design-reference/safety/modals.jsx. Overlays render absolutely
// inside the EmptyChair container (position: relative).
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';

/* ── 5-4-3-2-1 grounding ── */
const GROUNDING_STEPS = [
  { icon: 'eye', sense: 'SEE', count: 5, title: 'Name 5 things you can see', hint: 'Look slowly around you. Colours, shapes, light — anything your eyes land on.' },
  { icon: 'hand', sense: 'FEEL', count: 4, title: 'Name 4 things you can feel', hint: 'The chair beneath you, your feet on the floor, fabric, warmth or cool air.' },
  { icon: 'ear', sense: 'HEAR', count: 3, title: 'Name 3 things you can hear', hint: 'Listen out past the obvious — distant sounds, a hum, your own breath.' },
  { icon: 'wind', sense: 'SMELL', count: 2, title: 'Name 2 things you can smell', hint: 'Take a gentle breath in. Notice any scent in the air around you.' },
  { icon: 'droplet', sense: 'TASTE', count: 1, title: 'Name 1 thing you can taste', hint: 'Or simply take one slow, full breath and let it out.' },
];

export function GroundingExercise({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { overlayRef.current?.focus(); }, []);
  const s = GROUNDING_STEPS[step];
  const isLast = step === GROUNDING_STEPS.length - 1;
  const back = () => setStep((i) => Math.max(0, i - 1));
  const next = () => { if (isLast) onComplete(); else setStep((i) => i + 1); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onSkip();
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'ArrowRight') next();
  };
  return (
    <div ref={overlayRef} tabIndex={-1} onKeyDown={onKey} className="fade-in" role="dialog" aria-modal="true" aria-label={`Grounding exercise: ${s.title}`}
      style={{ position: 'absolute', inset: 0, zIndex: 80, outline: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 28px', background: 'color-mix(in oklab, var(--bg) 90%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
      <div role="status" aria-live="polite" className="sr-only">{`Step ${step + 1} of 5: ${s.title}`}</div>
      <div style={{ position: 'absolute', top: 26, left: 28, right: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label">5 · 4 · 3 · 2 · 1 grounding</span>
        <button onClick={onSkip} aria-label="Skip grounding exercise" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--ink-faint)', background: 'none', border: 'none' }}>Skip <Icon name="x" size={15} /></button>
      </div>
      <div className="scale-in" key={step} style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ width: 92, height: 92, borderRadius: 26, margin: '0 auto 22px', display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)', boxShadow: 'var(--shadow-soft)' }}>
          <Icon name={s.icon} size={42} strokeWidth={1.7} />
        </div>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 14 }}>
          {Array.from({ length: s.count }).map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)' }} />)}
        </div>
        <h2 className="serif" style={{ fontSize: 28, margin: '0 0 10px', color: 'var(--ink)' }}>{s.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 auto', maxWidth: 360 }}>{s.hint}</p>
      </div>
      <div style={{ position: 'absolute', bottom: 40, left: 28, right: 28, maxWidth: 440, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {GROUNDING_STEPS.map((_, i) => <span key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= step ? 'var(--sage)' : 'var(--surface-3)', transition: 'background .3s var(--ease)' }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={back} disabled={step === 0} aria-label="Previous step" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 'var(--r-pill)', fontWeight: 600, fontSize: 14, border: '1px solid var(--line)', background: 'var(--surface)', color: step === 0 ? 'var(--ink-faint)' : 'var(--ink-soft)', opacity: step === 0 ? 0.5 : 1 }}>
            <Icon name="arrow-left" size={16} /> Back
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>Step {step + 1} of 5</span>
          <button onClick={next} aria-label={isLast ? 'Finish' : 'Next step'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 'var(--r-pill)', fontWeight: 700, fontSize: 14, background: 'var(--sage)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-soft)' }}>
            {isLast ? <>Finish <Icon name="check" size={16} strokeWidth={2.2} /></> : <>Next <Icon name="arrow-right" size={16} strokeWidth={2} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── breathing ── */
const BREATH_PHASES = [
  { key: 'in', label: 'Breathe in', hint: 'Slowly fill your lungs', dur: 4000, scale: 1.34 },
  { key: 'hold', label: 'Hold', hint: 'Let it settle', dur: 4000, scale: 1.34 },
  { key: 'out', label: 'Breathe out', hint: 'Release, all the way', dur: 6000, scale: 0.82 },
];

export function BreathingModal({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [scale, setScale] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) { if (timeoutRef.current) clearTimeout(timeoutRef.current); return; }
    const p = BREATH_PHASES[phase];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- breathing animation driver, runs per phase
    setScale(p.scale);
    timeoutRef.current = setTimeout(() => setPhase((i) => (i + 1) % BREATH_PHASES.length), p.dur);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [running, phase]);

  useEffect(() => {
    if (!running) return;
    const tmr = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tmr);
  }, [running]);

  const p = BREATH_PHASES[phase];
  const curDur = running ? p.dur : 600;
  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const toggle = () => { if (!running && phase !== 0) setPhase(0); setRunning((r) => !r); };

  return (
    <div className="fade-in" role="dialog" aria-modal="true" aria-label="Breathing exercise"
      style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 28px', background: 'color-mix(in oklab, var(--bg) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <div style={{ position: 'absolute', top: 26, left: 28, right: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label">Settle your body</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
      </div>
      <div style={{ position: 'relative', width: 260, height: 260, display: 'grid', placeItems: 'center', marginBottom: 30 }}>
        <div aria-hidden="true" style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, color-mix(in oklab, var(--sage) 24%, transparent), color-mix(in oklab, var(--sage) 6%, transparent))', border: '1px solid color-mix(in oklab, var(--sage) 30%, transparent)', transform: `scale(${scale})`, transition: `transform ${curDur}ms ${running ? (p.key === 'hold' ? 'linear' : 'cubic-bezier(.4,0,.4,1)') : 'var(--ease)'}` }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }} aria-live="polite">
          <p className="serif" style={{ fontSize: 26, color: 'var(--sage-deep)', margin: 0 }}>{running ? p.label : 'Ready when you are'}</p>
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '4px 0 0' }}>{running ? p.hint : 'A few slow breaths together'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={toggle} aria-label={running ? 'Pause breathing' : 'Start breathing'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 'var(--r-pill)', fontWeight: 700, fontSize: 14.5, background: 'var(--sage)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-soft)' }}>
          <Icon name={running ? 'pause' : 'play'} size={17} strokeWidth={2} fill="currentColor" />{running ? 'Pause' : 'Start'}
        </button>
        <button onClick={onComplete} aria-label="Finish breathing exercise" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 22px', borderRadius: 'var(--r-pill)', fontWeight: 600, fontSize: 14, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-soft)' }}>
          <Icon name="check" size={16} strokeWidth={2} /> Finish
        </button>
      </div>
    </div>
  );
}

/* ── calming sounds (floating card) ── */
const SOUND_TRACKS = [
  { id: 'rain', label: 'Rain', icon: 'cloud-rain' },
  { id: 'ocean', label: 'Ocean', icon: 'waves' },
  { id: 'forest', label: 'Forest', icon: 'trees' },
];

export function CalmingSounds({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [unavailable, setUnavailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.loop = true; a.preload = 'metadata'; a.volume = 0.7;
    a.addEventListener('error', () => { setUnavailable(true); setPlaying(false); });
    audioRef.current = a;
    return () => { a.pause(); a.src = ''; };
  }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);

  const togglePlay = () => {
    const a = audioRef.current; if (!a || !selected) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setUnavailable(true)); }
  };
  const selectTrack = (id: string) => {
    const a = audioRef.current; if (!a) return;
    setUnavailable(false);
    if (selected === id) { togglePlay(); return; }
    a.pause(); a.src = `/audio/${id}.mp3`; setSelected(id);
    a.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setUnavailable(true); });
  };
  const close = () => { audioRef.current?.pause(); setPlaying(false); onClose(); };

  return (
    <div className="rise card" role="dialog" aria-label="Calming sounds" style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 90, width: 280, padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-lift)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
          <Icon name="waves" size={16} style={{ color: 'var(--sage-deep)' }} /> Calming sounds
        </span>
        <button onClick={close} aria-label="Close calming sounds" style={{ color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 2, background: 'none', border: 'none' }}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SOUND_TRACKS.map((tr) => {
          const active = selected === tr.id;
          return (
            <button key={tr.id} onClick={() => selectTrack(tr.id)} aria-label={`${active && playing ? 'Pause' : 'Play'} ${tr.label} sounds`} aria-pressed={active}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, background: active ? 'var(--sage)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--ink)', border: `1px solid ${active ? 'var(--sage)' : 'var(--line)'}`, transition: 'all .16s var(--ease)' }}>
              <Icon name={tr.icon} size={18} /> {tr.label}
              {active && <span style={{ marginLeft: 'auto' }}><Icon name={playing ? 'pause' : 'play'} size={15} strokeWidth={2} fill="currentColor" /></span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 16px' }}>
        <button onClick={togglePlay} disabled={!selected} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: !selected ? 'var(--surface-3)' : 'var(--sage)', color: !selected ? 'var(--ink-faint)' : '#fff', border: 'none' }}>
          <Icon name={playing ? 'pause' : 'play'} size={15} strokeWidth={2} fill="currentColor" />
        </button>
        <button onClick={() => setVolume((v) => (v === 0 ? 70 : 0))} aria-label={volume === 0 ? 'Unmute' : 'Mute'} style={{ color: 'var(--ink-faint)', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'none', border: 'none' }}>
          <Icon name={volume === 0 ? 'volume-x' : 'volume-2'} size={16} />
        </button>
        <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" className="so-range" style={{ flex: 1, accentColor: 'var(--sage)' }} />
        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{volume}%</span>
      </div>
      {unavailable && <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', padding: '0 16px 12px', margin: 0 }}>Audio for this track isn’t available right now.</p>}
    </div>
  );
}

/* ── safety / support resources page ── */
const SAFETY_RESOURCES = [
  { country: 'Vietnam', service: 'Heart 2 Heart — đường dây nóng tâm lý', phone: '1900 599 920', primary: true },
  { country: 'US · Canada', service: 'Suicide & Crisis Lifeline (call or text)', phone: '988', primary: true },
  { country: 'UK · Ireland', service: 'Samaritans', phone: '116 123' },
  { country: 'Australia', service: 'Lifeline', phone: '13 11 14' },
];

export function SafetyPage({ onBack, onTryGrounding, onTryBreathing }: { onBack: () => void; onTryGrounding: () => void; onTryBreathing: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div ref={ref} tabIndex={-1} className="fade-in no-scrollbar" role="dialog" aria-modal="true" aria-label="Support resources"
      style={{ position: 'absolute', inset: 0, zIndex: 85, overflowY: 'auto', background: 'var(--bg)', outline: 'none' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 26px 48px' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 22, background: 'none', border: 'none' }}>
          <Icon name="arrow-left" size={16} /> Back
        </button>
        <div style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)', marginBottom: 16 }}>
          <Icon name="heart-handshake" size={26} />
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: '0 0 8px', color: 'var(--ink)' }}>You’re not on your own</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)', margin: '0 0 8px' }}>SoulMate is a companion for reflection — not a crisis or emergency service. If things feel like too much, reaching out to a real person can help more than anything.</p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-faint)', margin: '0 0 26px' }}>If you’re in immediate danger, please call your local emergency number or go to the nearest emergency department.</p>
        <p className="label" style={{ marginBottom: 12 }}>Talk to someone now</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
          {SAFETY_RESOURCES.map((r) => (
            <a key={r.country} href={`tel:${r.phone.replace(/\s/g, '')}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 17px', textDecoration: 'none', boxShadow: 'var(--shadow-soft)', borderColor: r.primary ? 'color-mix(in oklab, var(--sage) 32%, transparent)' : 'var(--line)', background: r.primary ? 'var(--sage-tint)' : 'var(--surface)' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--sage-deep)' }}>
                <Icon name="phone" size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{r.country}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)' }}>{r.service}</span>
              </span>
              <span className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--sage-deep)', whiteSpace: 'nowrap' }}>{r.phone}</span>
            </a>
          ))}
        </div>
        <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--sage-deep)', marginBottom: 32 }}>
          Find more crisis centres worldwide <Icon name="external-link" size={14} />
        </a>
        <p className="label" style={{ marginBottom: 12 }}>Settle in the moment</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onTryGrounding} className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', boxShadow: 'var(--shadow-soft)', textAlign: 'left' }}>
            <Icon name="eye" size={20} style={{ color: 'var(--sage-deep)' }} />
            <span><span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Grounding</span><span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>5-4-3-2-1</span></span>
          </button>
          <button onClick={onTryBreathing} className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', boxShadow: 'var(--shadow-soft)', textAlign: 'left' }}>
            <Icon name="wind" size={20} style={{ color: 'var(--sage-deep)' }} />
            <span><span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Breathing</span><span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Settle your body</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}
