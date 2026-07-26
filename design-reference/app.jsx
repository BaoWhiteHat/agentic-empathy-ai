/* global React, ReactDOM, Icon, Button, IconBadge, OceanRadar, Pill,
   OnboardingShell, SafetyScreen, SettingsScreen, TodayScreen, MoodCheckIn,
   CompanionScreen, InsightScreen, MemoryScreen, GrowthScreen, ReflectionsScreen,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakColor, TweakButton */
const { useState, useEffect } = React;

const OCEAN_DATA = { openness: 0.78, conscientiousness: 0.62, extraversion: 0.34, agreeableness: 0.83, neuroticism: 0.58 };
const USER_NAME = 'Linh';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "#2E9E6E",
  "headingFont": "'Newsreader', Georgia, serif",
  "fontScale": 1,
  "dashboardLayout": "calm",
  "moodStyle": "weather",
  "chatStyle": "bubbles",
  "oceanViz": "radar",
  "onboardingStyle": "guided",
  "explainMode": "plain-detail",
  "voicePreview": "off"
}/*EDITMODE-END*/;

const NAV = [
  { id: 'today', label: 'Today', icon: 'sun', status: 'B' },
  { id: 'companion', label: 'Companion', icon: 'chat', status: 'A' },
  { id: 'reflections', label: 'Reflections', icon: 'feather', status: 'B' },
  { id: 'insights', label: 'Insights', icon: 'compass', status: 'A' },
];

// Feature-status legend for the academic framing.
const STATUS_INFO = {
  A: { label: 'Implemented core feature', tone: 'sage', short: 'Core' },
  B: { label: 'High-fidelity prototype', tone: 'gold', short: 'Prototype' },
  C: { label: 'Future work', tone: 'lavender', short: 'Future' },
};

function StatusChip({ tier }) {
  const [open, setOpen] = useState(false);
  const info = STATUS_INFO[tier];
  if (!info) return null;
  const map = { sage: ['var(--sage-soft)', 'var(--sage-deep)'], gold: ['var(--gold-soft)', 'var(--gold)'], lavender: ['var(--lavender-soft)', 'var(--lavender-deep)'] };
  const [bg, fg] = map[info.tone];
  return React.createElement('div', { style: { position: 'absolute', top: 18, right: 22, zIndex: 30 } },
    React.createElement('button', { onClick: () => setOpen((v) => !v), onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false),
      style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: bg, color: fg, border: '1px solid transparent', fontSize: 11, fontWeight: 700, letterSpacing: '.06em' } },
      React.createElement('span', { style: { width: 16, height: 16, borderRadius: '50%', background: fg, color: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800 } }, tier),
      info.short.toUpperCase()),
    open && React.createElement('div', { style: { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 248, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lift)', padding: '14px 16px' } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: fg, marginBottom: 8 } }, `${tier} · ${info.label}`),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        Object.entries(STATUS_INFO).map(([k, v]) => React.createElement('div', { key: k, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: k === tier ? 'var(--ink)' : 'var(--ink-faint)' } },
          React.createElement('span', { style: { fontWeight: 800, width: 12 } }, k), v.label)))
    )
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [phase, setPhase] = useState(() => localStorage.getItem('sm_onboarded') ? 'app' : 'onboarding');
  const [screen, setScreen] = useState('today');
  const [todayMood, setTodayMood] = useState(null);
  const [moodOpen, setMoodOpen] = useState(false);

  // apply theme + tokens
  useEffect(() => {
    document.documentElement.classList.toggle('dark', t.dark);
  }, [t.dark]);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--sage', t.accent);
    // derive a soft deep for text use
    r.style.setProperty('--font-display', t.headingFont);
    document.body.style.fontSize = (15.5 * t.fontScale) + 'px';
  }, [t.accent, t.headingFont, t.fontScale]);

  const completeOnboarding = () => { localStorage.setItem('sm_onboarded', '1'); setPhase('app'); setScreen('today'); };
  const replayOnboarding = () => { localStorage.removeItem('sm_onboarded'); setPhase('onboarding'); };

  const Tweaks = React.createElement(TweaksPanel, null,
    React.createElement(TweakSection, { label: 'Theme' }),
    React.createElement(TweakToggle, { label: 'Dark mode', value: t.dark, onChange: (v) => setTweak('dark', v) }),
    React.createElement(TweakColor, { label: 'Accent', value: t.accent, options: ['#2E9E6E', '#1F9488', '#5BA86B', '#3F8FA8', '#C77B5E'], onChange: (v) => setTweak('accent', v) }),
    React.createElement(TweakSelect, { label: 'Heading font', value: t.headingFont, options: [
      { label: 'Newsreader (serif)', value: "'Newsreader', Georgia, serif" },
      { label: 'Hanken (sans)', value: "'Hanken Grotesk', sans-serif" },
    ], onChange: (v) => setTweak('headingFont', v) }),
    React.createElement(TweakRadio, { label: 'Text size', value: String(t.fontScale), options: [
      { label: 'S', value: '0.92' }, { label: 'M', value: '1' }, { label: 'L', value: '1.1' } ], onChange: (v) => setTweak('fontScale', +v) }),

    React.createElement(TweakSection, { label: 'Variations to explore' }),
    React.createElement(TweakRadio, { label: 'Dashboard', value: t.dashboardLayout, options: [{ label: 'Calm', value: 'calm' }, { label: 'Bento', value: 'bento' }], onChange: (v) => setTweak('dashboardLayout', v) }),
    React.createElement(TweakSelect, { label: 'Mood check-in', value: t.moodStyle, options: ['weather', 'emoji', 'slider', 'words'], onChange: (v) => setTweak('moodStyle', v) }),
    React.createElement(TweakRadio, { label: 'Chat style', value: t.chatStyle, options: [{ label: 'Bubbles', value: 'bubbles' }, { label: 'Minimal', value: 'minimal' }], onChange: (v) => setTweak('chatStyle', v) }),
    React.createElement(TweakRadio, { label: 'Voice screen', value: t.voicePreview, options: [{ label: 'Idle', value: 'off' }, { label: 'Live transcript', value: 'live' }], onChange: (v) => setTweak('voicePreview', v) }),
    React.createElement(TweakSelect, { label: 'OCEAN insight', value: t.oceanViz, options: [{ label: 'Radar', value: 'radar' }, { label: 'Bars', value: 'bars' }, { label: 'Rings', value: 'rings' }], onChange: (v) => setTweak('oceanViz', v) }),
    React.createElement(TweakRadio, { label: 'Onboarding', value: t.onboardingStyle, options: [{ label: 'Guided', value: 'guided' }, { label: 'Chat', value: 'conversational' }], onChange: (v) => setTweak('onboardingStyle', v) }),

    React.createElement(TweakSection, { label: 'Explainability' }),
    React.createElement(TweakRadio, { label: 'Detail', value: t.explainMode, options: [{ label: 'Plain', value: 'plain' }, { label: 'Plain + how', value: 'plain-detail' }], onChange: (v) => setTweak('explainMode', v) }),

    React.createElement(TweakSection, { label: 'Demo' }),
    React.createElement(TweakButton, { label: 'Replay onboarding', onClick: replayOnboarding })
  );

  if (phase === 'onboarding') {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { height: '100%', overflowY: 'auto' }, className: 'no-scrollbar' },
        React.createElement(OnboardingShell, { style: t.onboardingStyle, onComplete: completeOnboarding })),
      Tweaks
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'today': return React.createElement(TodayScreen, { name: USER_NAME, todayMood, ocean: OCEAN_DATA, layout: t.dashboardLayout, onNavigate: setScreen, onCheckIn: () => setMoodOpen(true) });
      case 'companion': return React.createElement(CompanionScreen, { key: 'companion-' + t.voicePreview, name: USER_NAME, chatStyle: t.chatStyle, explainMode: t.explainMode, initialTab: t.voicePreview === 'live' ? 'voice' : 'chat', voiceLive: t.voicePreview === 'live' });
      case 'reflections': return React.createElement(ReflectionsScreen, null);
      case 'insights': return React.createElement(InsightScreen, { ocean: OCEAN_DATA, viz: t.oceanViz, explainMode: t.explainMode, onNavigate: setScreen });
      default: return null;
    }
  };
  const curStatus = (NAV.find((n) => n.id === screen) || {}).status;

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { display: 'flex', height: '100%', background: 'radial-gradient(120% 90% at 100% 0%, var(--bg-tint), var(--bg))' } },
      React.createElement(Sidebar, { screen, onNavigate: setScreen, ocean: OCEAN_DATA, dark: t.dark, onToggleTheme: () => setTweak('dark', !t.dark) }),
      React.createElement('main', { style: { flex: 1, minWidth: 0, position: 'relative', zIndex: 1 } },
        React.createElement(StatusChip, { tier: curStatus }),
        renderScreen())
    ),
    moodOpen && React.createElement(MoodCheckIn, { style: t.moodStyle, onClose: () => setMoodOpen(false),
      onComplete: (id, next) => { setTodayMood(id); setMoodOpen(false); if (next === 'talk') setScreen('companion'); } }),
    Tweaks
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar({ screen, onNavigate, ocean, dark, onToggleTheme }) {
  return React.createElement('aside', { style: { width: 264, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 18px', borderRight: '1px solid var(--line)', background: 'var(--surface)', overflowY: 'auto' }, className: 'no-scrollbar' },
    // brand
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 20px' } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px color-mix(in oklab, var(--sage) 40%, transparent)' } },
        React.createElement(Icon, { name: 'heart', size: 21, fill: '#fff', stroke: 0 })),
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' } }, 'SoulMate'),
        React.createElement('div', { className: 'label', style: { fontSize: 9.5, marginTop: 3 } }, 'a calm companion'))),

    // mini OCEAN
    React.createElement('button', { onClick: () => onNavigate('insights'), style: { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px', marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' } },
      React.createElement('span', { className: 'label', style: { fontSize: 9.5, marginBottom: 6, alignSelf: 'flex-start' } }, 'Your reflection'),
      React.createElement(OceanRadar, { data: ocean, size: 150, showLabels: false })),

    // nav
    React.createElement('nav', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
      NAV.map((n) => {
        const on = screen === n.id;
        return React.createElement('button', { key: n.id, onClick: () => onNavigate(n.id),
          style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 'var(--r-sm)', border: 'none', textAlign: 'left',
            background: on ? 'var(--sage-tint)' : 'transparent', color: on ? 'var(--sage-deep)' : 'var(--ink-soft)', fontWeight: on ? 600 : 500, fontSize: 14.5, transition: 'color .18s, font-weight .18s', position: 'relative' } },
          on && React.createElement('span', { style: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 99, background: 'var(--sage)' } }),
          React.createElement(Icon, { name: n.icon, size: 19, stroke: on ? 2 : 1.75 }), n.label);
      })
    ),

    // footer
    React.createElement('div', { style: { marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 } },
      React.createElement('button', { onClick: onToggleTheme, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--ink-soft)', fontWeight: 500, fontSize: 13.5, textAlign: 'left' } },
        React.createElement(Icon, { name: dark ? 'sun' : 'moon', size: 18 }), dark ? 'Light mode' : 'Dark mode'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 8px', marginTop: 4, borderTop: '1px solid var(--line)' } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)' } }, USER_NAME[0]),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: 13.5 } }, USER_NAME),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-faint)' } }, 'Private space')),
        React.createElement(Icon, { name: 'logout', size: 17, style: { color: 'var(--ink-faint)' } }))
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
