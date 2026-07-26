'use client';
// components/screens/Safety.tsx — calm crisis-support resource screen
import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, Pill } from '../ui/primitives';
import { ConfirmResume, SafetySupportPanel } from '../safety/SafetyBits';
import { BreathingModal, CalmingSounds, GroundingExercise } from '../safety/Modals';
import { SUPPORT_OPTIONS, type SupportOption } from '../../lib/safetyRouter';

export interface CrisisSupportSession {
  targetName: string;
  onEndSession: () => void;
  onResumeSession: () => void;
}

interface SafetyScreenProps {
  onBack?: () => void;
  crisisSupport?: CrisisSupportSession;
}

export function SafetyScreen({ onBack, crisisSupport }: SafetyScreenProps) {
  const [panelOpen, setPanelOpen] = useState(Boolean(crisisSupport));
  const [confirmResume, setConfirmResume] = useState(false);
  const [exercise, setExercise] = useState<'grounding' | 'breathing' | null>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const lines = [
    { region: 'Vietnam', name: 'Vietnam: 096 306 1414', num: '', hours: 'Public support number' },
    { region: 'US', name: 'US: 988 (Suicide & Crisis Lifeline)', num: '', hours: '24/7' },
    { region: 'International', name: 'Befrienders Worldwide', num: 'befrienders.org', hours: 'Find a local line' },
  ];
  const grounding = [
    { icon: 'wind', t: 'Breathe with me', d: 'A slow 4–7–8 breath, for one minute.' },
    { icon: 'waves', t: '5–4–3–2–1 grounding', d: 'Name what you can see, touch, hear, smell, taste.' },
    { icon: 'volume', t: 'Calming sounds', d: 'Soft rain or warm tones to settle the body.' },
  ];

  const chooseOption = (action: SupportOption['action']) => {
    if (action === 'try_grounding') return setExercise('grounding');
    if (action === 'try_breathing') return setExercise('breathing');
    if (action === 'play_sounds') return setSoundsOpen(true);
    if (action === 'open_safety') return setPanelOpen(false);
    if (action === 'end_session') {
      crisisSupport?.onEndSession();
      onBack?.();
    }
  };

  const resumeSession = () => {
    crisisSupport?.onResumeSession();
    onBack?.();
  };

  return (
    <div className="safety-screen no-scrollbar" style={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      <div className="safety-page" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 64px' }}>
        {onBack && <Button variant="ghost" icon="arrowL" size="sm" onClick={onBack} style={{ marginBottom: 20 }}>Back</Button>}
        <div className="safety-heading" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
          <IconBadge name="shieldHeart" tone="care" size={52} iconSize={26} />
          <div>
            <h1 className="serif" style={{ fontSize: 30, margin: 0 }}>You don’t have to carry this alone</h1>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: '4px 0 0' }}>If you’re in danger or thinking about harming yourself, please reach a person now.</p>
          </div>
        </div>
        <div className="safety-emergency-card" style={{ background: 'var(--care-tint)', border: '1px solid var(--care-soft)', borderRadius: 'var(--r-lg)', padding: '20px 22px', margin: '20px 0 28px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Icon name="phone" size={22} style={{ color: 'var(--care)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>If this is an emergency</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Call your local emergency number, or one of the lines below. They are free, confidential, and there for you.</div>
          </div>
        </div>
        <p className="label" style={{ marginBottom: 12 }}>People who can help</p>
        <div style={{ display: 'grid', gap: 12, marginBottom: 34 }}>
          {lines.map((l, i) => (
            <div key={i} className="safety-resource-card card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: 'var(--shadow-soft)' }}>
              <Pill tone="neutral" style={{ fontSize: 10 }}>{l.region}</Pill>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{l.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{l.hours}</div>
              </div>
              {l.num && <div className="safety-resource-value" style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--care)', fontWeight: 500, whiteSpace: 'nowrap' }}>{l.num}</div>}
            </div>
          ))}
        </div>
        <p className="label" style={{ marginBottom: 12 }}>Or, settle your body for a moment</p>
        <div className="safety-grounding-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {grounding.map((g, i) => (
            <button key={i} className="card" style={{ padding: '20px 16px', textAlign: 'left', boxShadow: 'var(--shadow-soft)' }}>
              <IconBadge name={g.icon} tone="sage" size={40} iconSize={19} />
              <div style={{ fontWeight: 600, fontSize: 14.5, margin: '12px 0 4px', color: 'var(--ink)' }}>{g.t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{g.d}</div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 34, lineHeight: 1.6 }}>SoulMate is a supportive companion, not a crisis service. When you’re in crisis, a trained human is the right kind of help — and reaching out is a brave, kind thing to do for yourself.</p>
      </div>
      {crisisSupport && panelOpen && !confirmResume && !exercise && !soundsOpen && (
        <SafetySupportPanel
          overSafetyPage
          targetName={crisisSupport.targetName}
          options={SUPPORT_OPTIONS}
          onChoose={chooseOption}
          onRequestResume={() => setConfirmResume(true)}
          onClose={() => setPanelOpen(false)}
        />
      )}
      {crisisSupport && confirmResume && <ConfirmResume targetName={crisisSupport.targetName} onConfirm={resumeSession} onCancel={() => setConfirmResume(false)} />}
      {exercise === 'grounding' && <GroundingExercise onComplete={() => setExercise(null)} onSkip={() => setExercise(null)} />}
      {exercise === 'breathing' && <BreathingModal onComplete={() => setExercise(null)} />}
      {soundsOpen && <CalmingSounds onClose={() => setSoundsOpen(false)} />}
    </div>
  );
}
