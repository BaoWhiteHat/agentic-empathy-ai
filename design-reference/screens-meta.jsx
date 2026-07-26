/* global React, Icon, Button, IconBadge, Toggle, Pill, BreathingOrb */
// screens-meta.jsx — Onboarding, Consent, Safety, Settings
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

/* ============================================================
   ONBOARDING — supports two flow styles via tweak
   ============================================================ */
const REASONS = ['Daily reflection', 'Stress & overwhelm', 'Feeling lonely', 'Sleep & rest', 'Understanding myself', 'Just curious'];

function OnboardingShell({ style, onComplete }) {
  return style === 'conversational'
    ? React.createElement(OnboardingConversational, { onComplete })
    : React.createElement(OnboardingGuided, { onComplete });
}

// ---- Guided (paged, calm cards) ----
function OnboardingGuided({ onComplete }) {
  const [step, setStep] = useStateM(0);
  const [name, setName] = useStateM('');
  const [reasons, setReasons] = useStateM([]);
  const [consent, setConsent] = useStateM({ memory: true, personality: true, anonymised: false });
  const [rhythm, setRhythm] = useStateM('gentle');
  const steps = ['welcome', 'about', 'consent', 'name', 'reasons', 'rhythm', 'ready'];
  const total = steps.length;
  const cur = steps[step];
  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleReason = (r) => setReasons((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);

  return React.createElement('div', { style: { minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'radial-gradient(120% 90% at 50% -10%, var(--bg-tint), var(--bg))' } },
    React.createElement('div', { style: { width: '100%', maxWidth: 560 } },
      // progress
      step > 0 && React.createElement('div', { style: { display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 } },
        steps.slice(1).map((_, i) => React.createElement('div', { key: i, style: { height: 4, width: i + 1 <= step ? 26 : 14, borderRadius: 99, background: i + 1 <= step ? 'var(--sage)' : 'var(--line-strong)', transition: 'all .4s var(--ease)' } }))
      ),
      React.createElement('div', { key: cur, className: 'fade-up card', style: { padding: '44px 40px', borderRadius: 'var(--r-xl)' } },
        cur === 'welcome' && React.createElement(StepWelcome, { onNext: next }),
        cur === 'about' && React.createElement(StepAbout, null),
        cur === 'consent' && React.createElement(StepConsent, { consent, setConsent }),
        cur === 'name' && React.createElement(StepName, { name, setName }),
        cur === 'reasons' && React.createElement(StepReasons, { reasons, toggleReason }),
        cur === 'rhythm' && React.createElement(StepRhythm, { rhythm, setRhythm }),
        cur === 'ready' && React.createElement(StepReady, { name })
      ),
      // nav
      cur !== 'welcome' && React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 } },
        React.createElement(Button, { variant: 'ghost', icon: 'arrowL', onClick: back }, 'Back'),
        cur === 'ready'
          ? React.createElement(Button, { variant: 'primary', size: 'lg', iconRight: 'arrowR', onClick: onComplete }, 'Enter SoulMate')
          : React.createElement(Button, { variant: 'primary', iconRight: 'arrowR', onClick: next, disabled: cur === 'name' && !name.trim() }, cur === 'consent' ? 'I agree' : 'Continue')
      )
    )
  );
}

function StepWelcome({ onNext }) {
  return React.createElement('div', { style: { textAlign: 'center', padding: '12px 0' } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 26 } },
      React.createElement(BreathingOrb, { size: 110, tone: 'var(--sage)' }, React.createElement(Icon, { name: 'heart', size: 30, fill: 'var(--sage)', stroke: 0 }))
    ),
    React.createElement('h1', { className: 'serif', style: { fontSize: 40, margin: '0 0 14px', lineHeight: 1.1 } }, 'Hello. You found a quiet corner.'),
    React.createElement('p', { style: { fontSize: 16.5, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 30px' } }, 'SoulMate is a calm space to notice how you feel, talk things through, and understand yourself a little better — at your own pace.'),
    React.createElement(Button, { variant: 'primary', size: 'lg', iconRight: 'arrowR', onClick: onNext }, 'Begin'),
    React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 22 } }, 'Takes about a minute. Nothing is shared with anyone.')
  );
}

function StepAbout() {
  const rows = [
    { icon: 'leaf', tone: 'sage', t: 'A companion for everyday reflection', d: 'Somewhere to think out loud, check in with your feelings, and feel a little less alone.' },
    { icon: 'shieldHeart', tone: 'clay', t: 'Not a therapist or medical service', d: 'SoulMate offers emotional support, not diagnosis or treatment. For clinical care, a human professional is always best.' },
    { icon: 'phone', tone: 'care', t: 'It will guide you to real help when it matters', d: 'If things ever feel overwhelming, SoulMate gently points you toward people and crisis lines who can be there in person.' },
  ];
  return React.createElement('div', null,
    React.createElement('p', { className: 'label', style: { marginBottom: 10 } }, 'Before we begin'),
    React.createElement('h2', { className: 'serif', style: { fontSize: 28, margin: '0 0 24px' } }, 'What SoulMate is — and isn\u2019t'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
      rows.map((r, i) => React.createElement('div', { key: i, style: { display: 'flex', gap: 16, alignItems: 'flex-start' } },
        React.createElement(IconBadge, { name: r.icon, tone: r.tone, size: 42 }),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 600, fontSize: 15.5, marginBottom: 3 } }, r.t),
          React.createElement('div', { style: { fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 } }, r.d)
        )
      ))
    )
  );
}

function ConsentRow({ icon, title, desc, on, onChange, required }) {
  return React.createElement('div', { style: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid var(--line)' } },
    React.createElement(IconBadge, { name: icon, tone: 'sage', size: 38, iconSize: 18 }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 } },
        React.createElement('span', { style: { fontWeight: 600, fontSize: 14.5 } }, title),
        required && React.createElement(Pill, { tone: 'neutral', style: { fontSize: 10, padding: '2px 8px' } }, 'Needed')
      ),
      React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 } }, desc)
    ),
    React.createElement(Toggle, { on, onChange, })
  );
}

function StepConsent({ consent, setConsent }) {
  return React.createElement('div', null,
    React.createElement('p', { className: 'label', style: { marginBottom: 10 } }, 'Your data, your choice'),
    React.createElement('h2', { className: 'serif', style: { fontSize: 28, margin: '0 0 8px' } }, 'What may SoulMate remember?'),
    React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 8 } }, 'You can change any of this later, and clear everything at any time.'),
    React.createElement(ConsentRow, { icon: 'archive', title: 'Remember our conversations', desc: 'So SoulMate can recall context like \u201cyour exams\u201d instead of asking again.', on: consent.memory, onChange: (v) => setConsent({ ...consent, memory: v }), required: true }),
    React.createElement(ConsentRow, { icon: 'compass', title: 'Learn my personality over time', desc: 'A gentle reading of how you tend to express yourself, used only to soften how SoulMate replies.', on: consent.personality, onChange: (v) => setConsent({ ...consent, personality: v }) }),
    React.createElement('div', { style: { marginTop: 16, fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', gap: 8, alignItems: 'center' } },
      React.createElement(Icon, { name: 'lock', size: 14 }), 'Stored privately on your account. Never sold, never shared.')
  );
}

function StepName({ name, setName }) {
  return React.createElement('div', { style: { textAlign: 'center' } },
    React.createElement('h2', { className: 'serif', style: { fontSize: 30, margin: '8px 0 10px' } }, 'What should I call you?'),
    React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 26 } }, 'A first name or nickname is perfect. This is just between us.'),
    React.createElement('input', { autoFocus: true, value: name, onChange: (e) => setName(e.target.value), placeholder: 'e.g. Linh',
      style: { width: '100%', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 26, padding: '16px', borderRadius: 'var(--r-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' } })
  );
}

function StepReasons({ reasons, toggleReason }) {
  return React.createElement('div', null,
    React.createElement('h2', { className: 'serif', style: { fontSize: 28, margin: '4px 0 8px' } }, 'What brings you here lately?'),
    React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 24 } }, 'Pick anything that fits — or nothing at all. There are no wrong answers.'),
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
      REASONS.map((r) => {
        const on = reasons.includes(r);
        return React.createElement('button', { key: r, onClick: () => toggleReason(r),
          style: { padding: '12px 18px', borderRadius: 99, fontSize: 14.5, fontWeight: 500,
            border: `1px solid ${on ? 'transparent' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'var(--surface)',
            color: on ? '#fff' : 'var(--ink)', transition: 'all .2s var(--ease)', display: 'inline-flex', alignItems: 'center', gap: 8 } },
          on && React.createElement(Icon, { name: 'check', size: 15, stroke: 2.4 }), r);
      })
    )
  );
}

function StepRhythm({ rhythm, setRhythm }) {
  const opts = [
    { id: 'gentle', t: 'A gentle presence', d: 'A calm space that greets you warmly when you arrive.', icon: 'leaf' },
    { id: 'minimal', t: 'Only when I open the app', d: 'SoulMate waits quietly until you come to it.', icon: 'moon' },
    { id: 'present', t: 'A little more present', d: 'A soft morning and evening check-in to return to.', icon: 'sun' },
  ];
  return React.createElement('div', null,
    React.createElement('h2', { className: 'serif', style: { fontSize: 28, margin: '4px 0 6px' } }, 'How present should I be?'),
    React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-soft)', marginBottom: 22, lineHeight: 1.55 } }, 'SoulMate is here to support you — not to keep you here. It gently points back toward real life and real people.'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      opts.map((o) => {
        const on = rhythm === o.id;
        return React.createElement('button', { key: o.id, onClick: () => setRhythm(o.id),
          style: { display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', padding: '16px 18px', borderRadius: 'var(--r-md)',
            border: `1.5px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: on ? 'var(--sage-tint)' : 'var(--surface)', transition: 'all .2s var(--ease)' } },
          React.createElement(IconBadge, { name: o.icon, tone: on ? 'sage' : 'neutral', size: 40 }),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 15 } }, o.t),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 } }, o.d)
          ),
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? 'var(--sage)' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, on && React.createElement(Icon, { name: 'check', size: 12, stroke: 3, style: { color: '#fff' } }))
        );
      })
    )
  );
}

function StepReady({ name }) {
  return React.createElement('div', { style: { textAlign: 'center', padding: '10px 0' } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 22 } },
      React.createElement(BreathingOrb, { size: 100, tone: 'var(--clay)' }, React.createElement(Icon, { name: 'sparkle', size: 28, fill: 'var(--clay)', stroke: 0 }))),
    React.createElement('h2', { className: 'serif', style: { fontSize: 32, margin: '0 0 12px' } }, `You're all set${name ? ', ' + name : ''}.`),
    React.createElement('p', { style: { fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' } }, 'Whenever you\u2019re ready, take a breath and step in. There\u2019s no right way to do this — just begin where you are.')
  );
}

// ---- Conversational variant ----
function OnboardingConversational({ onComplete }) {
  const script = [
    "Hi — I'm SoulMate. I'm really glad you're here.",
    "Before anything else: I'm a companion for everyday reflection, not a therapist or a medical service. If things ever get heavy, I'll help you reach real people who can support you.",
    "Everything you share stays private to you, and you can clear it anytime. Is it okay if I remember our conversations so I don't keep asking the same things?",
    "Wonderful. What should I call you?",
    "It's lovely to meet you. Whenever you're ready, we can begin — gently, at your pace.",
  ];
  const [shown, setShown] = useStateM(1);
  const [name, setName] = useStateM('');
  const endRef = useRefM(null);
  useEffectM(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [shown]);
  const atName = shown === 4;
  const done = shown >= script.length;
  return React.createElement('div', { style: { minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 620, margin: '0 auto', padding: '40px 24px' } },
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'flex-end' } },
      script.slice(0, shown).map((m, i) => React.createElement('div', { key: i, className: 'fade-up', style: { display: 'flex', gap: 12, alignItems: 'flex-start' } },
        React.createElement(IconBadge, { name: 'heart', tone: 'sage', size: 36, iconSize: 16 }),
        React.createElement('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '4px 20px 20px 20px', padding: '14px 18px', fontSize: 15.5, lineHeight: 1.6, maxWidth: '85%', boxShadow: 'var(--shadow-soft)' } }, m)
      )),
      atName && React.createElement('input', { key: 'ni', autoFocus: true, value: name, onChange: (e) => setName(e.target.value), placeholder: 'Type your name\u2026', onKeyDown: (e) => e.key === 'Enter' && name.trim() && setShown(5),
        style: { alignSelf: 'flex-end', padding: '12px 18px', borderRadius: 99, border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 15, width: 240 } }),
      React.createElement('div', { ref: endRef })
    ),
    React.createElement('div', { style: { marginTop: 24, display: 'flex', justifyContent: 'center' } },
      done ? React.createElement(Button, { variant: 'primary', size: 'lg', iconRight: 'arrowR', onClick: onComplete }, 'Step in')
        : atName ? React.createElement(Button, { variant: 'primary', onClick: () => name.trim() && setShown(5), disabled: !name.trim() }, 'Continue')
          : React.createElement(Button, { variant: 'soft', onClick: () => setShown((s) => s + 1) }, shown === 3 ? 'Yes, that\u2019s okay' : 'Okay'))
  );
}

/* ============================================================
   SAFETY SUPPORT SCREEN
   ============================================================ */
function SafetyScreen({ onBack }) {
  const lines = [
    { region: 'Vietnam', name: 'Vietnam: 096 306 1414', num: '', hours: 'Public support number' },
    { region: 'Vietnam', name: 'Crisis text & chat support', num: 'text via app', hours: 'Always on' },
    { region: 'US', name: 'US: 988 (Suicide & Crisis Lifeline)', num: '', hours: '24/7' },
    { region: 'International', name: 'Befrienders Worldwide', num: 'befrienders.org', hours: 'Find a local line' },
  ];
  const grounding = [
    { icon: 'wind', t: 'Breathe with me', d: 'A slow 4\u20137\u20138 breath, for one minute.' },
    { icon: 'waves', t: '5\u20134\u20133\u20132\u20131 grounding', d: 'Name what you can see, touch, hear, smell, taste.' },
    { icon: 'volume', t: 'Calming sounds', d: 'Soft rain or warm tones to settle the body.' },
  ];
  return React.createElement('div', { className: 'no-scrollbar', style: { height: '100%', overflowY: 'auto' } },
    React.createElement('div', { style: { maxWidth: 760, margin: '0 auto', padding: '40px 32px 64px' } },
      onBack && React.createElement(Button, { variant: 'ghost', icon: 'arrowL', size: 'sm', onClick: onBack, style: { marginBottom: 20 } }, 'Back'),
      React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 } },
        React.createElement(IconBadge, { name: 'shieldHeart', tone: 'care', size: 52, iconSize: 26 }),
        React.createElement('div', null,
          React.createElement('h1', { className: 'serif', style: { fontSize: 30, margin: 0 } }, 'You don\u2019t have to carry this alone'),
          React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-soft)', margin: '4px 0 0' } }, 'If you\u2019re in danger or thinking about harming yourself, please reach a person now.')
        )
      ),
      React.createElement('div', { style: { background: 'var(--care-tint)', border: '1px solid var(--care-soft)', borderRadius: 'var(--r-lg)', padding: '20px 22px', margin: '20px 0 28px', display: 'flex', gap: 14, alignItems: 'center' } },
        React.createElement(Icon, { name: 'phone', size: 22, style: { color: 'var(--care)' } }),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: 15 } }, 'If this is an emergency'),
          React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-soft)' } }, 'Call your local emergency number, or one of the lines below. They are free, confidential, and there for you.')
        )
      ),
      React.createElement('p', { className: 'label', style: { marginBottom: 12 } }, 'People who can help'),
      React.createElement('div', { style: { display: 'grid', gap: 12, marginBottom: 34 } },
        lines.map((l, i) => React.createElement('div', { key: i, className: 'card', style: { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: 'var(--shadow-soft)' } },
          React.createElement(Pill, { tone: 'neutral', style: { fontSize: 10 } }, l.region),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 15 } }, l.name),
            React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-faint)' } }, l.hours)
          ),
          l.num && React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--care)', fontWeight: 500, whiteSpace: 'nowrap' } }, l.num)
        ))
      ),
      React.createElement('p', { className: 'label', style: { marginBottom: 12 } }, 'Or, settle your body for a moment'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 } },
        grounding.map((g, i) => React.createElement('button', { key: i, className: 'card', style: { padding: '20px 16px', textAlign: 'left', boxShadow: 'var(--shadow-soft)' } },
          React.createElement(IconBadge, { name: g.icon, tone: 'sage', size: 40, iconSize: 19 }),
          React.createElement('div', { style: { fontWeight: 600, fontSize: 14.5, margin: '12px 0 4px' } }, g.t),
          React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45 } }, g.d)
        ))
      ),
      React.createElement('p', { style: { fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 34, lineHeight: 1.6 } }, 'SoulMate is a supportive companion, not a crisis service. When you\u2019re in crisis, a trained human is the right kind of help \u2014 and reaching out is a brave, kind thing to do for yourself.')
    )
  );
}

/* ============================================================
   SETTINGS / PRIVACY
   ============================================================ */
function SettingsScreen({ name, theme, onToggleTheme, onConsentReview }) {
  const [s, setS] = useStateM({ memory: true, personality: true });
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const Section = ({ title, children, note }) => React.createElement('div', { style: { marginBottom: 30 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
      React.createElement('p', { className: 'label', style: { margin: 0 } }, title),
      note),
    React.createElement('div', { className: 'card', style: { padding: '4px 22px', boxShadow: 'var(--shadow-soft)' } }, children));
  const Row = ({ icon, tone, title, desc, control, last, dim }) => React.createElement('div', { style: { display: 'flex', gap: 14, alignItems: 'center', padding: '18px 0', borderBottom: last ? 'none' : '1px solid var(--line)', opacity: dim ? 0.72 : 1 } },
    React.createElement(IconBadge, { name: icon, tone: tone || 'neutral', size: 38, iconSize: 18 }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 14.5 } }, title),
      desc && React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 } }, desc)
    ), control);
  const Planned = React.createElement(Pill, { tone: 'lavender', icon: 'sparkle' }, 'Planned');
  return React.createElement('div', { className: 'no-scrollbar', style: { height: '100%', overflowY: 'auto' } },
    React.createElement('div', { style: { maxWidth: 720, margin: '0 auto', padding: '40px 32px 64px' } },
      React.createElement('h1', { className: 'serif', style: { fontSize: 32, margin: '0 0 4px' } }, 'Settings'),
      React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 32 } }, 'The controls you need to feel safe here. A few are proposed for future versions \u2014 shown, but not yet active.'),
      React.createElement(Section, { title: 'Privacy & memory' },
        React.createElement(Row, { icon: 'archive', tone: 'sage', title: 'Remember our conversations', desc: 'Lets SoulMate recall context across sessions.', control: React.createElement(Toggle, { on: s.memory, onChange: (v) => set('memory', v) }) }),
        React.createElement(Row, { icon: 'compass', tone: 'sage', title: 'Learn my personality', desc: 'Used only to soften how replies are written.', control: React.createElement(Toggle, { on: s.personality, onChange: (v) => set('personality', v) }) }),
        React.createElement(Row, { icon: 'eye', tone: 'sage', title: 'Review what SoulMate remembers', desc: 'See and edit your memory in plain language.', control: React.createElement(Button, { variant: 'soft', size: 'sm', iconRight: 'chevR', onClick: onConsentReview }, 'Open Memory'), last: true })
      ),
      React.createElement(Section, { title: 'Appearance' },
        React.createElement(Row, { icon: theme === 'dark' ? 'moon' : 'sun', tone: 'gold', title: 'Dark mode', desc: 'A warmer, dimmer space for evenings.', control: React.createElement(Toggle, { on: theme === 'dark', onChange: onToggleTheme }), last: true })
      ),
      React.createElement(Section, { title: 'Proposed for future versions', note: React.createElement(Pill, { tone: 'lavender' }, 'C \u00b7 Future work') },
        React.createElement(Row, { icon: 'leaf', tone: 'neutral', dim: true, title: 'Gentle reminders to reach out', desc: 'Occasional nudges toward friends, family, fresh air.', control: Planned }),
        React.createElement(Row, { icon: 'moon', tone: 'neutral', dim: true, title: 'Evening wind-down', desc: 'A nudge to pause after long sessions.', control: Planned }),
        React.createElement(Row, { icon: 'sparkle', tone: 'neutral', dim: true, title: 'Help improve SoulMate (anonymised)', desc: 'Opt-in, with identifying details removed.', control: Planned }),
        React.createElement(Row, { icon: 'refresh', tone: 'neutral', dim: true, title: 'Export my data', desc: 'Download everything as a file.', control: Planned }),
        React.createElement(Row, { icon: 'trash', tone: 'neutral', dim: true, title: 'Delete my account & memories', desc: 'A full, permanent erase of everything.', control: Planned, last: true })
      ),
      React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 10 } }, 'SoulMate \u00b7 a non-clinical companion \u00b7 not a substitute for professional care')
    )
  );
}

Object.assign(window, { OnboardingShell, SafetyScreen, SettingsScreen });
