'use client';
// components/screens/Companion.tsx — tabbed Chat / Physical / Empty Chair.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconBadge, BreathingOrb } from '../ui/primitives';
import { useChat } from '../../hooks/useChat';
import { fromBackendDecision, LEVELS, type Assessment } from '../../lib/safetyRouter';
import { SafetyStatusChip, SafetyBanner, SupportFooter } from '../safety/SafetyBits';
import { EmotionBadge } from '../EmotionBadge';
import { useTweaks } from '../../context/TweaksContext';
import type { CrisisSupportSession } from './Safety';

interface CompanionProps {
  name: string;
  initialTab?: 'chat' | 'voice' | 'empty';
  onExit?: () => void;
  onOpenSafety?: (crisisSupport?: CrisisSupportSession) => void;
}

export function CompanionScreen({ name, initialTab = 'chat', onOpenSafety }: CompanionProps) {
  const { tweaks } = useTweaks();
  const [tab, setTab] = useState<'chat' | 'voice' | 'empty'>(initialTab);
  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: 'chat' },
    { id: 'voice' as const, label: 'Physical', icon: 'mic' },
    { id: 'empty' as const, label: 'Empty Chair', icon: 'chair' },
  ];
  return (
    <div className="companion-screen" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="companion-tabs" style={{ padding: '18px 32px 0', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="companion-tab-list" style={{ display: 'flex', gap: 6 }}>
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
        {tab === 'empty' && <EmptyChairView key="empty" onOpenSafety={onOpenSafety} />}
      </div>
    </div>
  );
}

/* ============================================================
   Shared composer + typing dots
   ============================================================ */
function Composer({ value, onChange, onSend, placeholder, tone, disabled }: { value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; tone: string; disabled?: boolean }) {
  return (
    <div className="companion-composer" style={{ padding: '16px 32px 24px' }}>
      <div className="companion-composer-box" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end', padding: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-card)', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
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
      <div className="chat-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={16} fill="var(--sage-deep)" stroke={0} /></div>
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
  const { prefersReducedMotion } = useTweaks();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status !== 'idle';
  const scrollToEnd = useCallback((behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth') => {
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [prefersReducedMotion]);
  const handleReveal = useCallback(() => scrollToEnd('auto'), [scrollToEnd]);

  useEffect(() => { scrollToEnd(); }, [messages, status, scrollToEnd]);

  const onSend = () => {
    if (!input.trim() || busy) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="companion-chat" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="companion-emotion-bar" style={{ padding: '12px 32px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center' }}>
        <span className="label" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>How you seem right now</span>
        <span style={{ marginLeft: 'auto' }}><EmotionBadge emotion={emotion} /></span>
      </div>
      <div className="companion-message-stream no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
        <div className="companion-message-column" style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: chatStyle === 'minimal' ? 28 : 20 }}>
          {messages.length === 0 && !busy && (
            <div className="companion-empty-state fade-up" style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '40px 0' }}>
              <div className="companion-empty-visual" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BreathingOrb size={84} tone="var(--sage)"><Icon name="heart" size={24} fill="var(--sage)" stroke={0} /></BreathingOrb></div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink)', margin: 0 }}>{`Hi ${name}. I'm here, and there's no rush.`}</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>What&apos;s present for you right now?</p>
            </div>
          )}
          {messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} style={chatStyle} animate={m.role === 'ai' && !!m.stream && !prefersReducedMotion} onReveal={handleReveal} />)}
          {busy && <TypingDots />}
          <div ref={endRef} />
        </div>
      </div>
      <Composer value={input} onChange={setInput} onSend={onSend} placeholder={busy ? 'SoulMate is responding…' : 'Share your thoughts with SoulMate…'} tone="var(--sage)" disabled={busy} />
    </div>
  );
}

function useTypewriterText(content: string, enabled: boolean, onReveal?: () => void) {
  const [visible, setVisible] = useState(enabled ? '' : content);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync display text when animation is disabled
      setVisible(content);
      return;
    }
    if (!content) {
      setVisible('');
      return;
    }

    let index = 0;
    const chunkSize = content.length > 700 ? 5 : content.length > 260 ? 3 : 2;
    setVisible('');
    const timer = setInterval(() => {
      index = Math.min(content.length, index + chunkSize);
      setVisible(content.slice(0, index));
      onReveal?.();
      if (index >= content.length) clearInterval(timer);
    }, 18);

    return () => clearInterval(timer);
  }, [content, enabled, onReveal]);

  return visible;
}

function ChatMessage({ role, content, style, animate = false, onReveal }: { role: 'user' | 'ai'; content: string; style: string; animate?: boolean; onReveal?: () => void }) {
  const isUser = role === 'user';
  const visibleContent = useTypewriterText(content, animate && !isUser, onReveal);
  if (style === 'minimal' && !isUser) {
    return (
      <div className="fade-up" style={{ paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div className="chat-avatar" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={13} fill="var(--sage-deep)" stroke={0} /></div>
          <span className="label" style={{ fontSize: 10 }}>SoulMate</span>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'calc(var(--text-base) * 1.19)', lineHeight: 1.55, color: 'var(--ink)', margin: 0, maxWidth: 600 }}>{visibleContent}</p>
      </div>
    );
  }
  if (style === 'minimal' && isUser) {
    return (
      <div className="fade-up" style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 'calc(var(--text-base) * 0.97)', lineHeight: 1.55, color: 'var(--ink-soft)', margin: 0, display: 'inline-block', maxWidth: 520, textAlign: 'left', borderLeft: '2px solid var(--clay)', paddingLeft: 14 }}>{visibleContent}</p>
      </div>
    );
  }
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div className="chat-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="heart" size={16} fill="var(--sage-deep)" stroke={0} /></div>}
      <div className="chat-message-content" style={{ maxWidth: '74%' }}>
        <div className="chat-bubble" style={{ padding: '13px 18px', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.6, background: isUser ? 'var(--sage)' : 'var(--surface)', color: isUser ? '#fff' : 'var(--ink)', border: isUser ? 'none' : '1px solid var(--line)', borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px', boxShadow: 'var(--shadow-soft)' }}>{visibleContent}</div>
      </div>
    </div>
  );
}

/* ============================================================
   PHYSICAL COMPANION VIEW — hardware overview
   ============================================================ */
function PhysicalCompanionView() {
  const hardware = ['ESP32', 'SH1106 OLED', 'MAX98357A speaker', 'Laptop mic'];
  const steps = [
    { icon: 'mic', title: 'Speak naturally', desc: 'User speaks through the laptop microphone.' },
    { icon: 'sparkle', title: 'SoulMate responds', desc: 'The backend runs the SoulMate emotion, memory, safety, and dialogue pipeline.' },
    { icon: 'volume', title: 'Hardware mirrors it', desc: 'The ESP32 shows emotion on the OLED and plays the response through the speaker.' },
  ];
  const commands = ['cd backend', 'uv run python voice_companion.py'];
  const controls = [
    { key: 'SPACE', title: 'Push to talk', desc: 'Hold to record, release to send.' },
    { key: 'Q', title: 'Quit', desc: 'Stops the local companion session.' },
  ];

  return (
    <div className="physical-companion no-scrollbar" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="physical-companion-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 56px', fontFamily: 'var(--font-body)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span className="label">Hardware companion</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 'var(--r-pill)', background: 'var(--sage-tint)', color: 'var(--sage-deep)', border: '1px solid color-mix(in oklab, var(--sage) 24%, transparent)', fontSize: 12, fontWeight: 700 }}>
                <Icon name="shieldCheck" size={14} /> Standalone hardware mode
              </span>
            </div>
            <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.05, margin: '0 0 12px', color: 'var(--ink)' }}>Physical companion</h1>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.65 }}>
              A standalone hardware companion that mirrors SoulMate through voice, OLED emotion display, and speaker output.
            </p>
          </div>
        </header>

        <section className="physical-primary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 18, alignItems: 'stretch', marginBottom: 18 }}>
          <div className="physical-device-card card" style={{ padding: 28, minHeight: 430, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24, boxShadow: 'var(--shadow-card)', background: 'linear-gradient(135deg, var(--surface), var(--surface-2))' }}>
            <div>
              <p className="label" style={{ margin: '0 0 10px' }}>Hardware prototype</p>
              <h2 className="serif" style={{ fontSize: 26, margin: 0, color: 'var(--ink)' }}>Voice, emotion, and presence in a small device.</h2>
            </div>

            <div style={{ display: 'grid', placeItems: 'center', minHeight: 235 }}>
              <div aria-hidden="true" style={{ width: 'min(100%, 350px)', aspectRatio: '1.18 / 1', borderRadius: 38, padding: 20, background: 'var(--surface-2)', border: '1px solid var(--line)', boxShadow: 'inset 0 1px 0 color-mix(in oklab, var(--surface) 84%, transparent), var(--shadow-soft)', position: 'relative' }}>
                <div style={{ height: '100%', borderRadius: 28, background: 'var(--bg)', border: '1px solid var(--line-strong)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 15, left: 18, right: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0, color: 'var(--ink-faint)' }}>SOULMATE</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--clay)' }} />
                  </div>
                  <div style={{ width: 138, height: 86, borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sage-deep)', boxShadow: 'var(--shadow-soft)' }}>
                    <Icon name="heart" size={34} fill="currentColor" stroke={0} />
                  </div>
                  <div style={{ position: 'absolute', bottom: 18, display: 'flex', gap: 7 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} style={{ width: 9, height: 24 + i * 4, borderRadius: 999, background: i === 2 ? 'var(--sage)' : 'color-mix(in oklab, var(--sage) 34%, var(--surface))' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {hardware.map((item) => (
                <span key={item} style={{ padding: '7px 11px', borderRadius: 'var(--r-pill)', background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="physical-how-card card" style={{ padding: 26, boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p className="label" style={{ margin: '0 0 10px' }}>How it works</p>
              <h2 className="serif" style={{ fontSize: 25, margin: 0, color: 'var(--ink)' }}>Runs from the backend terminal, then speaks through the device.</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((step, i) => (
                <div key={step.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '15px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--sage-tint)', color: 'var(--sage-deep)', border: '1px solid color-mix(in oklab, var(--sage) 20%, transparent)' }}>
                    <Icon name={step.icon} size={19} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-faint)' }}>{i + 1}</span>
                      <h3 style={{ margin: 0, fontSize: 15, color: 'var(--ink)', fontWeight: 700 }}>{step.title}</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: 'auto 0 0', fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
              The browser does not directly control the ESP32. Start the hardware companion from a backend terminal.
            </p>
          </div>
        </section>

        <section className="physical-secondary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 18, marginBottom: 18 }}>
          <div className="physical-info-card card" style={{ padding: 22, boxShadow: 'var(--shadow-soft)' }}>
            <p className="label" style={{ margin: '0 0 12px' }}>Run locally</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commands.map((cmd) => (
                <code key={cmd} style={{ display: 'block', fontFamily: 'monospace', fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '11px 13px', color: 'var(--ink)', userSelect: 'all', overflowX: 'auto' }}>
                  {cmd}
                </code>
              ))}
            </div>
          </div>

          <div className="physical-info-card card" style={{ padding: 22, boxShadow: 'var(--shadow-soft)' }}>
            <p className="label" style={{ margin: '0 0 12px' }}>Controls</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {controls.map((control) => (
                <div key={control.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <kbd style={{ minWidth: 54, height: 38, padding: '0 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line-strong)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: control.key === 'SPACE' ? 11 : 18, fontWeight: 700 }}>
                    {control.key}
                  </kbd>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{control.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{control.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <details className="card" style={{ padding: '15px 18px', background: 'var(--surface-2)', borderColor: 'var(--line)', boxShadow: 'none' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 13, fontWeight: 700 }}>Developer setup details</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 14, color: 'var(--ink-faint)', fontSize: 12.5, lineHeight: 1.5 }}>
            <span>Default serial port: <code style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>COM5</code></span>
            <span>Baud rate: <code style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>921600</code></span>
            <span>User override: <code style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>COMPANION_USER_ID</code></span>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY CHAIR VIEW
   ============================================================ */
function EmptyChairView({ onOpenSafety }: { onOpenSafety?: (crisisSupport?: CrisisSupportSession) => void }) {
  const { messages, sendMessage, socket, emotion, resetSession } = useChat('empty-chair');
  const [started, setStarted] = useState(false);
  const [form, setForm] = useState({ who: '', rel: '', words: '' });
  const [input, setInput] = useState('');
  const [assessment, setAssessment] = useState<Assessment>({ ...LEVELS.normal });
  const [paused, setPaused] = useState(false);
  const [hadCrisis, setHadCrisis] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elevated, setElevated] = useState(false);
  const [sysNotif, setSysNotif] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [showSafeBanner, setShowSafeBanner] = useState(false);
  const [ambience, setAmbience] = useState<string | null>(null);
  const [safetyHandoffPending, setSafetyHandoffPending] = useState(false);
  const [crisisAiBaseline, setCrisisAiBaseline] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const crisisSafetyOpenedRef = useRef(false);

  const inputLocked = paused;
  const visibleMessages = messages.filter((m) => !m.content.startsWith('[SYSTEM_INIT]'));
  const aiMessageCount = visibleMessages.filter((m) => m.role === 'ai').length;
  const lastAiIndex = visibleMessages.map((m) => m.role).lastIndexOf('ai');
  const hasCrisisResponse = stopped && aiMessageCount > crisisAiBaseline;
  const crisisText = hasCrisisResponse && lastAiIndex >= 0 ? visibleMessages[lastAiIndex].content : '';
  const bubbleMessages = hasCrisisResponse && lastAiIndex >= 0
    ? visibleMessages.filter((_, i) => i !== lastAiIndex)
    : visibleMessages;

  const AMBIENCE_TRACKS = [
    { id: 'forest', label: 'Forest', icon: 'trees' },
    { id: 'ocean', label: 'Ocean', icon: 'waves' },
    { id: 'rain', label: 'Rain', icon: 'cloud-rain' },
  ];

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [visibleMessages.length]);
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

  const endSession = useCallback(() => {
    socket?.send(JSON.stringify({ action: 'end_session' }));
    setSafetyHandoffPending(false);
    setPaused(false);
    setEnded(true);
  }, [socket]);

  const resumeSession = useCallback(() => {
    setSafetyHandoffPending(false);
    setPaused(false);
    setAssessment({ ...LEVELS.extra });
    crisisSafetyOpenedRef.current = false;
    socket?.send(JSON.stringify({ action: 'resume_roleplay' }));
  }, [socket]);

  const openCrisisSafety = useCallback(() => {
    if (!onOpenSafety || crisisSafetyOpenedRef.current) return;
    crisisSafetyOpenedRef.current = true;
    onOpenSafety({
      targetName: form.who,
      onEndSession: endSession,
      onResumeSession: resumeSession,
    });
  }, [endSession, form.who, onOpenSafety, resumeSession]);

  useEffect(() => {
    if (!safetyHandoffPending) return;
    const responseReady = aiMessageCount > crisisAiBaseline;
    const timer = setTimeout(() => {
      openCrisisSafety();
      setSafetyHandoffPending(false);
    }, responseReady ? 600 : 2500);
    return () => clearTimeout(timer);
  }, [aiMessageCount, crisisAiBaseline, openCrisisSafety, safetyHandoffPending]);

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
            setCrisisAiBaseline(aiMessageCount);
            setStopped(true); setPaused(true); setHadCrisis(true); setSafetyHandoffPending(true);
          }
        } else if (data.type === 'crisis_mode') {
          setAssessment({ ...LEVELS.urgent });
          setCrisisAiBaseline(aiMessageCount);
          setStopped(true); setPaused(true); setHadCrisis(true); setSafetyHandoffPending(true);
        } else if (data.type === 'elevated_mode' && data.active) {
          setElevated(true);
        } else if (data.type === 're_entry_choice') {
          setPaused(true); openCrisisSafety();
        } else if (data.type === 'system_message') {
          if (notifTimer.current) clearTimeout(notifTimer.current);
          setSysNotif(data.text);
          notifTimer.current = setTimeout(() => setSysNotif(null), 5000);
        } else if (data.type === 'safety_summary') {
          setPaused(false); setElevated(false);
        }
      } catch { /* ignore */ }
    };
    socket.addEventListener('message', handler);
    return () => socket.removeEventListener('message', handler);
  }, [aiMessageCount, openCrisisSafety, socket]);

  const begin = () => {
    if (!form.who.trim() || !form.rel.trim()) return;
    resetSession();
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setInput('');
    setAssessment({ ...LEVELS.normal });
    setPaused(false);
    setHadCrisis(false);
    setEnded(false);
    setElevated(false);
    setSysNotif(null);
    setStopped(false);
    setShowSafeBanner(false);
    setSafetyHandoffPending(false);
    setCrisisAiBaseline(0);
    crisisSafetyOpenedRef.current = false;
    ambienceRef.current?.pause();
    setAmbience(null);
    setStarted(true);
    const payload = `[SYSTEM_INIT] TARGET: ${form.who} | RELATIONSHIP: ${form.rel} | UNSPOKEN_NEED: ${form.words || 'to be heard'} | MESSAGE: I'm ready to begin the empty chair session.`;
    sendMessage(payload);
  };

  const send = () => {
    if (!input.trim() || inputLocked) return;
    sendMessage(input.trim());
    setInput('');
  };

  const restart = () => {
    setStarted(false); setEnded(false); setForm({ who: '', rel: '', words: '' });
    setAssessment({ ...LEVELS.normal }); setPaused(false); setHadCrisis(false);
    setElevated(false); setStopped(false); setShowSafeBanner(false); setSysNotif(null);
    setInput(''); setSafetyHandoffPending(false); setCrisisAiBaseline(0); crisisSafetyOpenedRef.current = false;
    ambienceRef.current?.pause(); setAmbience(null);
  };

  if (ended) {
    return (
      <div style={{ position: 'relative', height: '100%', display: 'grid', placeItems: 'center', padding: 28 }}>
        <div className="rise" style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: 'var(--sage-soft)', color: 'var(--sage-deep)' }}><Icon name="leaf" size={28} /></div>
          <h2 className="serif" style={{ fontSize: 27, margin: '0 0 10px', color: 'var(--ink)' }}>Take good care of yourself.</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 24px' }}>This space stays open. Come back whenever you&apos;re ready — there&apos;s no rush.</p>
          <Button variant="primary" onClick={restart}>Start a new session</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    const ready = form.who.trim() && form.rel.trim();
    return (
      <div className="empty-chair-setup no-scrollbar" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div className="empty-chair-setup-card card fade-up" style={{ width: '100%', maxWidth: 520, padding: '36px 36px', textAlign: 'center', borderTop: '3px solid var(--sage)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><IconBadge name="chair" tone="sage" size={54} iconSize={26} /></div>
          <h2 className="serif" style={{ fontSize: 25, margin: '0 0 8px' }}>A quiet reflection space</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 26 }}>The empty chair is a gentle way to say what&apos;s gone unsaid. Share a little context, and we&apos;ll begin softly — at your pace.</p>
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
    <div className="empty-chair-view" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="empty-chair-status-bar" style={{ padding: '10px 32px', background: 'var(--sage-tint)', borderBottom: '1px solid var(--sage-soft)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--sage-deep)', fontWeight: 600 }}>
          <Icon name="shieldCheck" size={15} />{`A gentle reflection with ${form.who}. You can pause anytime.`}
        </span>
        <span className="empty-chair-status-chips" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <EmotionBadge emotion={emotion} />
          <SafetyStatusChip assessment={assessment} />
        </span>
      </div>

      <div className="empty-chair-ambience" style={{ padding: '8px 32px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      {elevated && !paused && !stopped && <SafetyBanner onOpenSafety={() => onOpenSafety?.()} />}

      <div ref={scrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 0' }}>
        <div className="empty-chair-message-column" style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--sage-deep)', background: 'var(--sage-tint)', border: '1px solid color-mix(in oklab, var(--sage) 22%, transparent)', padding: '7px 16px', borderRadius: 'var(--r-pill)', textAlign: 'center', maxWidth: 460 }}>
              <Icon name="sparkles" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> Your safe space is open. Share what you&apos;ve held back from {form.who}.
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

      {hadCrisis && !paused && <SupportFooter onOpenSafety={() => onOpenSafety?.()} />}

      {stopped ? (
        <div className="empty-chair-paused" style={{ padding: '16px 32px 24px' }}>
          <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: '18px 20px', borderTop: '3px solid var(--care)', background: 'var(--care-tint)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--care-soft)', color: 'var(--care)' }}><Icon name="shieldHeart" size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--care)', marginBottom: 4 }}>This reflection is paused for your safety</div>
              {crisisText && <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{crisisText}</p>}
              <Button variant="primary" size="sm" icon="heart-handshake" onClick={() => onOpenSafety?.()}>Support resources</Button>
            </div>
          </div>
        </div>
      ) : (
        <Composer value={input} onChange={setInput} onSend={send} placeholder={inputLocked ? 'Take your time — choose an option above.' : `Speak to ${form.who}…`} tone="var(--sage)" disabled={inputLocked} />
      )}

    </div>
  );
}

function ECBubble({ role, content, crisis, speaker }: { role: 'user' | 'ai'; content: string; crisis?: boolean; speaker?: string }) {
  const isUser = role === 'user';
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div className="chat-avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: crisis ? 'var(--care-soft)' : 'var(--sage-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={crisis ? 'shieldHeart' : 'chair'} size={16} style={{ color: crisis ? 'var(--care)' : 'var(--sage-deep)' }} /></div>}
      <div className="chat-message-content" style={{ maxWidth: '74%' }}>
        {!isUser && speaker && <div className="label" style={{ fontSize: 10, marginBottom: 5, color: crisis ? 'var(--care)' : 'var(--sage-deep)' }}>{`${speaker}:`}</div>}
        <div className="chat-bubble" style={{ padding: '13px 18px', fontSize: 'calc(var(--text-base) * 0.94)', lineHeight: 1.6, background: isUser ? 'var(--sage)' : crisis ? 'var(--care-tint)' : 'var(--surface)', color: isUser ? '#fff' : 'var(--ink)', border: isUser ? 'none' : `1px solid ${crisis ? 'var(--care-soft)' : 'var(--line)'}`, borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px', boxShadow: 'var(--shadow-soft)' }}>{content}</div>
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
