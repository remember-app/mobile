import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import TestRenderer, { act } from 'react-test-renderer';

import { FILTER_NONE, type Filter } from '@/lib/frames';
import { Image } from 'expo-image';

import { Banner, Calendar, Chip, RowSummary, Spinner } from '@/kit';
import { FilterSheet, FrameInfoSheet } from '@/screens/memory/frames-sheets';
import { ru } from '@/strings';
import { mounted, mountsTrees } from '@tests/helpers/renderer';

/**
 * Two things about the sheets of a memory the feed cannot show. `SheetFilter`'s calendar (spec 8,
 * «Другая дата»): which month it opens on — the rest of that sheet is worked through the feed it is
 * raised from (`frames-feed-flow.test.tsx`), and the feed never asks the calendar where it stands. And
 * `SheetFrameInfo` in the three states its read can leave it in; what it says of a frame is
 * `frame-viewer-flow.test.tsx`'s, which raises it the way a person does.
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

/** The sheet of a frame in its three states, read off the tree rather than told apart by markup. */
const info = (over: Partial<React.ComponentProps<typeof FrameInfoSheet>> = {}) => (
  <FrameInfoSheet
    visible
    thumb="https://r2.example/a"
    title="13 сентября, 21:47"
    meta="суббота · Свадьба"
    info={null}
    error={null}
    onFilm={() => {}}
    onClose={() => {}}
    {...over}
  />
);

test('the sheet is a wait while its read is in the air, the reason when the read fell over, and the frame once it is here', async () => {
  const draw = async (node: React.ReactElement) => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = mounted(TestRenderer.create(node));
    });
    return tree.root;
  };
  const reading = await draw(info());
  expect(reading.findAllByType(Spinner)).toHaveLength(1);
  expect(reading.findAllByType(Banner)).toHaveLength(0);
  expect(reading.findAllByType(RowSummary)).toHaveLength(0);

  const failed = await draw(info({ error: 'Нет связи' }));
  expect(failed.findAllByType(Spinner)).toHaveLength(0);
  expect(failed.findAllByType(Banner).map((one) => one.props.text)).toEqual(['Нет связи']);

  const whole = await draw(
    info({
      info: {
        id: 'a',
        size_bytes: '4200000',
        captured_at: null,
        created_at: new Date(2026, 8, 15).toISOString(),
        width: null,
        height: null,
        camera_model: null,
        focal_length_mm: null,
        aperture: null,
        latitude: null,
        longitude: null,
        uploaded_by: { id: 'u', username: 'mark', name: 'Марк', media_count: 96 },
        montages: [],
      },
    }),
  );
  expect(whole.findAllByType(Spinner)).toHaveLength(0);
  expect(whole.findAllByType(Banner)).toHaveLength(0);
  expect(whole.findAllByType(RowSummary).map((one) => one.props.label)).toEqual([ru.viewer.file]);
  // The head is there in all three, and so is the picture of the frame in it.
  for (const sheet of [reading, failed, whole]) {
    expect(sheet.findAllByType(Image).map((one) => one.props.source)).toEqual([{ uri: 'https://r2.example/a' }]);
  }
  // A frame the worker made no picture for has none to show in the head.
  const bare = await draw(info({ thumb: undefined }));
  expect(bare.findAllByType(Image)).toHaveLength(0);
});
