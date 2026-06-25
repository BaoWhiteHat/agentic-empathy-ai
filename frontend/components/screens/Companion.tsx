'use client';
// components/screens/Companion.tsx — tabbed Chat / Physical / Empty Chair.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, BreathingOrb } from '../ui/primitives';
import { useChat } from '../../hooks/useChat';
import { fromBackendDecision, SUPPORT_OPTIONS, LEVELS, type Assessment, type SupportOption } from '../../lib/safetyRouter';
import { SafetyStatusChip, SafetyBanner, SafetySupportPanel, ConfirmResume, SupportFooter } from '../safety/SafetyBits';
import { GroundingExercise, BreathingModal, CalmingSounds, SafetyPage } from '../safety/Modals';
import { EmotionBadge } from '../EmotionBadge';
import { useTweaks } from '../../context/TweaksContext';

interface CompanionProps {
  name: string;
  initialTab?: 'chat' | 'voice' | 'empty';
  onExit?: () => void;
}

export function CompanionScreen({ name, initialTab = 'chat' }: CompanionProps) {
  const { tweaks } = useTweaks();
  const [tab, setTab] = useState<'chat' | 'voice' | 'empty'>(initialTab);
  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: 'chat' },
    { id: 'voice' as const, label: 'Physical', icon: 'mic' },
    { id: 'empty' as const, label: 'Empty Chair', icon: 'chair' },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 32px 0', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map((tb) => {
            const on = tb.id === tab;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)} aria-pressed={on}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px 13px', border: 'none', background: 'none', whiteSpace: 'nowrap', borderBottom: `2.5px solid ${on ? 'var(--sage)' : 'transparent'}`, color: on ? 'var(--sage-deep)' : 'var(--ink-faint)', fontWeight: on ? 700 : 600, fontSize: 14.5, marginBottom: -1, cursor: 'pointer' }}>
                <Icon name={tb.icon} size={17} stroke={on ? 2 : 1.75} />{tb.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'chat' && <ChatView key="chat" name={name} chatStyle={tweaks.chatStyle} />}
        {tab === 'voice' && <PhysicalCompanionView key="voice" />}
        {tab === 'empty' && <EmptyChairView key="empty" />}
      </div>
    </div>
  );
}

/* ============================================================
   Shared composer + typing dots
   ============================================================ */
function Composer({ value, onChange, onSend, placeholder, tone, disabled }: { value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; tone: string; disabled?: boolean }) {
  return (
    <div style={{ padding: '16px 32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end', padding: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-card)', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        <textarea value={value} onChange={(e) => { onChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} rows={1} placeholder={placeholder}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.5, color: 'var(--ink)', padding: '8px 12px', fontFamily: 'var(--font-body)', maxHeight: 140 }} />
        <button onClick={onSend} disabled={!value.trim()} aria-label="Send" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0, background: value.trim() ? tone : 'var(--surface-2)', color: value.trim() ? '#fff' : 'var(--ink-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s', cursor: value.trim() ? 'pointer' : 'default' }}>
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={16} fill="var(--sage-deep)" stroke={0} /></div>
      <div style={{ display: 'flex', gap: 5, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '20px 20px 20px 4px' }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-faint)', animation: 'shimmer-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />)}
      </div>
    </div>
  );
}

/* ============================================================
   CHAT VIEW
   ============================================================ */
function ChatView({ name, chatStyle = 'bubbles' }: { name: string; chatStyle?: string }) {
  const { messages, sendMessage, status, emotion } = useChat('messaging');
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status !== 'idle';

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, status]);

  const onSend = () => {
    if (!input.trim() || busy) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 32px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center' }}>
        <span className="label" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>How you seem right now</span>
        <span style={{ marginLeft: 'auto' }}><EmotionBadge emotion={emotion} /></span>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: chatStyle === 'minimal' ? 28 : 20 }}>
          {messages.length === 0 && !busy && (
            <div className="fade-up" style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '40px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BreathingOrb size={84} tone="var(--sage)"><Icon name="heart" size={24} fill="var(--sage)" stroke={0} /></BreathingOrb></div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink)', margin: 0 }}>{`Hi ${name}. I'm here, and there's no rush.`}</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>What's present for you right now?</p>
            </div>
          )}
          {messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} style={chatStyle} />)}
          {busy && <TypingDots />}
          <div ref={endRef} />
        </div>
      </div>
      <Composer value={input} onChange={setInput} onSend={onSend} placeholder={busy ? 'SoulMate is responding…' : 'Share your thoughts with SoulMate…'} tone="var(--sage)" disabled={busy} />
    </div>
  );
}

function ChatMessage({ role, content, style }: { role: 'user' | 'ai'; content: string; style: string }) {
  const isUser = role === 'user';
  if (style === 'minimal' && !isUser) {
    return (
      <div className="fade-up" style={{ paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={13} fill="var(--sage-deep)" stroke={0} /></div>
          <span className="label" style={{ fontSize: 10 }}>SoulMate</span>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'calc(var(--text-base) * 1.19)', lineHeight: 1.55, color: 'var(--ink)', margin: 0, maxWidth: 600 }}>{content}</p>
      </div>
    );
  }
  if (style === 'minimal' && isUser) {
    return (
      <div className="fade-up" style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 'calc(var(--text-base) * 0.97)', lineHeight: 1.55, color: 'var(--ink-soft)', margin: 0, display: 'inline-block', maxWidth: 520, textAlign: 'left', borderLeft: '2px solid var(--clay)', paddingLeft: 14 }}>{content}</p>
      </div>
    );
  }
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="heart" size={16} fill="var(--sage-deep)" stroke={0} /></div>}
      <div style={{ maxWidth: '74%' }}>
        <div style={{ padding: '13px 18px', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.6, background: isUser ? 'var(--sage)' : 'var(--surface)', color: isUser ? '#fff' : 'var(--ink)', border: isUser ? 'none' : '1px solid var(--line)', borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px', boxShadow: 'var(--shadow-soft)' }}>{content}</div>
      </div>
    </div>
  );
}

/* ============================================================
   PHYSICAL COMPANION VIEW — static guide page
   ============================================================ */
function PhysicalCompanionView() {
  return (
    <div className="no-scrollbar" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 40px 64px', fontFamily: 'var(--font-body)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
          </svg>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>Physical companion</h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 36px', lineHeight: 1.65 }}>
          Run SoulMate on real hardware — laptop mic, ESP32 speaker, and an OLED screen that shows live emotions.
        </p>

        {/* Hardware */}
        <p className="label" style={{ marginBottom: 12 }}>Hardware</p>
        <div className="card" style={{ marginBottom: 32 }}>
          {([
            { label: 'Board + audio + display', value: 'ESP32 · MAX98357A · SH1106 OLED' },
            { label: 'Serial port',             value: 'COM5'                             },
            { label: 'Baud rate',               value: '921600'                           },
            { label: 'Microphone',              value: 'Laptop mic (default)'             },
          ] as const).map((row, i) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{row.label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--ink)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 'var(--r-sm)' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Steps */}
        <p className="label" style={{ marginBottom: 14 }}>How to start</p>
        {([
          { n: 1, title: 'Navigate to the backend folder',  sub: 'Open a terminal at the project root',                                                                           cmd: 'cd backend'                        },
          { n: 2, title: 'Run the companion script',        sub: 'The script connects to ESP32 on COM5 and starts the AI pipeline automatically',                                  cmd: 'uv run python voice_companion.py'  },
          { n: 3, title: 'Wait for the ready signal',       sub: '"SoulMate" will appear on the OLED screen and the terminal will confirm the ESP32 connection. You\'re good to go.', cmd: null                              },
        ] as const).map((step) => (
          <div key={step.n} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--sage-tint)', color: 'var(--sage-deep)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {step.n}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>{step.title}</p>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>{step.sub}</p>
                {step.cmd && (
                  <code style={{ display: 'block', fontFamily: 'monospace', fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginTop: 10, color: 'var(--ink)', userSelect: 'all' }}>
                    {step.cmd}
                  </code>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Controls */}
        <p className="label" style={{ marginBottom: 14, marginTop: 32 }}>Controls</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {([
            { key: 'SPACE',  label: 'SPACE', title: 'Push to talk', desc: 'Press to start recording, release to send' },
            { key: 'Q',  label: 'Q',     title: 'Quit',         desc: 'Closes the companion and frees COM5'       },
          ] as const).map((k) => (
            <div key={k.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontFamily: 'monospace', fontSize: k.label === 'SPACE' ? 10 : 18, fontWeight: 500, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-md)', color: 'var(--ink)', flexShrink: 0 }}>
                {k.key}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px', color: 'var(--ink)' }}>{k.title}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>{k.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.65, margin: 0 }}>
          No ESP32? The script falls back to laptop speakers via pygame. Set{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12 }}>COMPANION_USER_ID</code>{' '}
          in your <code style={{ fontFamily: 'monospace', fontSize: 12 }}>.env</code>{' '}
          to change the user name (default:{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12 }}>Ghostman</code>).
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY CHAIR VIEW
   ============================================================ */
function EmptyChairView() {
  const { messages, sendMessage, socket, emotion } = useChat('empty-chair');
  const [started, setStarted] = useState(false);
  const [form, setForm] = useState({ who: '', rel: '', words: '' });
  const [input, setInput] = useState('');
  const [assessment, setAssessment] = useState<Assessment>({ ...LEVELS.normal });
  const [paused, setPaused] = useState(false);
  const [hadCrisis, setHadCrisis] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [overlay, setOverlay] = useState<'grounding' | 'breathing' | 'safety' | null>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elevated, setElevated] = useState(false);
  const [sysNotif, setSysNotif] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [showSafeBanner, setShowSafeBanner] = useState(false);
  const [ambience, setAmbience] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);

  const inputLocked = paused || panelOpen;
  const visibleMessages = messages.filter((m) => !m.content.startsWith('[SYSTEM_INIT]'));
  const lastAiIndex = visibleMessages.map((m) => m.role).lastIndexOf('ai');
  const crisisText = lastAiIndex >= 0 ? visibleMessages[lastAiIndex].content : '';
  const bubbleMessages = stopped && lastAiIndex >= 0
    ? visibleMessages.filter((_, i) => i !== lastAiIndex)
    : visibleMessages;

  const AMBIENCE_TRACKS = [
    { id: 'forest', label: 'Forest', icon: 'trees' },
    { id: 'ocean', label: 'Ocean', icon: 'waves' },
    { id: 'rain', label: 'Rain', icon: 'cloud-rain' },
  ];

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [visibleMessages.length, panelOpen]);
  useEffect(() => () => { if (notifTimer.current) clearTimeout(notifTimer.current); }, []);

  useEffect(() => {
    const a = new Audio();
    a.loop = true;
    a.volume = 0.3;
    ambienceRef.current = a;
    return () => { a.pause(); a.src = ''; ambienceRef.current = null; };
  }, []);

  const selectAmbience = (id: string) => {
    const a = ambienceRef.current;
    if (!a) return;
    if (ambience === id) { a.pause(); setAmbience(null); return; }
    a.src = `/audio/${id}.mp3`;
    a.volume = 0.3;
    a.play().catch(() => {});
    setAmbience(id);
  };

  useEffect(() => {
    if (!socket) return;
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'safety_decision') {
          const a = fromBackendDecision(data);
          setAssessment(a);
          setElevated((prev) => prev || a.level === 'extra');
          setShowSafeBanner(data.action === 'safe_roleplay');
          if (data.action === 'stop_roleplay') {
            setStopped(true); setPaused(true); setHadCrisis(true); setOverlay('safety');
          }
        } else if (data.type === 'crisis_mode') {
          setAssessment({ ...LEVELS.urgent });
          setStopped(true); setPaused(true); setHadCrisis(true); setOverlay('safety');
        } else if (data.type === 'elevated_mode' && data.active) {
          setElevated(true);
        } else if (data.type === 're_entry_choice') {
          setPaused(true); setPanelOpen(true);
        } else if (data.type === 'system_message') {
          if (notifTimer.current) clearTimeout(notifTimer.current);
          setSysNotif(data.text);
          notifTimer.current = setTimeout(() => setSysNotif(null), 5000);
        } else if (data.type === 'safety_summary') {
          setPaused(false); setPanelOpen(false); setElevated(false);
        }
      } catch { /* ignore */ }
    };
    socket.addEventListener('message', handler);
    return () => socket.removeEventListener('message', handler);
  }, [socket]);

  const begin = () => {
    if (!form.who.trim() || !form.rel.trim()) return;
    setStarted(true);
    const payload = `[SYSTEM_INIT] TARGET: ${form.who} | RELATIONSHIP: ${form.rel} | UNSPOKEN_NEED: ${form.words || 'to be heard'} | MESSAGE: I'm ready to begin the empty chair session.`;
    sendMessage(payload);
  };

  const send = () => {
    if (!input.trim() || inputLocked) return;
    sendMessage(input.trim());
    setInput('');
  };

  const onBreathingComplete = () => {
    setOverlay(null);
    if (hadCrisis && paused && !panelOpen) {
      socket?.send(JSON.stringify({ action: 'show_reentry_options' }));
    }
  };

  const chooseOption = (action: SupportOption['action']) => {
    if (action === 'try_grounding') return setOverlay('grounding');
    if (action === 'try_breathing') return setOverlay('breathing');
    if (action === 'play_sounds') return setSoundsOpen(true);
    if (action === 'open_safety') return setOverlay('safety');
    if (action === 'end_session') {
      socket?.send(JSON.stringify({ action: 'end_session' }));
      setPanelOpen(false); setPaused(false); setOverlay(null); setSoundsOpen(false);
      setEnded(true);
    }
  };

  const resumeConfirmed = () => {
    setConfirmResume(false); setPanelOpen(false); setPaused(false);
    setAssessment({ ...LEVELS.extra });
    socket?.send(JSON.stringify({ action: 'resume_roleplay' }));
  };

  const restart = () => {
    setStarted(false); setEnded(false); setForm({ who: '', rel: '', words: '' });
    setAssessment({ ...LEVELS.normal }); setPaused(false); setHadCrisis(false);
    setPanelOpen(false); setSoundsOpen(false); setOverlay(null); setElevated(false);
    setStopped(false); setShowSafeBanner(false);
    ambienceRef.current?.pause(); setAmbience(null);
  };

  if (ended) {
    return (
      <div style={{ position: 'relative', height: '100%', display: 'grid', placeItems: 'center', padding: 28 }}>
        <div className="rise" style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)' }}><Icon name="leaf" size={28} /></div>
          <h2 className="serif" style={{ fontSize: 27, margin: '0 0 10px', color: 'var(--ink)' }}>Take good care of yourself.</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 24px' }}>This space stays open. Come back whenever you're ready — there's no rush.</p>
          <Button variant="primary" onClick={restart}>Start a new session</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    const ready = form.who.trim() && form.rel.trim();
    return (
      <div className="no-scrollbar" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div className="card fade-up" style={{ width: '100%', maxWidth: 520, padding: '36px 36px', textAlign: 'center', borderTop: '3px solid var(--sage)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><IconBadge name="chair" tone="sage" size={54} iconSize={26} /></div>
          <h2 className="serif" style={{ fontSize: 25, margin: '0 0 8px' }}>A quiet reflection space</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 26 }}>The empty chair is a gentle way to say what's gone unsaid. Share a little context, and we'll begin softly — at your pace.</p>
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <FormField label="Who is sitting in the empty chair?" val={form.who} onChange={(v) => setForm({ ...form, who: v })} ph="A parent, a friend, my younger self…" />
            <FormField label="How would you describe your relationship?" val={form.rel} onChange={(v) => setForm({ ...form, rel: v })} ph="Loving but distant; complicated; lost…" area />
            <FormField label="What words have you never been able to say?" val={form.words} onChange={(v) => setForm({ ...form, words: v })} ph="Optional — only if you want to" area />
          </div>
          <Button variant="primary" size="lg" full iconRight="arrowR" onClick={begin} disabled={!ready} style={{ marginTop: 24 }}>Begin gently</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 32px', background: 'var(--sage-tint)', borderBottom: '1px solid var(--sage-soft)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 600 }}>
          <Icon name="shieldCheck" size={15} />{`A gentle reflection with ${form.who}. You can pause anytime.`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <EmotionBadge emotion={emotion} />
          <SafetyStatusChip assessment={assessment} />
        </span>
      </div>

      <div style={{ padding: '8px 32px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="label" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Ambience</span>
        {AMBIENCE_TRACKS.map((tr) => {
          const on = ambience === tr.id;
          return (
            <button key={tr.id} onClick={() => selectAmbience(tr.id)} aria-pressed={on}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: on ? 'var(--sage)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-soft)', cursor: 'pointer' }}>
              <Icon name={tr.icon} size={13} /> {tr.label}
            </button>
          );
        })}
      </div>

      {showSafeBanner && !stopped && (
        <div className="fade-up" style={{ padding: '9px 32px', background: 'var(--sage-tint)', borderBottom: '1px solid var(--sage-soft)', fontSize: 13, fontWeight: 600, color: 'var(--sage-deep)', textAlign: 'center' }}>
          SoulMate is here with you 💚
        </div>
      )}
      {elevated && !paused && !stopped && <SafetyBanner onOpenSafety={() => setOverlay('safety')} />}

      <div ref={scrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--sage-deep)', background: 'var(--sage-tint)', border: '1px solid color-mix(in oklab, var(--sage) 22%, transparent)', padding: '7px 16px', borderRadius: 'var(--r-pill)', textAlign: 'center', maxWidth: 460 }}>
              <Icon name="sparkles" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> Your safe space is open. Share what you've held back from {form.who}.
            </span>
          </div>
          {bubbleMessages.map((m, i) => <ECBubble key={i} role={m.role} content={m.content} speaker={form.who} crisis={assessment.level === 'urgent' && m.role === 'ai' && i === bubbleMessages.length - 1} />)}
          {sysNotif && (
            <div className="fade-up" style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 500, padding: '7px 16px', borderRadius: 999 }}>{sysNotif}</div>
            </div>
          )}
        </div>
      </div>

      {hadCrisis && !paused && <SupportFooter onOpenSafety={() => setOverlay('safety')} />}

      {stopped ? (
        <div style={{ padding: '16px 32px 24px' }}>
          <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: '18px 20px', borderTop: '3px solid var(--care)', background: 'var(--care-tint)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--care-soft)', color: 'var(--care)' }}><Icon name="shieldHeart" size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--care)', marginBottom: 4 }}>This reflection is paused for your safety</div>
              {crisisText && <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{crisisText}</p>}
              <Button variant="primary" size="sm" icon="heart-handshake" onClick={() => setOverlay('safety')}>Support resources</Button>
            </div>
          </div>
        </div>
      ) : (
        <Composer value={input} onChange={setInput} onSend={send} placeholder={inputLocked ? 'Take your time — choose an option above.' : `Speak to ${form.who}…`} tone="var(--sage)" disabled={inputLocked} />
      )}

      {panelOpen && <SafetySupportPanel targetName={form.who} options={SUPPORT_OPTIONS} onChoose={chooseOption} onRequestResume={() => setConfirmResume(true)} />}
      {confirmResume && <ConfirmResume targetName={form.who} onConfirm={resumeConfirmed} onCancel={() => setConfirmResume(false)} />}
      {overlay === 'grounding' && <GroundingExercise onComplete={() => setOverlay(null)} onSkip={() => setOverlay(null)} />}
      {overlay === 'breathing' && <BreathingModal onComplete={onBreathingComplete} />}
      {overlay === 'safety' && <SafetyPage onBack={() => setOverlay(null)} onTryGrounding={() => setOverlay('grounding')} onTryBreathing={() => setOverlay('breathing')} />}
      {soundsOpen && <CalmingSounds onClose={() => setSoundsOpen(false)} />}
    </div>
  );
}

function ECBubble({ role, content, crisis, speaker }: { role: 'user' | 'ai'; content: string; crisis?: boolean; speaker?: string }) {
  const isUser = role === 'user';
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={{ width: 32, height: 32, borderRadius: '50%', background: crisis ? 'var(--care-soft)' : 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={crisis ? 'shieldHeart' : 'chair'} size={16} style={{ color: crisis ? 'var(--care)' : 'var(--sage-deep)' }} /></div>}
      <div style={{ maxWidth: '74%' }}>
        {!isUser && speaker && <div className="label" style={{ fontSize: 10, marginBottom: 5, color: crisis ? 'var(--care)' : 'var(--sage-deep)' }}>{`${speaker}:`}</div>}
        <div style={{ padding: '13px 18px', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.6, background: isUser ? 'var(--sage)' : crisis ? 'var(--care-tint)' : 'var(--surface)', color: isUser ? '#fff' : 'var(--ink)', border: isUser ? 'none' : `1px solid ${crisis ? 'var(--care-soft)' : 'var(--line)'}`, borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px', boxShadow: 'var(--shadow-soft)' }}>{content}</div>
      </div>
    </div>
  );
}

function FormField({ label, val, onChange, ph, area }: { label: string; val: string; onChange: (v: string) => void; ph: string; area?: boolean }) {
  const common = {
    value: val,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder: ph,
    style: { width: '100%', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', fontSize: 14.5, fontFamily: 'var(--font-body)', resize: 'none' as const },
  };
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sage-deep)', marginBottom: 7, letterSpacing: '.02em' }}>{label}</label>
      {area ? <textarea {...common} rows={2} /> : <input {...common} />}
    </div>
  );
}