import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, account } = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    setParams: vi.fn(),
    canGoBack: vi.fn(() => true),
  },
  /** The account's «Даты между днями» — what turns the feed into `MemoryDated`. */
  account: { dates: false },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// A phone's width: under node the window is 0 × 0, and the tiles and the spine are measured off it.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'session', user: { id: 'me' }, datesBetweenDays: account.dates }),
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
  };
});
// The films block is drawn for real — `FilmsEmpty` is one of the faces — and only the player over
// it, which is `expo-video` in a window of its own, is not.
vi.mock('@/screens/memory/film-player', () => ({
  FilmPlayer: () => null,
}));
vi.mock('@/screens/memory/frame-viewer', () => ({ FrameViewer: () => null }));
// The phone's side of taking frames home: native, and nothing here takes any.
vi.mock('@/lib/downloads', () => ({
  maySaveToPhone: vi.fn(),
  saveToPhone: vi.fn(),
  shareFiles: vi.fn(),
}));

import { developing, member, memory, photo, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { MediaItem, Montage } from '@/api';
import {
  CardMontage,
  DateSpine,
  DayMark,
  Empty,
  EmptyMontages,
  GlassBar,
  Icon,
  IconButton,
  Text,
} from '@/kit';
import { Frames } from '@/screens/memory/frames';
import { SortSheet } from '@/screens/memory/frames-sheets';
import { BlockHead } from '@/screens/memory/head';
import { ru } from '@/strings';

/**
 * The capsule over a memory's feed in every face the layout draws of it (spec 8: `MemoryFrames`,
 * `FilmsEmpty`, `FramesEmpty`, `MemoryScrub`, `MemoryDated`, `FramesByPeople`). Rule 9 of spec 1
 * holds on all six: no chevron in it — the capsule is the button — and a press on it is the way
 * into the memory's settings. What each face is made of is the feed's own tests; this one only
 * reaches each face for real and presses the capsule there.
 */

mountsTrees();

beforeEach(() => {
  for (const fn of [router.push, router.back, router.replace, router.setParams]) fn.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).toISOString();

/** Three days of material, by the organizer and by Liza. */
const frames = (): MediaItem[] => [
  photo('a', 'me', at(13, 10)),
  photo('b', 'liza', at(13, 9)),
  photo('c', 'liza', at(12, 15)),
  developing('d', 'me', at(12, 14)),
  photo('e', 'me', at(11, 10)),
];

const film: Montage = {
  id: 'f1',
  memory_id: 'm1',
  ordered_by: { id: 'me', username: 'me', name: null },
  status: 'ready',
  name: 'Ролик f1',
  template: null,
  size_bytes: null,
  duration_seconds: 60,
  params: {},
  error_text: null,
  created_at: at(14),
  video_url: 'https://r2.example/f1.mp4',
  poster_url: 'https://r2.example/f1.jpg',
  stages: null,
};

/** What the server holds, and whether the account writes the dates between the days. */
type World = { media: MediaItem[]; films: Montage[]; dates?: boolean };

async function open({ media, films, dates = false }: World) {
  account.dates = dates;
  serve((asked) => {
    if (asked.path === '/memories/m1/media') return media;
    if (asked.path === '/memories/m1/members')
      return [member('me', 'organizer', { name: 'Я' }), member('liza', 'contributor')];
    if (asked.path === '/memories/m1/labels') return [];
    if (asked.path === '/memories/m1/montages') return films;
    return undefined;
  });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Frames
          id="m1"
          head={{ memory: memory({ member_count: 6 }), error: null, reload: () => {} }}
        />,
      ),
    );
  });
  return tree.root;
}

type Root = TestRenderer.ReactTestInstance;

/** The sort, turned the way a finger turns it — the round button, then the control on the sheet. */
async function sort(root: Root, turn: (sheet: Root) => void) {
  const button = root
    .findAllByType(IconButton)
    .find((one) => one.props.label === ru.gallery.sorting)!;
  await act(async () => button.props.onPress());
  const sheet = root.findByType(SortSheet);
  await act(async () => turn(sheet));
  await act(async () => sheet.props.onDone());
}

/** How the list measures itself: the block over the frames, what there is to scroll, what is seen. */
async function measure(root: Root) {
  await act(async () => {
    root
      .findAll(
        (one) =>
          typeof one.props.onLayout === 'function' && one.findAllByType(BlockHead).length > 0,
      )
      .at(-1)!
      .props.onLayout({ nativeEvent: { layout: { height: 300 } } });
    const list = root.findByType(FlatList);
    list.props.onContentSizeChange(390, 2400);
    list.props.onLayout({ nativeEvent: { layout: { height: 844 } } });
  });
}

const faces: [string, World, (root: Root) => Promise<void>][] = [
  [
    'MemoryFrames',
    { media: frames(), films: [film] },
    async (root) => {
      expect(root.findAllByType(CardMontage)).toHaveLength(1);
    },
  ],
  [
    'FilmsEmpty',
    { media: frames(), films: [] },
    async (root) => {
      expect(root.findAllByType(EmptyMontages)).toHaveLength(1);
    },
  ],
  [
    'FramesEmpty',
    { media: [], films: [] },
    async (root) => {
      expect(root.findAllByType(Empty)).toHaveLength(1);
      expect(root.findByType(GlassBar).props.meta).toContain(ru.memory.nothingYet);
      // Nothing to pick: the right slot is empty, and the capsule is still the door.
      expect(root.findByType(GlassBar).props.right).toBeUndefined();
    },
  ],
  [
    'MemoryScrub',
    { media: frames(), films: [] },
    async (root) => {
      await measure(root);
      expect(root.findByType(DateSpine).props.marks.length).toBeGreaterThan(0);
    },
  ],
  [
    'MemoryDated',
    { media: frames(), films: [], dates: true },
    async (root) => {
      const seams = root.findAllByType(DayMark);
      expect(seams.map((one) => one.props.label)).toEqual([
        '13 сентября, воскресенье',
        '12 сентября, суббота',
        '11 сентября, пятница',
      ]);
      // The date alone in its seam is the quiet one (spec 7.8, detail 65).
      for (const seam of seams) expect(seam.findAllByType(Text)[0].props.tone).toBe('muted');
    },
  ],
  [
    'FramesByPeople',
    { media: frames(), films: [] },
    async (root) => {
      await sort(root, (sheet) =>
        sheet
          .findAll(
            (one) =>
              typeof one.props.onChange === 'function' &&
              one.props.label === ru.gallery.groupBy &&
              one.props.options,
          )[0]
          .props.onChange('person'),
      );
      expect(root.findAllByType(DayMark).map((one) => one.props.avatar)).toEqual([
        'Я',
        expect.any(String),
      ]);
    },
  ],
];

test.each(faces)(
  '%s: the capsule wears no chevron, is a button a finger can hit, is named in full and opens the settings',
  async (_, world, reach) => {
    const root = await open(world);
    await reach(root);

    const bar = root.findByType(GlassBar);
    const capsule = bar
      .findAllByType(Pressable)
      .find((one) => one.props.accessibilityLabel === bar.props.capsuleLabel)!;
    expect(capsule.props.accessibilityRole).toBe('button');
    // The drawn name is cut with an ellipsis on purpose; the one read out is whole (spec 10.6).
    expect(capsule.props.accessibilityLabel).toBe(ru.memory.settings('Свадьба Лизы и Марка'));
    expect(capsule.findAllByType(Icon)).toHaveLength(0);
    // A floor, and not a height: the meta under the name grows with the system's type (TASK-400).
    const box = StyleSheet.flatten(capsule.props.style);
    expect(box.minHeight).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeUndefined();

    await act(async () => capsule.props.onPress());
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/memory/[id]/settings',
      params: { id: 'm1' },
    });
  },
);
