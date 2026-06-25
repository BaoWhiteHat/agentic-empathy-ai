// components.jsx — safety status chip, banner, support panel, confirm, footer
const { useState, useEffect, useRef } = React;

// Tone → SoulMate color tokens (sage / clay / care). Warm, never alarming.
function toneVars(tone) {
  const map = {
    sage: { bg: 'var(--sage-tint)', bd: 'color-mix(in oklab, var(--sage) 28%, transparent)', fg: 'var(--sage-deep)', dot: 'var(--sage)' },
    clay: { bg: 'var(--clay-tint)', bd: 'color-mix(in oklab, var(--clay) 32%, transparent)', fg: 'var(--clay-deep)', dot: 'var(--clay)' },
    care: { bg: 'var(--care-tint)', bd: 'color-mix(in oklab, var(--care) 34%, transparent)', fg: 'var(--care-deep)', dot: 'var(--care)' },
  };
  return map[tone] || map.sage;
}

const LEVEL_ICON = { normal: 'shield-check', extra: 'shield-alert', urgent: 'life-buoy' };

// ── Function 1: plain-language safety status (no model jargon) ──────────
function SafetyStatusChip({ assessment }) {
  if (!assessment) return null;
  const t = toneVars(assessment.tone);
  const pulse = assessment.level !== 'normal';
  return (
    <div
      className="scale-in"
      role="status"
      aria-label={`Support level: ${assessment.label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        padding: '7px 13px 7px 11px', borderRadius: 'var(--r-pill)',
        background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: t.dot, flexShrink: 0,
        animation: pulse ? 'so-pulse-dot 1.8s ease-in-out infinite' : 'none',
      }} />
      <Icon name={LEVEL_ICON[assessment.level]} size={15} strokeWidth={2} />
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{assessment.label}</span>
    </div>
  );
}

// ── Function 6: calm "extra support" banner ─────────────────────────────
function SafetyBanner({ onOpenSafety }) {
  return (
    <div
      role="complementary"
      aria-label="Extra support available"
      className="fade-up"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '11px 18px', background: 'var(--clay-tint)',
        borderBottom: '1px solid color-mix(in oklab, var(--clay) 22%, transparent)',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: 'color-mix(in oklab, var(--clay) 16%, transparent)', color: 'var(--clay-deep)',
      }}>
        <Icon name="leaf" size={17} />
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--ink-soft)', fontWeight: 500, flex: 1, minWidth: 180 }}>
        Extra support is available — you don’t have to hold this on your own.
      </span>
      <button
        onClick={onOpenSafety}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
          fontSize: 12.5, fontWeight: 700, color: 'var(--clay-deep)',
          padding: '6px 12px', borderRadius: 'var(--r-pill)',
          border: '1px solid color-mix(in oklab, var(--clay) 30%, transparent)',
          background: 'var(--surface)',
        }}
      >
        Support resources <Icon name="arrow-right" size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Function 2 + 7: calm support panel shown when roleplay is paused ─────
const OPTION_ICON = {
  try_grounding: 'eye',
  try_breathing: 'wind',
  play_sounds: 'waves',
  open_safety: 'heart-handshake',
  end_session: 'leaf',
};

function SafetySupportPanel({ targetName, options, onChoose, onRequestResume }) {
  const cardRef = useRef(null);
  useEffect(() => { cardRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') e.stopPropagation(); }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      className="fade-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'color-mix(in oklab, var(--bg) 78%, transparent)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
      role="dialog" aria-modal="true" aria-labelledby="sp-title"
    >
      <div
        ref={cardRef} tabIndex={-1} className="rise card no-scrollbar"
        style={{
          width: '100%', maxWidth: 460, maxHeight: '92%', overflowY: 'auto',
          padding: '34px 30px 26px', outline: 'none', boxShadow: 'var(--shadow-lift)',
        }}
      >
        <div style={{
          width: 58, height: 58, borderRadius: 18, margin: '0 auto 18px',
          display: 'grid', placeItems: 'center',
          background: 'var(--sage-soft)', color: 'var(--sage-deep)',
        }}>
          <Icon name="heart" size={28} />
        </div>

        <h2 id="sp-title" className="serif" style={{ fontSize: 26, textAlign: 'center', margin: '0 0 10px', color: 'var(--ink)' }}>
          Let’s pause here for a moment.
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, textAlign: 'center', color: 'var(--ink-soft)', margin: '0 0 6px' }}>
          What you’re feeling matters. We’ve gently stepped out of the conversation
          {targetName ? <> with <strong style={{ color: 'var(--ink)' }}>{targetName}</strong></> : null} so we can look after you first.
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, textAlign: 'center', color: 'var(--ink-faint)', margin: '0 0 20px' }}>
          SoulMate is a companion, not a crisis or emergency service. If you’re in immediate
          danger, please contact someone you trust or your local emergency number.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {options.map((opt) => (
            <button
              key={opt.action}
              onClick={() => onChoose(opt.action)}
              style={{
                display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left',
                padding: '13px 15px', borderRadius: 'var(--r-md)',
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                transition: 'all .18s var(--ease)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--sage) 40%, transparent)'; e.currentTarget.style.background = 'var(--sage-tint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--sage-deep)',
              }}>
                <Icon name={OPTION_ICON[opt.action] || 'heart'} size={19} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{opt.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-faint)', marginTop: 1 }}>{opt.sub}</span>
              </span>
              <Icon name="chevron-right" size={17} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <button
          onClick={onRequestResume}
          style={{
            display: 'block', margin: '18px auto 0', fontSize: 12.5, fontWeight: 600,
            color: 'var(--ink-faint)', padding: '8px 14px', borderRadius: 'var(--r-pill)',
          }}
        >
          I’m okay — continue the conversation
        </button>
      </div>
    </div>
  );
}

// ── Function 7: gentle confirmation before returning to roleplay ────────
function ConfirmResume({ targetName, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div
      className="fade-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 70, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'color-mix(in oklab, var(--ink) 28%, transparent)',
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
      }}
      role="dialog" aria-modal="true" aria-labelledby="cr-title"
    >
      <div ref={ref} tabIndex={-1} className="scale-in card" style={{ width: '100%', maxWidth: 380, padding: 26, outline: 'none', boxShadow: 'var(--shadow-lift)' }}>
        <h3 className="serif" id="cr-title" style={{ fontSize: 21, margin: '0 0 8px', color: 'var(--ink)' }}>
          Ready to return?
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
          We’ll continue gently{targetName ? <> with <strong style={{ color: 'var(--ink)' }}>{targetName}</strong></> : null},
          keeping the softer, extra-support tone. You can pause again anytime.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: 14, color: 'var(--ink-soft)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            Not yet
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--sage)', boxShadow: 'var(--shadow-soft)' }}
          >
            Yes, continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calm support footer (replaces the old alarm-red crisis bar) ─────────
function SupportFooter({ onOpenSafety }) {
  return (
    <div
      role="complementary" aria-label="Immediate support"
      className="fade-up"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 24px', background: 'var(--care-tint)',
        borderTop: '1px solid color-mix(in oklab, var(--care) 22%, transparent)',
      }}
    >
      <Icon name="heart-handshake" size={16} style={{ color: 'var(--care-deep)', flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: 'var(--care-deep)', fontWeight: 600, flex: 1, minWidth: 180 }}>
        If you’re in immediate danger, contact your local emergency services or someone you trust.
      </span>
      <button
        onClick={onOpenSafety}
        style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--care-deep)', textDecoration: 'underline', textUnderlineOffset: 3, flexShrink: 0 }}
      >
        Support resources
      </button>
    </div>
  );
}

Object.assign(window, { SafetyStatusChip, SafetyBanner, SafetySupportPanel, ConfirmResume, SupportFooter, toneVars });
