import { rule } from '@tests/helpers/css';
import { beforeAll, expect, test } from 'vitest';
import { Calendar } from '@/kit/calendar';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3, detail 15 — the calendar: one day or a few, said with one gesture. */

beforeAll(async () => {
  await setTheme('dark');
});

const WEEK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const sept = (day: number) => new Date(2026, 8, day);

function month(props: Partial<Parameters<typeof Calendar>[0]> = {}) {
  return (
    <Calendar
      month={sept(1)}
      onMonth={() => {}}
      from={null}
      onPick={() => {}}
      weekdays={WEEK}
      monthLabel="Сентябрь 2026"
      prevLabel="Предыдущий месяц"
      nextLabel="Следующий месяц"
      dayLabel={(day) => `${day.getDate()} сентября`}
      {...props}
    />
  );
}

test('the month is drawn whole, and every day says its own date out loud', () => {
  const grid = story(month());
  expect(grid).toContain('Сентябрь 2026');
  expect(grid).toContain('ПН');
  // September 2026 has 30 days and begins on a Tuesday — one blank in front, and both ends drawn.
  expect(grid).toContain('aria-label="1 сентября"');
  expect(grid).toContain('aria-label="30 сентября"');
  expect(grid).not.toContain('aria-label="31 сентября"');
  // The two month buttons are the only words the calendar itself needs.
  expect(grid).toContain('aria-label="Предыдущий месяц"');
});

test('the month’s head and the strip of weekday letters are floors, since a month named on large type takes a second line', () => {
  const grid = story(month());
  expect(grid).toContain(rule('min-height:44px'));
  expect(grid).toContain(rule('min-height:22px'));
});

test('nothing is picked, one day is picked, a range is picked — three calendars', () => {
  allDifferent({
    empty: month(),
    one: month({ from: sept(12) }),
    range: month({ from: sept(12), to: sept(14) }),
  });
});

test('a range is one ribbon, and one day picked twice is still one day', () => {
  // Three days apart from two, because the ribbon under them is what differs.
  allDifferent({
    two: month({ from: sept(12), to: sept(13) }),
    three: month({ from: sept(12), to: sept(14) }),
  });
  // Spec 7.3: a range that ends where it began is a single day and is drawn as one.
  expect(story(month({ from: sept(12), to: sept(12) }))).toBe(story(month({ from: sept(12) })));
});

test('today is its own mark, and the picked day is another', () => {
  const today = new Date();
  const label = (day: Date) => `${day.getDate()}`;
  allDifferent({
    // The month with today in it, untouched — today is ringed and nothing is filled.
    nothing: month({ month: today, from: null, dayLabel: label }),
    // The same month with today picked: the ring gives way to the fill, never carries both.
    picked: month({ month: today, from: today, dayLabel: label }),
  });
});

test('a day outside the walls is quiet and does not answer', () => {
  const capped = story(month({ max: sept(21) }));
  expect(capped).toContain('aria-disabled="true"');
  // And the ones inside still answer.
  expect(story(month())).not.toContain('aria-disabled="true"');
});

test('a day that does not answer is the layout’s #4A4757, a step under the weekday letters', () => {
  // Spec 7.3, detail 15, and `Create.json` e70…e86 — the 22nd to the 30th, past «today» the 21st.
  const capped = story(month({ max: sept(21) }));
  const off = rule('color:rgba(74,71,87,1.00)');
  expect(capped).toContain(off);
  expect(story(month())).not.toContain(off);
  // The letters over the grid stay `faint` (e20…e26, #6E6B7D).
  expect(capped).toContain(rule('color:rgba(110,107,125,1.00)'));
});

test('a range lies on one ribbon per week, rounded where it meets the week’s edge', () => {
  // `Create.json`, 12–14 September: the 13th's piece ends in a curve of 20 on the right (e51), the
  // 14th's begins in one on the left (e53). One piece a week and not one a day: the seam between two
  // pieces was a dark line across the ribbon on the phone.
  const pieces = (drawn: string) => drawn.split(rule('opacity:0.26')).length - 1;
  const across = story(month({ from: sept(12), to: sept(14) }));
  expect(pieces(across)).toBe(2);
  expect(across).toContain(rule('border-top-right-radius:20px'));
  expect(across).toContain(rule('border-top-left-radius:20px'));
  // Inside one week both ends stand under circles: one piece, and nothing to round.
  const within = story(month({ from: sept(15), to: sept(17) }));
  expect(pieces(within)).toBe(1);
  expect(within).not.toContain(rule('border-top-right-radius:20px'));
  expect(within).not.toContain(rule('border-top-left-radius:20px'));
  expect(pieces(story(month({ from: sept(12) })))).toBe(0);
});
