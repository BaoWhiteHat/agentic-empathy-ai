'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

interface Props {
  untilTimestamp: number; // Unix seconds
}

function minutesLeft(until: number): number {
  return Math.max(0, Math.ceil((until - Date.now() / 1000) / 60));
}

export function ElevatedModeBanner({ untilTimestamp }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [mins, setMins] = useState(minutesLeft(untilTimestamp));

  useEffect(() => {
    const t = setInterval(() => {
      const m = minutesLeft(untilTimestamp);
      setMins(m);
      if (m <= 0) clearInterval(t);
    }, 60_000);
    return () => clearInterval(t);
  }, [untilTimestamp]);

  if (dismissed || mins <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/8 border-b border-amber-500/20 backdrop-blur-md"
    >
      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-[11px] font-semibold text-amber-400/75 flex-1 leading-none">
        Enhanced support active for ~{mins}m — you're not alone
      </span>
      <a
        href="https://www.iasp.info/resources/Crisis_Centres/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300 transition-colors shrink-0"
      >
        Crisis resources ↗
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="ml-0.5 text-amber-400/40 hover:text-amber-400 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
