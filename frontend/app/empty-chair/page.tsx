// app/empty-chair/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, ArrowRight, Flame, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { BreathingModal } from '../../components/empty-chair/BreathingModal';
import { ReliefOptionsSheet, type ReEntryButton } from '../../components/empty-chair/ReliefOptionsSheet';
import { ElevatedModeBanner } from '../../components/empty-chair/ElevatedModeBanner';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SafetyDecision {
  action: 'normal_roleplay' | 'safe_roleplay' | 'stop_roleplay';
  method: string;
  risk_level: 'low' | 'medium' | 'critical';
  suicidewatch_probability: number;
}

// ── Safety Badge ───────────────────────────────────────────────────────────────
const SAFETY_CONFIG = {
  normal_roleplay: {
    Icon: ShieldCheck,
    label: 'Normal',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/5 border-emerald-500/20',
    dot: 'bg-emerald-400',
    pulse: false,
  },
  safe_roleplay: {
    Icon: ShieldAlert,
    label: 'Safe Mode',
    color: 'text-amber-400',
    bg: 'bg-amber-500/5 border-amber-500/20',
    dot: 'bg-amber-400',
    pulse: true,
  },
  stop_roleplay: {
    Icon: ShieldOff,
    label: 'Crisis',
    color: 'text-red-400',
    bg: 'bg-red-500/5 border-red-500/20',
    dot: 'bg-red-400',
    pulse: true,
  },
};

function SafetyBadge({ decision }: { decision: SafetyDecision }) {
  const cfg = SAFETY_CONFIG[decision.action];
  const { Icon } = cfg;
  const prob = (decision.suicidewatch_probability * 100).toFixed(1);

  const methodLabel = decision.method
    .replace('distilbert_threshold_0.2', 'threshold≥0.2')
    .replace('distilbert_argmax', 'DistilBERT')
    .replace('keyword_override', 'Keyword');

  return (
    <motion.div
      initial={{ opacity: 0, x: 10, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.94 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-center gap-2 border px-3.5 py-2 rounded-2xl backdrop-blur-md ${cfg.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
      <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
      <span className="text-slate-700 select-none text-[10px]">·</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{methodLabel}</span>
      <span className="text-slate-700 select-none text-[10px]">·</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color} opacity-70`}>{decision.risk_level}</span>
      <span className="text-slate-700 select-none text-[10px]">·</span>
      <span className="text-[10px] font-mono font-bold text-slate-400">SW {prob}%</span>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmptyChairPage() {
  const { messages, sendMessage, emotion, socket } = useChat();

  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [unspokenNeed, setUnspokenNeed] = useState('');
  const [input, setInput] = useState('');
  const [safetyDecision, setSafetyDecision] = useState<SafetyDecision | null>(null);

  // Crisis lifecycle state
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingSeconds, setBreathingSeconds] = useState(15);
  const [elevatedMode, setElevatedMode] = useState<{ until: number } | null>(null);
  const [reEntryOptions, setReEntryOptions] = useState<{ prompt: string; buttons: ReEntryButton[] } | null>(null);
  const [inputLocked, setInputLocked] = useState(false);
  const [systemNotification, setSystemNotification] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── WebSocket message handler ──
  useEffect(() => {
    if (!socket) return;
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'safety_decision') {
          setSafetyDecision({
            action: data.action,
            method: data.method,
            risk_level: data.risk_level,
            suicidewatch_probability: data.suicidewatch_probability,
          });
        }

        if (data.type === 'crisis_mode') {
          setBreathingSeconds(data.lockout_seconds ?? 15);
          setBreathingActive(true);
          setInputLocked(true);
          setReEntryOptions(null);
        }

        if (data.type === 'elevated_mode' && data.active) {
          setElevatedMode({ until: data.until_timestamp });
        }

        if (data.type === 're_entry_choice') {
          setReEntryOptions({ prompt: data.prompt, buttons: data.buttons });
          setInputLocked(true);
        }

        if (data.type === 'system_message') {
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
          setSystemNotification(data.text);
          notifTimerRef.current = setTimeout(() => setSystemNotification(null), 5000);
        }

        if (data.type === 'safety_summary') {
          setElevatedMode(null);
          setInputLocked(false);
          setReEntryOptions(null);
        }
      } catch {}
    };
    socket.addEventListener('message', handler);
    return () => socket.removeEventListener('message', handler);
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
  }, []);

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleStartSession = () => {
    if (targetName.trim() && relationship.trim() && unspokenNeed.trim()) {
      setIsSessionStarted(true);
      const initPayload = `[SYSTEM_INIT] TARGET: ${targetName} | RELATIONSHIP: ${relationship} | UNSPOKEN_NEED: ${unspokenNeed} | MESSAGE: I'm ready to begin the empty chair session.`;
      sendMessage(initPayload);
    }
  };

  const handleSendText = () => {
    if (input.trim() && !inputLocked) {
      sendMessage(input);
      setInput('');
      resetTextareaHeight();
    }
  };

  const handleBreathingComplete = useCallback(() => {
    setBreathingActive(false);
    socket?.send(JSON.stringify({ action: 'show_reentry_options' }));
  }, [socket]);

  const handleReEntryChoice = useCallback((action: string) => {
    setReEntryOptions(null);
    socket?.send(JSON.stringify({ action }));
    if (action !== 'end_session') {
      setInputLocked(false);
    }
  }, [socket]);

  return (
    <div className="flex flex-col h-full bg-background/50 relative transition-colors duration-300">

      {/* ── Breathing lockout overlay ── */}
      <AnimatePresence>
        {breathingActive && (
          <BreathingModal
            key="breathing"
            lockoutSeconds={breathingSeconds}
            onComplete={handleBreathingComplete}
          />
        )}
      </AnimatePresence>

      {/* ── Re-entry options sheet ── */}
      <AnimatePresence>
        {reEntryOptions && !breathingActive && (
          <ReliefOptionsSheet
            key="relief"
            prompt={reEntryOptions.prompt}
            buttons={reEntryOptions.buttons}
            onChoice={handleReEntryChoice}
          />
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-purple-500/20 px-8 py-4 flex justify-between items-center gap-4 shadow-sm flex-wrap">
        <div className="flex items-center gap-4 shrink-0">
          <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/30">
            <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              Empty Chair Technique
              {isSessionStarted && <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />}
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {isSessionStarted ? `Connecting with: ${targetName}` : 'Creating Your Safe Space'}
            </p>
          </div>
        </div>

        {isSessionStarted && (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Emotion badge */}
            <div className="flex items-center gap-3 bg-purple-500/5 border border-purple-500/10 px-4 py-2 rounded-2xl">
              <Flame className="w-4 h-4 text-purple-500" />
              <span className="text-[11px] text-purple-600/60 dark:text-purple-200/60 font-black uppercase tracking-widest">Emotion:</span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest animate-pulse">{emotion}</span>
            </div>

            {/* Safety badge — animate swap on each new decision */}
            <AnimatePresence mode="wait">
              {safetyDecision && (
                <SafetyBadge
                  key={safetyDecision.action + safetyDecision.method + safetyDecision.suicidewatch_probability}
                  decision={safetyDecision}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      {/* ── Elevated mode banner (below header) ── */}
      <AnimatePresence>
        {elevatedMode && isSessionStarted && (
          <ElevatedModeBanner
            key="elevated"
            untilTimestamp={elevatedMode.until}
          />
        )}
      </AnimatePresence>

      {/* ── SETUP / CHAT ── */}
      <AnimatePresence mode="wait">
        {!isSessionStarted ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 overflow-y-auto custom-scrollbar"
          >
            <div className="w-full max-w-xl bg-card border border-purple-500/20 rounded-3xl p-8 shadow-2xl shadow-purple-900/10 relative overflow-hidden my-8">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
              <div className="w-16 h-16 mx-auto bg-purple-500/10 rounded-full flex items-center justify-center mb-4 border border-purple-500/20">
                <User className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-2 text-center">Creating Your Safe Space</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-center px-4">
                To make this healing journey as profound as possible, please share a little context. This will help us guide the conversation with true empathy
              </p>
              <div className="space-y-5 text-left">
                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">1. Who is sitting in the empty chair?</label>
                  <input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g., My father, my ex-partner, my inner child..." className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">2. How would you describe your relationship?</label>
                  <textarea value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g., A strict father who rarely shows affection..." rows={2} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pl-2 mb-1 block">3. What are the words you've never been able to say?</label>
                  <textarea value={unspokenNeed} onChange={(e) => setUnspokenNeed(e.target.value)} placeholder="e.g., I just want to be seen, to hear that you are proud of me..." rows={2} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm font-medium focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none" />
                </div>
                <button onClick={handleStartSession} disabled={!targetName.trim() || !relationship.trim() || !unspokenNeed.trim()} className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm py-4 rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 group">
                  Start the Conversation
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />
          </motion.div>
        ) : (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full w-full min-h-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scrollbar-hide min-h-0">
              <div className="flex justify-center mb-8">
                <div className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-medium px-6 py-2 rounded-full flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Your safe space is now open. Share what you've been holding back from {targetName}.
                </div>
              </div>

              <AnimatePresence initial={false}>
                {messages.filter((m) => !m.content.startsWith('[SYSTEM_INIT]')).map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'ai' && (
                      <div className="w-8 h-8 rounded-xl bg-purple-900/20 border border-purple-500/30 flex items-center justify-center mb-1 shrink-0 relative overflow-hidden">
                        <User className="w-4 h-4 text-purple-400 opacity-50" />
                        <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
                      </div>
                    )}
                    <div className={`group relative max-w-[70%] px-5 py-3.5 rounded-3xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none font-medium' : 'bg-card/80 backdrop-blur-sm text-foreground rounded-bl-none border border-purple-500/20'}`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* System notification (inline) */}
              <AnimatePresence>
                {systemNotification && (
                  <motion.div
                    key="sysnotif"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="flex justify-center"
                  >
                    <div className="bg-purple-500/8 border border-purple-500/15 text-purple-400/70 text-xs font-medium px-5 py-2 rounded-full">
                      {systemNotification}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="p-8 pt-0 shrink-0">
              <div className={`max-w-4xl mx-auto flex gap-3 items-end p-2 rounded-[2rem] bg-card border transition-all duration-300 shadow-2xl ${inputLocked ? 'border-border opacity-50 pointer-events-none' : 'border-border focus-within:border-purple-500/40 focus-within:ring-4 focus-within:ring-purple-500/5'}`}>
                <textarea ref={textareaRef} rows={1} className="flex-1 bg-transparent px-6 py-4 rounded-xl outline-none text-sm font-medium text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none leading-relaxed" style={{ maxHeight: '160px', overflowY: 'auto' }} placeholder={inputLocked ? 'Choose an option above to continue...' : `Speak directly to ${targetName}...`} value={input} disabled={inputLocked}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                />
                <motion.button whileHover={input.trim() && !inputLocked ? { scale: 1.05 } : {}} whileTap={input.trim() && !inputLocked ? { scale: 0.95 } : {}} onClick={handleSendText} disabled={!input.trim() || inputLocked} className={`p-4 rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 px-6 mb-1 shrink-0 ${!input.trim() || inputLocked ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-50' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40'}`}>
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
