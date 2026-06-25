'use client';
// components/ui/Icon.tsx
// Unified calm line-icon set. Merges the main SoulMate icon set
// (compact "arrowR"/"chair" naming, encoded path strings) with the
// safety feature's Lucide icons (kebab "arrow-right"/"shield-check").
import React from 'react';

// Main set: each value is a "|"-separated list of path fragments.
// Prefixes: circle:, rect:, dot:, poly:, or the literal "gear".
const ICON_PATHS: Record<string, string> = {
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4|circle:12,12,4',
  // Half-sun dome on a horizon line, rays above only.
  sunrise: 'M3 18h18|M8 18a4 4 0 0 1 8 0|M12 4v3|M5.6 9.6 7 11|M18.4 9.6 17 11',
  // Same dome + horizon, but shorter (fading) rays — the setting mirror of sunrise.
  sunset: 'M3 18h18|M8 18a4 4 0 0 1 8 0|M12 7v2|M6.8 10.8 7.6 11.6|M17.2 10.8 16.4 11.6',
  chat: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z',
  feather: 'M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8 2 22M17.5 15H9',
  compass: 'M14.31 8 9.69 16M16.62 12 7.38 12|circle:12,12,9|poly:13.5,10.5 16,8 13.5,13.5 8,16 10.5,13.5',
  archive: 'M4 8h16M6 8v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8M9 12h6|rect:3,4,18,4,1',
  sprout: 'M7 20h10M12 20V10M12 10c0-3-2-5-5-5-1 0-2 .3-2 .3S5 9 8 9c2.5 0 4-1.5 4-1.5M12 10c0-2.5 1.7-4.3 4.2-4.3 .9 0 1.8.3 1.8.3s-.2 3.2-3 3.2c-2 0-3-1.2-3-1.2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|gear',
  shieldHeart: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 13.2c-1-1.4-3-1.6-3-3.4 0-1 .8-1.6 1.6-1.6.7 0 1.1.4 1.4.8.3-.4.7-.8 1.4-.8.8 0 1.6.6 1.6 1.6 0 1.8-2 2-3 3.4z',
  mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8',
  chair: 'M6 4h12M7 4v6h10V4M7 10l-1 6M17 10l1 6M5 20l1-4h12l1 4',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  chevR: 'M9 18l6-6-6-6',
  chevL: 'M15 18l-6-6 6-6',
  chevD: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  arrowR: 'M5 12h14M12 5l7 7-7 7',
  arrowL: 'M19 12H5M12 19l-7-7 7-7',
  info: 'M12 16v-4M12 8h.01|circle:12,12,10',
  heart: 'M20.8 7.6a5 5 0 0 0-8.8-2.3A5 5 0 0 0 3.2 7.6c0 4 5.5 8 8.8 10.4 3.3-2.4 8.8-6.4 8.8-10.4z',
  wind: 'M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.6 7.5A2.5 2.5 0 1 1 19 12H2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|circle:12,12,3',
  eyeOff: 'M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2.2 3M6.6 6.6A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 4-.9M3 3l18 18M10 10a3 3 0 0 0 4 4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3|rect:4,11,16,10,2|dot:12,15.5',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6',
  pencil: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  clock: 'M12 7v5l3 2|circle:12,12,9',
  calendar: 'M8 2v4M16 2v4M3 10h18|rect:3,4,18,18,2',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16zM4 20c4-7 7-9 13-11',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19z',
  rain: 'M16 13a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1A3.5 3.5 0 0 0 6 11M8 17l-.7 1.5M12 17l-1 2.5M16 17l-.7 1.5',
  droplet: 'M12 2.7 6.3 9a8 8 0 1 0 11.4 0z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M8 5v14M16 5v14',
  volume: 'M11 5 6 9H2v6h4l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  pen: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-1.5M2 22l3-1 12.5-12.5a1.4 1.4 0 0 0 0-2L16 4.5a1.4 1.4 0 0 0-2 0L1.5 17z',
  smile: 'M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01|circle:12,12,10',
  star: 'M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.6 6.7 19.1l1-5.8-4.2-4.1 5.9-.9z',
  waves: 'M2 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 18c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|circle:12,7,4',
};

// Safety/Lucide set: raw inner SVG markup, kebab-case names.
const LUCIDE_PATHS: Record<string, string> = {
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  sparkles: '<path d="M9.94 14.06A2 2 0 0 0 8.5 12.6L3 11l5.5-1.6A2 2 0 0 0 9.94 7.9L11.5 2.4 13 7.9a2 2 0 0 0 1.44 1.5L20 11l-5.56 1.6A2 2 0 0 0 13 14.06L11.5 19.6z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'shield-alert': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  'life-buoy': '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  ear: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
  'cloud-rain': '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  trees: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
  'volume-2': '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4A.7.7 0 0 0 11 19.3z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.36 18.36a9 9 0 0 0 0-12.72"/>',
  'volume-x': '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4A.7.7 0 0 0 11 19.3z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  'check-circle': '<path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/>',
  'heart-handshake': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
};

export interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  strokeWidth?: number; // alias used by safety components
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, stroke, strokeWidth, fill = 'none', className = '', style }: IconProps) {
  const sw = strokeWidth ?? stroke ?? 1.75;

  // Lucide (kebab) icons render via raw inner markup.
  const lucide = LUCIDE_PATHS[name];
  if (lucide) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: lucide }}
      />
    );
  }

  const def = ICON_PATHS[name];
  if (!def) return null;
  const parts = def.split('|');
  const els: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p.startsWith('circle:')) {
      const [cx, cy, r] = p.slice(7).split(',');
      els.push(<circle key={i} cx={cx} cy={cy} r={r} />);
    } else if (p.startsWith('rect:')) {
      const [x, y, w, h, rx] = p.slice(5).split(',');
      els.push(<rect key={i} x={x} y={y} width={w} height={h} rx={rx || 0} />);
    } else if (p.startsWith('dot:')) {
      const [cx, cy] = p.slice(4).split(',');
      els.push(<circle key={i} cx={cx} cy={cy} r={1} fill="currentColor" stroke="none" />);
    } else if (p.startsWith('poly:')) {
      els.push(<polygon key={i} points={p.slice(5)} />);
    } else if (p === 'gear') {
      els.push(<path key={i} d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />);
    } else {
      els.push(<path key={i} d={p} />);
    }
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {els}
    </svg>
  );
}

export default Icon;
