// app/voice/page.tsx - Physical Companion Monitor
'use client';

import { useUser } from '../../context/UserContext';
import { useVoiceMonitor } from '../../hooks/useVoiceMonitor';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Smile, Cpu, Radio, UserRound } from 'lucide-react';

export default function VoicePage() {
  const { userId } = useUser();
  const { messages, emotion, status, isConnected } = useVoiceMonitor(userId);

  const lastMessages = messages.slice(-6);
  const statusLabel = status.replace('-', ' ');

  return (
    <div className="flex flex-col h-full bg-background/50 relative overflow-hidden transition-colors duration-500">
      <header className="relative z-20 px-8 py-6 flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Cpu className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
              Physical Companion
              <span className={`flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {isConnected ? 'Monitor Connected' : 'Monitor Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 px-4 py-2 rounded-2xl backdrop-blur-md">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] text-indigo-600/60 dark:text-indigo-200/60 font-black uppercase tracking-widest">Status:</span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest animate-pulse">
              {statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 px-4 py-2 rounded-2xl backdrop-blur-md">
            <Smile className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] text-indigo-600/60 dark:text-indigo-200/60 font-black uppercase tracking-widest">Emotion:</span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest animate-pulse">
              {emotion}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-8 gap-8">
        <div className="relative flex items-center justify-center w-40 h-40">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
          />
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.1, 0, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            className="absolute inset-0 rounded-full border-2 border-indigo-500/20"
          />
          <div className="w-24 h-24 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Radio className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Run <code className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">voice_companion.py</code> on your laptop
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[10px] text-indigo-500 bg-indigo-500/10 border border-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
            <UserRound className="w-3 h-3" />
            Monitoring user_id: <span className="font-black">{userId}</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
            SPACE to speak - Q to quit - ESP32 plays audio
          </p>
        </div>

        <div className="w-full max-w-2xl flex flex-col gap-3 max-h-72 overflow-y-auto">
          <AnimatePresence initial={false}>
            {lastMessages.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-slate-500 text-sm italic"
              >
                Conversation will appear here...
              </motion.p>
            )}
            {lastMessages.map((msg, i) => (
              <motion.div
                key={`${msg.role}-${i}-${msg.content.slice(0, 12)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/20 text-indigo-200 rounded-br-sm'
                    : 'bg-slate-700/40 text-slate-200 rounded-bl-sm'
                }`}>
                  <div className="text-[9px] uppercase tracking-widest opacity-50 mb-1">
                    {msg.role === 'user' ? 'You' : 'SoulMate'}
                  </div>
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
    </div>
  );
}
