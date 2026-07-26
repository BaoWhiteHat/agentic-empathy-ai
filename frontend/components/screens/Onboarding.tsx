'use client';
// components/screens/Onboarding.tsx — guided + conversational onboarding.
// The captured name becomes the userId for the backend session.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, BreathingOrb } from '../ui/primitives';

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
  const steps = ['welcome', 'about', 'consent', 'name', 'reasons', 'ready'];
  const total = steps.length;
  const cur = steps[step];
  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleReason = (r: string) => setReasons((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);

  return (
    <div className="onboarding-shell" style={{ background: 'radial-gradient(120% 90% at 50% -10%, var(--bg-tint), var(--bg))' }}>
      <div className="onboarding-column">
        {step > 0 && (
          <div
            className="onboarding-progress"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={total - 1}
            aria-valuenow={step}
          >
            {steps.slice(1).map((_, i) => (
              <div key={i} style={{ height: 4, width: i + 1 <= step ? 26 : 14, borderRadius: 99, background: i + 1 <= step ? 'var(--sage)' : 'var(--line-strong)', transition: 'all .4s var(--ease)' }} />
            ))}
          </div>
        )}
        <div key={cur} className="onboarding-card fade-up card">
          {cur === 'welcome' && <StepWelcome onNext={next} />}
          {cur === 'about' && <StepAbout />}
          {cur === 'consent' && <StepConsent />}
          {cur === 'name' && <StepName name={name} setName={setName} />}
          {cur === 'reasons' && <StepReasons reasons={reasons} toggleReason={toggleReason} />}
          {cur === 'ready' && <StepReady name={name} />}
        </div>
        {cur !== 'welcome' && (
          <div className="onboarding-nav">
            <Button variant="ghost" icon="arrowL" onClick={back}>Back</Button>
            {cur === 'ready'
              ? <Button variant="primary" size="lg" iconRight="arrowR" onClick={() => onComplete(name.trim() || 'friend')}>Enter SoulMate</Button>
              : <Button variant="primary" iconRight="arrowR" onClick={next} disabled={cur === 'name' && !name.trim()}>{cur === 'consent' ? 'I understand and continue' : 'Continue'}</Button>}
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

function StepConsent() {
  return (
    <div>
      <p className="label" style={{ marginBottom: 10 }}>YOUR DATA, YOUR CHOICE</p>
      <h2 className="serif" style={{ fontSize: 28, margin: '0 0 12px' }}>How SoulMate uses your text</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '18px 0 20px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <IconBadge name="compass" tone="sage" size={42} iconSize={19} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>SoulMate uses what you write to:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 9 }}>
            {['generate supportive replies', 'maintain conversation continuity', 'update memory and personality signals when relevant'].map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sage)', flex: '0 0 auto', marginTop: 7 }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: '13px 15px', borderRadius: 'var(--r-md)', border: '1px solid var(--care-soft)', background: 'var(--care-tint)', fontSize: 12.8, color: 'var(--ink-soft)', display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5 }}>
        <Icon name="shieldCheck" size={16} style={{ color: 'var(--care-deep)', flex: '0 0 auto', marginTop: 1 }} />
        <span>When you continue, you understand that your conversation text may support memory, personalisation, and safety-aware responses.</span>
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
      <div className="onboarding-chip-grid">
        {REASONS.map((r) => {
          const on = reasons.includes(r);
          return (
            <button
              key={r}
              type="button"
              className="onboarding-chip"
              aria-pressed={on}
              onClick={() => toggleReason(r)}
              style={{ border: `1px solid ${on ? 'transparent' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)' }}
            >
              {on && <Icon name="check" size={15} stroke={2.4} />}{r}
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
    "SoulMate uses what you write to generate supportive replies, maintain conversation continuity, and update memory or personality signals when relevant.",
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
    <div className="onboarding-conversational" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 620, margin: '0 auto', padding: '40px 24px' }}>
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
            : <Button variant="soft" onClick={() => setShown((s) => s + 1)}>{shown === 3 ? 'I understand and continue' : 'Okay'}</Button>}
      </div>
    </div>
  );
}
