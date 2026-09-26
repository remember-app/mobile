import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { expectReachable } from '@tests/helpers/access';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import type { Label } from '@/api';
import {
  Banner,
  Button,
  Calendar,
  Chip,
  DayTile,
  FaceToggle,
  IconButton,
  RowSummary,
  Segment,
  Shares,
  Spinner,
} from '@/kit';
import { FILTER_NONE, type Filter, type FilterDay, SORT_DEFAULT } from '@/lib/frames';
import { setLanguage } from '@/lib/language';
import { FilterSheet, FrameInfoSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { ru, strings } from '@/strings';

/**
 * Two things about the sheets of a memory the feed cannot show. `SheetFilter`'s calendar (spec 8,
 * «Выбрать другую дату»): which month it opens on — the rest of that sheet is worked through the feed it is
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
        <FilterSheet
          people={[]}
          labels={[]}
          days={[]}
          value={value}
          count={() => 1}
          onApply={() => {}}
          onCancel={() => {}}
        />,
      ),
    );
  });
  // A chosen day with no tile opens the calendar by itself; with none, the button does.
  if (days.length === 0)
    await act(async () =>
      tree.root
        .findAllByType(IconButton)
        .find((one) => one.props.label === ru.gallery.otherDay)!
        .props.onPress(),
    );
  return tree.root.findByType(Calendar).props as { month: Date; from: Date | null };
}

test('the calendar opens on this month when no day is chosen', async () => {
  const calendar = await open([]);
  expect(calendar.month.getFullYear()).toBe(2026);
  expect(calendar.month.getMonth()).toBe(9);
  expect(calendar.from).toBeNull();
});

test('a chosen day no tile shows opens the calendar with the sheet, marked, and the tile days leave the mark to it', async () => {
  const tiled = new Date(2026, 8, 13).getTime();
  let tree!: TestRenderer.ReactTestRenderer;
  const sheet = (chosen: number[]) => (
    <FilterSheet
      people={[]}
      labels={[]}
      days={[{ at: tiled, count: 3, fill: 1 }]}
      value={{ ...FILTER_NONE, days: new Set(chosen) }}
      count={() => 1}
      onApply={() => {}}
      onCancel={() => {}}
    />
  );
  await act(async () => {
    tree = mounted(TestRenderer.create(sheet([tiled, day(8, 5)])));
  });
  // The 13th has its tile lit; the 5th has nothing but the calendar, so the calendar is out and
  // marks it — not the later 13th, which already says so itself.
  expect(tree.root.findByType(Calendar).props.from).toEqual(new Date(2026, 8, 5));
  const button = tree.root
    .findAllByType(IconButton)
    .find((one) => one.props.label === ru.gallery.otherDay)!;
  expect(button.props.on).toBe(true);
  // Only tile days chosen: the tiles say it all, and the calendar waits behind its button.
  await act(async () => {
    tree = mounted(TestRenderer.create(sheet([tiled])));
  });
  expect(tree.root.findAllByType(Calendar)).toHaveLength(0);
});

test('and on the latest of the days that are — never the first — with that day marked', async () => {
  const calendar = await open([day(7, 30), day(8, 2), day(7, 12)]);
  expect(calendar.month.getMonth()).toBe(8);
  expect(calendar.from).toEqual(new Date(2026, 8, 2));
  const early = await open([day(6, 5)]);
  expect(early.month.getMonth()).toBe(6);
  expect(early.from).toEqual(new Date(2026, 6, 5));
});

/** The filter sheet as a person works it: faces, tiles, «Все дни», «Сбросить», and the button that applies. */
const dayAt = (d: number) => new Date(2026, 8, d).getTime();
const crowd = (n: number) =>
  Array.from({ length: n }, (_, at) => ({ id: `p${at}`, name: `Гость Номер${at + 1}` }));
const spread = (n: number): FilterDay[] =>
  Array.from({ length: n }, (_, at) => ({
    at: dayAt(10 + at),
    count: 10 * (at + 1),
    fill: (at + 1) / n,
  }));

async function work(over: { who?: number; days?: number; labels?: Label[]; value?: Filter } = {}) {
  const applied: Filter[] = [];
  const asked: Filter[] = [];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FilterSheet
          people={crowd(over.who ?? 3)}
          labels={over.labels ?? []}
          days={spread(over.days ?? 3)}
          value={over.value ?? FILTER_NONE}
          // Every draft it is asked about is remembered; the count is what the draft leaves of 100.
          count={(draft) => {
            asked.push(draft);
            return draft.people.size === 0 ? 100 : 100 - draft.people.size * 10;
          }}
          onApply={(filter) => applied.push(filter)}
          onCancel={() => {}}
        />,
      ),
    );
  });
  const root = tree.root;
  return {
    root,
    applied,
    asked,
    face: (n: number) =>
      root.findAllByType(FaceToggle).find((one) => one.props.name === `Гость Номер${n}`)!,
    tiles: () => root.findAllByType(DayTile),
    button: (label: string | RegExp) =>
      root
        .findAllByType(Button)
        .find((one) =>
          typeof label === 'string' ? one.props.label === label : label.test(one.props.label),
        )!,
    chip: (label: string) => root.findAllByType(Chip).find((one) => one.props.label === label)!,
    press: (node: TestRenderer.ReactTestInstance) => act(async () => node.props.onPress()),
  };
}

test('the faces are pressed on and off, «Все дни» empties only the days, «Сбросить» empties everything and goes dim', async () => {
  const sheet = await work({ who: 7 });
  /** Which faces are drawn left out, at half — by the number in their name. */
  const leftOut = () =>
    sheet.root
      .findAllByType(FaceToggle)
      .filter((one) => one.props.excluded)
      .map((one) => Number(one.props.name.replace('Гость Номер', '')));
  // Nothing chosen: nothing to clear, the button offers the lot — and nobody is left out, so every
  // face is at full strength (spec 7.5, detail 31).
  expect(sheet.button(ru.gallery.reset).props.disabled).toBe(true);
  expect(sheet.button(ru.gallery.showAll).props.disabled).toBeFalsy();
  expect(sheet.chip(ru.gallery.anyDay).props.selected).toBe(true);
  expect(leftOut()).toEqual([]);

  await sheet.press(sheet.face(2));
  await sheet.press(sheet.face(7));
  await sheet.press(sheet.tiles()[1]);
  expect(sheet.face(2).props.selected).toBe(true);
  expect(sheet.face(1).props.selected).toBe(false);
  expect(leftOut()).toEqual([1, 3, 4, 5, 6]);
  expect(sheet.tiles().map((one) => one.props.selected)).toEqual([false, true, false]);
  expect(sheet.chip(ru.gallery.anyDay).props.selected).toBe(false);
  // The button says what this draft leaves, live, and the sheet has not applied anything yet.
  expect(sheet.button(ru.gallery.show(80))).toBeDefined();
  expect(sheet.applied).toEqual([]);

  // A second press on a chosen face or tile takes it back.
  await sheet.press(sheet.face(7));
  expect(sheet.face(7).props.selected).toBe(false);
  await sheet.press(sheet.tiles()[1]);
  await sheet.press(sheet.tiles()[0]);
  await sheet.press(sheet.tiles()[2]);
  expect(sheet.tiles().map((one) => one.props.selected)).toEqual([true, false, true]);
  // «Все дни» lets go of the days and leaves the people alone.
  await sheet.press(sheet.chip(ru.gallery.anyDay));
  expect(sheet.tiles().map((one) => one.props.selected)).toEqual([false, false, false]);
  expect(sheet.face(2).props.selected).toBe(true);

  await sheet.press(sheet.face(1));
  await sheet.press(sheet.button(ru.gallery.reset));
  expect(sheet.root.findAllByType(FaceToggle).some((one) => one.props.selected)).toBe(false);
  expect(leftOut()).toEqual([]);
  expect(sheet.button(ru.gallery.reset).props.disabled).toBe(true);
  await sheet.press(sheet.button(ru.gallery.showAll));
  expect(sheet.applied).toHaveLength(1);
  expect(sheet.applied[0].people.size + sheet.applied[0].days.size).toBe(0);
});

/** How strongly each face of the sheet is actually drawn — its own press surface's opacity, 1 where none is set. */
const strengths = (root: TestRenderer.ReactTestInstance) =>
  root
    .findAllByType(FaceToggle)
    .map((one) => StyleSheet.flatten(one.findAllByType(View)[0].props.style).opacity ?? 1);

test.each([1, 6, 7, 12])(
  'with %i people: nobody chosen is every face at full strength, one chosen dims the rest, and taking the last choice back lifts them all',
  async (who) => {
    const sheet = await work({ who });
    const all = Array.from({ length: who }, () => 1);
    expect(strengths(sheet.root)).toEqual(all);

    await sheet.press(sheet.face(1));
    // The chosen one stays at full strength and the ring is its mark; everybody else is left out.
    expect(strengths(sheet.root)).toEqual([1, ...Array.from({ length: who - 1 }, () => 0.5)]);
    // Read out as a switch that stands in: only the chosen face says so.
    expect(
      sheet.root
        .findAllByType(FaceToggle)
        .map((one) => one.findByType(Pressable).props.accessibilityState.checked),
    ).toEqual([true, ...Array.from({ length: who - 1 }, () => false)]);
    if (who > 1) {
      await sheet.press(sheet.face(who));
      expect(strengths(sheet.root)).toEqual(
        Array.from({ length: who }, (_, at) => (at === 0 || at === who - 1 ? 1 : 0.5)),
      );
      await sheet.press(sheet.face(who));
    }
    // The same face pressed again is the last choice taken back: nobody is left out any more.
    await sheet.press(sheet.face(1));
    expect(strengths(sheet.root)).toEqual(all);
    expect(sheet.root.findAllByType(FaceToggle).some((one) => one.props.selected)).toBe(false);
    expect(sheet.button(ru.gallery.reset).props.disabled).toBe(true);
  },
);

test('a sheet opened on an applied choice of people opens with the rest already dimmed, and «Сбросить» brings everybody back', async () => {
  const sheet = await work({ who: 4, value: { ...FILTER_NONE, people: new Set(['p1', 'p3']) } });
  expect(strengths(sheet.root)).toEqual([0.5, 1, 0.5, 1]);
  await sheet.press(sheet.button(ru.gallery.reset));
  expect(strengths(sheet.root)).toEqual([1, 1, 1, 1]);
});

test('«Сбросить» empties every group of the sheet at once, not the faces alone', async () => {
  const box = (id: string): Label => ({
    id,
    title: id,
    color: 2,
    shared: true,
    mine: true,
    can_edit: true,
    can_add_media: true,
    media_count: 5,
  });
  const sheet = await work({ who: 3, days: 3, labels: [box('Лучшее'), box('Дорога')] });
  await sheet.press(sheet.face(2));
  await act(async () => sheet.root.findAllByType(Segment)[0].props.onChange('video'));
  await sheet.press(sheet.chip('Лучшее'));
  await sheet.press(sheet.tiles()[1]);
  expect(sheet.button(ru.gallery.reset).props.disabled).toBe(false);

  await sheet.press(sheet.button(ru.gallery.reset));
  expect(sheet.button(ru.gallery.reset).props.disabled).toBe(true);
  expect(sheet.tiles().map((one) => one.props.selected)).toEqual([false, false, false]);
  expect(sheet.chip('Лучшее').props.selected).toBe(false);
  expect(sheet.chip(ru.gallery.anyDay).props.selected).toBe(true);
  await sheet.press(sheet.button(ru.gallery.showAll));
  const [applied] = sheet.applied;
  expect(applied.kind).toBe('all');
  expect([applied.people.size, applied.labels.size, applied.days.size]).toEqual([0, 0, 0]);
});

test('a filter that is applied hands over exactly what was chosen, and later edits of the draft cannot change it', async () => {
  const sheet = await work({ who: 3 });
  await sheet.press(sheet.face(3));
  await sheet.press(sheet.tiles()[2]);
  await sheet.press(sheet.button(ru.gallery.show(90)));
  const [sent] = sheet.applied;
  expect([...sent.people]).toEqual(['p2']);
  expect([...sent.days]).toEqual([dayAt(12)]);
  await sheet.press(sheet.face(1));
  expect([...sent.people]).toEqual(['p2']);
});

test('one day and two days stretch their tiles across the row, three share it evenly, and more than three stay three', async () => {
  for (const [days, drawn] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [9, 3],
  ] as const) {
    const sheet = await work({ days });
    expect(sheet.tiles(), `${days} days`).toHaveLength(drawn);
    // Every tile stands in an equal share of the row (`Shares`) and fills it, none with a width of
    // its own, so the row is filled whatever their number is — and the tiles stand one under another
    // once a word on one of them breaks (TASK-400).
    for (const tile of sheet.tiles()) {
      let row = tile.parent;
      while (row && row.type !== Shares) row = row.parent;
      expect(row, `${days} days`).toBeTruthy();
      let share = tile.parent;
      while (share && share.type !== View) share = share.parent;
      expect(StyleSheet.flatten(share?.props.style).flex, `${days} days`).toBe(1);
      const style = StyleSheet.flatten(tile.findByType(Pressable).props.style({ pressed: false }));
      expect(style.flexGrow, `${days} days`).toBe(1);
      expect(style.width, `${days} days`).toBeUndefined();
    }
  }
});

test.each(['ru', 'en'] as const)(
  'in %s the filter and the sort sheets: every control has a role and a name, faces and tiles are read as switches, and none is under 44',
  async (language) => {
    await act(async () => setLanguage(language));
    try {
      const s = strings[language];
      const sheet = await work({
        who: 12,
        days: 5,
        labels: [
          {
            id: 'best',
            title: 'Лучшее',
            color: 2,
            shared: true,
            mine: true,
            can_edit: true,
            can_add_media: true,
            media_count: 23,
          } as Label,
        ],
      });
      const found = expectReachable(sheet.root);
      const names = found.map((one) => one.name);
      for (const name of [
        s.gallery.reset,
        s.gallery.anyDay,
        s.gallery.otherDay,
        s.gallery.showAll,
        'Гость Номер12',
      ])
        expect(names, name).toContain(name);
      // Twelve faces and three tiles, all of them switches that say which way they stand.
      const roles = found.filter((one) => one.role === 'togglebutton').length;
      expect(roles).toBeGreaterThanOrEqual(12 + 3);
      for (const toggle of [...sheet.root.findAllByType(FaceToggle), ...sheet.tiles()])
        expect(toggle.findByType(Pressable).props.accessibilityState).toMatchObject({
          checked: false,
        });
      // The main button is the last thing read, the reset the first: the order of the layout.
      expect(names[0]).toBe(s.gallery.reset);
      expect(names.at(-1)).toBe(s.gallery.showAll);

      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = mounted(
          TestRenderer.create(
            <SortSheet value={SORT_DEFAULT} onChange={() => {}} onDone={() => {}} />,
          ),
        );
      });
      const sorting = expectReachable(tree.root).map((one) => one.name);
      expect(sorting.at(-1)).toBe(s.action.done);
    } finally {
      await act(async () => setLanguage('ru'));
    }
  },
);

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
    expect(sheet.findAllByType(Image).map((one) => one.props.source)).toEqual([
      { uri: 'https://r2.example/a' },
    ]);
  }
  // A frame the worker made no picture for has none to show in the head.
  const bare = await draw(info({ thumb: undefined }));
  expect(bare.findAllByType(Image)).toHaveLength(0);
});
