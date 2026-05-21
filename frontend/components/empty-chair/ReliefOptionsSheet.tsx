'use client';

import { motion } from 'framer-motion';

export interface ReEntryButton {
  action: string;
  label: string;
  tone: 'primary' | 'secondary' | 'neutral';
}

interface Props {
  prompt: string;
  buttons: ReEntryButton[];
  onChoice: (action: string) => void;
}

const TONE: Record<string, string> = {
  primary:
    'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40',
  secondary:
    'bg-card border border-purple-500/30 hover:border-purple-500/60 text-foreground',
  neutral:
    'bg-card border border-border hover:border-slate-500/40 text-slate-400 hover:text-foreground',
};

export function ReliefOptionsSheet({ prompt, buttons, onChoice }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed bottom-0 inset-x-0 z-40 flex flex-col items-center px-6 pb-10 pt-6 bg-gradient-to-t from-background via-background/97 to-transparent pointer-events-none"
    >
      <div className="w-full max-w-md pointer-events-auto">
        {/* Drag handle (decorative) */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <p className="text-center text-sm font-medium text-foreground/60 mb-4">
          {prompt}
        </p>

        <div className="space-y-2.5">
          {buttons.map(btn => (
            <motion.button
              key={btn.action}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onChoice(btn.action)}
              className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all duration-200 ${TONE[btn.tone] ?? TONE.neutral}`}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
