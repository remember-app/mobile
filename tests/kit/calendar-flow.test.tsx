import { expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Pressable } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { IconButton } from '@/kit/button';
import { Calendar, type CalendarProps } from '@/kit/calendar';

/**
 * Spec 7.3, detail 15 — the calendar as it is pressed. `calendar.test.tsx` draws its states and
 * `calendar-grid.test.ts` checks the arithmetic; what neither of them can say is what a touch does:
 * which day a press hands to the screen, which days do not answer, and where the two arrows go.
 */

mountsTrees();

const WEEK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

async function draw(over: Partial<CalendarProps> = {}) {
  const calls = { pick: [] as Date[], month: [] as Date[] };
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Calendar
          month={new Date(2026, 8, 1)}
          onMonth={(month) => calls.month.push(month)}
          from={null}
          onPick={(day) => calls.pick.push(day)}
          weekdays={WEEK}
          monthLabel="Сентябрь 2026"
          prevLabel="Назад"
          nextLabel="Вперёд"
          dayLabel={(day) => `${day.getDate()} сентября`}
          {...over}
        />,
      ),
    );
  });
  return {
    calls,
    day: (n: number) =>
      tree.root
        .findAllByType(Pressable)
        .find((one) => one.props.accessibilityLabel === `${n} сентября`)!,
    arrow: (label: string) =>
      tree.root.findAllByType(IconButton).find((one) => one.props.label === label)!,
  };
}

test('a press on a day hands that day, at local midnight, to the screen — and only that one', async () => {
  const calendar = await draw();
  await act(async () => calendar.day(12).props.onPress());
  await act(async () => calendar.day(30).props.onPress());
  expect(calendar.calls.pick).toEqual([new Date(2026, 8, 12), new Date(2026, 8, 30)]);
  expect(calendar.calls.month).toEqual([]);
});

test('the last day allowed answers and the day after it does not: the wall is inclusive', async () => {
  const calendar = await draw({ max: new Date(2026, 8, 21, 15, 30) });
  expect(calendar.day(20).props.disabled).toBe(false);
  // Today is a day a memory can be of, and it is the wall.
  expect(calendar.day(21).props.disabled).toBe(false);
  expect(calendar.day(22).props.disabled).toBe(true);
  expect(calendar.day(30).props.disabled).toBe(true);
});

test('the first day allowed answers and the day before it does not, the same way', async () => {
  const calendar = await draw({ min: new Date(2026, 8, 10, 8) });
  expect(calendar.day(9).props.disabled).toBe(true);
  expect(calendar.day(10).props.disabled).toBe(false);
  expect(calendar.day(11).props.disabled).toBe(false);
});

test('with no walls every day answers', async () => {
  const calendar = await draw();
  for (const n of [1, 15, 30]) expect(calendar.day(n).props.disabled).toBe(false);
});

test('the arrows hand the first of the month before and after, and the year turns with them', async () => {
  const calendar = await draw({ month: new Date(2026, 8, 17) });
  await act(async () => calendar.arrow('Назад').props.onPress());
  await act(async () => calendar.arrow('Вперёд').props.onPress());
  expect(calendar.calls.month).toEqual([new Date(2026, 7, 1), new Date(2026, 9, 1)]);

  // December forward is January of the next year, and January back is December of the last.
  const december = await draw({ month: new Date(2026, 11, 1) });
  await act(async () => december.arrow('Вперёд').props.onPress());
  expect(december.calls.month).toEqual([new Date(2027, 0, 1)]);
  const january = await draw({ month: new Date(2027, 0, 1) });
  await act(async () => january.arrow('Назад').props.onPress());
  expect(january.calls.month).toEqual([new Date(2026, 11, 1)]);
});

test('from the end of a long month the arrow lands on the next month and not two on', async () => {
  // `new Date(2026, 0, 31)` plus a month by `setMonth` is 3 March. The month is rebuilt from its
  // first day, which is the only way that cannot skip one.
  const calendar = await draw({ month: new Date(2026, 0, 31) });
  await act(async () => calendar.arrow('Вперёд').props.onPress());
  expect(calendar.calls.month).toEqual([new Date(2026, 1, 1)]);
  const march = await draw({ month: new Date(2026, 2, 31) });
  await act(async () => march.arrow('Назад').props.onPress());
  expect(march.calls.month).toEqual([new Date(2026, 1, 1)]);
});

test('today is the one day marked as today, whatever the hour, and only in the month it is in', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 16, 23, 59));
  try {
    const marked = async (month: Date) => {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = mounted(
          TestRenderer.create(
            <Calendar
              month={month}
              onMonth={() => {}}
              from={null}
              onPick={() => {}}
              weekdays={WEEK}
              monthLabel=""
              prevLabel=""
              nextLabel=""
              dayLabel={(d) => `${d.getDate()}`}
            />,
          ),
        );
      });
      return tree.root
        .findAll((one) => one.props.day instanceof Date && one.props.today === true)
        .map((one) => (one.props.day as Date).getDate());
    };
    expect(await marked(new Date(2026, 8, 1))).toEqual([16]);
    expect(await marked(new Date(2026, 9, 1))).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

test('the ends of the range and the days between are read as selected, and nothing else is', async () => {
  // Selected is a state of the day for whoever cannot see the ribbon: the first, the last, and every
  // day between them.
  const calendar = await draw({ from: new Date(2026, 8, 12), to: new Date(2026, 8, 14) });
  const selected = (n: number) => calendar.day(n).props.accessibilityState.selected;
  expect([11, 12, 13, 14, 15].map(selected)).toEqual([false, true, true, true, false]);
  const one = await draw({ from: new Date(2026, 8, 12) });
  expect([11, 12, 13].map((n) => one.day(n).props.accessibilityState.selected)).toEqual([
    false,
    true,
    false,
  ]);
});
