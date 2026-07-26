/* global React */
// components.jsx — shared primitives for SoulMate. Exports to window.
const { useState, useEffect, useRef } = React;

/* ============================================================
   Icon — calm Lucide-style line icons (1.75 stroke, rounded)
   ============================================================ */
const ICON_PATHS = {
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4|circle:12,12,4',
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

function Icon({ name, size = 20, stroke = 1.75, fill = 'none', className = '', style = {} }) {
  const def = ICON_PATHS[name];
  if (!def) return null;
  const parts = def.split('|');
  const els = [];
  parts.forEach((p, i) => {
    if (p.startsWith('circle:')) {
      const [cx, cy, r] = p.slice(7).split(',');
      els.push(React.createElement('circle', { key: i, cx, cy, r }));
    } else if (p.startsWith('rect:')) {
      const [x, y, w, h, rx] = p.slice(5).split(',');
      els.push(React.createElement('rect', { key: i, x, y, width: w, height: h, rx: rx || 0 }));
    } else if (p.startsWith('dot:')) {
      const [cx, cy] = p.slice(4).split(',');
      els.push(React.createElement('circle', { key: i, cx, cy, r: 1, fill: 'currentColor', stroke: 'none' }));
    } else if (p.startsWith('poly:')) {
      els.push(React.createElement('polygon', { key: i, points: p.slice(5) }));
    } else if (p === 'gear') {
      els.push(React.createElement('path', { key: i, d: 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z' }));
    } else {
      els.push(React.createElement('path', { key: i, d: p }));
    }
  });
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill,
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    className, style, 'aria-hidden': true,
  }, els);
}

/* ============================================================
   Button — 4 tiers
   ============================================================ */
function Button({ variant = 'primary', size = 'md', icon, iconRight, full, children, style = {}, ...rest }) {
  const sz = {
    sm: { padding: '8px 14px', fontSize: 13, gap: 7 },
    md: { padding: '12px 20px', fontSize: 14.5, gap: 9 },
    lg: { padding: '15px 26px', fontSize: 15.5, gap: 10 },
  }[size];
  const variants = {
    primary: { background: 'linear-gradient(135deg, var(--sage), var(--sage-deep))', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 18px color-mix(in oklab, var(--sage) 38%, transparent)' },
    clay: { background: 'var(--clay)', color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 18px color-mix(in oklab, var(--clay) 32%, transparent)' },
    lavender: { background: 'var(--lavender)', color: '#fff', border: '1px solid transparent' },
    soft: { background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line)' },
    outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
    ghost: { background: 'transparent', color: 'var(--ink-soft)', border: '1px solid transparent' },
    care: { background: 'var(--care)', color: '#fff', border: '1px solid transparent' },
  }[variant];
  return React.createElement('button', {
    ...rest,
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: sz.gap, padding: sz.padding, fontSize: sz.fontSize, fontWeight: 600,
      borderRadius: 'var(--r-pill)', width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
      transition: 'transform .15s var(--ease), filter .15s var(--ease), background .2s',
      ...variants, ...style,
    },
    onMouseDown: (e) => { e.currentTarget.style.transform = 'scale(.97)'; rest.onMouseDown && rest.onMouseDown(e); },
    onMouseUp: (e) => { e.currentTarget.style.transform = 'scale(1)'; },
    onMouseLeave: (e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; rest.onMouseLeave && rest.onMouseLeave(e); },
    onMouseEnter: (e) => { if (['primary','clay','lavender','care'].includes(variant)) e.currentTarget.style.filter = 'brightness(1.06)'; else e.currentTarget.style.background = 'var(--surface-3)'; rest.onMouseEnter && rest.onMouseEnter(e); },
  },
    icon && React.createElement(Icon, { name: icon, size: size === 'sm' ? 16 : 18 }),
    children && React.createElement('span', null, children),
    iconRight && React.createElement(Icon, { name: iconRight, size: size === 'sm' ? 16 : 18 })
  );
}

/* ============================================================
   IconBadge — tonal circle holding an icon
   ============================================================ */
function IconBadge({ name, tone = 'sage', size = 44, iconSize = 20 }) {
  const map = {
    sage: ['var(--sage-soft)', 'var(--sage-deep)'],
    clay: ['var(--clay-soft)', 'var(--clay-deep)'],
    lavender: ['var(--lavender-soft)', 'var(--lavender-deep)'],
    gold: ['var(--gold-soft)', 'var(--gold)'],
    care: ['var(--care-soft)', 'var(--care)'],
    neutral: ['var(--surface-2)', 'var(--ink-soft)'],
  };
  const [bg, fg] = map[tone] || map.sage;
  return React.createElement('div', {
    style: { width: size, height: size, borderRadius: size > 40 ? 'var(--r-md)' : 'var(--r-sm)', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  }, React.createElement(Icon, { name, size: iconSize, stroke: 1.9 }));
}

/* ============================================================
   OCEAN radar / chart — multiple visualisation modes
   ============================================================ */
const OCEAN = [
  { key: 'openness', label: 'Openness', short: 'O' },
  { key: 'conscientiousness', label: 'Conscientiousness', short: 'C' },
  { key: 'extraversion', label: 'Extraversion', short: 'E' },
  { key: 'agreeableness', label: 'Agreeableness', short: 'A' },
  { key: 'neuroticism', label: 'Sensitivity', short: 'N' },
];

function OceanRadar({ data, size = 220, color = 'var(--sage)', showLabels = true }) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const n = OCEAN.length;
  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.33, 0.66, 1];
  const gridPolys = rings.map((rr) => OCEAN.map((_, i) => pt(i, R * rr).join(',')).join(' '));
  const valPts = OCEAN.map((o, i) => pt(i, R * (data[o.key] ?? 0.5)).join(',')).join(' ');
  return React.createElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { overflow: 'visible' } },
    React.createElement('defs', null,
      React.createElement('radialGradient', { id: 'oceanFill' },
        React.createElement('stop', { offset: '0%', stopColor: color, stopOpacity: 0.42 }),
        React.createElement('stop', { offset: '100%', stopColor: color, stopOpacity: 0.12 })
      )
    ),
    gridPolys.map((p, i) => React.createElement('polygon', { key: i, points: p, fill: 'none', stroke: 'var(--line-strong)', strokeWidth: 1, opacity: 0.6 })),
    OCEAN.map((_, i) => { const [x, y] = pt(i, R); return React.createElement('line', { key: i, x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--line-strong)', strokeWidth: 1, opacity: 0.5 }); }),
    React.createElement('polygon', { points: valPts, fill: 'url(#oceanFill)', stroke: color, strokeWidth: 2.2, strokeLinejoin: 'round' }),
    OCEAN.map((o, i) => { const [x, y] = pt(i, R * (data[o.key] ?? 0.5)); return React.createElement('circle', { key: i, cx: x, cy: y, r: 3, fill: color }); }),
    showLabels && OCEAN.map((o, i) => {
      const [x, y] = pt(i, R + 22);
      return React.createElement('text', { key: i, x, y, textAnchor: 'middle', dominantBaseline: 'middle',
        style: { fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em', fill: 'var(--ink-faint)', fontFamily: 'var(--font-body)' } }, o.label);
    })
  );
}

function OceanBars({ data, color = 'var(--sage)' }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%' } },
    OCEAN.map((o) => {
      const v = Math.round((data[o.key] ?? 0.5) * 100);
      return React.createElement('div', { key: o.key },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink)' } }, o.label),
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' } }, v + '%')
        ),
        React.createElement('div', { style: { height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' } },
          React.createElement('div', { style: { height: '100%', width: v + '%', borderRadius: 99, background: color, transition: 'width .8s var(--ease)' } })
        )
      );
    })
  );
}

/* ============================================================
   BreathingOrb — calm pulsing presence
   ============================================================ */
function BreathingOrb({ size = 120, tone = 'var(--sage)', active = true, children }) {
  return React.createElement('div', { style: { position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    [0, 1].map((i) => React.createElement('div', { key: i, style: {
      position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${tone}`,
      animation: active ? `ripple 4s var(--ease) infinite` : 'none', animationDelay: `${i * 1.4}s`, opacity: 0,
    } })),
    React.createElement('div', { style: {
      width: size * 0.62, height: size * 0.62, borderRadius: '50%',
      background: `color-mix(in oklab, ${tone} 18%, var(--surface))`, border: `1.5px solid color-mix(in oklab, ${tone} 40%, transparent)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone,
      animation: active ? 'breathe 5s ease-in-out infinite' : 'none',
    } }, children)
  );
}

/* ============================================================
   Toggle switch
   ============================================================ */
function Toggle({ on, onChange, tone = 'var(--sage)' }) {
  return React.createElement('button', {
    role: 'switch', 'aria-checked': on, onClick: () => onChange(!on),
    style: { width: 46, height: 27, borderRadius: 99, border: '1px solid var(--line)', background: on ? tone : 'var(--surface-2)', position: 'relative', transition: 'background .25s', flexShrink: 0, padding: 0 },
  }, React.createElement('span', { style: { position: 'absolute', top: 2, left: on ? 21 : 2, width: 21, height: 21, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .25s var(--ease)' } }));
}

/* ============================================================
   Pill / chip
   ============================================================ */
function Pill({ children, tone = 'neutral', icon, active, onClick, style = {} }) {
  const map = {
    neutral: ['var(--surface-2)', 'var(--ink-soft)', 'var(--line)'],
    sage: ['var(--sage-soft)', 'var(--sage-deep)', 'transparent'],
    clay: ['var(--clay-soft)', 'var(--clay-deep)', 'transparent'],
    lavender: ['var(--lavender-soft)', 'var(--lavender-deep)', 'transparent'],
    care: ['var(--care-soft)', 'var(--care)', 'transparent'],
    gold: ['var(--gold-soft)', 'var(--gold)', 'transparent'],
  };
  const [bg, fg, bd] = map[tone] || map.neutral;
  return React.createElement(onClick ? 'button' : 'span', {
    onClick,
    style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99,
      background: bg, color: fg, border: `1px solid ${bd}`, fontSize: 11.5, fontWeight: 600,
      letterSpacing: '.02em', cursor: onClick ? 'pointer' : 'default', ...style },
  }, icon && React.createElement(Icon, { name: icon, size: 13, stroke: 2 }), children);
}

Object.assign(window, { Icon, Button, IconBadge, OceanRadar, OceanBars, OCEAN, BreathingOrb, Toggle, Pill });
