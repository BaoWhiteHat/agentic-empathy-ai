'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const STEP_DURATION_MS      = 12_000;
const TIMER_INTERVAL_MS     = 100;
const ENTRANCE_ANIMATION_MS = 400;
const TOTAL_STEPS           = 5;

const GROUNDING_STEPS = [
  {
    emoji:       '👀',
    sense:       'SEE',
    count:       5,
    title:       'Name 5 things you can SEE',
    description: 'Look around your space slowly.\nWhat colors, shapes, or objects catch your attention?',
  },
  {
    emoji:       '✋',
    sense:       'TOUCH',
    count:       4,
    title:       'Name 4 things you can TOUCH',
    description: 'Feel the texture of surfaces near you.\nWhat sensations do you notice?',
  },
  {
    emoji:       '👂',
    sense:       'HEAR',
    count:       3,
    title:       'Name 3 sounds you can HEAR',
    description: 'Listen carefully to your environment.\nWhat sounds are present?',
  },
  {
    emoji:       '👃',
    sense:       'SMELL',
    count:       2,
    title:       'Name 2 things you can SMELL',
    description: 'Take a deep breath.\nWhat scents are present?',
  },
  {
    emoji:       '👅',
    sense:       'TASTE',
    count:       1,
    title:       'Name 1 thing you can TASTE',
    description: 'Notice any taste in your mouth,\nor recall a recent flavor.',
  },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────
interface GroundingExerciseProps {
  isOpen:     boolean;
  onComplete: () => void;
  onSkip:     () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function GroundingExercise({ isOpen, onComplete, onSkip }: GroundingExerciseProps) {
  const [currentStep, setCurrentStep]         = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(STEP_DURATION_MS);

  // Read once on mount — no need to react to runtime OS setting changes
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // Timer refs
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const entranceRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const stepStartRef   = useRef<number>(0);
  // Mirrors currentStep state — lets interval callbacks avoid stale closures
  const currentStepRef = useRef<number>(0);
  // Callback ref — keeps onComplete stable without adding it to effect deps
  const onCompleteRef  = useRef(onComplete);
  // Indirection ref for restartTimerForStep: breaks the useCallback self-reference
  // cycle that react-hooks/immutability flags as a TDZ concern.
  const restartRef     = useRef<(step: number) => void>(() => {});
  const overlayRef     = useRef<HTMLDivElement>(null);

  // Keep callback ref current after every render
  useEffect(() => { onCompleteRef.current = onComplete; });

  // Focus overlay when opened so keyboard nav works immediately
  useEffect(() => {
    if (isOpen) overlayRef.current?.focus();
  }, [isOpen]);

  // ── Master lifecycle effect ──────────────────────────────────────────────────
  // All setState calls live inside async callbacks (setTimeout/setInterval),
  // never directly in the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    // Cancel whatever was running in the previous session
    if (entranceRef.current)  clearTimeout(entranceRef.current);
    if (intervalRef.current)  clearInterval(intervalRef.current);
    entranceRef.current  = null;
    intervalRef.current  = null;

    if (!isOpen) {
      currentStepRef.current = 0; // Pure ref reset — no setState needed on close
      return;
    }

    currentStepRef.current = 0; // Reset ref before the async callback fires

    // Delay the first tick until the entrance animation has finished.
    entranceRef.current = setTimeout(() => {
      entranceRef.current = null;
      // ↓ All setState calls are inside this async callback ↓
      setCurrentStep(0);
      setTimeRemainingMs(STEP_DURATION_MS);
      stepStartRef.current = Date.now();
      runStep();
    }, ENTRANCE_ANIMATION_MS);

    // Self-recursive: advances through steps without re-running the effect
    function runStep() {
      intervalRef.current = setInterval(() => {
        const elapsed   = Date.now() - stepStartRef.current;
        const remaining = Math.max(0, STEP_DURATION_MS - elapsed);
        setTimeRemainingMs(remaining);

        if (remaining === 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;

          const next = currentStepRef.current + 1;
          if (next >= TOTAL_STEPS) {
            onCompleteRef.current();
          } else {
            currentStepRef.current = next;
            setCurrentStep(next);
            setTimeRemainingMs(STEP_DURATION_MS);
            stepStartRef.current = Date.now();
            runStep();
          }
        }
      }, TIMER_INTERVAL_MS);
    }

    return () => {
      if (entranceRef.current)  { clearTimeout(entranceRef.current);  entranceRef.current  = null; }
      if (intervalRef.current)  { clearInterval(intervalRef.current); intervalRef.current  = null; }
    };
  }, [isOpen]); // isOpen only — onComplete is stable via ref

  // ── Navigation helpers ────────────────────────────────────────────────────────
  // useCallback: ESLint purity rule knows the body runs at interaction time,
  // not during render — so Date.now() and clearInterval calls are safe.
  // restartRef indirection: avoids react-hooks/immutability's TDZ concern about
  // a useCallback referencing itself before its own const declaration completes.

  const restartTimerForStep = useCallback((step: number) => {
    if (entranceRef.current)  { clearTimeout(entranceRef.current);  entranceRef.current  = null; }
    if (intervalRef.current)  { clearInterval(intervalRef.current); intervalRef.current  = null; }
    currentStepRef.current = step;
    setCurrentStep(step);
    setTimeRemainingMs(STEP_DURATION_MS);
    stepStartRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed   = Date.now() - stepStartRef.current;
      const remaining = Math.max(0, STEP_DURATION_MS - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining === 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        const next = currentStepRef.current + 1;
        if (next >= TOTAL_STEPS) {
          onCompleteRef.current();
        } else {
          restartRef.current(next); // Indirection via ref — no TDZ concern
        }
      }
    }, TIMER_INTERVAL_MS);
  }, []); // All deps are refs or stable state setters — empty array is correct

  // Sync the indirection ref after mount (restartTimerForStep is stable, runs once)
  useEffect(() => {
    restartRef.current = restartTimerForStep;
  }, [restartTimerForStep]);

  function handleBack() {
    if (currentStepRef.current > 0) restartTimerForStep(currentStepRef.current - 1);
  }

  function handleAdvance() {
    const next = currentStepRef.current + 1;
    if (next >= TOTAL_STEPS) {
      if (entranceRef.current)  { clearTimeout(entranceRef.current);  entranceRef.current  = null; }
      if (intervalRef.current)  { clearInterval(intervalRef.current); intervalRef.current  = null; }
      onCompleteRef.current();
    } else {
      restartTimerForStep(next);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape')          onSkip();
    else if (e.key === 'ArrowLeft')  handleBack();
    else if (e.key === 'ArrowRight') handleAdvance();
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const step        = GROUNDING_STEPS[currentStep];
  const progressPct = ((STEP_DURATION_MS - timeRemainingMs) / STEP_DURATION_MS) * 100;
  const secondsLeft = Math.ceil(timeRemainingMs / 1000);

  const stepVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 20  },
        animate: { opacity: 1, y: 0   },
        exit:    { opacity: 0, y: -20 },
      };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-8 py-12"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={`Grounding exercise: ${step.title}`}
          tabIndex={-1}
        >
          {/* Screen-reader live region — announces each step change */}
          <div role="status" aria-live="polite" className="sr-only">
            {`Step ${currentStep + 1} of ${TOTAL_STEPS}: ${step.title}`}
          </div>

          {/* ── Top navigation row ── */}
          <div className="absolute top-8 inset-x-8 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-1.5 text-sm font-medium transition-all duration-200 ${
                currentStep === 0
                  ? 'text-foreground/20 cursor-not-allowed'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
              aria-label="Go to previous step"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
              aria-label="Skip grounding exercise"
            >
              Skip
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Step content ── */}
          <div className="w-full max-w-md flex flex-col items-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={stepVariants.initial}
                animate={stepVariants.animate}
                exit={stepVariants.exit}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-col items-center"
              >
                {/* Emoji — subtle idle pulse (disabled for reduced motion) */}
                <motion.span
                  className="text-[80px] mb-8 select-none leading-none block"
                  animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  aria-hidden="true"
                >
                  {step.emoji}
                </motion.span>

                {/* Step title */}
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent mb-4">
                  {step.title}
                </h2>

                {/* Step description */}
                <p className="text-base text-foreground/70 leading-relaxed whitespace-pre-line">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Bottom progress ── */}
          <div className="absolute bottom-12 inset-x-8 flex flex-col gap-3">
            {/* CSS transition for smooth 100ms updates without Framer Motion overhead */}
            <div className="w-full h-1.5 bg-purple-500/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${progressPct}%`, transition: 'width 100ms linear' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/40">
                Step {currentStep + 1}/{TOTAL_STEPS}
              </span>
              <span className="text-xs font-mono text-foreground/40 tabular-nums">
                {secondsLeft}s left
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
