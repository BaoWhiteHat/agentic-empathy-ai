'use client';
// components/screens/Insight.tsx — OCEAN personality insight (wired to backend ocean)
import React, { useState } from 'react';
import { Button, Skeleton } from '../ui/primitives';
import { ScreenScroll } from '../ui/ScreenScroll';
import { OCEAN, OceanRadar, type OceanData } from '../ui/Ocean';
import { useTweaks } from '../../context/TweaksContext';

const TRAIT_COPY: Record<string, { plain: string; soft: string }> = {
  openness: { plain: 'You’re curious and open to new ways of seeing things.', soft: 'open & curious' },
  conscientiousness: { plain: 'You like a sense of order, and you follow through on what matters to you.', soft: 'thoughtful & steady' },
  extraversion: { plain: 'You recharge more in quiet, and warm up once you feel safe.', soft: 'gently reserved' },
  agreeableness: { plain: 'You’re warm and considerate, often putting others first.', soft: 'warm & caring' },
  neuroticism: { plain: 'You feel things deeply — a sensitivity that’s also a kind of depth.', soft: 'deeply feeling' },
};

// Per-trait colour treatment for the trait cards + chart-card legend. (--gold-tint
// isn't defined in globals.css, so openness uses --gold-soft, the existing gold tint.)
const TRAIT_COLORS: Record<string, { bar: string; badgeBg: string; badgeText: string; border: string }> = {
  openness:          { bar: 'var(--gold)',         badgeBg: 'var(--gold-soft)',      badgeText: 'var(--gold)',          border: 'color-mix(in oklab, var(--gold) 28%, transparent)'     },
  conscientiousness: { bar: 'var(--sage)',         badgeBg: 'var(--sage-tint)',      badgeText: 'var(--sage-deep)',     border: 'color-mix(in oklab, var(--sage) 28%, transparent)'     },
  agreeableness:     { bar: 'var(--clay)',         badgeBg: 'var(--clay-tint)',      badgeText: 'var(--clay-deep)',     border: 'color-mix(in oklab, var(--clay) 28%, transparent)'     },
  extraversion:      { bar: 'var(--lavender)',     badgeBg: 'var(--lavender-tint)',  badgeText: 'var(--lavender-deep)', border: 'color-mix(in oklab, var(--lavender) 28%, transparent)' },
  neuroticism:       { bar: 'oklch(55% 0.08 235)', badgeBg: 'oklch(97% 0.018 235)',  badgeText: 'oklch(38% 0.09 235)',  border: 'oklch(84% 0.045 235)'                                 },
};

export function InsightScreen({ ocean, narrative = '', loaded = true, error = null }: { ocean: OceanData; narrative?: string; loaded?: boolean; error?: string | null }) {
  const { tweaks } = useTweaks();
  const [why, setWhy] = useState(false);
  const sorted = [...OCEAN].sort((a, b) => (ocean[b.key] ?? 0) - (ocean[a.key] ?? 0));
  // Text alternative for the chart (WCAG — non-text content needs a text equivalent).
  const oceanAria = `OCEAN profile: ${OCEAN.map((o) => `${o.label} ${Math.round((ocean[o.key] ?? 0.5) * 100)}%`).join(', ')}`;
  return (
    <ScreenScroll max={900}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>How I’m getting to know you</p>
          <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>Your reflection, in five colours</h1>
          <p style={{ fontSize: 'calc(var(--text-base) * 0.94)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 540, lineHeight: 1.55 }}>This is SoulMate’s gentle, evolving sense of you — never a label or a score to fix. It only shapes how warmly and how I respond.</p>
        </div>
        <Button variant="soft" size="sm" icon="info" onClick={() => setWhy((v) => !v)}>Why am I seeing this?</Button>
      </div>

      {why && (
        <div className="fade-up" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '16px 20px', marginBottom: 22, fontSize: 'calc(var(--text-base) * 0.875)', color: 'var(--ink)', lineHeight: 1.6 }}>
          SoulMate quietly notices patterns in how you write — word choice, pace, what you return to — and nudges these five dials over time.{' '}
          {tweaks.explainDetail === 'plain+how' && <span style={{ color: 'var(--ink-faint)' }}>Technically: a lightweight OCEAN inference runs on your messages; values are smoothed across sessions and never shared.{' '}</span>}
          You can ask me to ease off anytime, and it never changes whether you’re welcome here.
        </div>
      )}

      <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <p className="label" style={{ marginBottom: 10 }}>How I’m getting to know you</p>
        {!loaded && !error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Skeleton height={13} /><Skeleton height={13} /><Skeleton height={13} width="72%" />
          </div>
        ) : error || !narrative.trim() ? (
          <p style={{ fontSize: 'calc(var(--text-base) * 0.9)', color: 'var(--ink-faint)', lineHeight: 1.6, margin: 0 }}>Not enough conversations yet.</p>
        ) : (
          <p style={{ fontSize: 'calc(var(--text-base) * 0.94)', color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>{narrative}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div role="img" aria-label={oceanAria} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <OceanRadar data={ocean} size={240} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 18, textAlign: 'center' }}>Updated gently as we talk</p>
        </div>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((o) => {
            const tc = TRAIT_COLORS[o.key];
            const pct = Math.round((ocean[o.key] ?? 0.5) * 100);
            return (
              <div key={o.key} className="card" style={{ flex: 1, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: 'var(--shadow-soft)', borderLeft: `2.5px solid ${tc.bar}` }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: tc.badgeBg, border: `1.5px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 17, color: tc.badgeText, flexShrink: 0 }}>{o.short}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, fontSize: 'calc(var(--text-base) * 0.9)' }}>{o.label}</span>
                    <span style={{ fontSize: 12, color: tc.badgeText, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', margin: '8px 0 6px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: tc.bar, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 'calc(var(--text-base) * 0.8125)', color: 'var(--ink-soft)', lineHeight: 1.4, marginTop: 2 }}>{TRAIT_COPY[o.key].plain}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenScroll>
  );
}
