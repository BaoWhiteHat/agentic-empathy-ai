'use client';
// components/screens/Onboarding.tsx — guided + conversational onboarding.
// The captured name becomes the userId for the backend session.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, Pill, Toggle, BreathingOrb } from '../ui/primitives';

const REASONS = ['Daily reflection', 'Stress & overwhelm', 'Feeling lonely', 'Sleep & rest', 'Understanding myself', 'Just curious'];

export function OnboardingShell({ style, onComplete }: { style: string; onComplete: (name: string) => void }) {
  return style === 'conversational'
    ? <OnboardingConversational onComplete={onComplete} />
    : <OnboardingGuided onComplete={onComplete} />;
}

// ---- Guided (paged, calm cards) ----
function OnboardingGuided({ onComplete }: { onComplete: (name: string) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [consent, setConsent] = useState({ memory: true, personality: true, anonymised: false });
  const [rhythm, setRhythm] = useState('gentle');
  const steps = ['welcome', 'about', 'consent', 'name', 'reasons', 'rhythm', 'ready'];
  const total = steps.length;
  const cur = steps[step];
  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleReason = (r: string) => setReasons((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'radial-gradient(120% 90% at 50% -10%, var(--bg-tint), var(--bg))' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {step > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
            {steps.slice(1).map((_, i) => (
              <div key={i} style={{ height: 4, width: i + 1 <= step ? 26 : 14, borderRadius: 99, background: i + 1 <= step ? 'var(--sage)' : 'var(--line-strong)', transition: 'all .4s var(--ease)' }} />
            ))}
          </div>
        )}
        <div key={cur} className="fade-up card" style={{ padding: '44px 40px', borderRadius: 'var(--r-xl)' }}>
          {cur === 'welcome' && <StepWelcome onNext={next} />}
          {cur === 'about' && <StepAbout />}
          {cur === 'consent' && <StepConsent consent={consent} setConsent={setConsent} />}
          {cur === 'name' && <StepName name={name} setName={setName} />}
          {cur === 'reasons' && <StepReasons reasons={reasons} toggleReason={toggleReason} />}
          {cur === 'rhythm' && <StepRhythm rhythm={rhythm} setRhythm={setRhythm} />}
          {cur === 'ready' && <StepReady name={name} />}
        </div>
        {cur !== 'welcome' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <Button variant="ghost" icon="arrowL" onClick={back}>Back</Button>
            {cur === 'ready'
              ? <Button variant="primary" size="lg" iconRight="arrowR" onClick={() => onComplete(name.trim() || 'friend')}>Enter SoulMate</Button>
              : <Button variant="primary" iconRight="arrowR" onClick={next} disabled={cur === 'name' && !name.trim()}>{cur === 'consent' ? 'I agree' : 'Continue'}</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
        <BreathingOrb size={110} tone="var(--sage)"><Icon name="heart" size={30} fill="var(--sage)" stroke={0} /></BreathingOrb>
      </div>
      <h1 className="serif" style={{ fontSize: 40, margin: '0 0 14px', lineHeight: 1.1 }}>Hello. You found a quiet corner.</h1>
      <p style={{ fontSize: 16.5, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 30px' }}>SoulMate is a calm space to notice how you feel, talk things through, and understand yourself a little better — at your own pace.</p>
      <Button variant="primary" size="lg" iconRight="arrowR" onClick={onNext}>Begin</Button>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 22 }}>Takes about a minute. Nothing is shared with anyone.</p>
    </div>
  );
}

function StepAbout() {
  const rows = [
    { icon: 'leaf', tone: 'sage' as const, t: 'A companion for everyday reflection', d: 'Somewhere to think out loud, check in with your feelings, and feel a little less alone.' },
    { icon: 'shieldHeart', tone: 'clay' as const, t: 'Not a therapist or medical service', d: 'SoulMate offers emotional support, not diagnosis or treatment. For clinical care, a human professional is always best.' },
    { icon: 'phone', tone: 'care' as const, t: 'It will guide you to real help when it matters', d: 'If things ever feel overwhelming, SoulMate gently points you toward people and crisis lines who can be there in person.' },
  ];
  return (
    <div>
      <p className="label" style={{ marginBottom: 10 }}>Before we begin</p>
      <h2 className="serif" style={{ fontSize: 28, margin: '0 0 24px' }}>What SoulMate is — and isn’t</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <IconBadge name={r.icon} tone={r.tone} size={42} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 3 }}>{r.t}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{r.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsentRow({ icon, title, desc, on, onChange, required }: { icon: string; title: string; desc: string; on: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
      <IconBadge name={icon} tone="sage" size={38} iconSize={18} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</span>
          {required && <Pill tone="neutral" style={{ fontSize: 10, padding: '2px 8px' }}>Needed</Pill>}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function StepConsent({ consent, setConsent }: { consent: { memory: boolean; personality: boolean; anonymised: boolean }; setConsent: (c: { memory: boolean; personality: boolean; anonymised: boolean }) => void }) {
  return (
    <div>
      <p className="label" style={{ marginBottom: 10 }}>Your data, your choice</p>
      <h2 className="serif" style={{ fontSize: 28, margin: '0 0 8px' }}>What may SoulMate remember?</h2>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 8 }}>You can change any of this later, and clear everything at any time.</p>
      <ConsentRow icon="archive" title="Remember our conversations" desc="So SoulMate can recall context like “your exams” instead of asking again." on={consent.memory} onChange={(v) => setConsent({ ...consent, memory: v })} required />
      <ConsentRow icon="compass" title="Learn my personality over time" desc="A gentle reading of how you tend to express yourself, used only to soften how SoulMate replies." on={consent.personality} onChange={(v) => setConsent({ ...consent, personality: v })} />
      <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Icon name="lock" size={14} /> Stored privately on your account. Never sold, never shared.
      </div>
    </div>
  );
}

function StepName({ name, setName }: { name: string; setName: (v: string) => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 className="serif" style={{ fontSize: 30, margin: '8px 0 10px' }}>What should I call you?</h2>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 26 }}>A first name or nickname is perfect. This is just between us.</p>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Linh"
        style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 26, padding: 16, borderRadius: 'var(--r-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }} />
    </div>
  );
}

function StepReasons({ reasons, toggleReason }: { reasons: string[]; toggleReason: (r: string) => void }) {
  return (
    <div>
      <h2 className="serif" style={{ fontSize: 28, margin: '4px 0 8px' }}>What brings you here lately?</h2>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 24 }}>Pick anything that fits — or nothing at all. There are no wrong answers.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {REASONS.map((r) => {
          const on = reasons.includes(r);
          return (
            <button key={r} onClick={() => toggleReason(r)} style={{ padding: '12px 18px', borderRadius: 99, fontSize: 14.5, fontWeight: 500, border: `1px solid ${on ? 'transparent' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)', transition: 'all .2s var(--ease)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {on && <Icon name="check" size={15} stroke={2.4} />}{r}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepRhythm({ rhythm, setRhythm }: { rhythm: string; setRhythm: (v: string) => void }) {
  const opts = [
    { id: 'gentle', t: 'A gentle presence', d: 'A calm space that greets you warmly when you arrive.', icon: 'leaf' },
    { id: 'minimal', t: 'Only when I open the app', d: 'SoulMate waits quietly until you come to it.', icon: 'moon' },
    { id: 'present', t: 'A little more present', d: 'A soft morning and evening check-in to return to.', icon: 'sun' },
  ];
  return (
    <div>
      <h2 className="serif" style={{ fontSize: 28, margin: '4px 0 6px' }}>How present should I be?</h2>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 22, lineHeight: 1.55 }}>SoulMate is here to support you — not to keep you here. It gently points back toward real life and real people.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {opts.map((o) => {
          const on = rhythm === o.id;
          return (
            <button key={o.id} onClick={() => setRhythm(o.id)} style={{ display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', padding: '16px 18px', borderRadius: 'var(--r-md)', border: `1.5px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: on ? 'var(--sage-tint)' : 'var(--surface)', transition: 'all .2s var(--ease)' }}>
              <IconBadge name={o.icon} tone={on ? 'sage' : 'neutral'} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{o.t}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 }}>{o.d}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? 'var(--sage)' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="check" size={12} stroke={3} style={{ color: '#fff' }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepReady({ name }: { name: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <BreathingOrb size={100} tone="var(--clay)"><Icon name="sparkle" size={28} fill="var(--clay)" stroke={0} /></BreathingOrb>
      </div>
      <h2 className="serif" style={{ fontSize: 32, margin: '0 0 12px' }}>{`You're all set${name ? ', ' + name : ''}.`}</h2>
      <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>Whenever you’re ready, take a breath and step in. There’s no right way to do this — just begin where you are.</p>
    </div>
  );
}

// ---- Conversational variant ----
function OnboardingConversational({ onComplete }: { onComplete: (name: string) => void }) {
  const script = [
    "Hi — I'm SoulMate. I'm really glad you're here.",
    "Before anything else: I'm a companion for everyday reflection, not a therapist or a medical service. If things ever get heavy, I'll help you reach real people who can support you.",
    "Everything you share stays private to you, and you can clear it anytime. Is it okay if I remember our conversations so I don't keep asking the same things?",
    "Wonderful. What should I call you?",
    "It's lovely to meet you. Whenever you're ready, we can begin — gently, at your pace.",
  ];
  const [shown, setShown] = useState(1);
  const [name, setName] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [shown]);
  const atName = shown === 4;
  const done = shown >= script.length;
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 620, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'flex-end' }}>
        {script.slice(0, shown).map((m, i) => (
          <div key={i} className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <IconBadge name="heart" tone="sage" size={36} iconSize={16} />
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '4px 20px 20px 20px', padding: '14px 18px', fontSize: 15.5, lineHeight: 1.6, maxWidth: '85%', boxShadow: 'var(--shadow-soft)' }}>{m}</div>
          </div>
        ))}
        {atName && (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name…" onKeyDown={(e) => e.key === 'Enter' && name.trim() && setShown(5)}
            style={{ alignSelf: 'flex-end', padding: '12px 18px', borderRadius: 99, border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 15, width: 240 }} />
        )}
        <div ref={endRef} />
      </div>
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
        {done
          ? <Button variant="primary" size="lg" iconRight="arrowR" onClick={() => onComplete(name.trim() || 'friend')}>Step in</Button>
          : atName
            ? <Button variant="primary" onClick={() => name.trim() && setShown(5)} disabled={!name.trim()}>Continue</Button>
            : <Button variant="soft" onClick={() => setShown((s) => s + 1)}>{shown === 3 ? 'Yes, that’s okay' : 'Okay'}</Button>}
      </div>
    </div>
  );
}
