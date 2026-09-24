import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { allDifferent, story } from '@/kit/story';
import { daysIn, EventWhen, pickDay, quickSpans, type Span } from '@/memory/when';
import { setTheme } from '@/theme';

/**
 * «Когда это было» (spec 10.8.3) — the one block `Create` and `MemoryEdit` share. What the two
 * screens send to the api is the block's business, so the gesture and the four quick days are read
 * here as behaviour, over real days, and not as text in a source file.
 */

beforeAll(async () => {
  await setTheme('dark');
});

const sept = (day: number) => new Date(2026, 8, day);
const span = (from: number, to: number | null = null): Span => ({
  from: sept(from),
  to: to === null ? null : sept(to),
});

test('one tap is a day, the second closes the range behind it, the third starts over', () => {
  const first = pickDay(span(12), sept(14));
  expect(first).toEqual(span(12, 14));
  // A closed span is not extended by the next tap in either direction: it starts over.
  expect(pickDay(first, sept(20))).toEqual(span(20));
  expect(pickDay(first, sept(13))).toEqual(span(13));
});

test('a tap before the first day is that tap being corrected, never a span running backwards', () => {
  expect(pickDay(span(12), sept(10))).toEqual(span(10));
  // And the same day again is still one day, not a range of none.
  expect(pickDay(span(12), sept(12))).toEqual(span(12));
});

test('a picked day is a whole local day, whatever hour the calendar handed over', () => {
  const picked = pickDay(span(12), new Date(2026, 8, 14, 17, 45));
  expect(picked.to).toEqual(sept(14));
});

test('the length counts days, both ends, and one day is one', () => {
  expect(daysIn(span(12))).toBe(1);
  expect(daysIn(span(12, 14))).toBe(3);
  // Across a month, and a span that ends where it began is a single day.
  expect(daysIn({ from: sept(28), to: new Date(2026, 9, 2) })).toBe(5);
  expect(daysIn(span(12, 12))).toBe(1);
});

test('the four quick days, on every day of a week, never reach past today', () => {
  // 14 September 2026 is a Monday.
  const monday = sept(14);
  for (let ahead = 0; ahead < 7; ahead += 1) {
    const today = new Date(2026, 8, 14 + ahead);
    const quick = quickSpans(today);
    for (const answer of Object.values(quick)) {
      expect(answer.from <= today).toBe(true);
      expect((answer.to ?? answer.from) <= today).toBe(true);
    }
    expect(quick.today).toEqual({ from: today, to: null });
    expect(quick.yesterday).toEqual({ from: new Date(2026, 8, 13 + ahead), to: null });
    // Seven days back, today among them — on a Monday that is not one day long.
    expect(quick.week).toEqual({ from: new Date(2026, 8, 8 + ahead), to: today });
  }
  expect(quickSpans(monday).weekend).toEqual(span(12, 13));
});

test('the weekend is the one just gone, and on a Saturday it is a single day with no end', () => {
  expect(quickSpans(sept(13)).weekend).toEqual(span(12, 13)); // Sunday: its own Sunday closes it
  expect(quickSpans(sept(16)).weekend).toEqual(span(12, 13)); // Wednesday
  // Saturday has no Sunday behind it yet. An end equal to the start would be sent as an end for one
  // day, and read by the edit screen as a change where there is none.
  expect(quickSpans(sept(12)).weekend).toEqual(span(12));
  expect(quickSpans(sept(12)).weekend.to).toBeNull();
});

const block = (value: Span, disabled = false) => (
  <EventWhen value={value} onChange={() => {}} disabled={disabled} />
);

test('one day is a date with no length, and a span says how long it is', () => {
  const one = story(block(span(12)));
  const three = story(block(span(12, 14)));
  expect(one).toContain('12 сентября 2026');
  expect(one).not.toContain('· 1 день');
  expect(three).toContain('12–14 сентября');
  expect(three).toContain('· 3 дня');
  // Two days is the smallest span there is, and it carries its length too.
  const two = story(block(span(12, 13)));
  expect(two).toContain('12–13 сентября');
  expect(two).toContain('· 2 дня');
  // A span that ends where it began is one day and says nothing of length.
  expect(story(block(span(12, 12)))).not.toContain('· 1 день');
});

test('the four quick days stand over the calendar, and switch off with the screen', () => {
  const on = story(block(span(12)));
  for (const word of ['Сегодня', 'Вчера', 'Выходные', 'Неделя']) expect(on).toContain(word);
  expect(on).toContain('Один день — одно касание. Несколько — первый и последний.');
  allDifferent({ on: block(span(12)), saving: block(span(12), true) });
});
