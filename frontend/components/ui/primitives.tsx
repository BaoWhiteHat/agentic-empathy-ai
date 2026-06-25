'use client';
// components/ui/primitives.tsx — shared SoulMate primitives
import React from 'react';
import { Icon } from './Icon';

/* ============================================================
   Button — tiered, calm
   ============================================================ */
export type ButtonVariant = 'primary' | 'clay' | 'lavender' | 'soft' | 'outline' | 'ghost' | 'care';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  full?: boolean;
  style?: React.CSSProperties;
}

export function Button({
  variant = 'primary', size = 'md', icon, iconRight, full, children, style = {}, ...rest
}: ButtonProps) {
  const sz = {
    sm: { padding: '8px 14px', fontSize: 13, gap: 7 },
    md: { padding: '12px 20px', fontSize: 14.5, gap: 9 },
    lg: { padding: '15px 26px', fontSize: 15.5, gap: 10 },
  }[size];
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg, var(--sage), var(--sage-deep))', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 18px color-mix(in oklab, var(--sage) 38%, transparent)' },
    clay: { background: 'var(--clay)', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 18px color-mix(in oklab, var(--clay) 32%, transparent)' },
    lavender: { background: 'var(--lavender)', color: '#fff', border: '1px solid transparent' },
    soft: { background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line)' },
    outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
    ghost: { background: 'transparent', color: 'var(--ink-soft)', border: '1px solid transparent' },
    care: { background: 'var(--care)', color: '#fff', border: '1px solid transparent' },
  };
  const filled = ['primary', 'clay', 'lavender', 'care'].includes(variant);
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: sz.gap, padding: sz.padding, fontSize: sz.fontSize, fontWeight: 600,
        borderRadius: 'var(--r-pill)', width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
        transition: 'transform .15s var(--ease), filter .15s var(--ease), background .2s',
        opacity: rest.disabled ? 0.5 : 1,
        ...variants[variant], ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.97)'; rest.onMouseDown?.(e); }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; rest.onMouseUp?.(e); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; rest.onMouseLeave?.(e); }}
      onMouseEnter={(e) => {
        if (rest.disabled) return;
        if (filled) e.currentTarget.style.filter = 'brightness(1.06)';
        else if (variant !== 'primary') e.currentTarget.style.background = 'var(--surface-3)';
        rest.onMouseEnter?.(e);
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

/* ============================================================
   IconBadge — tonal circle/rounded square holding an icon
   ============================================================ */
export type Tone = 'sage' | 'clay' | 'lavender' | 'gold' | 'care' | 'neutral';

const TONE_MAP: Record<Tone, [string, string]> = {
  sage: ['var(--sage-soft)', 'var(--sage-deep)'],
  clay: ['var(--clay-soft)', 'var(--clay-deep)'],
  lavender: ['var(--lavender-soft)', 'var(--lavender-deep)'],
  gold: ['var(--gold-soft)', 'var(--gold)'],
  care: ['var(--care-soft)', 'var(--care)'],
  neutral: ['var(--surface-2)', 'var(--ink-soft)'],
};

export function IconBadge({ name, tone = 'sage', size = 44, iconSize = 20 }: { name: string; tone?: Tone; size?: number; iconSize?: number }) {
  const [bg, fg] = TONE_MAP[tone] || TONE_MAP.sage;
  return (
    <div style={{ width: size, height: size, borderRadius: size > 40 ? 'var(--r-md)' : 'var(--r-sm)', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={name} size={iconSize} stroke={1.9} />
    </div>
  );
}

/* ============================================================
   Pill / chip
   ============================================================ */
const PILL_MAP: Record<Tone, [string, string, string]> = {
  neutral: ['var(--surface-2)', 'var(--ink-soft)', 'var(--line)'],
  sage: ['var(--sage-soft)', 'var(--sage-deep)', 'transparent'],
  clay: ['var(--clay-soft)', 'var(--clay-deep)', 'transparent'],
  lavender: ['var(--lavender-soft)', 'var(--lavender-deep)', 'transparent'],
  care: ['var(--care-soft)', 'var(--care)', 'transparent'],
  gold: ['var(--gold-soft)', 'var(--gold)', 'transparent'],
};

export function Pill({ children, tone = 'neutral', icon, onClick, style = {} }: { children: React.ReactNode; tone?: Tone; icon?: string; onClick?: () => void; style?: React.CSSProperties }) {
  const [bg, fg, bd] = PILL_MAP[tone] || PILL_MAP.neutral;
  const common: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99,
    background: bg, color: fg, border: `1px solid ${bd}`, fontSize: 11.5, fontWeight: 600,
    letterSpacing: '.02em', cursor: onClick ? 'pointer' : 'default', ...style,
  };
  if (onClick) return <button onClick={onClick} style={common}>{icon && <Icon name={icon} size={13} stroke={2} />}{children}</button>;
  return <span style={common}>{icon && <Icon name={icon} size={13} stroke={2} />}{children}</span>;
}

/* ============================================================
   Toggle switch
   ============================================================ */
export function Toggle({ on, onChange, tone = 'var(--sage)' }: { on: boolean; onChange: (v: boolean) => void; tone?: string }) {
  return (
    <button
      role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ width: 46, height: 27, borderRadius: 99, border: '1px solid var(--line)', background: on ? tone : 'var(--surface-2)', position: 'relative', transition: 'background .25s', flexShrink: 0, padding: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 21 : 2, width: 21, height: 21, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .25s var(--ease)' }} />
    </button>
  );
}

/* ============================================================
   BreathingOrb — calm pulsing presence
   ============================================================ */
export function BreathingOrb({ size = 120, tone = 'var(--sage)', active = true, children }: { size?: number; tone?: string; active?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${tone}`, animation: active ? 'ripple 4s var(--ease) infinite' : 'none', animationDelay: `${i * 1.4}s`, opacity: 0 }} />
      ))}
      <div style={{
        width: size * 0.62, height: size * 0.62, borderRadius: '50%',
        background: `color-mix(in oklab, ${tone} 18%, var(--surface))`, border: `1.5px solid color-mix(in oklab, ${tone} 40%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone,
        animation: active ? 'breathe 5s ease-in-out infinite' : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ width = '100%', height = 12, radius = 6, style = {} }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ width, height, borderRadius: radius, background: 'var(--surface-2)', animation: 'soft-pulse 1.4s ease-in-out infinite', ...style }} />
  );
}
