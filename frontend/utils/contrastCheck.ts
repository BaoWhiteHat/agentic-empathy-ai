// utils/contrastCheck.ts — WCAG 2.x relative-luminance contrast ratio.
// Used by the Tweaks panel to warn (not block) when a chosen accent colour
// fails the AA 4.5:1 threshold against the current background.

/** Parse #rgb / #rrggbb into [r,g,b] 0–255. Returns null if unparseable. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB channel (0–255) → linearised value, per WCAG. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance L = 0.2126R + 0.7152G + 0.0722B (linearised). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Contrast ratio between two hex colours, 1 (identical) … 21 (black vs white).
 * Returns 1 if either colour can't be parsed (treated as "no contrast info").
 */
export function getContrastRatio(hex: string, bgHex: string): number {
  const a = parseHex(hex);
  const b = parseHex(bgHex);
  if (!a || !b) return 1;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for normal text is 4.5:1 (3:1 for large text). */
export function passesAA(hex: string, bgHex: string, largeText = false): boolean {
  return getContrastRatio(hex, bgHex) >= (largeText ? 3 : 4.5);
}

/** Round to one decimal for display, e.g. 2.8. */
export function formatRatio(ratio: number): string {
  return (Math.round(ratio * 10) / 10).toFixed(1);
}
