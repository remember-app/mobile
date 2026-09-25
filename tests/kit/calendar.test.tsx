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
