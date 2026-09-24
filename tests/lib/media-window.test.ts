import { expect, test, vi } from 'vitest';

// Nothing below is about language, but `@/lib/dates` writes a day in the app's own one now (m-13), and
// the module holding it stands on two native expo modules vitest cannot load. Faked so the import
// goes through; the cut itself is timezone arithmetic and never reads a word.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import { endOfDay, startOfDay } from '@/lib/dates';
import { assetsByDay } from '@/lib/media-window';

// Every instant here is built from a *local* date, never from a literal like
// '2026-09-03T00:00:00Z': the days are local days, so a test written in UTC would pass only for
// whoever runs it in London.

/** September 2026, the month the fixtures live in. */
const day = (date: number) => new Date(2026, 8, date);
const at = (date: number, h: number, m = 0, s = 0, ms = 0) =>
  new Date(2026, 8, date, h, m, s, ms).getTime();

/** A memory as the create screen sends it and the api hands it back. */
const memory = (start: Date, end?: Date) => ({
  event_start: startOfDay(start).toISOString(),
  event_end: end ? endOfDay(end).toISOString() : null,
});

/** An asset as expo-media-library lists it, cut down to what the cut reads. */
const shot = (id: string, creationTime?: number) => ({ id, creationTime });

/** The roll as the screen draws it: the days in order, each with the event mark and its own ids. */
const strips = (
  window: ReturnType<typeof memory> | null,
  assets: ReturnType<typeof shot>[],
): [boolean, string[]][] =>
  assetsByDay(window, assets).map((one) => [one.inEvent, one.assets.map((asset) => asset.id)]);

test('a one-day memory owns that whole day, both edges included', () => {
  const assets = [
    shot('the-night-before', at(2, 23, 59, 59, 999)),
    shot('first-millisecond', at(3, 0)),
    shot('noon', at(3, 12)),
    shot('last-millisecond', at(3, 23, 59, 59, 999)),
    shot('the-morning-after', at(4, 0)),
  ];

  expect(strips(memory(day(3)), assets)).toEqual([
    [true, ['first-millisecond', 'noon', 'last-millisecond']],
    // Everything else keeps the roll's own order behind it — newest day first.
    [false, ['the-morning-after']],
    [false, ['the-night-before']],
  ]);
});

test('a memory with an end keeps every day of the span, and each day is its own strip', () => {
  const assets = [
    shot('the-night-before', at(2, 23, 59, 59, 999)),
    shot('opening-day', at(3, 0)),
    shot('the-day-between', at(4, 12)),
    shot('closing-day', at(5, 23, 59, 59, 999)),
    shot('the-morning-after', at(6, 0)),
  ];

  expect(strips(memory(day(3), day(5)), assets)).toEqual([
    [true, ['closing-day']],
    [true, ['the-day-between']],
    [true, ['opening-day']],
    [false, ['the-morning-after']],
    [false, ['the-night-before']],
  ]);
});

test('the days of the event come first however far back in the roll they are', () => {
  const assets = [
    shot('yesterday', at(20, 9)),
    shot('the-event', at(3, 12)),
    shot('last-week', at(14, 9)),
  ];

  expect(strips(memory(day(3)), assets)).toEqual([
    [true, ['the-event']],
    [false, ['yesterday']],
    [false, ['last-week']],
  ]);
});

test('an asset with no capture date is not the event’s, and is not thrown away either', () => {
  const assets = [shot('undated'), shot('zeroed', 0), shot('dated', at(3, 12))];

  expect(strips(memory(day(3)), assets)).toEqual([
    [true, ['dated']],
    // Both of them on the epoch day, at the bottom of the roll where their order already put them.
    [false, ['undated', 'zeroed']],
  ]);
});

test('a memory that has not arrived leaves the roll a roll — no day is the event’s', () => {
  const assets = [shot('today', at(20, 9)), shot('back-then', at(3, 12))];

  expect(strips(null, assets)).toEqual([
    [false, ['today']],
    [false, ['back-then']],
  ]);
});
