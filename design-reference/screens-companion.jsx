/* global React, Icon, Button, IconBadge, Pill, BreathingOrb */
// screens-companion.jsx — Chat / Voice (idle + live transcript) / Empty Chair
const { useState: useStateK, useEffect: useEffectK, useRef: useRefK } = React;

const CRISIS_WORDS = ['kill myself', 'end it', 'suicide', 'hurt myself', 'no point', 'want to die', 'better off without', "can't go on", 'self harm'];
function detectCrisis(t) { const s = t.toLowerCase(); return CRISIS_WORDS.some((w) => s.includes(w)); }

const CHAT_REPLIES = [
  { c: "That makes a lot of sense. It sounds like today asked a lot of you.", why: "You sounded tired, so I'm slowing the pace and just reflecting back rather than offering advice.", tech: "Tone routing \u2192 validating \u00b7 low-energy register" },
  { c: "Thank you for trusting me with that. What feels heaviest about it right now?", why: "You mentioned feeling overwhelmed, so I'm gently opening space rather than fixing.", tech: "Open-question strategy \u00b7 empathy-first" },
  { c: "I remember you mentioned your exams felt close. Is that part of what\u2019s on your mind?", why: "You told me about your exams earlier this week \u2014 I kept that in mind.", tech: "Context recall: \u201cexams\u201d (this week)" },
  { c: "You don\u2019t have to have the words sorted out. We can just sit with it for a moment.", why: "You seemed unsure how to put it into words, so I'm easing the pressure to explain.", tech: "Cognitive-load reduction" },
];

/* ============================================================
   COMPANION (tabbed) — unified, soft active states
   ============================================================ */
function CompanionScreen({ name, chatStyle, explainMode, initialTab = 'chat', voiceLive = false }) {
  const [tab, setTab] = useStateK(initialTab);
  const tabs = [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'voice', label: 'Voice', icon: 'mic' },
    { id: 'empty', label: 'Empty Chair', icon: 'chair' },
  ];
  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement('div', { style: { padding: '18px 32px 0', borderBottom: '1px solid var(--line)', background: 'var(--surface)' } },
      React.createElement('div', { style: { display: 'flex', gap: 6 } },
        tabs.map((tb) => {
          const on = tb.id === tab;
          return React.createElement('button', { key: tb.id, onClick: () => setTab(tb.id), 'aria-pressed': on,
            style: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px 13px', border: 'none', background: 'none', whiteSpace: 'nowrap',
              borderBottom: `2.5px solid ${on ? 'var(--sage)' : 'transparent'}`,
              color: on ? 'var(--sage-deep)' : 'var(--ink-faint)', fontWeight: on ? 700 : 600, fontSize: 14.5, marginBottom: -1 } },
            React.createElement(Icon, { name: tb.icon, size: 17, stroke: on ? 2 : 1.75 }), tb.label);
        })
      )
    ),
    React.createElement('div', { style: { flex: 1, minHeight: 0 } },
      tab === 'chat' && React.createElement(ChatView, { key: 'chat', name, chatStyle, explainMode }),
      tab === 'voice' && React.createElement(VoiceView, { key: 'voice', name, autoStart: voiceLive, onSwitchToChat: () => setTab('chat') }),
      tab === 'empty' && React.createElement(EmptyChairView, { key: 'empty', name, explainMode })
    )
  );
}

/* ============================================================
   CHAT VIEW
   ============================================================ */
function ChatView({ name, chatStyle = 'bubbles', explainMode = 'plain-detail' }) {
  const [msgs, setMsgs] = useStateK([{ role: 'ai', ...CHAT_REPLIES[3], c: `Hi ${name}. I\u2019m here, and there\u2019s no rush. What\u2019s present for you right now?`, why: 'A soft, open start \u2014 no agenda, low pressure to perform.', tech: 'Greeting \u00b7 open register' }]);
  const [input, setInput] = useStateK('');
  const [typing, setTyping] = useStateK(false);
  const [ri, setRi] = useStateK(0);
  const endRef = useRefK(null);
  useEffectK(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, typing]);

  const send = () => {
    if (!input.trim()) return;
    const text = input.trim();
    const isCrisis = detectCrisis(text);
    setMsgs((m) => [...m, { role: 'user', c: text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      if (isCrisis) {
        setMsgs((m) => [...m, { role: 'ai', crisis: true,
          c: `I want to pause gently here, ${name}, because what you said sounds really painful \u2014 and you matter. You don\u2019t have to be alone with this. Is there someone you trust who could be with you right now?`,
          why: 'I noticed words about being unsafe, so I\u2019m slowing right down and gently encouraging real-life support.', tech: 'Crisis-aware response \u00b7 encourage human support' }]);
      } else {
        const r = CHAT_REPLIES[ri % CHAT_REPLIES.length];
        setRi((x) => x + 1);
        setMsgs((m) => [...m, { role: 'ai', ...r }]);
      }
    }, 1100);
  };

  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } },
    React.createElement('div', { className: 'no-scrollbar', style: { flex: 1, overflowY: 'auto', padding: '32px 0' } },
      React.createElement('div', { style: { maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: chatStyle === 'minimal' ? 28 : 20 } },
        msgs.map((m, i) => React.createElement(ChatMessage, { key: i, m, style: chatStyle, explainMode })),
        typing && React.createElement(TypingDots, null),
        React.createElement('div', { ref: endRef })
      )
    ),
    React.createElement(Composer, { value: input, onChange: setInput, onSend: send, placeholder: `Share your thoughts with SoulMate\u2026`, tone: 'var(--sage)' })
  );
}

function ChatMessage({ m, style, explainMode }) {
  const [showWhy, setShowWhy] = useStateK(false);
  const isUser = m.role === 'user';
  if (style === 'minimal' && !isUser) {
    return React.createElement('div', { className: 'fade-up', style: { paddingLeft: 4 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
        React.createElement('div', { style: { width: 24, height: 24, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'heart', size: 13, fill: 'var(--sage-deep)', stroke: 0 })),
        React.createElement('span', { className: 'label', style: { fontSize: 10 } }, 'SoulMate')),
      React.createElement('p', { style: { fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.55, color: 'var(--ink)', margin: 0, maxWidth: 600 } }, m.c),
      React.createElement(WhyChip, { m, showWhy, setShowWhy, explainMode })
    );
  }
  if (style === 'minimal' && isUser) {
    return React.createElement('div', { className: 'fade-up', style: { textAlign: 'right' } },
      React.createElement('p', { style: { fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-soft)', margin: 0, display: 'inline-block', maxWidth: 520, textAlign: 'left', borderLeft: '2px solid var(--clay)', paddingLeft: 14 } }, m.c));
  }
  // bubbles
  return React.createElement('div', { className: 'fade-up', style: { display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' } },
    !isUser && React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: m.crisis ? 'var(--care-soft)' : 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: 'heart', size: 16, fill: m.crisis ? 'var(--care)' : 'var(--sage-deep)', stroke: 0 })),
    React.createElement('div', { style: { maxWidth: '74%' } },
      React.createElement('div', { style: {
        padding: '13px 18px', fontSize: 15, lineHeight: 1.6,
        background: isUser ? 'var(--sage)' : m.crisis ? 'var(--care-tint)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--ink)',
        border: isUser ? 'none' : `1px solid ${m.crisis ? 'var(--care-soft)' : 'var(--line)'}`,
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        boxShadow: 'var(--shadow-soft)' } }, m.c),
      !isUser && React.createElement(WhyChip, { m, showWhy, setShowWhy, explainMode })
    )
  );
}

function WhyChip({ m, showWhy, setShowWhy, explainMode }) {
  if (!m.why) return null;
  return React.createElement('div', { style: { marginTop: 8 } },
    React.createElement('button', { onClick: () => setShowWhy((v) => !v),
      style: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 11.5, fontWeight: 600, padding: 0 } },
      React.createElement(Icon, { name: 'info', size: 13 }), showWhy ? 'Hide' : 'Why this reply?'),
    showWhy && React.createElement('div', { className: 'fade-up', style: { marginTop: 8, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', maxWidth: 420 } },
      React.createElement('div', { style: { fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 } }, m.why),
      explainMode === 'plain-detail' && m.tech && React.createElement('div', { style: { marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-body)', letterSpacing: '.02em' } },
        React.createElement('span', { style: { textTransform: 'uppercase', fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em' } }, 'How it works  '), m.tech)
    )
  );
}

function TypingDots() {
  return React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center' } },
    React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'heart', size: 16, fill: 'var(--sage-deep)', stroke: 0 })),
    React.createElement('div', { style: { display: 'flex', gap: 5, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '20px 20px 20px 4px' } },
      [0, 1, 2].map((i) => React.createElement('div', { key: i, style: { width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-faint)', animation: 'shimmer-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` } }))));
}

function Composer({ value, onChange, onSend, placeholder, tone, disabled }) {
  return React.createElement('div', { style: { padding: '16px 32px 24px' } },
    React.createElement('div', { style: { maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end', padding: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-card)', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' } },
      React.createElement('textarea', { value, onChange: (e) => { onChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; },
        onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }, rows: 1, placeholder,
        style: { flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', padding: '8px 12px', fontFamily: 'var(--font-body)', maxHeight: 140 } }),
      React.createElement('button', { onClick: onSend, disabled: !value.trim(), 'aria-label': 'Send',
        style: { width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0, background: value.trim() ? tone : 'var(--surface-2)', color: value.trim() ? '#fff' : 'var(--ink-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' } },
        React.createElement(Icon, { name: 'send', size: 18 }))
    )
  );
}

/* ============================================================
   VOICE — two states: idle (invite) + live transcript (ESP32)
   ============================================================ */
const VOICE_SCRIPT = [
  { you: "I\u2019ve been feeling a bit stretched thin this week, honestly.",
    ai: "Stretched thin \u2014 thank you for telling me. Let\u2019s slow down together. Where do you feel it pulling hardest?" },
  { you: "Mostly my exams. There\u2019s so much to do and not enough hours.",
    ai: "That pressure sounds heavy. You don\u2019t have to solve all of it right now \u2014 what\u2019s the one piece sitting closest to the surface?" },
  { you: "I think I\u2019m scared I\u2019ll let people down if I don\u2019t do well.",
    ai: "That fear makes so much sense, and it comes from how much you care. Could we take one slow breath together before we go on?" },
];

const VOICE_STAGES = [
  { id: 'listening', label: 'Listening', icon: 'mic', tone: 'var(--v-listen)', caption: 'Listening to you\u2026' },
  { id: 'transcribing', label: 'Transcribing', icon: 'feather', tone: 'var(--v-transcribe)', caption: 'Turning your words into text\u2026' },
  { id: 'preparing', label: 'Preparing', icon: 'sparkle', tone: 'var(--v-prepare)', caption: 'Preparing a gentle response\u2026' },
  { id: 'speaking', label: 'Speaking', icon: 'volume', tone: 'var(--v-speak)', caption: 'Speaking through your ESP32 companion\u2026' },
];

function VoiceView({ name, autoStart = false, onSwitchToChat }) {
  const [live, setLive] = useStateK(autoStart);
  return live
    ? React.createElement(VoiceLive, { name, onStop: () => setLive(false), onSwitchToChat })
    : React.createElement(VoiceIdle, { name, onStart: () => setLive(true), onSwitchToChat });
}

// ---- State 1: idle / invitation ----
function VoiceIdle({ name, onStart, onSwitchToChat }) {
  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', position: 'relative', textAlign: 'center' } },
    React.createElement('div', { style: { position: 'absolute', top: 22, display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-soft)', whiteSpace: 'nowrap' } },
      React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: 'var(--v-connected)', animation: 'conn-pulse 2.4s ease-out infinite' } }),
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600 } }, 'ESP32 companion'),
      React.createElement('span', { style: { fontSize: 12, color: 'var(--sage-deep)', fontWeight: 700 } }, 'Connected')),
    React.createElement('button', { onClick: onStart, 'aria-label': 'Tap to speak', style: { background: 'none', border: 'none', padding: 0, marginBottom: 30 } },
      React.createElement(BreathingOrb, { size: 208, tone: 'var(--sage)', active: true },
        React.createElement(Icon, { name: 'mic', size: 46, style: { color: 'var(--sage)' } }))),
    React.createElement('h2', { className: 'serif', style: { fontSize: 30, color: 'var(--ink)', margin: '0 0 8px', whiteSpace: 'nowrap' } }, 'Tap to speak'),
    React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, maxWidth: 380, margin: '0 0 4px' } },
      'A slower, spoken way to talk. Speak when you\u2019re ready \u2014 SoulMate listens, then replies out loud through your companion device.'),
    React.createElement('button', { onClick: onSwitchToChat, style: { marginTop: 18, background: 'none', border: 'none', color: 'var(--sage-deep)', fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 } },
      React.createElement(Icon, { name: 'chat', size: 15 }), 'or switch to Chat anytime')
  );
}

// ---- State 2: live transcript conversation ----
function VoiceLive({ name, onStop, onSwitchToChat }) {
  const [status, setStatus] = useStateK('listening'); // listening | transcribing | preparing | speaking | paused
  const [turns, setTurns] = useStateK([]); // {role, text}
  const [interim, setInterim] = useStateK('');
  const idxRef = useRefK(0);
  const timers = useRefK([]);
  const pausedRef = useRefK(false);
  const endRef = useRefK(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const wait = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  useEffectK(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, interim, status]);
  useEffectK(() => { runTurn(); return clearTimers; }, []); // eslint-disable-line

  function runTurn() {
    if (pausedRef.current) return;
    const turn = VOICE_SCRIPT[idxRef.current % VOICE_SCRIPT.length];
    // 1. Listening — reveal the spoken words progressively
    setStatus('listening');
    setInterim('');
    const words = turn.you.split(' ');
    let w = 0;
    const reveal = () => {
      if (pausedRef.current) return;
      w += 1;
      setInterim(words.slice(0, w).join(' '));
      if (w < words.length) { wait(150, reveal); }
      else {
        // 2. Transcribing
        wait(700, () => {
          if (pausedRef.current) return;
          setStatus('transcribing');
          wait(750, () => {
            if (pausedRef.current) return;
            setTurns((t) => [...t, { role: 'user', text: turn.you }]);
            setInterim('');
            // 3. Preparing
            setStatus('preparing');
            wait(1300, () => {
              if (pausedRef.current) return;
              // 4. Speaking
              setStatus('speaking');
              setTurns((t) => [...t, { role: 'ai', text: turn.ai }]);
              const speakMs = Math.min(5200, 1600 + turn.ai.length * 28);
              wait(speakMs, () => {
                if (pausedRef.current) return;
                idxRef.current += 1;
                if (idxRef.current >= VOICE_SCRIPT.length) { setStatus('paused'); pausedRef.current = true; }
                else { runTurn(); }
              });
            });
          });
        });
      }
    };
    wait(500, reveal);
  }

  const pause = () => { pausedRef.current = true; clearTimers(); setStatus('paused'); };
  const resume = () => { pausedRef.current = false; runTurn(); };
  const stop = () => { clearTimers(); pausedRef.current = true; onStop(); };

  const stage = VOICE_STAGES.find((s) => s.id === status);
  const isPaused = status === 'paused';

  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } },
    // ---- connection + pipeline header ----
    React.createElement('div', { style: { padding: '14px 32px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' } },
      React.createElement('div', { style: { maxWidth: 760, margin: '0 auto' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' } },
          React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 13px', borderRadius: 999, background: 'var(--sage-tint)', border: '1px solid var(--sage-soft)', whiteSpace: 'nowrap' } },
            React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--v-connected)', animation: isPaused ? 'none' : 'conn-pulse 2.4s ease-out infinite' } }),
            React.createElement(Icon, { name: 'volume', size: 14, style: { color: 'var(--sage-deep)' } }),
            React.createElement('span', { style: { fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 700 } }, 'ESP32 companion \u00b7 Connected')),
          React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600 } }, isPaused ? 'Paused' : 'Live conversation')
        ),
        React.createElement(VoicePipeline, { status })
      )
    ),
    // ---- transcript timeline ----
    React.createElement('div', { className: 'no-scrollbar', style: { flex: 1, overflowY: 'auto', padding: '26px 0' } },
      React.createElement('div', { style: { maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 16 } },
        turns.length === 0 && !interim && React.createElement('p', { style: { textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, padding: '20px 0' } }, 'Your conversation will appear here as you speak.'),
        turns.map((t, i) => React.createElement(VoiceLine, { key: i, role: t.role, text: t.text })),
        interim && React.createElement(VoiceInterim, { text: interim, status }),
        React.createElement('div', { ref: endRef })
      )
    ),
    // ---- status caption + controls ----
    React.createElement('div', { style: { borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '16px 32px 22px' } },
      React.createElement('div', { style: { maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 } },
          React.createElement(VoiceWave, { tone: isPaused ? 'var(--ink-faint)' : (stage ? stage.tone : 'var(--sage)'), active: !isPaused && (status === 'listening' || status === 'speaking') }),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 700, fontSize: 14, color: 'var(--ink)' } }, isPaused ? 'Conversation paused' : (stage ? stage.label : '')),
            React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-soft)' } }, isPaused ? 'Take your time. Resume whenever you\u2019re ready.' : (stage ? stage.caption : '')))
        ),
        React.createElement('div', { style: { display: 'flex', gap: 9, flexWrap: 'wrap' } },
          isPaused
            ? React.createElement(Button, { variant: 'primary', size: 'sm', icon: 'play', onClick: resume }, 'Resume')
            : React.createElement(Button, { variant: 'soft', size: 'sm', icon: 'pause', onClick: pause }, 'Pause'),
          React.createElement(Button, { variant: 'outline', size: 'sm', icon: 'x', onClick: stop }, 'Stop'),
          React.createElement(Button, { variant: 'ghost', size: 'sm', icon: 'chat', onClick: onSwitchToChat }, 'Switch to text chat')
        )
      )
    )
  );
}

function VoicePipeline({ status }) {
  const order = ['listening', 'transcribing', 'preparing', 'speaking'];
  const curIdx = order.indexOf(status);
  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
    VOICE_STAGES.map((s, i) => {
      const active = s.id === status;
      const done = curIdx > -1 && i < curIdx;
      const color = active ? s.tone : done ? 'var(--sage-deep)' : 'var(--ink-faint)';
      return React.createElement(React.Fragment, { key: s.id },
        React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 999, flexShrink: 0,
          background: active ? `color-mix(in oklab, ${s.tone} 14%, var(--surface))` : 'transparent',
          border: `1px solid ${active ? `color-mix(in oklab, ${s.tone} 38%, transparent)` : 'transparent'}`, transition: 'border-color .25s var(--ease)' } },
          React.createElement('span', { style: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: active ? s.tone : done ? 'var(--sage-soft)' : 'var(--surface-2)', color: active ? '#fff' : color, transition: 'all .25s' } },
            React.createElement(Icon, { name: done ? 'check' : s.icon, size: 12, stroke: 2.4 })),
          React.createElement('span', { style: { fontSize: 12, fontWeight: active ? 700 : 600, color, whiteSpace: 'nowrap' } }, s.label)),
        i < VOICE_STAGES.length - 1 && React.createElement('div', { style: { flex: 1, minWidth: 8, height: 2, borderRadius: 2, background: i < curIdx ? 'var(--sage)' : 'var(--line-strong)', transition: 'background .25s' } })
      );
    })
  );
}

function VoiceLine({ role, text }) {
  const isUser = role === 'user';
  return React.createElement('div', { className: 'fade-up', style: { display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: isUser ? 'flex-end' : 'flex-start' } },
    !isUser && React.createElement('div', { style: { width: 30, height: 30, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 } }, React.createElement(Icon, { name: 'heart', size: 15, fill: 'var(--sage-deep)', stroke: 0 })),
    React.createElement('div', { style: { maxWidth: '76%' } },
      React.createElement('div', { className: 'label', style: { fontSize: 9.5, marginBottom: 5, textAlign: isUser ? 'right' : 'left' } }, isUser ? 'You' : 'SoulMate'),
      React.createElement('div', { style: {
        padding: '12px 17px', fontSize: 15, lineHeight: 1.6,
        background: isUser ? 'var(--surface-2)' : 'var(--surface)',
        color: 'var(--ink)', border: `1px solid ${isUser ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px', boxShadow: 'var(--shadow-soft)' } }, text)
    ),
    isUser && React.createElement('div', { style: { width: 30, height: 30, borderRadius: '50%', background: 'var(--clay-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, color: 'var(--clay-deep)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-display)' } }, 'L')
  );
}

function VoiceInterim({ text, status }) {
  const labelMap = { listening: 'Hearing you\u2026', transcribing: 'Transcribing\u2026' };
  return React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'flex-end' } },
    React.createElement('div', { style: { maxWidth: '76%', textAlign: 'right' } },
      React.createElement('div', { className: 'label', style: { fontSize: 9.5, marginBottom: 5, color: 'var(--v-transcribe)' } }, labelMap[status] || 'You\u2026'),
      React.createElement('div', { style: { padding: '12px 17px', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', fontStyle: 'italic', background: 'color-mix(in oklab, var(--v-transcribe) 8%, var(--surface))', border: '1px dashed color-mix(in oklab, var(--v-transcribe) 45%, transparent)', borderRadius: '18px 18px 4px 18px', textAlign: 'left' } },
        text,
        React.createElement('span', { style: { display: 'inline-block', width: 2, height: 15, marginLeft: 3, background: 'var(--v-transcribe)', verticalAlign: 'middle', animation: 'caret-blink 1s step-end infinite' } }))
    )
  );
}

function VoiceWave({ tone = 'var(--sage)', active = true }) {
  const bars = [0.5, 0.8, 1, 0.65, 0.9, 0.55, 0.75];
  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 3, height: 34, width: 46, flexShrink: 0 } },
    bars.map((h, i) => React.createElement('span', { key: i, style: {
      width: 4, borderRadius: 4, background: tone, height: `${active ? 100 : 30 * h}%`, transformOrigin: 'center',
      animation: active ? `wave-bar ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.07}s infinite` : 'none', opacity: active ? 1 : 0.5 } }))
  );
}

/* ============================================================
   EMPTY CHAIR — a quiet reflection space (sage system)
   ============================================================ */
function EmptyChairView({ name, explainMode }) {
  const [started, setStarted] = useStateK(false);
  const [form, setForm] = useStateK({ who: '', rel: '', words: '' });
  const [msgs, setMsgs] = useStateK([]);
  const [input, setInput] = useStateK('');
  const [reentry, setReentry] = useStateK(false);
  const [locked, setLocked] = useStateK(false);
  const endRef = useRefK(null);
  useEffectK(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, reentry]);

  const begin = () => {
    if (!form.who.trim() || !form.rel.trim()) return;
    setStarted(true);
    setMsgs([{ role: 'sys', c: `This is your quiet space. Speak to ${form.who} as if they were here. There are no wrong words.` }, { role: 'ai', c: 'I\u2019m here. It\u2019s good to see you. What\u2019s been on your heart?' }]);
  };
  const send = () => {
    if (!input.trim() || locked) return;
    const text = input.trim();
    const isCrisis = detectCrisis(text);
    setMsgs((m) => [...m, { role: 'user', c: text }]);
    setInput('');
    setTimeout(() => {
      if (isCrisis) {
        setLocked(true);
        setMsgs((m) => [...m, { role: 'ai', crisis: true, c: `I\u2019m going to gently pause our reflection, ${name}, because what you shared matters more than any exercise. You deserve real support right now \u2014 please reach someone you trust. I\u2019ll be right here when you\u2019re ready.` }]);
        setTimeout(() => setReentry(true), 600);
      } else {
        setMsgs((m) => [...m, { role: 'ai', c: 'I hear how much that\u2019s weighed on you. Thank you for saying it to me. What did you most need from me back then?' }]);
      }
    }, 1100);
  };
  const choose = (id) => {
    setReentry(false);
    if (id === 'end') { setLocked(true); return; }
    setLocked(false);
    setMsgs((m) => [...m, { role: 'sys', c: { sounds: 'Soft rain is playing. Let it hold you for a moment.', grounding: 'Let\u2019s try 5\u20134\u20133\u20132\u20131 together \u2014 name five things you can see.', talk: 'Okay. Let\u2019s just talk, no roleplay. How are you feeling right now?', cont: `Whenever you\u2019re ready, you can keep speaking to ${form.who}.` }[id] || '' }]);
  };

  if (!started) {
    return React.createElement('div', { className: 'no-scrollbar', style: { height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 } },
      React.createElement('div', { className: 'card fade-up', style: { width: '100%', maxWidth: 520, padding: '36px 36px', textAlign: 'center', borderTop: '3px solid var(--sage)' } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 16 } }, React.createElement(IconBadge, { name: 'chair', tone: 'sage', size: 54, iconSize: 26 })),
        React.createElement('h2', { className: 'serif', style: { fontSize: 25, margin: '0 0 8px' } }, 'A quiet reflection space'),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 26 } }, 'The empty chair is a gentle way to say what\u2019s gone unsaid. Share a little context, and we\u2019ll begin softly \u2014 at your pace.'),
        React.createElement('div', { style: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 } },
          React.createElement(FormField, { label: 'Who is sitting with you?', val: form.who, onChange: (v) => setForm({ ...form, who: v }), ph: 'A parent, a friend, my younger self\u2026' }),
          React.createElement(FormField, { label: 'How would you describe the relationship?', val: form.rel, onChange: (v) => setForm({ ...form, rel: v }), ph: 'Loving but distant; complicated; lost\u2026', area: true }),
          React.createElement(FormField, { label: 'What have you never been able to say?', val: form.words, onChange: (v) => setForm({ ...form, words: v }), ph: 'Optional \u2014 only if you want to', area: true })
        ),
        React.createElement(Button, { variant: 'primary', size: 'lg', full: true, iconRight: 'arrowR', onClick: begin, disabled: !form.who.trim() || !form.rel.trim(), style: { marginTop: 24 } }, 'Begin gently')
      )
    );
  }

  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } },
    React.createElement('div', { style: { padding: '10px 32px', background: 'var(--sage-tint)', borderBottom: '1px solid var(--sage-soft)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 600 } },
      React.createElement(Icon, { name: 'shieldCheck', size: 15 }), `A gentle reflection with ${form.who}. You can pause anytime.`),
    React.createElement('div', { className: 'no-scrollbar', style: { flex: 1, overflowY: 'auto', padding: '28px 0' } },
      React.createElement('div', { style: { maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 18 } },
        msgs.map((m, i) => m.role === 'sys'
          ? React.createElement('div', { key: i, style: { alignSelf: 'center', textAlign: 'center', maxWidth: 460, fontSize: 13, color: 'var(--sage-deep)', background: 'var(--sage-tint)', border: '1px solid var(--sage-soft)', padding: '10px 18px', borderRadius: 99 } }, m.c)
          : React.createElement('div', { key: i, className: 'fade-up', style: { display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' } },
            m.role === 'ai' && React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: m.crisis ? 'var(--care-soft)' : 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: m.crisis ? 'shieldHeart' : 'chair', size: 16, style: { color: m.crisis ? 'var(--care)' : 'var(--sage-deep)' } })),
            React.createElement('div', { style: { maxWidth: '74%' } },
              React.createElement('div', { style: { padding: '13px 18px', fontSize: 15, lineHeight: 1.6, background: m.role === 'user' ? 'var(--sage)' : m.crisis ? 'var(--care-tint)' : 'var(--surface)', color: m.role === 'user' ? '#fff' : 'var(--ink)', border: m.role === 'user' ? 'none' : `1px solid ${m.crisis ? 'var(--care-soft)' : 'var(--line)'}`, borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', boxShadow: 'var(--shadow-soft)' } }, m.c))
          )),
        reentry && React.createElement(ReentrySheet, { who: form.who, onChoose: choose }),
        React.createElement('div', { ref: endRef })
      )
    ),
    React.createElement(Composer, { value: input, onChange: setInput, onSend: send, placeholder: locked ? 'Take your time \u2014 choose an option above.' : `Speak to ${form.who}\u2026`, tone: 'var(--sage)', disabled: locked })
  );
}

function ReentrySheet({ who, onChoose }) {
  const opts = [
    { id: 'sounds', label: 'Play calming sounds', icon: 'volume' },
    { id: 'grounding', label: 'Try 5\u20134\u20133\u20132\u20131 grounding', icon: 'waves' },
    { id: 'talk', label: 'Just talk normally', icon: 'chat' },
    { id: 'end', label: 'End the session for now', icon: 'moon' },
  ];
  return React.createElement('div', { className: 'fade-up', style: { alignSelf: 'center', width: '100%', maxWidth: 420, marginTop: 8 } },
    React.createElement('p', { style: { textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginBottom: 14, fontFamily: 'var(--font-display)' } }, 'How would you like to keep going?'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
      opts.map((o) => React.createElement('button', { key: o.id, onClick: () => onChoose(o.id),
        style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 14.5, fontWeight: 500, textAlign: 'left' } },
        React.createElement(Icon, { name: o.icon, size: 18, style: { color: 'var(--sage-deep)' } }), o.label)))
  );
}

function FormField({ label, val, onChange, ph, area }) {
  const common = { value: val, onChange: (e) => onChange(e.target.value), placeholder: ph,
    style: { width: '100%', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 14.5, fontFamily: 'var(--font-body)', resize: 'none' } };
  return React.createElement('div', null,
    React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sage-deep)', marginBottom: 7, letterSpacing: '.02em' } }, label),
    area ? React.createElement('textarea', { ...common, rows: 2 }) : React.createElement('input', common));
}

Object.assign(window, { CompanionScreen });
