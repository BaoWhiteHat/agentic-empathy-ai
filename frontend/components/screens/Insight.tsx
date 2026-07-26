'use client';
// components/screens/Insight.tsx — OCEAN personality insight (wired to backend ocean)
import React from 'react';
import { Skeleton } from '../ui/primitives';
import { ScreenScroll } from '../ui/ScreenScroll';
import { OCEAN, OceanRadar, type OceanData } from '../ui/Ocean';
import { Icon } from '../ui/Icon';

const TRAIT_COPY: Record<keyof OceanData, { plain: string; icon: string }> = {
  openness: { plain: 'A glimpse of how you welcome new ideas and possibilities.', icon: 'sparkle' },
  conscientiousness: { plain: 'A sense of how much structure helps you feel steady.', icon: 'check' },
  extraversion: { plain: 'How connection and quiet may each help you recharge.', icon: 'chat' },
  agreeableness: { plain: 'How naturally warmth and cooperation show up for you.', icon: 'heart' },
  neuroticism: { plain: 'A gentle sense of how strongly moments and feelings may land.', icon: 'waves' },
};

const TRAIT_COLORS: Record<keyof OceanData, string> = {
  openness: 'var(--gold)',
  conscientiousness: 'var(--sage)',
  extraversion: 'var(--lavender)',
  agreeableness: 'var(--clay)',
  neuroticism: 'var(--mood-low)',
};

const SUPPORT_SHIFTS = [
  { icon: 'chat', label: 'Tone', text: 'warmer or more direct' },
  { icon: 'waves', label: 'Pacing', text: 'room to pause or move gently' },
  { icon: 'heart', label: 'Reassurance', text: 'more grounding when it helps' },
  { icon: 'compass', label: 'Structure', text: 'clearer next steps when wanted' },
];

export function InsightScreen({ ocean, narrative = '', loaded = true, error = null }: { ocean: OceanData; narrative?: string; loaded?: boolean; error?: string | null }) {
  const narrativeText = narrative.trim();
  // Text alternative for the chart (WCAG — non-text content needs a text equivalent).
  const oceanAria = `OCEAN profile: ${OCEAN.map((o) => `${o.label} ${Math.round((ocean[o.key] ?? 0.5) * 100)}%`).join(', ')}`;
  return (
    <ScreenScroll max={1180}>
      <div className="insights-screen">
        <header className="insights-heading">
          <div>
            <p className="label" style={{ marginBottom: 7 }}>A little more understanding</p>
            <h1 className="serif">Your personal reflection</h1>
            <p>Small patterns can help SoulMate meet you with more care. Nothing here defines you, and everything can keep changing.</p>
          </div>
        </header>

        <section className="insights-hero" aria-labelledby="reflection-label">
          <div className="insights-hero-copy">
            <div className="insights-hero-meta">
              <p id="reflection-label" className="label">What I’m noticing</p>
              <div className="insights-private-badge"><Icon name="lock" size={13} /> Private · Updates gradually</div>
            </div>
            {!loaded && !error ? (
              <div className="insights-hero-loading" aria-label="Your reflection is loading">
                <Skeleton height={20} width="48%" /><Skeleton height={12} /><Skeleton height={12} width="72%" />
              </div>
            ) : error ? (
              <div className="insights-hero-content">
                <h2 className="serif">This reflection is taking a quiet pause</h2>
                <p>I can’t refresh it right now. When SoulMate reconnects, your reflection will return here.</p>
              </div>
            ) : !narrativeText ? (
              <div className="insights-hero-content">
                <h2 className="serif">Your reflection is still forming</h2>
                <p>As we share a few more conversations, a gentle summary will take shape here. There is nothing you need to do or prove.</p>
              </div>
            ) : (
              <div className="insights-hero-content">
                <h2 className="serif">A gentle sense of what feels like you</h2>
                <p className="insights-narrative">{narrativeText}</p>
              </div>
            )}
            <div className="insights-disclaimer"><Icon name="leaf" size={16} /> These are evolving clues, not labels, diagnoses, or fixed scores.</div>
          </div>
        </section>

      <div className="insights-profile-grid">
        <aside className="insights-radar-card card" aria-labelledby="overview-heading">
          <div>
            <p className="label">Your OCEAN profile</p>
            <h2 id="overview-heading" className="serif">Five signals at a glance</h2>
          </div>
          <div role="img" aria-label={oceanAria} className="insights-radar">
            <OceanRadar data={ocean} size={244} />
          </div>
          <p>Updated gradually as we talk—not a personality test or a fixed result.</p>
        </aside>

        <section className="insights-traits" aria-labelledby="traits-heading">
          <div className="insights-section-heading">
            <div>
              <p className="label">Understanding your signals</p>
              <h2 id="traits-heading" className="serif">Your profile, held lightly</h2>
            </div>
            <p>Percentages show subtle patterns, never grades.</p>
          </div>
          <div className="insights-trait-grid">
            {OCEAN.map((o) => {
              const accent = TRAIT_COLORS[o.key];
              const copy = TRAIT_COPY[o.key];
              const pct = Math.round((ocean[o.key] ?? 0.5) * 100);
              return (
                <article key={o.key} className="insights-trait-card" style={{ '--trait-accent': accent } as React.CSSProperties}>
                  <div className="insights-trait-top">
                    <span className="insights-trait-icon"><Icon name={copy.icon} size={19} /></span>
                    <h3>{o.label}</h3>
                    <span className="insights-trait-percent">{pct}%</span>
                  </div>
                  <p>{copy.plain}</p>
                  <div
                    className="insights-trait-progress"
                    role="progressbar"
                    aria-label={`${o.label} reflection`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="insights-support-card card" aria-labelledby="support-heading">
        <div className="insights-support-copy">
          <p className="label">How this shapes support</p>
          <h2 id="support-heading" className="serif">Care that can meet you where you are</h2>
          <p className="insights-support-intro">These signals may gently guide SoulMate’s tone and pacing. You are always in charge of what feels useful.</p>
        </div>
        <div className="insights-support-list">
          {SUPPORT_SHIFTS.map((item) => (
            <div key={item.label} className="insights-support-item">
              <span><Icon name={item.icon} size={17} /></span>
              <div><strong>{item.label}</strong><small>{item.text}</small></div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </ScreenScroll>
  );
}
