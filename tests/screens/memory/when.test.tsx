import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { thisYear2026 } from '@tests/helpers/clock';
import { rule } from '@tests/helpers/css';
import { fontFile, wordWidth } from '@tests/helpers/font';
import { Chip } from '@/kit/chip';
import { allDifferent, story } from '@/kit/story';
import {
  ASIDE_BLEED,
  daysIn,
  EventWhen,
  pickDay,
  quickSpans,
  type Span,
} from '@/screens/memory/when';
import when from '@/screens/memory/when.tsx?raw';
import { ru } from '@/strings';
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
  thisYear2026();
  const one = story(block(span(12)));
  const three = story(block(span(12, 14)));
  // Spec 8, `Create`, and spec 9: one day of this year is the date alone.
  expect(one).toContain('12 сентября');
  expect(one).not.toContain('12 сентября 2026');
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

/**
 * `Create` at the layout's 390 and the system's own type (TASK-387), measured off the font file the
 * way the spec measures words. The column is 358; what the layout draws is wider than that.
 */
const MEDIUM = fontFile('@expo-google-fonts/onest/500Medium/Onest_500Medium.ttf');
const REGULAR = fontFile('@expo-google-fonts/onest/400Regular/Onest_400Regular.ttf');
const COLUMN = 390 - 2 * 16;

test('on the layout’s 390 the four quick days are one row, and the line under the grid one line', () => {
  // `Create.json` e10…e13: the chips 86.55 / 71.1 / 98.9 / 80.1 — Onest 500 14, 14 a side inside a
  // hairline — 8 apart, 360.6 in all: 1.3 past the column on either side. Spec 7.3, detail 16
  // `[правлено]` takes them to 13 a side, and the row to 353.5 — inside the column, one line.
  const chips = (sides: number) =>
    ['Сегодня', 'Вчера', 'Выходные', 'Неделя'].map(
      (word) => wordWidth(MEDIUM, word, 14) + 2 * sides + 2,
    );
  for (const [chip, drawn] of chips(14).map((one, i) => [one, [86.55, 71.1, 98.9, 80.1][i]])) {
    expect(Math.abs(chip - drawn)).toBeLessThan(0.5);
  }
  const across = (sides: number) => chips(sides).reduce((sum, one) => sum + one, 0) + 3 * 8;
  expect(across(14)).toBeGreaterThan(COLUMN);
  expect(across(13)).toBeCloseTo(353.5, 0);
  expect(across(13)).toBeLessThanOrEqual(COLUMN);
  const quick = story(<Chip label="Сегодня" size={36} onPress={() => {}} />);
  expect(quick).toContain(rule('padding-left:13px;padding-right:13px'));
  // e87: «Один день — одно касание. Несколько — первый и последний.» 12 / 400 in one line of 359.2,
  // on a line the layout gives 363.
  const line = wordWidth(REGULAR, ru.create.dateHint, 12);
  expect(line).toBeGreaterThan(COLUMN);
  expect(line).toBeLessThanOrEqual(COLUMN + ASIDE_BLEED);
  expect(COLUMN + ASIDE_BLEED).toBe(363);

  // And the block reaches that far: the line past the column's right, the chips not at all; 12 from
  // the chips down to the grid (e13 ends at 291, the card e14 starts at 303).
  const drawn = story(block(span(12, 14)));
  expect(drawn).not.toContain('margin-left:-');
  expect(drawn).toContain(rule(`margin-right:-${ASIDE_BLEED}px`));
  expect(drawn).toContain(rule('margin-top:2px'));
  // Still a row that wraps: a narrower phone, or larger type, puts what does not fit under it.
  expect(drawn).toContain(rule('flex-wrap:wrap'));
});

test('the head of the block is the layout’s: a quiet eyebrow, the days on their own line of 18, the line under the grid 12 / 17', () => {
  const drawn = story(block(span(12, 14)));
  // `Create.json` e7: «КОГДА ЭТО БЫЛО» #A4A1B2 (`muted`), not the `paper` of the words beside it.
  expect(when).toContain('<Text role="eyebrow" tone="muted"');
  expect(when).toContain('<Text role="rowSm"');
  expect(drawn).toContain(rule('line-height:18px'));
  // e87 — the kit's `Hint` is 13 / 19: a size up, and on the phone it took two lines.
  expect(when).toContain('<Text role="aside" tone="muted"');
  expect(when).not.toContain('<Hint');
  expect(drawn).toContain(rule('line-height:17px'));
});

test('the four quick days stand over the calendar, and switch off with the screen', () => {
  const on = story(block(span(12)));
  for (const word of ['Сегодня', 'Вчера', 'Выходные', 'Неделя']) expect(on).toContain(word);
  expect(on).toContain('Один день — одно касание. Несколько — первый и последний.');
  allDifferent({ on: block(span(12)), saving: block(span(12), true) });
});
