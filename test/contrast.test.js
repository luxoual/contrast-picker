import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, evaluate, formatRatio, normalizeHex, relativeLuminance } from '../src/contrast.js';

const close = (actual, expected, eps = 0.005) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ~${expected}, got ${actual}`);

test('normalizeHex', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('  336699 '), '#336699');
  assert.equal(normalizeHex('#12345'), null);
  assert.equal(normalizeHex('#ggg'), null);
  assert.equal(normalizeHex(null), null);
});

test('relative luminance extremes', () => {
  assert.equal(relativeLuminance('#000'), 0);
  close(relativeLuminance('#fff'), 1, 1e-9);
});

test('known contrast ratios', () => {
  close(contrastRatio('#000', '#fff'), 21);
  close(contrastRatio('#fff', '#fff'), 1);
  close(contrastRatio('#777777', '#ffffff'), 4.48);
  close(contrastRatio('#767676', '#ffffff'), 4.54);
  close(contrastRatio('#0000ff', '#ffffff'), 8.59);
  close(contrastRatio('#ff0000', '#ffffff'), 4.0);
});

test('ratio is symmetric', () => {
  assert.equal(contrastRatio('#123456', '#abcdef'), contrastRatio('#abcdef', '#123456'));
});

test('formatRatio truncates instead of rounding up', () => {
  assert.equal(formatRatio(4.4999), '4.49:1');
  assert.equal(formatRatio(21), '21.00:1');
});

test('evaluate thresholds', () => {
  const pass = (fg, bg) => Object.fromEntries(evaluate(fg, bg).results.map((r) => [r.id, r.pass]));
  // #777 on white: 4.48 -> fails AA normal, passes AA large / UI
  assert.deepEqual(pass('#777777', '#ffffff'), {
    'aa-normal': false, 'aa-large': true, 'aaa-normal': false, 'aaa-large': false, ui: true,
  });
  // #767676 on white: 4.54 -> passes AA normal and AAA large
  assert.deepEqual(pass('#767676', '#ffffff'), {
    'aa-normal': true, 'aa-large': true, 'aaa-normal': false, 'aaa-large': true, ui: true,
  });
});
