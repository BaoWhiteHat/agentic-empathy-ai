/* global React, Icon, Button, IconBadge, Pill, Toggle, OceanRadar, OceanBars, OCEAN, ScreenScroll, MOODS, moodById, BreathingOrb */
// screens-insight.jsx — OCEAN insight, Memory, Growth, Reflections
const { useState: useStateI, useEffect: useEffectI } = React;

const TRAIT_COPY = {
  openness: { plain: 'You\u2019re curious and open to new ways of seeing things.', soft: 'open & curious' },
  conscientiousness: { plain: 'You like a sense of order, and you follow through on what matters to you.', soft: 'thoughtful & steady' },
  extraversion: { plain: 'You recharge more in quiet, and warm up once you feel safe.', soft: 'gently reserved' },
  agreeableness: { plain: 'You\u2019re warm and considerate, often putting others first.', soft: 'warm & caring' },
  neuroticism: { plain: 'You feel things deeply \u2014 a sensitivity that\u2019s also a kind of depth.', soft: 'deeply feeling' },
};

/* ============================================================
   OCEAN INSIGHT
   ============================================================ */
function InsightScreen({ ocean, viz = 'radar', explainMode, onNavigate }) {
  const [why, setWhy] = useStateI(false);
  const sorted = [...OCEAN].sort((a, b) => (ocean[b.key] ?? 0) - (ocean[a.key] ?? 0));
  return React.createElement(ScreenScroll, { max: 900 },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 26, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, 'How I\u2019m getting to know you'),
        React.createElement('h1', { className: 'serif', style: { fontSize: 34, margin: 0 } }, 'Your reflection, in five colours'),
        React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', marginTop: 8, maxWidth: 540, lineHeight: 1.55 } }, 'This is SoulMate\u2019s gentle, evolving sense of you \u2014 never a label or a score to fix. It only shapes how warmly and how I respond.')
      ),
      React.createElement(Button, { variant: 'soft', size: 'sm', icon: 'info', onClick: () => setWhy((v) => !v) }, 'Why am I seeing this?')
    ),
    why && React.createElement('div', { className: 'fade-up', style: { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '16px 20px', marginBottom: 22, fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 } },
      'SoulMate quietly notices patterns in how you write \u2014 word choice, pace, what you return to \u2014 and nudges these five dials over time. ',
      explainMode === 'plain-detail' && React.createElement('span', { style: { color: 'var(--ink-faint)' } }, 'Technically: a lightweight OCEAN inference runs on your messages; values are smoothed across sessions and never shared. '),
      'You can ask me to ease off anytime, and it never changes whether you\u2019re welcome here.'),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' } },
      React.createElement('div', { className: 'card', style: { padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        viz === 'bars' ? React.createElement(OceanBars, { data: ocean })
          : viz === 'rings' ? React.createElement(OceanRings, { data: ocean })
            : React.createElement(OceanRadar, { data: ocean, size: 240 }),
        React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 18, textAlign: 'center' } }, 'Updated gently as we talk')
      ),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        React.createElement('div', { style: { background: 'var(--sage-tint)', border: '1px solid var(--sage-soft)', borderRadius: 'var(--r-md)', padding: '18px 20px', fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.5, color: 'var(--ink)' } },
          'Right now, you read as ', React.createElement('span', { style: { color: 'var(--sage-deep)' } }, `${TRAIT_COPY[sorted[0].key].soft}`), ' and ', React.createElement('span', { style: { color: 'var(--sage-deep)' } }, `${TRAIT_COPY[sorted[1].key].soft}`), '.'),
        sorted.map((o) => React.createElement('div', { key: o.key, className: 'card', style: { padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: 'var(--shadow-soft)' } },
          React.createElement('div', { style: { width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--sage-deep)', flexShrink: 0 } }, o.short),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
              React.createElement('span', { style: { fontWeight: 600, fontSize: 14.5 } }, o.label),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 } }, Math.round((ocean[o.key] ?? 0.5) * 100) + '%')),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4, marginTop: 2 } }, TRAIT_COPY[o.key].plain))))
      )
    )
  );
}

function OceanRings({ data }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center' } },
    OCEAN.map((o) => {
      const v = data[o.key] ?? 0.5; const C = 2 * Math.PI * 22;
      return React.createElement('div', { key: o.key, style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%' } },
        React.createElement('svg', { width: 52, height: 52, viewBox: '0 0 52 52' },
          React.createElement('circle', { cx: 26, cy: 26, r: 22, fill: 'none', stroke: 'var(--surface-2)', strokeWidth: 5 }),
          React.createElement('circle', { cx: 26, cy: 26, r: 22, fill: 'none', stroke: 'var(--sage)', strokeWidth: 5, strokeLinecap: 'round', strokeDasharray: C, strokeDashoffset: C * (1 - v), transform: 'rotate(-90 26 26)' }),
          React.createElement('text', { x: 26, y: 26, textAnchor: 'middle', dominantBaseline: 'central', style: { fontSize: 13, fontWeight: 700, fill: 'var(--sage-deep)', fontFamily: 'var(--font-display)' } }, o.short)),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 600, fontSize: 13.5 } }, o.label),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-faint)' } }, Math.round(v * 100) + '%')));
    })
  );
}

/* ============================================================
   MEMORY CONTROL
   ============================================================ */
const SEED_MEMORY = {
  people: [{ id: 1, t: 'Mai', d: 'Close friend you confide in', on: true }, { id: 2, t: 'Dad', d: 'Relationship feels distant lately', on: true }],
  facts: [{ id: 3, t: 'Final exams', d: 'Coming up this month \u2014 a big source of stress', on: true }, { id: 4, t: 'Lives away from home', d: 'Moved cities for university', on: true }, { id: 5, t: 'Loves early walks', d: 'Mornings by the river help you reset', on: true }],
  themes: [{ id: 6, t: 'Pressure to perform', d: 'A recurring theme in our talks', on: true }, { id: 7, t: 'Wanting to feel seen', d: 'Comes up around family', on: true }],
};

function MemoryScreen({ onNavigate }) {
  const [mem, setMem] = useStateI(SEED_MEMORY);
  const groups = [
    { key: 'people', label: 'People in your life', icon: 'heart', tone: 'clay' },
    { key: 'facts', label: 'Things about you', icon: 'bookmark', tone: 'sage' },
    { key: 'themes', label: 'Themes we return to', icon: 'waves', tone: 'lavender' },
  ];
  const toggle = (g, id) => setMem((m) => ({ ...m, [g]: m[g].map((x) => x.id === id ? { ...x, on: !x.on } : x) }));
  const remove = (g, id) => setMem((m) => ({ ...m, [g]: m[g].filter((x) => x.id !== id) }));
  const total = Object.values(mem).reduce((s, a) => s + a.length, 0);
  return React.createElement(ScreenScroll, { max: 820 },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, 'What SoulMate remembers' ),
        React.createElement('h1', { className: 'serif', style: { fontSize: 32, margin: 0, lineHeight: 1.12 } }, 'Your memory, in your hands'),
      ),
      React.createElement(Button, { variant: 'outline', size: 'sm', icon: 'trash', style: { color: 'var(--care)', borderColor: 'var(--care-soft)' } }, 'Clear everything')
    ),
    React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, maxWidth: 600, marginBottom: 28 } }, `Everything SoulMate has gathered to understand you better \u2014 ${total} items in plain language. Switch any off to make it forget, or remove it for good.`),
    groups.map((g) => React.createElement('div', { key: g.key, style: { marginBottom: 26 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
        React.createElement(IconBadge, { name: g.icon, tone: g.tone, size: 34, iconSize: 16 }),
        React.createElement('span', { style: { fontWeight: 600, fontSize: 15 } }, g.label),
        React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-faint)' } }, `\u00b7 ${mem[g.key].length}`)),
      React.createElement('div', { className: 'card', style: { padding: '4px 20px', boxShadow: 'var(--shadow-soft)' } },
        mem[g.key].length === 0
          ? React.createElement('div', { style: { padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint)' } }, 'Nothing here \u2014 SoulMate will only remember what you allow.')
          : mem[g.key].map((item, i) => React.createElement('div', { key: item.id, style: { display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: i === mem[g.key].length - 1 ? 'none' : '1px solid var(--line)', opacity: item.on ? 1 : 0.5 } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 14.5 } }, item.t),
              React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)' } }, item.d)),
            React.createElement('button', { onClick: () => remove(g.key, item.id), 'aria-label': 'Forget', style: { background: 'none', border: 'none', color: 'var(--ink-faint)', padding: 6, borderRadius: 8, display: 'flex' } }, React.createElement(Icon, { name: 'trash', size: 16 })),
            React.createElement(Toggle, { on: item.on, onChange: () => toggle(g.key, item.id) }))))
    )),
    React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 } },
      React.createElement(Icon, { name: 'lock', size: 18, style: { color: 'var(--sage-deep)', flexShrink: 0 } }),
      'These notes never leave your account. Forgetting something here means SoulMate truly lets it go.')
  );
}

/* ============================================================
   GROWTH (gentle, non-gamified)
   ============================================================ */
const SEED_INTENTIONS = [
  { id: 1, t: 'Notice one good moment a day', cadence: 'Most days', done: 5, of: 7, tone: 'sage' },
  { id: 2, t: 'Message a friend when I feel low', cadence: 'As needed', done: 2, of: 3, tone: 'clay' },
  { id: 3, t: 'A slow morning walk', cadence: 'Weekdays', done: 3, of: 5, tone: 'lavender' },
];

function GrowthScreen() {
  const [items] = useStateI(SEED_INTENTIONS);
  return React.createElement(ScreenScroll, { max: 820 },
    React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, 'Gentle intentions'),
    React.createElement('h1', { className: 'serif', style: { fontSize: 34, margin: '0 0 8px' } }, 'Small things, tended kindly'),
    React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, maxWidth: 560, marginBottom: 28 } }, 'Not streaks or scores \u2014 just a few caring intentions you\u2019re holding. Missing a day is human, and completely okay.'),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 } },
      React.createElement('div', { className: 'card', style: { padding: '24px 26px' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
          React.createElement(BreathingOrb, { size: 76, tone: 'var(--sage)', active: false }, React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--sage-deep)' } }, '6')),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 600, fontSize: 15 } }, 'Check-ins this week'),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)' } }, 'A steady, kind rhythm.')))),
      React.createElement('div', { className: 'card', style: { padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 14 } },
        React.createElement(IconBadge, { name: 'sprout', tone: 'clay', size: 56, iconSize: 26 }),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 600, fontSize: 15 } }, 'Heavier days are easing'),
          React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 } }, 'Fewer low check-ins than last week. You\u2019re tending to yourself.')))),
    React.createElement('p', { className: 'label', style: { marginBottom: 12 } }, 'What you\u2019re holding'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 } },
      items.map((it) => React.createElement('div', { key: it.id, className: 'card', style: { padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: 'var(--shadow-soft)' } },
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: 15.5, marginBottom: 6 } }, it.t),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { style: { flex: 1, maxWidth: 220, height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' } },
              React.createElement('div', { style: { height: '100%', width: `${(it.done / it.of) * 100}%`, background: `var(--${it.tone})`, borderRadius: 99 } })),
            React.createElement('span', { style: { fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 } }, `${it.done} of ${it.of} \u00b7 ${it.cadence}`))),
        React.createElement(Pill, { tone: it.tone }, 'Tending'))),
    ),
    React.createElement(Button, { variant: 'soft', icon: 'plus' }, 'Add a gentle intention')
  );
}

/* ============================================================
   REFLECTIONS (journal)
   ============================================================ */
const SEED_ENTRIES = [
  { id: 1, date: 'Today', mood: 'cloudy', title: 'A foggy sort of day', body: 'Couldn\u2019t quite name what I felt. Talked it through and realised I\u2019m just tired, not broken.', from: 'From a chat' },
  { id: 2, date: 'Yesterday', mood: 'low', title: 'Missing home', body: 'The quiet hit harder tonight. SoulMate reminded me to message Mai \u2014 I did, and it helped.', from: 'Written' },
  { id: 3, date: 'Sat', mood: 'radiant', title: 'River walk', body: 'The morning light was unreal. Felt like myself again for a while.', from: 'Mood check-in' },
  { id: 4, date: 'Thu', mood: 'low', title: 'Before the exam', body: 'So much pressure. We did a breathing exercise and I slept a little better.', from: 'From a chat' },
];

function ReflectionsScreen() {
  const [entries, setEntries] = useStateI(SEED_ENTRIES);
  const [writing, setWriting] = useStateI(false);
  const [draft, setDraft] = useStateI({ title: '', body: '' });
  const save = () => {
    if (!draft.body.trim()) { setWriting(false); return; }
    setEntries((e) => [{ id: Date.now(), date: 'Today', mood: 'bright', title: draft.title || 'Untitled', body: draft.body, from: 'Written' }, ...e]);
    setDraft({ title: '', body: '' }); setWriting(false);
  };
  return React.createElement(ScreenScroll, { max: 860 },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 16, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('p', { className: 'label', style: { marginBottom: 6 } }, 'Your reflections'),
        React.createElement('h1', { className: 'serif', style: { fontSize: 34, margin: 0 } }, 'A quiet record of how you\u2019ve been'),
        React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', marginTop: 8, maxWidth: 520, lineHeight: 1.55 } }, 'Moments worth keeping \u2014 from check-ins, chats, or whenever you feel like writing. Only ever for you.')),
      React.createElement(Button, { variant: 'primary', icon: 'pen', onClick: () => setWriting(true) }, 'New reflection')),
    writing && React.createElement('div', { className: 'card fade-up', style: { padding: '24px 26px', marginBottom: 22, borderLeft: '3px solid var(--clay)' } },
      React.createElement('input', { autoFocus: true, value: draft.title, onChange: (e) => setDraft({ ...draft, title: e.target.value }), placeholder: 'A title, if you like\u2026',
        style: { width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 10 } }),
      React.createElement('textarea', { value: draft.body, onChange: (e) => setDraft({ ...draft, body: e.target.value }), placeholder: 'What\u2019s on your mind?', rows: 5,
        style: { width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink)', resize: 'none', fontFamily: 'var(--font-body)' } }),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 } },
        React.createElement(Button, { variant: 'ghost', onClick: () => { setWriting(false); setDraft({ title: '', body: '' }); } }, 'Cancel'),
        React.createElement(Button, { variant: 'primary', icon: 'check', onClick: save }, 'Save'))),
    React.createElement('div', { style: { columnCount: 2, columnGap: 18 } },
      entries.map((e) => {
        const m = moodById(e.mood);
        return React.createElement('div', { key: e.id, className: 'card', style: { padding: '20px 22px', marginBottom: 18, breakInside: 'avoid', boxShadow: 'var(--shadow-soft)' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
            React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: m.weather, size: 13, style: { color: '#fff' } })),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)' } }, e.date),
            React.createElement('span', { style: { marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' } }, e.from)),
          React.createElement('h3', { className: 'serif', style: { fontSize: 19, margin: '0 0 8px' } }, e.title),
          React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 } }, e.body));
      }))
  );
}

Object.assign(window, { InsightScreen, MemoryScreen, GrowthScreen, ReflectionsScreen });
