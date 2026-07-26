'use client';
// components/EmotionBadge.tsx — header chip showing the latest backend-detected emotion.
// Driven by the `emotion` field of each chat WebSocket `emotion_status` frame.
import React from 'react';

// Maps each backend emotion (from PerceptionAgent) to its badge color.
const EMOTION_COLORS: Record<string, string> = {
  neutral: '#9e9e9e',   // grey
  happy: '#f4c430',     // yellow
  love: '#e91e8c',      // pink
  sad: '#5b8dee',       // blue
  depressed: '#3a5a8c', // dark blue
  anxious: '#ff9800',   // orange
  angry: '#e53935',     // red
  fearful: '#7b1fa2',   // purple
  ashamed: '#795548',   // brown
  surprise: '#00bcd4',  // teal
  disgust: '#827717',   // olive
  confusion: '#78909c', // grey-purple
};

export function EmotionBadge({ emotion = 'neutral' }: { emotion?: string }) {
  const key = (emotion || 'neutral').toLowerCase();
  const color = EMOTION_COLORS[key] ?? EMOTION_COLORS.neutral;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span
      className="emotion-badge"
      title={`Detected emotion: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.02em',
        color,
        background: `color-mix(in oklab, ${color} 14%, var(--surface))`,
        border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
        whiteSpace: 'nowrap',
        transition: 'color .25s, background .25s, border-color .25s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export default EmotionBadge;
