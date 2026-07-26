/* global React, Icon, Button, IconBadge, Toggle, Pill, BreathingOrb, OceanRadar */
// screens-core.jsx — Today dashboard + Mood check-in (with variations)
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

const MOODS = [
  { id: 'radiant', label: 'Radiant', weather: 'sun', emoji: '\u2600\ufe0f', word: 'light, open, alive', color: 'var(--mood-radiant)', v: 1 },
  { id: 'bright', label: 'Steady', weather: 'leaf', emoji: '\ud83d\ude42', word: 'calm, okay, grounded', color: 'var(--mood-calm)', v: 0.75 },
  { id: 'cloudy', label: 'Cloudy', weather: 'cloud', emoji: '\ud83d\ude10', word: 'flat, unsure, in-between', color: 'var(--mood-cloudy)', v: 0.5 },
  { id: 'low', label: 'Low', weather: 'rain', emoji: '\ud83d\ude14', word: 'tired, sad, heavy-ish', color: 'var(--mood-low)', v: 0.3 },
  { id: 'heavy', label: 'Heavy', weather: 'droplet', emoji: '\ud83d\ude22', word: 'overwhelmed, hurting', color: 'var(--mood-heavy)', v: 0.1 },
];

const WEEK = [
  { d: 'Mon', m: 'bright' }, { d: 'Tue', m: 'cloudy' }, { d: 'Wed', m: 'bright' },
  { d: 'Thu', m: 'low' }, { d: 'Fri', m: 'bright' }, { d: 'Sat', m: 'radiant' }, { d: 'Sun', m: null },
];

function moodById(id) { return MOODS.find((m) => m.id === id) || MOODS[2]; }
function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

/* ============================================================
   TODAY DASHBOARD
   ============================================================ */
function TodayScreen({ name, todayMood, ocean, layout = 'calm', onNavigate, onCheckIn }) {
  const mood = todayMood ? moodById(todayMood) : null;
  const Greeting = React.createElement('div', { style: { marginBottom: 28 } },
    React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })),
    React.createElement('h1', { className: 'serif', style: { fontSize: 38, margin: 0, lineHeight: 1.1 } }, `${greet()}, ${name}.`),
    React.createElement('p', { style: { fontSize: 16, color: 'var(--ink-soft)', marginTop: 8, maxWidth: 520, lineHeight: 1.55 } },
      mood ? `You checked in as ${mood.label.toLowerCase()} today. Whatever you're carrying, there's room for it here.`
        : "However today is landing for you, this is a place to slow down and notice it.")
  );

  const CheckInCard = React.createElement('div', { className: 'card', style: { padding: '28px 30px', position: 'relative', overflow: 'hidden', background: mood ? `linear-gradient(135deg, color-mix(in oklab, ${mood.color} 14%, var(--surface)), var(--surface))` : 'var(--surface)' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 22 } },
      React.createElement(BreathingOrb, { size: 92, tone: mood ? mood.color : 'var(--sage)' },
        mood ? React.createElement(Icon, { name: mood.weather, size: 28, style: { color: mood.color } }) : React.createElement(Icon, { name: 'sun', size: 26, style: { color: 'var(--sage)' } })),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, mood ? 'Today\u2019s weather' : 'Daily check-in'),
        React.createElement('h2', { className: 'serif', style: { fontSize: 24, margin: '0 0 4px' } }, mood ? `Feeling ${mood.label.toLowerCase()}` : 'How are you, really?'),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 16px' } }, mood ? mood.word : 'A 30-second check-in. No pressure to be anything in particular.'),
        React.createElement(Button, { variant: mood ? 'soft' : 'primary', iconRight: mood ? 'refresh' : 'arrowR', onClick: onCheckIn }, mood ? 'Update check-in' : 'Check in')
      )
    )
  );

  const TalkCard = React.createElement('button', { className: 'card', onClick: () => onNavigate('companion'), style: { padding: '24px 26px', textAlign: 'left', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' } },
    React.createElement(IconBadge, { name: 'chat', tone: 'sage', size: 48, iconSize: 22 }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-display)' } }, 'Talk it through'),
      React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 } }, 'Say whatever\u2019s on your mind. I\u2019m listening.')
    ),
    React.createElement(Icon, { name: 'arrowR', size: 18, style: { color: 'var(--ink-faint)' } })
  );

  const ReflectCard = React.createElement('button', { className: 'card', onClick: () => onNavigate('reflections'), style: { padding: '24px 26px', textAlign: 'left', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' } },
    React.createElement(IconBadge, { name: 'feather', tone: 'clay', size: 48, iconSize: 22 }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-display)' } }, 'Write a reflection'),
      React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 } }, 'Put the day into words, just for you.')
    ),
    React.createElement(Icon, { name: 'arrowR', size: 18, style: { color: 'var(--ink-faint)' } })
  );

  const WeekCard = React.createElement('div', { className: 'card', style: { padding: '24px 26px' } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 } },
      React.createElement('p', { className: 'label' }, 'Your week, gently'),
      React.createElement('button', { onClick: () => onNavigate('reflections'), style: { background: 'none', border: 'none', color: 'var(--sage-deep)', fontSize: 12.5, fontWeight: 600 } }, 'See more')),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
      WEEK.map((w, i) => {
        const m = w.m ? moodById(w.m) : null;
        return React.createElement('div', { key: i, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 } },
          React.createElement('div', { style: { width: 30, height: 30, borderRadius: '50%', background: m ? m.color : 'var(--surface-2)', opacity: m ? 0.9 : 1, border: m ? 'none' : '1.5px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            m && React.createElement(Icon, { name: m.weather, size: 15, style: { color: '#fff' } })),
          React.createElement('span', { style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-faint)' } }, w.d));
      })
    )
  );

  const InsightCard = React.createElement('button', { className: 'card', onClick: () => onNavigate('insights'), style: { padding: '24px 26px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 18, alignItems: 'center' } },
    React.createElement('div', { style: { width: 96, height: 96, flexShrink: 0 } }, React.createElement(OceanRadar, { data: ocean, size: 96, showLabels: false })),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, 'How I\u2019m getting to know you'),
      React.createElement('div', { style: { fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5 } }, 'You tend to be ', React.createElement('b', null, 'reflective and warm'), ', and you open up more once you feel safe.'),
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 600, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5 } }, 'See your insight', React.createElement(Icon, { name: 'chevR', size: 14 }))
    )
  );

  const NudgeCard = React.createElement('div', { style: { background: 'var(--clay-tint)', border: '1px solid var(--clay-soft)', borderRadius: 'var(--r-lg)', padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'center' } },
    React.createElement(Icon, { name: 'leaf', size: 22, style: { color: 'var(--clay-deep)', flexShrink: 0 } }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 14, color: 'var(--clay-deep)' } }, 'A small invitation'),
      React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 } }, 'You\u2019ve had a few heavy days. Is there one person you could send a small hello to today?')
    )
  );

  if (layout === 'bento') {
    return React.createElement(ScreenScroll, null,
      Greeting,
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 } },
        React.createElement('div', { style: { gridColumn: '1 / 2', gridRow: '1 / 3' } }, CheckInCard),
        React.createElement('div', null, TalkCard),
        React.createElement('div', null, ReflectCard)
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 } }, WeekCard, InsightCard),
      React.createElement('div', { style: { marginTop: 18 } }, NudgeCard)
    );
  }
  // calm single-column (default)
  return React.createElement(ScreenScroll, null,
    Greeting,
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 } },
      CheckInCard,
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 } }, TalkCard, ReflectCard),
      WeekCard,
      InsightCard,
      NudgeCard
    )
  );
}

function ScreenScroll({ children, max = 980 }) {
  return React.createElement('div', { className: 'no-scrollbar', style: { height: '100%', overflowY: 'auto' } },
    React.createElement('div', { style: { maxWidth: max, margin: '0 auto', padding: '40px 40px 64px' } }, children));
}

/* ============================================================
   MOOD CHECK-IN FLOW (modal overlay) — 4 input styles
   ============================================================ */
function MoodCheckIn({ style = 'weather', onClose, onComplete }) {
  const [step, setStep] = useStateC(0);
  const [picked, setPicked] = useStateC(null);
  const [note, setNote] = useStateC('');
  const mood = picked ? moodById(picked) : null;

  const reflectBack = mood ? {
    radiant: 'That\u2019s lovely to hear. Let\u2019s hold onto what made today feel light.',
    bright: 'Steady is a good place to be. Thank you for checking in with yourself.',
    cloudy: 'In-between days are completely valid. You don\u2019t have to figure it all out right now.',
    low: 'That sounds tender. I\u2019m glad you told me \u2014 you don\u2019t have to carry it quietly.',
    heavy: 'I\u2019m really glad you\u2019re here. That\u2019s a lot to feel. Let\u2019s take it gently, together.',
  }[mood.id] : '';

  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'color-mix(in oklab, var(--ink) 32%, transparent)', backdropFilter: 'blur(6px)' } },
    React.createElement('div', { className: 'card fade-up', style: { width: '100%', maxWidth: 560, padding: '34px 36px', boxShadow: 'var(--shadow-lift)', position: 'relative' } },
      React.createElement('button', { onClick: onClose, 'aria-label': 'Close', style: { position: 'absolute', top: 20, right: 20, background: 'var(--surface-2)', border: 'none', borderRadius: 99, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' } }, React.createElement(Icon, { name: 'x', size: 17 })),

      step === 0 && React.createElement('div', null,
        React.createElement('p', { className: 'label', style: { marginBottom: 8 } }, 'Daily check-in'),
        React.createElement('h2', { className: 'serif', style: { fontSize: 27, margin: '0 0 4px' } }, 'How are you, really?'),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-soft)', marginBottom: 26 } }, 'There\u2019s no right answer. Just whatever\u2019s true right now.'),
        React.createElement(MoodPicker, { style, picked, onPick: (id) => { setPicked(id); } }),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 } },
          React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' } }, 'Maybe later'),
          React.createElement(Button, { variant: 'primary', iconRight: 'arrowR', disabled: !picked, onClick: () => setStep(1) }, 'Next')
        )
      ),

      step === 1 && React.createElement('div', null,
        React.createElement('p', { className: 'label', style: { marginBottom: 8 } }, 'A little more, if you\u2019d like'),
        React.createElement('h2', { className: 'serif', style: { fontSize: 25, margin: '0 0 18px' } }, 'Want to say what\u2019s behind it?'),
        React.createElement('textarea', { autoFocus: true, value: note, onChange: (e) => setNote(e.target.value), placeholder: 'A word, a sentence, or nothing at all\u2026', rows: 4,
          style: { width: '100%', padding: '16px', borderRadius: 'var(--r-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 15, lineHeight: 1.6, resize: 'none', fontFamily: 'var(--font-body)' } }),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 } },
          React.createElement(Button, { variant: 'ghost', icon: 'arrowL', onClick: () => setStep(0) }, 'Back'),
          React.createElement(Button, { variant: 'primary', iconRight: 'check', onClick: () => setStep(2) }, note.trim() ? 'Save check-in' : 'Skip & save')
        )
      ),

      step === 2 && React.createElement('div', { style: { textAlign: 'center', padding: '8px 0' } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 20 } },
          React.createElement(BreathingOrb, { size: 96, tone: mood.color, active: true }, React.createElement(Icon, { name: mood.weather, size: 28, style: { color: mood.color } }))),
        React.createElement('h2', { className: 'serif', style: { fontSize: 24, margin: '0 0 10px' } }, `Checked in: ${mood.label.toLowerCase()}`),
        React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 24px' } }, reflectBack),
        React.createElement('div', { style: { display: 'flex', gap: 10, justifyContent: 'center' } },
          React.createElement(Button, { variant: 'soft', icon: 'chat', onClick: () => onComplete(picked, 'talk') }, 'Talk about it'),
          React.createElement(Button, { variant: 'primary', onClick: () => onComplete(picked, 'done') }, 'Done for now')
        )
      )
    )
  );
}

function MoodPicker({ style, picked, onPick }) {
  if (style === 'slider') {
    const idx = picked ? MOODS.findIndex((m) => m.id === picked) : 2;
    const cur = MOODS[4 - idx] || MOODS[2]; // reversed so right = brighter
    return React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 22 } },
        React.createElement(BreathingOrb, { size: 90, tone: cur.color }, React.createElement(Icon, { name: cur.weather, size: 26, style: { color: cur.color } }))),
      React.createElement('div', { style: { textAlign: 'center', marginBottom: 16, fontFamily: 'var(--font-display)', fontSize: 20 } }, cur.label),
      React.createElement('input', { type: 'range', min: 0, max: 4, step: 1, value: 4 - idx, onChange: (e) => onPick(MOODS[4 - +e.target.value].id),
        style: { width: '100%', accentColor: cur.color, height: 6 } }),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 } },
        React.createElement('span', null, 'Heavy'), React.createElement('span', null, 'Radiant'))
    );
  }
  if (style === 'words') {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      MOODS.map((m) => {
        const on = picked === m.id;
        return React.createElement('button', { key: m.id, onClick: () => onPick(m.id),
          style: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 'var(--r-md)', textAlign: 'left',
            border: `1.5px solid ${on ? m.color : 'var(--line)'}`, background: on ? `color-mix(in oklab, ${m.color} 12%, var(--surface))` : 'var(--surface)', transition: 'all .2s var(--ease)' } },
          React.createElement('div', { style: { width: 12, height: 12, borderRadius: '50%', background: m.color, flexShrink: 0 } }),
          React.createElement('span', { style: { fontWeight: 600, fontSize: 15, width: 92 } }, m.label),
          React.createElement('span', { style: { fontSize: 13.5, color: 'var(--ink-soft)' } }, m.word));
      })
    );
  }
  // weather (default) & emoji share a row layout
  return React.createElement('div', { style: { display: 'flex', gap: 10, justifyContent: 'space-between' } },
    MOODS.map((m) => {
      const on = picked === m.id;
      return React.createElement('button', { key: m.id, onClick: () => onPick(m.id), 'aria-pressed': on,
        style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 6px', borderRadius: 'var(--r-md)',
          border: `1.5px solid ${on ? m.color : 'var(--line)'}`, background: on ? `color-mix(in oklab, ${m.color} 14%, var(--surface))` : 'var(--surface)', transition: 'all .2s var(--ease)', transform: on ? 'translateY(-2px)' : 'none' } },
        React.createElement('div', { style: { width: 46, height: 46, borderRadius: '50%', background: on ? m.color : `color-mix(in oklab, ${m.color} 16%, var(--surface-2))`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' } },
          style === 'emoji'
            ? React.createElement('span', { style: { fontSize: 22 } }, m.emoji)
            : React.createElement(Icon, { name: m.weather, size: 22, style: { color: on ? '#fff' : m.color } })),
        React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-soft)' } }, m.label));
    })
  );
}

Object.assign(window, { TodayScreen, MoodCheckIn, MOODS, WEEK, moodById, ScreenScroll, greet });
