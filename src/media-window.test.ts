import { expect, test } from 'vitest';
import { endOfDay, startOfDay } from '@/dates';
import { assetsInEventWindow } from '@/media-window';

// Every instant here is built from a *local* date, never from a literal like
// '2026-09-03T00:00:00Z': the window is a span of local days, so a test written in UTC would
// pass only for whoever runs it in London.

/** September 2026, the month the fixtures live in. */
const day = (date: number) => new Date(2026, 8, date);
const at = (date: number, h: number, m = 0, s = 0, ms = 0) =>
  new Date(2026, 8, date, h, m, s, ms).getTime();

/** A memory as the create screen sends it and the api hands it back. */
const memory = (start: Date, end?: Date) => ({
  event_start: startOfDay(start).toISOString(),
  event_end: end ? endOfDay(end).toISOString() : null,
});

/** An asset as expo-media-library lists it, cut down to what the pick reads. */
const shot = (id: string, creationTime?: number) => ({ id, creationTime });

const picked = (window: ReturnType<typeof memory>, assets: ReturnType<typeof shot>[]) =>
  assetsInEventWindow(window, assets).map((asset) => asset.id);

test('a one-day memory takes that whole day, both edges included', () => {
  const assets = [
    shot('the-night-before', at(2, 23, 59, 59, 999)),
    shot('first-millisecond', at(3, 0)),
    shot('noon', at(3, 12)),
    shot('last-millisecond', at(3, 23, 59, 59, 999)),
    shot('the-morning-after', at(4, 0)),
  ];

  expect(picked(memory(day(3)), assets)).toEqual([
    'first-millisecond',
    'noon',
    'last-millisecond',
  ]);
});

test('a memory with an end takes every day of the span', () => {
  const assets = [
    shot('the-night-before', at(2, 23, 59, 59, 999)),
    shot('opening-day', at(3, 0)),
    shot('the-day-between', at(4, 12)),
    shot('closing-day', at(5, 23, 59, 59, 999)),
    shot('the-morning-after', at(6, 0)),
  ];

  expect(picked(memory(day(3), day(5)), assets)).toEqual([
    'opening-day',
    'the-day-between',
    'closing-day',
  ]);
});

test('an asset with no capture date is left out', () => {
  const assets = [shot('undated'), shot('zeroed', 0), shot('dated', at(3, 12))];

  expect(picked(memory(day(3)), assets)).toEqual(['dated']);
});
