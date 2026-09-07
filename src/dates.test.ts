import { expect, test } from 'vitest';
import { formatDay, formatEventDates, formatRuntime } from '@/dates';

// The date tests name their language out loud. The app never does — it takes the phone's — but a
// run in node has one locale and the kit's form has to hold in both the app speaks, and the whole
// point of the fix is that neither language's own punctuation («2026 г.», «September 3, 2026»)
// reaches the screen. Days are written as local ones, since that is the day a memory carries.

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();

test('a single day is written in the kit form: full month, no year marker', () => {
  expect(formatDay(day(2026, 9, 3), 'ru-RU')).toBe('3 сентября 2026');
  expect(formatDay(day(2026, 9, 3), 'en-US')).toBe('3 September 2026');
});

test('a span inside one month names the month once and drops the year', () => {
  expect(formatEventDates(day(2026, 8, 12), day(2026, 8, 16), 'ru-RU')).toBe('12–16 августа');
  expect(formatEventDates(day(2026, 8, 12), day(2026, 8, 16), 'en-US')).toBe('12–16 August');
});

test('a span across months writes both days whole', () => {
  expect(formatEventDates(day(2026, 8, 28), day(2026, 9, 2), 'ru-RU')).toBe(
    '28 августа 2026 — 2 сентября 2026',
  );
});

test('a span across years writes both days whole, same month or not', () => {
  expect(formatEventDates(day(2025, 12, 31), day(2026, 1, 1), 'en-US')).toBe(
    '31 December 2025 — 1 January 2026',
  );
  expect(formatEventDates(day(2025, 8, 12), day(2026, 8, 16), 'ru-RU')).toBe(
    '12 августа 2025 — 16 августа 2026',
  );
});

test('no end at all is the single day', () => {
  expect(formatEventDates(day(2026, 9, 3), null, 'ru-RU')).toBe('3 сентября 2026');
});

// The create screen switches an end on by setting it to the end of the day it starts on, so this
// pair arrives from the api as a real memory — and it is one day, not a span of one.
test('an end on the starting day is still a single day, not «3–3 сентября»', () => {
  expect(formatEventDates(day(2026, 9, 3), day(2026, 9, 3), 'ru-RU')).toBe('3 сентября 2026');
});

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
