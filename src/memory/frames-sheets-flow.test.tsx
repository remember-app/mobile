import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import TestRenderer, { act } from 'react-test-renderer';

import { FILTER_NONE, type Filter } from '@/frames';
import { Calendar, Chip } from '@/kit';
import { FilterSheet } from '@/memory/frames-sheets';
import { ru } from '@/strings';
import { mounted, mountsTrees } from '@/test-renderer';

/**
 * `SheetFilter`'s calendar (spec 8, «Другая дата»): which month it opens on. The rest of the sheet is
 * worked through the feed it is raised from (`frames-feed-flow.test.tsx`); this is the one thing
 * about it the feed cannot see, because the feed never asks the calendar where it stands.
 */

mountsTrees();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});
afterEach(() => vi.useRealTimers());

const day = (m: number, d: number) => new Date(2026, m, d).getTime();

async function open(days: number[]) {
  let tree!: TestRenderer.ReactTestRenderer;
  const value: Filter = { ...FILTER_NONE, days: new Set(days) };
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FilterSheet people={[]} labels={[]} days={[]} value={value} count={() => 1} onApply={() => {}} onCancel={() => {}} />,
      ),
    );
  });
  await act(async () =>
    tree.root.findAllByType(Chip).find((one) => one.props.label === ru.gallery.otherDay)!.props.onPress(),
  );
  return tree.root.findByType(Calendar).props as { month: Date; from: Date | null };
}

test('the calendar opens on this month when no day is chosen', async () => {
  const calendar = await open([]);
  expect(calendar.month.getFullYear()).toBe(2026);
  expect(calendar.month.getMonth()).toBe(9);
  expect(calendar.from).toBeNull();
});

test('and on the latest of the days that are — never the first — with that day marked', async () => {
  const calendar = await open([day(7, 30), day(8, 2), day(7, 12)]);
  expect(calendar.month.getMonth()).toBe(8);
  expect(calendar.from).toEqual(new Date(2026, 8, 2));
  const early = await open([day(6, 5)]);
  expect(early.month.getMonth()).toBe(6);
  expect(early.from).toEqual(new Date(2026, 6, 5));
});
