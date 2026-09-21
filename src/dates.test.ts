import { expect, test, vi } from 'vitest';

// `@/dates` asks `@/language` which language to write a day in, and that one stands on two native
// expo modules vitest has nothing to run. The phone below is set to Russian on purpose: the last
// tests here are about the app not listening to it.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import {
  daysBefore,
  formatDay,
  formatDayShort,
  formatEventDates,
  formatMonth,
  formatRuntime,
  formatTime,
  lastWeekend,
  weekdayLetters,
} from '@/dates';
import { setLanguage } from '@/language';

// The date tests below name their language out loud. The app never does — it takes the one it is
// speaking — but a run in node has one locale and the kit's form has to hold in both languages the
// app speaks, and the whole point of that fix is that neither language's own punctuation
// («2026 г.», «September 3, 2026») reaches the screen. Days are written as local ones, since that
// is the day a memory carries.

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

// The app ships over the air and the api deploys on its own, so a build can meet a listing that no
// longer carries these fields. `new Date` swallows anything and `toLocaleDateString` answers
// «Invalid Date» rather than throwing, so without a guard the garbage reaches the screen whole —
// «NaN Invalid Date NaN» printed under a photograph as the day the event happened.
test('a day the api did not send, or sent unreadable, writes nothing at all', () => {
  for (const bad of ['', 'yesterday', undefined as unknown as string]) {
    expect(formatDay(bad, 'ru-RU')).toBe('');
    expect(formatEventDates(bad, null, 'ru-RU')).toBe('');
  }
});

test('a readable start with an unreadable end is the day it began', () => {
  expect(formatEventDates(day(2026, 9, 3), 'not-a-day', 'ru-RU')).toBe('3 сентября 2026');
});

// m-13: nobody names a language on the calls the screens make. The phone faked above says Russian,
// so a date that came out Russian while the app is English would be the device's locale leaking
// back in — which is the bug this pair stands over.

test('a day with no language named is written in the one the app speaks', async () => {
  await setLanguage('en');
  expect(formatDay(day(2026, 9, 3))).toBe('3 September 2026');
  await setLanguage('ru');
  expect(formatDay(day(2026, 9, 3))).toBe('3 сентября 2026');
});

test('a span follows the app’s language too, both ends and the month it names once', async () => {
  await setLanguage('en');
  expect(formatEventDates(day(2026, 8, 12), day(2026, 8, 16))).toBe('12–16 August');
  await setLanguage('ru');
  expect(formatEventDates(day(2026, 8, 12), day(2026, 8, 16))).toBe('12–16 августа');
});

// The calendar on `Create` knows no words: the month over its grid and the seven letters over its
// columns are written here, in the language the app is speaking.

test('the month over the grid is capitalised and carries its year', () => {
  expect(formatMonth(new Date(2026, 8, 12), 'ru-RU')).toBe('Сентябрь 2026');
  expect(formatMonth(new Date(2026, 8, 12), 'en-US')).toBe('September 2026');
  // The month on its own is the form that heads a page, never the one a day is written with.
  expect(formatMonth(new Date(2026, 8, 12), 'ru-RU')).not.toContain('сентября');
});

test('the week starts on Monday and ends on Sunday, whichever language it is read in', () => {
  const ru = weekdayLetters('ru-RU');
  expect(ru).toHaveLength(7);
  expect(ru[0]).toBe('ПН');
  expect(ru[6]).toBe('ВС');
  expect(weekdayLetters('en-US')[0]).toBe('MON');
});

test('a day some days back rolls the month and the year over with it', () => {
  expect(daysBefore(new Date(2026, 8, 3), 6)).toEqual(new Date(2026, 7, 28));
  expect(daysBefore(new Date(2026, 0, 1), 1)).toEqual(new Date(2025, 11, 31));
});

// «Выходные» is the weekend just gone — the one quick day whose meaning is not one line of
// arithmetic, and the one that has to stay behind today whatever day of the week it is pressed on.
test('the weekend is the last Saturday and Sunday, and on a Saturday it is that day alone', () => {
  // Sunday 13 September 2026 and the Saturday before it.
  expect(lastWeekend(new Date(2026, 8, 16))).toEqual({
    from: new Date(2026, 8, 12),
    to: new Date(2026, 8, 13),
  });
  // Pressed on the Sunday itself, that Sunday is the end of it.
  expect(lastWeekend(new Date(2026, 8, 13))).toEqual({
    from: new Date(2026, 8, 12),
    to: new Date(2026, 8, 13),
  });
  // Pressed on the Monday after, it is still the weekend two days behind — never the one ahead.
  expect(lastWeekend(new Date(2026, 8, 14))).toEqual({
    from: new Date(2026, 8, 12),
    to: new Date(2026, 8, 13),
  });
  // And on a Saturday there is no Sunday yet: a memory cannot be of tomorrow.
  expect(lastWeekend(new Date(2026, 8, 12))).toEqual({
    from: new Date(2026, 8, 12),
    to: new Date(2026, 8, 12),
  });
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

/**
 * The two the montage journal writes with — the same pair the open frame writes its own line with
 * (TASK-211): the day without its year, and the clock beside it. Both are local, because they stand
 * beside «сейчас» on a screen somebody is watching while it is written.
 */
test('a journal record carries the day and the minute, and never the year', () => {
  const at = new Date(2026, 8, 13, 16, 43);
  expect(formatDayShort(at, 'ru')).toBe('13 сентября');
  expect(formatDayShort(at, 'ru')).not.toContain('2026');
  expect(formatTime(at, 'ru')).toBe('16:43');
  // English reads a clock on twelve hours, which is the language's shape and not a choice here.
  expect(formatTime(at, 'en-US')).toMatch(/4:43\s?PM/i);
});

test('an instant that will not parse writes nothing at all, the way a day does', () => {
  expect(formatTime('не дата')).toBe('');
  expect(formatDayShort('не дата')).toBe('');
});
