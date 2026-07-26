/* ============================================================
   safetyRouter (preview build)
   Plain-language, non-clinical safety routing for EmptyChair.

   The PRODUCTION version lives at frontend/lib/safetyRouter.ts and
   shares this exact shape. NOTHING about the underlying classifier
   (model name, thresholds, probabilities, internal labels) is ever
   surfaced to the UI — callers only see { level, mode, ... }.
   ============================================================ */
(function () {
  // Public, user-safe levels. These are the ONLY safety concepts the UI knows.
  //   normal → continue EmptyChair as usual
  //   extra  → softer, supportive tone + calm "extra support" banner
  //   urgent → pause roleplay, show the support panel
  const LEVELS = {
    normal: {
      level: 'normal',
      mode: 'normal_roleplay',
      label: 'Normal support',
      tone: 'sage',
      blurb: 'Holding space for you',
    },
    extra: {
      level: 'extra',
      mode: 'safe_roleplay',
      label: 'Extra support',
      tone: 'clay',
      blurb: 'Here with a little more care',
    },
    urgent: {
      level: 'urgent',
      mode: 'stop_roleplay',
      label: 'Urgent support',
      tone: 'care',
      blurb: 'Let’s pause and take care of you',
    },
  };

  // ── Mock keyword logic ─────────────────────────────────────────────
  // TODO(backend): delete these lists once the server emits a decision.
  // They exist so the flow is fully testable with no backend running.
  const URGENT_PATTERNS = [
    /\bkill myself\b/, /\bend (my|it all)\b/, /\bsuicid/, /\bwant to die\b/,
    /\bdon'?t want to (be alive|live)\b/, /\bno reason to live\b/,
    /\bharm myself\b/, /\bhurt myself\b/, /\bself[-\s]?harm\b/,
    /\bgive up on (life|everything)\b/, /\bbetter off (dead|without me)\b/,
    /\bcan'?t go on\b/, /\bnothing left\b/,
  ];
  const EXTRA_PATTERNS = [
    /\bhopeless\b/, /\bworthless\b/, /\bempty inside\b/, /\bnumb\b/,
    /\bcan'?t (cope|breathe|stop crying)\b/, /\boverwhelm/, /\bpanic/,
    /\bbreaking down\b/, /\bfalling apart\b/, /\bso alone\b/, /\bunbearable\b/,
    /\bi (hate|can'?t stand) myself\b/, /\bexhausted\b/, /\bdespair\b/,
  ];

  function classifyMessage(text) {
    // Normalise curly apostrophes/quotes so "don’t" matches "don't" patterns.
    const t = (text || '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'");
    if (URGENT_PATTERNS.some((re) => re.test(t))) return { ...LEVELS.urgent };
    if (EXTRA_PATTERNS.some((re) => re.test(t))) return { ...LEVELS.extra };
    return { ...LEVELS.normal };
  }

  // ── Backend decision mapper ────────────────────────────────────────
  // The server sends raw fields (action / risk_level / probabilities /
  // method). We translate them here so jargon NEVER leaves this module.
  // TODO(backend): confirm the action strings match your gateway payload.
  function fromBackendDecision(raw) {
    if (!raw) return { ...LEVELS.normal };
    switch (raw.action) {
      case 'stop_roleplay':
        return { ...LEVELS.urgent };
      case 'safe_roleplay':
        return { ...LEVELS.extra };
      case 'normal_roleplay':
      default:
        return { ...LEVELS.normal };
    }
  }

  // The five next-step options offered in urgent / re-entry support.
  const SUPPORT_OPTIONS = [
    { action: 'try_grounding', label: 'Try grounding', sub: 'A short 5-4-3-2-1 exercise' },
    { action: 'try_breathing', label: 'Try breathing', sub: 'Settle your body, one breath at a time' },
    { action: 'play_sounds',   label: 'Open calming sounds', sub: 'Rain, ocean or forest' },
    { action: 'open_safety',   label: 'Support resources', sub: 'People you can reach right now' },
    { action: 'end_session',   label: 'End this session for now', sub: 'You can always come back' },
  ];

  window.SafetyRouter = { LEVELS, classifyMessage, fromBackendDecision, SUPPORT_OPTIONS };
})();
