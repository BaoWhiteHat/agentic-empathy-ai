// app.jsx — EmptyChair safety-support demo (green SoulMate design)
const { useState: useS, useEffect: useE, useRef: useR } = React;
const SR = window.SafetyRouter;

// Mock in-character replies. The REAL app streams these from the backend;
// here they only illustrate normal vs. softer "extra support" tone.
const REPLY_NORMAL = [
  'I’ve been waiting a long time to hear you say that. Go on — I’m listening.',
  'I remember it differently than you do… but tell me what it was like for you.',
  'That stayed with you all these years? I didn’t realise.',
];
const REPLY_EXTRA = [
  'I can hear how much this is weighing on you. We don’t have to rush — take your time.',
  'Thank you for trusting me with something this heavy. I’m staying right here.',
  'You’re carrying a lot. Let’s slow down together for a moment.',
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SAMPLES = [
  { tone: 'sage', label: 'Calm message', text: 'I keep thinking about the summers we spent at grandma’s house.' },
  { tone: 'clay', label: 'Distress', text: 'I feel so hopeless lately — completely numb, like I’m falling apart.' },
  { tone: 'care', label: 'Urgent', text: 'Honestly, sometimes I don’t want to be alive anymore.' },
];

function App() {
  const [started, setStarted] = useS(false);
  const [targetName, setTargetName] = useS('');
  const [relationship, setRelationship] = useS('');
  const [unspoken, setUnspoken] = useS('');
  const [messages, setMessages] = useS([]);
  const [input, setInput] = useS('');
  const [assessment, setAssessment] = useS(SR.LEVELS.normal);
  const [paused, setPaused] = useS(false);
  const [hadUrgent, setHadUrgent] = useS(false);
  const [panelOpen, setPanelOpen] = useS(false);
  const [confirmResume, setConfirmResume] = useS(false);
  const [overlay, setOverlay] = useS(null);       // 'grounding' | 'breathing' | 'safety'
  const [soundsOpen, setSoundsOpen] = useS(false);
  const [ended, setEnded] = useS(false);
  const scrollRef = useR(null);
  const taRef = useR(null);

  useE(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, panelOpen]);

  function startSession() {
    if (!targetName.trim() || !relationship.trim() || !unspoken.trim()) return;
    setStarted(true);
    setMessages([{ role: 'ai', content: `I’m here. Whatever you’ve been holding back — say it to me now.` }]);
  }

  function processMessage(text) {
    const a = SR.classifyMessage(text);
    setAssessment(a);
    setMessages((m) => [...m, { role: 'user', content: text }]);

    if (a.level === 'urgent') {
      // Function 7: pause roleplay — NO in-character reply is generated.
      setPaused(true);
      setHadUrgent(true);
      setTimeout(() => setPanelOpen(true), 280);
      return;
    }
    // normal / extra → gentle reply (softer tone for "extra")
    const reply = a.level === 'extra' ? pick(REPLY_EXTRA) : pick(REPLY_NORMAL);
    setTimeout(() => setMessages((m) => [...m, { role: 'ai', content: reply }]), 520);
  }

  function send() {
    const t = input.trim();
    if (!t || paused) return;
    setInput(''); if (taRef.current) taRef.current.style.height = 'auto';
    processMessage(t);
  }

  function chooseOption(action) {
    if (action === 'try_grounding') return setOverlay('grounding');
    if (action === 'try_breathing') return setOverlay('breathing');
    if (action === 'play_sounds') return setSoundsOpen(true);
    if (action === 'open_safety') return setOverlay('safety');
    if (action === 'end_session') {
      setPanelOpen(false); setPaused(false); setOverlay(null); setSoundsOpen(false);
      setEnded(true);
    }
  }

  function resumeConfirmed() {
    setConfirmResume(false); setPanelOpen(false); setPaused(false);
    setAssessment(SR.LEVELS.extra); // step down to softer support, not full intensity
    setMessages((m) => [...m, { role: 'ai', content: 'I’m right here with you. We’ll take this slowly, together.' }]);
  }

  function restart() {
    setStarted(false); setEnded(false); setMessages([]); setAssessment(SR.LEVELS.normal);
    setPaused(false); setHadUrgent(false); setPanelOpen(false); setSoundsOpen(false); setOverlay(null);
    setTargetName(''); setRelationship(''); setUnspoken('');
  }

  const showBanner = assessment.level === 'extra' && !paused && started;

  // ── Ended screen ──
  if (ended) {
    return (
      <Shell>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 28 }}>
          <div className="rise" style={{ textAlign: 'center', maxWidth: 380 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)' }}>
              <Icon name="leaf" size={28} />
            </div>
            <h2 className="serif" style={{ fontSize: 27, margin: '0 0 10px', color: 'var(--ink)' }}>Take good care of yourself.</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 24px' }}>
              This space stays open. Come back whenever you’re ready — there’s no rush.
            </p>
            <button onClick={restart} style={{ padding: '12px 24px', borderRadius: 'var(--r-pill)', fontWeight: 700, fontSize: 14.5, background: 'var(--sage)', color: '#fff', boxShadow: 'var(--shadow-soft)' }}>
              Start a new session
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Setup screen ──
  if (!started) {
    const ready = targetName.trim() && relationship.trim() && unspoken.trim();
    return (
      <Shell>
        <Header started={false} />
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <div className="card rise" style={{ width: '100%', maxWidth: 560, padding: '34px 32px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)' }}>
              <Icon name="user" size={26} />
            </div>
            <h2 className="serif" style={{ fontSize: 27, textAlign: 'center', margin: '0 0 8px', color: 'var(--ink)' }}>Creating your safe space</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, textAlign: 'center', color: 'var(--ink-soft)', margin: '0 auto 26px', maxWidth: 400 }}>
              Share a little context so we can hold this conversation with real care. Everything stays gentle and at your pace.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field label="1 · Who is sitting in the empty chair?">
                <input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g. my father, my younger self…" style={inputStyle} />
              </Field>
              <Field label="2 · How would you describe your relationship?">
                <textarea value={relationship} onChange={(e) => setRelationship(e.target.value)} rows={2} placeholder="e.g. caring but distant; we never spoke about feelings…" style={{ ...inputStyle, resize: 'none' }} />
              </Field>
              <Field label="3 · What words have you never been able to say?">
                <textarea value={unspoken} onChange={(e) => setUnspoken(e.target.value)} rows={2} placeholder="e.g. I just wanted you to be proud of me…" style={{ ...inputStyle, resize: 'none' }} />
              </Field>
              <button onClick={startSession} disabled={!ready}
                style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 15, background: 'var(--sage)', color: '#fff', boxShadow: ready ? 'var(--shadow-soft)' : 'none', opacity: ready ? 1 : 0.5 }}>
                Begin the conversation <Icon name="arrow-right" size={17} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Chat screen ──
  return (
    <Shell>
      <Header started targetName={targetName} assessment={assessment} />
      {showBanner && <SafetyBanner onOpenSafety={() => setOverlay('safety')} />}

      <div ref={scrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 8px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--sage-deep)', background: 'var(--sage-tint)', border: '1px solid color-mix(in oklab, var(--sage) 22%, transparent)', padding: '7px 16px', borderRadius: 'var(--r-pill)', textAlign: 'center', maxWidth: 460 }}>
              <Icon name="sparkles" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> Your safe space is open. Share what you’ve held back from {targetName}.
            </span>
          </div>
          {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
        </div>
      </div>

      {hadUrgent && !paused && <SupportFooter onOpenSafety={() => setOverlay('safety')} />}

      {/* preview-only simulate bar */}
      <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="label" style={{ fontSize: 10 }}>Preview · simulate a message</span>
        {SAMPLES.map((s) => {
          const t = toneVars(s.tone);
          return (
            <button key={s.label} onClick={() => !paused && processMessage(s.text)} disabled={paused}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 'var(--r-pill)', background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, opacity: paused ? 0.5 : 1 }}>
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '14px 24px 22px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end', padding: 7, borderRadius: 'var(--r-xl)', background: 'var(--surface)', border: `1px solid ${paused ? 'var(--line)' : 'var(--line-strong)'}`, boxShadow: 'var(--shadow-card)', opacity: paused ? 0.6 : 1 }}>
          <textarea ref={taRef} rows={1} value={input} disabled={paused}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={paused ? 'We’ve paused for now — choose an option above.' : `Speak to ${targetName}…`}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', resize: 'none', padding: '11px 14px', fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink)', maxHeight: 150 }} />
          <button onClick={send} disabled={!input.trim() || paused} aria-label="Send message"
            style={{ width: 46, height: 46, borderRadius: 'var(--r-md)', flexShrink: 0, display: 'grid', placeItems: 'center', background: (!input.trim() || paused) ? 'var(--surface-3)' : 'var(--sage)', color: (!input.trim() || paused) ? 'var(--ink-faint)' : '#fff', transition: 'all .16s var(--ease)' }}>
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>

      {/* Overlays */}
      {panelOpen && (
        <SafetySupportPanel
          targetName={targetName}
          options={SR.SUPPORT_OPTIONS}
          onChoose={chooseOption}
          onRequestResume={() => setConfirmResume(true)}
        />
      )}
      {confirmResume && <ConfirmResume targetName={targetName} onConfirm={resumeConfirmed} onCancel={() => setConfirmResume(false)} />}
      {overlay === 'grounding' && <GroundingExercise onComplete={() => setOverlay(null)} onSkip={() => setOverlay(null)} />}
      {overlay === 'breathing' && <BreathingModal onComplete={() => setOverlay(null)} />}
      {overlay === 'safety' && <SafetyPage onBack={() => setOverlay(null)} onTryGrounding={() => setOverlay('grounding')} onTryBreathing={() => setOverlay('breathing')} />}
      {soundsOpen && <CalmingSounds onClose={() => setSoundsOpen(false)} />}
    </Shell>
  );
}

// ── small presentational helpers ──
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line)', background: 'var(--surface-2)',
  fontSize: 14, color: 'var(--ink)', outline: 'none',
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="label" style={{ display: 'block', marginBottom: 7, color: 'var(--sage-deep)' }}>{label}</span>
      {children}
    </label>
  );
}

function Shell({ children }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 920, height: '100%', maxHeight: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lift)', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function Header({ started, targetName, assessment }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '15px 22px', borderBottom: '1px solid var(--line)', background: 'color-mix(in oklab, var(--surface) 75%, transparent)', backdropFilter: 'blur(8px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)' }}>
          <Icon name="sparkles" size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Empty Chair</h1>
          <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', margin: '2px 0 0' }}>{started ? `With ${targetName}` : 'A space to say the unspoken'}</p>
        </div>
      </div>
      {started && <SafetyStatusChip assessment={assessment} />}
    </header>
  );
}

function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--sage-deep)' }}>
          <Icon name="user" size={16} />
        </div>
      )}
      <div style={{
        maxWidth: '72%', padding: '12px 16px', fontSize: 14.5, lineHeight: 1.55,
        borderRadius: isUser ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
        background: isUser ? 'var(--sage)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--ink)',
        border: isUser ? 'none' : '1px solid var(--line)',
        boxShadow: 'var(--shadow-soft)',
      }}>
        {content}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
