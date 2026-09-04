import { expect, test } from 'vitest';
import { formatRuntime } from '@/dates';

// New in m-7: both the gallery and the upload screen draw a tile's duration corner through this,
// so a rounding or padding slip here would show up twice.

test('writes minutes and seconds, seconds padded to two digits', () => {
  expect(formatRuntime(42)).toBe('0:42');
  expect(formatRuntime(67)).toBe('1:07');
});

test('a whole minute carries no leftover seconds', () => {
  expect(formatRuntime(60)).toBe('1:00');
});

test('zero is a real runtime, not the missing one', () => {
  expect(formatRuntime(0)).toBe('0:00');
});

test('rounds to the nearest second, even across a minute boundary', () => {
  expect(formatRuntime(59.6)).toBe('1:00');
});

test('no duration at all — the gallery item that has none yet — is left for the caller to word', () => {
  expect(formatRuntime(null)).toBeUndefined();
});
