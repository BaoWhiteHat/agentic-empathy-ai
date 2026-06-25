'use client';
// components/ui/Ocean.tsx — OCEAN personality visualisations (pure SVG)
import React from 'react';

export interface OceanData {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface OceanTrait {
  key: keyof OceanData;
  label: string;
  short: string;
}

export const OCEAN: OceanTrait[] = [
  { key: 'openness', label: 'Openness', short: 'O' },
  { key: 'conscientiousness', label: 'Conscientiousness', short: 'C' },
  { key: 'extraversion', label: 'Extraversion', short: 'E' },
  { key: 'agreeableness', label: 'Agreeableness', short: 'A' },
  { key: 'neuroticism', label: 'Sensitivity', short: 'N' },
];

export function OceanRadar({ data, size = 220, color = 'var(--sage)', showLabels = true }: { data: OceanData; size?: number; color?: string; showLabels?: boolean }) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const n = OCEAN.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.33, 0.66, 1];
  const gridPolys = rings.map((rr) => OCEAN.map((_, i) => pt(i, R * rr).join(',')).join(' '));
  const valPts = OCEAN.map((o, i) => pt(i, R * (data[o.key] ?? 0.5)).join(',')).join(' ');
  const gid = React.useId();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={gid}>
          <stop offset="0%" stopColor={color} stopOpacity={0.42} />
          <stop offset="100%" stopColor={color} stopOpacity={0.12} />
        </radialGradient>
      </defs>
      {gridPolys.map((p, i) => <polygon key={i} points={p} fill="none" stroke="var(--line-strong)" strokeWidth={1} opacity={0.6} />)}
      {OCEAN.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-strong)" strokeWidth={1} opacity={0.5} />; })}
      <polygon points={valPts} fill={`url(#${gid})`} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      {OCEAN.map((o, i) => { const [x, y] = pt(i, R * (data[o.key] ?? 0.5)); return <circle key={i} cx={x} cy={y} r={3} fill={color} />; })}
      {showLabels && OCEAN.map((o, i) => {
        const [x, y] = pt(i, R + 22);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em', fill: 'var(--ink-faint)', fontFamily: 'var(--font-body)' }}>{o.label}</text>;
      })}
    </svg>
  );
}

export function OceanBars({ data, color = 'var(--sage)' }: { data: OceanData; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {OCEAN.map((o) => {
        const v = Math.round((data[o.key] ?? 0.5) * 100);
        return (
          <div key={o.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${v}%`, borderRadius: 99, background: color, transition: 'width .8s var(--ease)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OceanRings({ data }: { data: OceanData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center' }}>
      {OCEAN.map((o) => {
        const v = data[o.key] ?? 0.5; const C = 2 * Math.PI * 22;
        return (
          <div key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <svg width={52} height={52} viewBox="0 0 52 52">
              <circle cx={26} cy={26} r={22} fill="none" stroke="var(--surface-2)" strokeWidth={5} />
              <circle cx={26} cy={26} r={22} fill="none" stroke="var(--sage)" strokeWidth={5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v)} transform="rotate(-90 26 26)" />
              <text x={26} y={26} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--sage-deep)', fontFamily: 'var(--font-display)' }}>{o.short}</text>
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{Math.round(v * 100)}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
