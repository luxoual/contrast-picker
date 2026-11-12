// WCAG 2.x contrast math. Pure functions, no browser APIs, so it can be unit-tested in Node.
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance

/** Normalize "#abc", "abc", "#AABBCC" etc. to "#aabbcc". Returns null if invalid. */
export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = [...h].map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

export function hexToRgb(hex) {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

// sRGB channel (0–255) -> linear-light value. WCAG 2.2 uses the 0.04045 threshold
// (older texts say 0.03928; the difference never affects an 8-bit color's result).
function linearize(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio from 1 to 21. Order of arguments does not matter. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG says not to round the ratio before comparing it with a threshold
 * (4.499:1 fails 4.5:1), so the displayed value is truncated, never rounded up.
 */
export function formatRatio(ratio) {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

export const CRITERIA = [
  { id: 'aa-normal', short: 'AA', label: 'AA · Normal text', sc: '1.4.3', min: 4.5 },
  { id: 'aa-large', short: 'AA Large', label: 'AA · Large text', sc: '1.4.3', min: 3 },
  { id: 'aaa-normal', short: 'AAA', label: 'AAA · Normal text', sc: '1.4.6', min: 7 },
  { id: 'aaa-large', short: 'AAA Large', label: 'AAA · Large text', sc: '1.4.6', min: 4.5 },
  { id: 'ui', short: 'UI', label: 'AA · UI & graphics', sc: '1.4.11', min: 3 },
];

export function evaluate(fg, bg) {
  const ratio = contrastRatio(fg, bg);
  return { ratio, results: CRITERIA.map((c) => ({ ...c, pass: ratio >= c.min })) };
}
