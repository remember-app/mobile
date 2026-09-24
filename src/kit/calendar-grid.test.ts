import { afterEach, expect, test } from 'vitest';

import { dayKey, laneOf, weeksOf } from '@/kit/calendar-grid';

/** Spec 7.3, detail 15 — the arithmetic under the calendar, with no renderer between it and the test. */

const zone = process.env.TZ;
afterEach(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

/**
 * Runs `check` with the process in `name`'s zone. It first proves the zone took hold: a test that
 * quietly ran in the machine's own zone would pass for the wrong reason, which is the one way a
 * time-zone test can lie.
 */
function inZone(name: string, offsetMinutes: number, check: () => void) {
  process.env.TZ = name;
  expect(new Date(Date.UTC(2026, 0, 1, 12)).getTimezoneOffset(), `${name} took hold`).toBe(offsetMinutes);
  check();
}

const days = (month: Date) => weeksOf(month).flat().filter((day): day is Date => day !== null);

test('every week is seven long, and the month is all of it and nothing but it', () => {
  for (let m = 0; m < 12; m++) {
    const weeks = weeksOf(new Date(2026, m, 1));
    for (const week of weeks) expect(week).toHaveLength(7);
    const real = days(new Date(2026, m, 1));
    expect(real.map((day) => day.getDate())).toEqual(
      Array.from({ length: new Date(2026, m + 1, 0).getDate() }, (_, i) => i + 1),
    );
    for (const day of real) expect(day.getMonth()).toBe(m);
  }
});

test('the week starts on Monday: the first is under its own weekday, blanks in front of it', () => {
  // June 2026 opens on a Monday — no blanks at all. February 2026 opens on a Sunday — six of them.
  // September 2026 opens on a Tuesday — one.
  const blanks = (month: Date) => weeksOf(month)[0].findIndex((day) => day !== null);
  expect(blanks(new Date(2026, 5, 1))).toBe(0);
  expect(blanks(new Date(2026, 1, 1))).toBe(6);
  expect(blanks(new Date(2026, 8, 1))).toBe(1);
  // And whichever day of the month is handed in, it is the month that is drawn.
  expect(weeksOf(new Date(2026, 8, 30))).toEqual(weeksOf(new Date(2026, 8, 1)));
});

test('a month that spills into a sixth week gets six, and February is short when it is', () => {
  // August 2026 opens on a Saturday and has 31 days: 5 + 31 = 36 squares, so six rows.
  expect(weeksOf(new Date(2026, 7, 1))).toHaveLength(6);
  // February 2027 opens on a Monday and has 28: exactly four weeks and not a square more.
  expect(weeksOf(new Date(2027, 1, 1))).toHaveLength(4);
});

test('leap years: 29 February exists in 2028 and in 2000, and not in 2027 or 1900', () => {
  const last = (year: number) => days(new Date(year, 1, 1)).at(-1)!.getDate();
  expect(last(2028)).toBe(29);
  expect(last(2000)).toBe(29);
  expect(last(2027)).toBe(28);
  expect(last(1900)).toBe(28);
});

test('the year rolls over on its own in either direction', () => {
  // The two buttons build `new Date(year, month ± 1, 1)`, and December → January is the seam.
  const december = new Date(2026, 11, 1);
  expect(new Date(december.getFullYear(), december.getMonth() + 1, 1).getFullYear()).toBe(2027);
  expect(days(new Date(2027, 0, 1))[0].getFullYear()).toBe(2027);
  const january = new Date(2026, 0, 1);
  expect(new Date(january.getFullYear(), january.getMonth() - 1, 1).getMonth()).toBe(11);
});

test('a day is the day it lands on, whatever the hour and whatever the zone', () => {
  // East of UTC by fourteen hours and west of it by eleven: the two zones on which the moment a
  // day starts is on the other side of the date line from UTC's own. Read through `toISOString()`
  // the 12th would come out as the 11th in one and the 13th in the other; through the local
  // getters it is the 12th in both.
  for (const [name, offset] of [
    ['Pacific/Kiritimati', -840],
    ['Pacific/Pago_Pago', 660],
    ['Europe/Moscow', -180],
    ['UTC', 0],
  ] as const) {
    inZone(name, offset, () => {
      const start = new Date(2026, 8, 12, 0, 0, 0, 0);
      const end = new Date(2026, 8, 12, 23, 59, 59, 999);
      expect(dayKey(end), name).toBe(dayKey(start));
      expect(dayKey(new Date(2026, 8, 13, 0, 0, 0, 0)), name).toBeGreaterThan(dayKey(end));
      // The grid hands out exactly the days it drew, in order, one to a square.
      const real = days(new Date(2026, 8, 1));
      expect(real.map((day) => day.getDate()), name).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(new Set(real.map(dayKey)).size, name).toBe(30);
    });
  }
});

test('a day whose midnight was skipped by the clocks is still one day, and only one', () => {
  // Brazil put the clocks forward at midnight until 2018: on 4 November of that year there was no
  // 00:00 in São Paulo, and `new Date(2018, 10, 4)` lands on 01:00. It is still the 4th, and it
  // must not collide with the 3rd or the 5th.
  inZone('America/Sao_Paulo', 180, () => {
    const real = days(new Date(2018, 10, 1));
    expect(real.map((day) => day.getDate())).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(new Set(real.map(dayKey)).size).toBe(30);
    expect(dayKey(new Date(2018, 10, 4, 15))).toBe(dayKey(real[3]));
  });
});

test('a ribbon is the ends and everything between, and one day is not a ribbon', () => {
  const [a, b, c, d] = [12, 13, 14, 15].map((day) => dayKey(new Date(2026, 8, day)));
  // First day: the right half. Last day: the left half. Between: the whole square.
  expect(laneOf(a, a, c)).toBe('right');
  expect(laneOf(b, a, c)).toBe('full');
  expect(laneOf(c, a, c)).toBe('left');
  // Outside it, and with no range at all, there is nothing under the figure.
  expect(laneOf(d, a, c)).toBeNull();
  expect(laneOf(a, null, null)).toBeNull();
  expect(laneOf(a, a, null)).toBeNull();
  // One day picked twice is one day; a range handed in backwards is not drawn at all.
  expect(laneOf(a, a, a)).toBeNull();
  expect(laneOf(b, c, a)).toBeNull();
});
