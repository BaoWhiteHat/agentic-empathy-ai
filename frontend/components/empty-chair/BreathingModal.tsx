'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const PHASES = [
  { label: 'Breathe in slowly...', hint: 'Fill your lungs gently' },
  { label: 'Hold gently...', hint: 'Let it settle' },
  { label: 'Let it out slowly...', hint: 'Release everything' },
];

const CRISIS_LINES = [
  'Crisis Text Line (US/CA): Text HOME to 741741',
  'International resources: iasp.info/resources/Crisis_Centres',
];

interface Props {
  lockoutSeconds: number;
  onComplete: () => void;
}

export function BreathingModal({ lockoutSeconds, onComplete }: Props) {
  const [remaining, setRemaining] = useState(lockoutSeconds);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const controls = useAnimation();
  const completedRef = useRef(false);

  // Breathing animation: inhale 5s → hold 5s → exhale 5s
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPhaseIndex(0);
      await controls.start({
        scale: 1.42,
        transition: { duration: 5, ease: [0.25, 0.1, 0.25, 1] },
      });
      if (cancelled) return;
      setPhaseIndex(1);
      await controls.start({
        scale: 1.42,
        transition: { duration: 5, ease: 'linear' },
      });
      if (cancelled) return;
      setPhaseIndex(2);
      await controls.start({
        scale: 1.0,
        transition: { duration: 5, ease: [0.25, 0.1, 0.25, 1] },
      });
    };
    run();
    return () => { cancelled = true; };
  }, [controls]);

  // Countdown
  useEffect(() => {
    if (remaining <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070010]/92 backdrop-blur-2xl"
    >
      {/* Breathing rings */}
      <div className="relative flex items-center justify-center mb-14">
        <motion.div
          animate={controls}
          className="absolute w-64 h-64 rounded-full bg-purple-500/8 border border-purple-500/15"
        />
        <motion.div
          animate={controls}
          className="absolute w-52 h-52 rounded-full bg-purple-500/10 border border-purple-400/20"
        />
        <motion.div
          animate={controls}
          className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-400/35 flex items-center justify-center"
        >
          <span className="text-3xl select-none pointer-events-none">💜</span>
        </motion.div>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phaseIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-6"
        >
          <p className="text-white/85 text-2xl font-light tracking-wide">
            {PHASES[phaseIndex].label}
          </p>
          <p className="text-white/30 text-sm mt-1 font-light">
            {PHASES[phaseIndex].hint}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Countdown pill */}
      <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
        <span className="text-white/30 text-xs font-mono tabular-nums">
          {remaining}s
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-purple-400/50 rounded-full"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: lockoutSeconds, ease: 'linear' }}
        />
      </div>

      {/* Crisis resources */}
      <div className="absolute bottom-8 text-center px-6 space-y-1.5">
        <p className="text-white/20 text-[9px] uppercase tracking-widest mb-2">
          If you need immediate support
        </p>
        {CRISIS_LINES.map(line => (
          <p key={line} className="text-white/35 text-xs font-medium">{line}</p>
        ))}
      </div>
    </motion.div>
  );
}
