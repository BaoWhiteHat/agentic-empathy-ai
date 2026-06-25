'use client';
// components/StatusChip.tsx — academic feature-maturity badge (A/B/C)
import React, { useState } from 'react';

export type Tier = 'A' | 'B' | 'C';

export const STATUS_INFO: Record<Tier, { label: string; tone: 'sage' | 'gold' | 'lavender'; short: string }> = {
  A: { label: 'Implemented core feature', tone: 'sage', short: 'Core' },
  B: { label: 'High-fidelity prototype', tone: 'gold', short: 'Prototype' },
  C: { label: 'Future work', tone: 'lavender', short: 'Future' },
};

const TONE_MAP: Record<string, [string, string]> = {
  sage: ['var(--sage-soft)', 'var(--sage-deep)'],
  gold: ['var(--gold-soft)', 'var(--gold)'],
  lavender: ['var(--lavender-soft)', 'var(--lavender-deep)'],
};

export function StatusChip({ tier }: { tier?: Tier }) {
  const [open, setOpen] = useState(false);
  if (!tier) return null;
  const info = STATUS_INFO[tier];
  if (!info) return null;
  const [bg, fg] = TONE_MAP[info.tone];
  return (
    <div className="status-chip" style={{ position: 'absolute', top: 18, right: 22, zIndex: 30 }}>
      <button onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: bg, color: fg, border: '1px solid transparent', fontSize: 11, fontWeight: 700, letterSpacing: '.06em' }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: fg, color: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800 }}>{tier}</span>
        {info.short.toUpperCase()}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 248, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lift)', padding: '14px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: fg, marginBottom: 8 }}>{tier} · {info.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(Object.entries(STATUS_INFO) as [Tier, typeof info][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: k === tier ? 'var(--ink)' : 'var(--ink-faint)' }}>
                <span style={{ fontWeight: 800, width: 12 }}>{k}</span>{v.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StatusChip;
