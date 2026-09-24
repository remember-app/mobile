import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { who, router, downloads } = vi.hoisted(() => ({
  /** Who is asking. A test sets it before it opens the screen. */
  who: { id: 'me' },
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  // The phone's side of taking frames home: the grant, the gallery, and the share sheet.
  downloads: { maySaveToPhone: vi.fn(), saveToPhone: vi.fn(), shareFiles: vi.fn() },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// A phone's width: under node the window is 0 × 0, and the tiles, the rows and the marks of the date
// spine are all measured off it. The `Modal` is the plain container `vitest.setup.ts` makes of it —
// mocked again here because this replaces that mock, not adds to it.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: who.id } }) }));
// The screen reads on focus, and the router that says when is not here: focus is «now, once».
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useRouter: () => router,
  };
});
// Not what these tests are about, and each reads a corner of the api of its own.
vi.mock('@/screens/memory/films', () => ({ Films: () => null }));
vi.mock('@/screens/memory/frame-viewer', () => ({ FrameViewer: () => null }));
vi.mock('@/lib/downloads', () => downloads);
// A text input listens on the browser's `document`, which a test renderer has none of.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import {
  type Asked,
  developing,
  later,
  member,
  memory,
  photo,
  refused,
  serve,
} from '@tests/helpers/api';
import { touch } from '@tests/helpers/gesture';
import { label } from '@tests/helpers/labels';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, RefreshControl } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Label, MediaItem, Member } from '@/api';
import {
  Banner,
  Button,
  Calendar,
  Chip,
  ConfirmSheet,
  DateSpine,
  DayMark,
  Empty,
  FEED_GAP,
  GlassBar,
  IconButton,
  RowToggle,
  Tile,
  Waiting,
} from '@/kit';
import { startOfDay } from '@/lib/dates';
import { frameOf } from '@/lib/frames';
import { FrameViewer } from '@/screens/memory/frame-viewer';
import { Frames } from '@/screens/memory/frames';
import { FilterSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { BlockHead, type Head } from '@/screens/memory/head';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { ru } from '@/strings';
import { board, height, space } from '@/theme';

/**
 * The feed of a memory the way a person works it (spec 8, `MemoryFrames` and `FramesPicking`): the
 * whole screen, the real api client, and a stand-in server behind `fetch`. What is asserted is what
 * is drawn — which frames, in what order, what the capsule says, which buttons are off — and what
 * went over the wire. The rules underneath (`toggleEvery`, `removeFrames`, `groupFrames`,
 * `framesMatching`) are `frames.test.ts`'s; this file is that they are joined to the screen the way
 * the layout says, which the text of the screen cannot show.
 */

mountsTrees();

beforeEach(() => {
  who.id = 'me';
  router.push.mockClear();
  router.back.mockClear();
  router.replace.mockClear();
  router.canGoBack.mockReturnValue(true);
  for (const fn of Object.values(downloads)) fn.mockReset();
  downloads.maySaveToPhone.mockResolvedValue(true);
  downloads.saveToPhone.mockResolvedValue(undefined);
  downloads.shareFiles.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

/** A day and hour of September 2026, in the phone's own zone — a day is a local day. */
const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).toISOString();

/**
 * Five frames over three days, newest first as the feed reads them: `a` and `b` on the 13th, `c` and
 * `d` on the 12th, `e` on the 11th. `d` is still being developed and `b` is a video.
 */
const frames = (): MediaItem[] => [
  photo('a', 'me', at(13, 10), { size_bytes: '4200000' }),
  photo('b', 'liza', at(13, 9), { kind: 'video', duration_seconds: 12, size_bytes: '30000000' }),
  photo('c', 'liza', at(12, 15), { size_bytes: '1000000' }),
  { ...developing('d', 'me', at(12, 14)), thumbnail_url: 'https://r2.example/d' },
  photo('e', 'me', at(11, 10), { size_bytes: '2000000' }),
];

const roster = (): Member[] => [
  member('me', 'organizer', { name: 'Я' }),
  member('liza', 'contributor', { name: 'Лиза Морозова' }),
];

type World = {
  media: MediaItem[];
  members: Member[];
  /** How many times the gallery has been read, and what the nth read is answered with, if not `media`. */
  reads: number;
  /** What the route that signs every original answers with, if not one link per frame. */
  originals?: unknown;
  /** The boxes of the memory as the asker sees them. */
  labels: Label[];
  read?: (nth: number) => unknown;
  /** What each DELETE is answered with, by frame id; a frame not named here is deleted. */
  onDelete: Record<string, Response>;
  log: Asked[];
};

function world(
  over: Partial<
    Pick<World, 'media' | 'members' | 'onDelete' | 'read' | 'originals' | 'labels'>
  > = {},
): World {
  const w: World = {
    media: frames(),
    members: roster(),
    reads: 0,
    onDelete: {},
    labels: [],
    log: [],
  };
  Object.assign(w, over);
  w.log = serve((asked) => {
    if (asked.path === '/memories/m1/media' && asked.method === 'GET') {
      w.reads += 1;
      return w.read?.(w.reads) ?? w.media;
    }
    if (asked.path === '/memories/m1/members') return w.members;
    if (asked.path === '/memories/m1/labels') return w.labels;
    if (asked.path === '/memories/m1/media/download') {
      return (
        w.originals ??
        w.media.map((one) => ({
          id: one.id,
          kind: one.kind,
          url: `https://r2.example/original/${one.id}`,
        }))
      );
    }
    const [, , , , id] = asked.path.split('/');
    if (asked.method === 'DELETE') {
      const answer = w.onDelete[id];
      if (answer) return answer;
      w.media = w.media.filter((one) => one.id !== id);
      return { ok: true };
    }
    return undefined;
  });
  return w;
}

async function open(
  head: Head = {
    memory: memory({ member_count: 2, media_count: 5 }),
    error: null,
    reload: () => {},
  },
) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<Frames id="m1" head={head} />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const icon = (text: string) => () =>
    root.findAllByType(IconButton).find((one) => one.props.label === text)!;
  const button = (text: string) => () =>
    root.findAllByType(Button).find((one) => one.props.label === text)!;
  const tile = (id: string) => () =>
    root.findAllByType(Tile).find((one) => one.props.uri === `https://r2.example/${id}`)!;
  const screen = {
    root,
    press,
    icon,
    button,
    tile,
    unmount: () => act(async () => tree.unmount()),
    /** The pull that reads the gallery again, the way a finger does it. */
    pull: () => act(async () => root.findByType(RefreshControl).props.onRefresh()),
    /** The frames on the feed, in the order drawn. */
    feed: () => root.findAllByType(Tile).map((one) => String(one.props.uri).split('/').pop()),
    /** The two lines of the glass capsule. */
    capsule: () => ({
      title: root.findByType(GlassBar).props.title as string,
      meta: root.findByType(GlassBar).props.meta as string | undefined,
    }),
    /** The capsule pressed — the door in the feed, «выбрать все» while picking. */
    pressCapsule: () => act(async () => root.findByType(GlassBar).props.onCapsule()),
    /** Which of the three the mark on a frame is: `off`, `keep`, or `undefined` (no circle at all). */
    mark: (id: string) => tile(id)().props.pick as 'off' | 'keep' | undefined,
    startPicking: () => press(icon(ru.gallery.select)),
    stopPicking: () => press(icon(ru.gallery.leaveSelect)),
    /** A tap on each of these frames. */
    tap: async (...ids: string[]) => {
      for (const id of ids) await press(tile(id));
    },
    /** What the three buttons of the picking layer are, off or on. */
    footer: () => ({
      share: icon(ru.action.share)().props.disabled as boolean,
      download: root
        .findAllByType(Button)
        .find((one) => one.props.icon !== undefined && one.props.wide)!.props,
      remove: icon(ru.action.delete)().props.disabled as boolean,
    }),
    sheet: () => root.findByType(ConfirmSheet),
    seams: () => root.findAllByType(DayMark),
  };
  return screen;
}

type Screen = Awaited<ReturnType<typeof open>>;

test('the feed reads newest first, and nothing is a mark until the mode is on', async () => {
  world();
  const screen = await open();
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
  // Off the mode, a frame is a button and not a checkbox: no circle at all.
  for (const id of ['a', 'b', 'c', 'd', 'e']) expect(screen.mark(id)).toBeUndefined();
  expect(screen.capsule().title).toBe('Свадьба Лизы и Марка');
  expect(screen.capsule().meta).toContain('12–13 сентября');
});

/** The lines the capsule says while picking, worked out the way a person would count them. */
const picked = (n: number, weight: string, kinds: string) => ({
  title: ru.gallery.picked(n),
  meta: `${ru.viewer.size(weight)} · ${kinds}`,
});

test('picking starts with nothing marked, says so, and holds the three buttons off', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  // «Ничего не выбрано» is said by the capsule, by the button that would take it home, and by every
  // button that would do something to it — none of them is a promise about nothing.
  expect(screen.capsule()).toEqual({ title: ru.gallery.pickNothing, meta: undefined });
  const foot = screen.footer();
  expect(foot.share).toBe(true);
  expect(foot.remove).toBe(true);
  expect(foot.download.disabled).toBe(true);
  expect(foot.download.label).toBe(ru.gallery.nothingPicked);
  expect(screen.icon(ru.gallery.labelsPut)().props.disabled).toBe(true);
  // Every frame there is something to take home of wears an empty circle; the developing one none.
  for (const id of ['a', 'b', 'c', 'e']) expect(screen.mark(id)).toBe('off');
  expect(screen.mark('d')).toBeUndefined();
});

test('a tap marks a frame, and the capsule counts what is marked, weighs it and says what it is made of', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'b');
  expect(screen.mark('a')).toBe('keep');
  expect(screen.mark('c')).toBe('off');
  // 4,2 and 30 megabytes together, a photograph and a video — not the largest, not the count.
  expect(screen.capsule()).toEqual(picked(2, '34', ru.gallery.pickedKinds(1, 1)));
  expect(screen.footer().download.label).toBe(ru.gallery.download(2));
  expect(screen.footer().download.disabled).toBe(false);
  expect(screen.footer().share).toBe(false);
  // The same tap again gives it back.
  await screen.tap('b');
  expect(screen.capsule()).toEqual(picked(1, '4,2', ru.gallery.pickedKinds(1, 0)));
});

test('a frame still developing cannot be marked, and cannot be opened off the mode either', async () => {
  world();
  const screen = await open();
  // Off the mode: a frame with something behind it opens, one still being made has no press at all.
  expect(screen.tile('a')().props.onPress).toBeDefined();
  expect(screen.tile('d')().props.onPress).toBeUndefined();
  await screen.startPicking();
  expect(screen.tile('a')().props.onPress).toBeDefined();
  expect(screen.tile('d')().props.onPress).toBeUndefined();
});

test('the capsule takes every frame that can be marked and gives them all back on the second press', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  // Four, and not five: the one still developing has nothing to take.
  expect(screen.capsule().title).toBe(ru.gallery.picked(4));
  for (const id of ['a', 'b', 'c', 'e']) expect(screen.mark(id)).toBe('keep');
  expect(screen.mark('d')).toBeUndefined();
  await screen.pressCapsule();
  expect(screen.capsule().title).toBe(ru.gallery.pickNothing);
  // With one taken by hand the press completes the set rather than clearing it.
  await screen.tap('a');
  await screen.pressCapsule();
  expect(screen.capsule().title).toBe(ru.gallery.picked(4));
});

test('leaving the mode drops every mark, and the next entry starts from nothing', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'c');
  await screen.stopPicking();
  for (const id of ['a', 'c']) expect(screen.mark(id)).toBeUndefined();
  await screen.startPicking();
  expect(screen.capsule().title).toBe(ru.gallery.pickNothing);
  expect(screen.mark('a')).toBe('off');
});

test('the capsule is the door to the settings off the mode, and «Добавить ещё» is the one road to the upload', async () => {
  world();
  const screen = await open();
  await screen.pressCapsule();
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/settings',
    params: { id: 'm1' },
  });
  await screen.press(screen.button(ru.gallery.addMore));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/upload',
    params: { id: 'm1' },
  });
  // In the mode the capsule is «выбрать все» and never the door.
  router.push.mockClear();
  await screen.startPicking();
  await screen.pressCapsule();
  expect(router.push).not.toHaveBeenCalled();
});

/** Delete pressed, and the sheet that asks — its price, what it says about what will not go. */
const asked = (screen: Screen) => ({
  visible: screen.sheet().props.visible as boolean,
  title: screen.sheet().props.title as string,
  meta: screen.sheet().props.meta as string | undefined,
});
const deletes = (log: Asked[]) =>
  log.filter((one) => one.method === 'DELETE').map((one) => one.path.split('/').pop());
const notice = (screen: Screen) =>
  screen.root.findAllByType(Banner).map((one) => one.props.text as string);

test('the organizer deletes an armful: the sheet counts it, the requests go one by one, the feed loses exactly those', async () => {
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  expect(asked(screen).visible).toBe(false);
  await screen.press(screen.icon(ru.action.delete));
  expect(asked(screen)).toEqual({
    visible: true,
    title: ru.gallery.deleteAskMany(4),
    meta: undefined,
  });
  // Asking is not doing: nothing has gone yet.
  expect(deletes(w.log)).toEqual([]);

  await act(async () => screen.sheet().props.onConfirm());
  expect(deletes(w.log)).toEqual(['a', 'b', 'c', 'e']);
  // What went is off the feed without the gallery having been read again; what was never marked stays.
  expect(screen.feed()).toEqual(['d']);
  expect(w.log.filter((one) => one.method === 'GET' && one.path.endsWith('/media'))).toHaveLength(
    1,
  );
  expect(asked(screen).visible).toBe(false);
  expect(notice(screen)).toEqual([]);
  // The marks of what is gone are gone: the capsule counts what is there.
  expect(screen.capsule().title).toBe(ru.gallery.pickNothing);
});

test('one frame is asked about by what it is, and a cancel sends nothing', async () => {
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('b');
  await screen.press(screen.icon(ru.action.delete));
  expect(asked(screen).title).toBe(ru.gallery.deleteAsk('video'));
  await act(async () => screen.sheet().props.onCancel());
  expect(asked(screen).visible).toBe(false);
  expect(deletes(w.log)).toEqual([]);
  expect(screen.feed()).toContain('b');
});

test('a frame somebody else has already deleted is gone all the same, and the run goes on past it', async () => {
  const w = world({ onDelete: { b: refused(404) } });
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  await screen.press(screen.icon(ru.action.delete));
  await act(async () => screen.sheet().props.onConfirm());
  expect(deletes(w.log)).toEqual(['a', 'b', 'c', 'e']);
  expect(screen.feed()).toEqual(['d']);
  expect(notice(screen)).toEqual([]);
});

test('a refusal in the middle stops the run, says why, and what went before it has left the feed', async () => {
  const w = world({ onDelete: { c: refused(403) } });
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  await screen.press(screen.icon(ru.action.delete));
  await act(async () => screen.sheet().props.onConfirm());
  // `e` was never asked about: the rest would meet the same answer.
  expect(deletes(w.log)).toEqual(['a', 'b', 'c']);
  expect(screen.feed()).toEqual(['c', 'd', 'e']);
  expect(notice(screen)).toEqual([ru.gallery.deleteDenied]);
  // And the mode is still there for another try, on what is left marked.
  expect(screen.capsule().title).toBe(ru.gallery.picked(2));
});

test('no connection while deleting is said in its own words, and nothing leaves the feed', async () => {
  const w = world();
  w.log = serve((one) =>
    one.method === 'DELETE' ? 'offline' : one.path.endsWith('/members') ? w.members : w.media,
  );
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.action.delete));
  await act(async () => screen.sheet().props.onConfirm());
  expect(notice(screen)).toEqual([ru.error.offline]);
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
});

test('a contributor deletes what they brought and nothing else: the sheet counts only that, and says why it is fewer', async () => {
  who.id = 'liza';
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  await screen.press(screen.icon(ru.action.delete));
  // Four are marked and two of them are Liza's own: two will go, and the sheet does not promise more.
  expect(asked(screen)).toEqual({
    visible: true,
    title: ru.gallery.deleteAskMany(2),
    meta: ru.gallery.deleteDenied,
  });
  await act(async () => screen.sheet().props.onConfirm());
  expect(deletes(w.log)).toEqual(['b', 'c']);
  expect(screen.feed()).toEqual(['a', 'd', 'e']);
});

test('a selection with nothing of one’s own in it has a delete that is off, not one the api will refuse', async () => {
  who.id = 'liza';
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'e');
  expect(screen.icon(ru.action.delete)().props.disabled).toBe(true);
  await screen.tap('c');
  expect(screen.icon(ru.action.delete)().props.disabled).toBe(false);
});

test('a viewer may look and delete their own frame; nobody who may not is shown the way to add', async () => {
  who.id = 'vera';
  const w = world({
    members: [...roster(), member('vera', 'viewer', { name: 'Вера' })],
    media: [...frames(), photo('v', 'vera', at(10))],
  });
  const screen = await open();
  // The bottom layer keeps its two round buttons and has nothing between them.
  expect(screen.root.findAllByType(Button).filter((one) => one.props.wide)).toHaveLength(0);
  expect(screen.icon(ru.gallery.filters)()).toBeDefined();
  expect(screen.icon(ru.gallery.sorting)()).toBeDefined();
  await screen.startPicking();
  await screen.pressCapsule();
  await screen.press(screen.icon(ru.action.delete));
  expect(asked(screen).title).toBe(ru.gallery.deleteAsk('photo'));
  await act(async () => screen.sheet().props.onConfirm());
  expect(deletes(w.log)).toEqual(['v']);
});

test('the organizer deletes anybody’s, the api being the one to say otherwise', async () => {
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('b', 'c');
  await screen.press(screen.icon(ru.action.delete));
  expect(asked(screen)).toEqual({
    visible: true,
    title: ru.gallery.deleteAskMany(2),
    meta: undefined,
  });
  await act(async () => screen.sheet().props.onConfirm());
  expect(deletes(w.log)).toEqual(['b', 'c']);
});

test('a memory with nothing in it is the empty sign and one action, with no picking and nothing to sort', async () => {
  world({ media: [] });
  const screen = await open();
  expect(screen.root.findAllByType(Empty)).toHaveLength(1);
  expect(screen.root.findAllByType(Tile)).toHaveLength(0);
  expect(screen.button(ru.gallery.add)()).toBeDefined();
  // No select button at all, and neither of the two round ones.
  for (const label of [ru.gallery.select, ru.gallery.filters, ru.gallery.sorting]) {
    expect(
      screen.root.findAllByType(IconButton).filter((one) => one.props.label === label),
    ).toHaveLength(0);
  }
  expect(screen.capsule().meta).toContain(ru.memory.nothingYet);
});

test('and for somebody who may only look at it there is no bottom layer at all', async () => {
  who.id = 'vera';
  world({ media: [], members: [...roster(), member('vera', 'viewer')] });
  const screen = await open();
  expect(screen.root.findAllByType(Empty)).toHaveLength(1);
  expect(screen.root.findAllByType(Button)).toHaveLength(0);
  expect(
    screen.root.findAllByType(IconButton).filter((one) => one.props.label === ru.gallery.filters),
  ).toHaveLength(0);
});

/**
 * The two sheets the feed is tuned from, driven the way a finger does: the round button raises the
 * sheet, a control on it is pressed through the prop the kit hands the press to.
 */
const sortSheet = (screen: Screen) => screen.root.findByType(SortSheet);
const filterSheet = (screen: Screen) => screen.root.findByType(FilterSheet);
const openSort = (screen: Screen) => screen.press(screen.icon(ru.gallery.sorting));
const openFilter = (screen: Screen) => screen.press(screen.icon(ru.gallery.filters));
/** A control of a sheet, found by the name it answers to. */
const control = (
  sheet: TestRenderer.ReactTestInstance,
  type: typeof Chip | typeof RowToggle | typeof Button,
  name: string,
) =>
  sheet.findAllByType(type as never).find((one) => (one.props.label ?? one.props.name) === name)!;
const segment = (sheet: TestRenderer.ReactTestInstance, name: string) =>
  sheet.findAll(
    (one) =>
      typeof one.props.onChange === 'function' && one.props.label === name && one.props.options,
  )[0]!;
/** A choice made on a sheet, through the same prop the finger's press lands on. */
const choose = (on: () => TestRenderer.ReactTestInstance, value: unknown) =>
  act(async () => on().props.onChange(value));
const seamsOf = (screen: Screen) =>
  screen.seams().map((one) => ({
    label: one.props.label as string,
    count: one.props.count as string | undefined,
    ...(one.props.avatar === undefined ? {} : { avatar: one.props.avatar as string }),
  }));

test('turning the dates on writes each day over its strip, and the round button says the order is no longer the default', async () => {
  world();
  const screen = await open();
  expect(screen.seams()).toHaveLength(0);
  expect(screen.icon(ru.gallery.sorting)().props.dot).toBe(false);

  await openSort(screen);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(true),
  );
  // A seam per day, newest first, the day and its name and never the year; a day carries no count.
  expect(seamsOf(screen)).toEqual([
    { label: '13 сентября, воскресенье', count: undefined },
    { label: '12 сентября, суббота', count: undefined },
    { label: '11 сентября, пятница', count: undefined },
  ]);
  // The frames themselves have not moved; only the seams were put between them.
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
  // It takes effect as it is pressed — the sheet is still up, and «Готово» is only the way out.
  expect(screen.root.findAllByType(SortSheet)).toHaveLength(1);
  expect(screen.icon(ru.gallery.sorting)().props.dot).toBe(true);
  await act(async () => sortSheet(screen).props.onDone());
  expect(screen.root.findAllByType(SortSheet)).toHaveLength(0);
  expect(screen.seams()).toHaveLength(3);
  // And off again it is the default, and the dot goes with it.
  await openSort(screen);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(false),
  );
  expect(screen.seams()).toHaveLength(0);
  expect(screen.icon(ru.gallery.sorting)().props.dot).toBe(false);
});

test('«Сначала старые» turns the whole feed around, the days and the frames inside them', async () => {
  world();
  const screen = await open();
  await openSort(screen);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(true),
  );
  await choose(() => segment(sortSheet(screen), ru.gallery.order), 'oldest');
  expect(screen.feed()).toEqual(['e', 'd', 'c', 'b', 'a']);
  expect(seamsOf(screen).map((one) => one.label)).toEqual([
    '11 сентября, пятница',
    '12 сентября, суббота',
    '13 сентября, воскресенье',
  ]);
  expect(screen.icon(ru.gallery.sorting)().props.dot).toBe(true);
});

test('by people the seam is a person: their circle, the organizer’s ringed, the one with more frames first', async () => {
  world();
  const screen = await open();
  await openSort(screen);
  await choose(() => segment(sortSheet(screen), ru.gallery.groupBy), 'person');
  // Three of «Я», two of Liza — every record counts, one still developing included.
  expect(seamsOf(screen)).toEqual([
    { label: 'Я', count: '3', avatar: 'Я' },
    { label: 'Лиза Морозова', count: '2', avatar: 'Лиза Морозова' },
  ]);
  expect(screen.seams().map((one) => one.props.organizer)).toEqual([true, false]);
  expect(screen.feed()).toEqual(['a', 'd', 'e', 'b', 'c']);
  // The seam is already a name, so the switch for dates is held shut.
  expect(control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.disabled).toBe(true);
  // By kind it is the two words, photographs before videos.
  await choose(() => segment(sortSheet(screen), ru.gallery.groupBy), 'kind');
  expect(seamsOf(screen)).toEqual([
    { label: ru.media.photo, count: '4' },
    { label: ru.media.video, count: '1' },
  ]);
  // And «Не собирать» gives the switch back.
  await choose(() => segment(sortSheet(screen), ru.gallery.groupBy), 'none');
  expect(control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.disabled).toBe(false);
  expect(screen.seams()).toHaveLength(0);
});

test('while picking a seam is a switch over its own day: it counts what a tap could mark, takes it, and gives it back', async () => {
  const w = world({
    media: [
      ...frames(),
      { ...developing('x', 'me', at(10)), thumbnail_url: 'https://r2.example/x' },
    ],
  });
  void w;
  const screen = await open();
  await openSort(screen);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(true),
  );
  await act(async () => sortSheet(screen).props.onDone());
  await screen.startPicking();
  const seams = () =>
    screen.seams().map((one) => ({
      count: one.props.count as string,
      picked: one.props.picked as boolean,
      press: one.props.pressLabel as string,
      live: one.props.onPress !== undefined,
    }));
  // 13th: a and b. 12th: c — d is still developing and is no part of «все». 11th: e. 10th: only x,
  // which is developing, so there is nothing to take and the band does not answer.
  expect(seams()).toEqual([
    { count: '2', picked: false, press: ru.gallery.selectDay(2), live: true },
    { count: '1', picked: false, press: ru.gallery.selectDay(1), live: true },
    { count: '1', picked: false, press: ru.gallery.selectDay(1), live: true },
    { count: '0', picked: false, press: ru.gallery.selectDay(0), live: false },
  ]);

  await act(async () => screen.seams()[0].props.onPress());
  expect(screen.capsule().title).toBe(ru.gallery.picked(2));
  expect(seams()[0].picked).toBe(true);
  // A frame of another day marked by hand completes that day's own seam and nothing else.
  await screen.tap('c');
  expect(seams().map((one) => one.picked)).toEqual([true, true, false, false]);
  // The second press on the first seam gives its own strip back, and what is marked elsewhere stays.
  await act(async () => screen.seams()[0].props.onPress());
  expect(screen.capsule().title).toBe(ru.gallery.picked(1));
  expect(screen.mark('c')).toBe('keep');
  expect(screen.mark('a')).toBe('off');
  // Off the mode the seam is a caption again, with no press and no count.
  await screen.stopPicking();
  expect(seams().map((one) => one.live)).toEqual([false, false, false, false]);
  expect(screen.seams()[0].props.count).toBeUndefined();
});

test('the filter counts what a draft would leave before it is applied, and applies exactly that', async () => {
  world();
  const screen = await open();
  expect(screen.icon(ru.gallery.filters)().props.dot).toBe(false);
  await openFilter(screen);
  const apply = () => filterSheet(screen).findAllByType(Button).at(-1)!;
  // Nothing chosen: no number to promise.
  expect(apply().props.label).toBe(ru.gallery.showAll);
  await act(async () => control(filterSheet(screen), Chip, 'Лиза').props.onPress());
  expect(apply().props.label).toBe(ru.gallery.show(2));
  await choose(() => segment(filterSheet(screen), ru.gallery.whatKind), 'video');
  expect(apply().props.label).toBe(ru.gallery.show(1));
  // «Кто принёс» is «или»: adding the organizer widens the answer by what the organizer has, and the
  // kind narrows it again — the count is worked out over the whole memory, not over the feed on show.
  await act(async () => control(filterSheet(screen), Chip, 'Я').props.onPress());
  expect(apply().props.label).toBe(ru.gallery.show(1));
  await choose(() => segment(filterSheet(screen), ru.gallery.whatKind), 'photo');
  expect(apply().props.label).toBe(ru.gallery.show(4));
  // Nothing under the conditions: the button says so and cannot be pressed.
  await act(async () => control(filterSheet(screen), Chip, 'Лиза').props.onPress());
  await choose(() => segment(filterSheet(screen), ru.gallery.whatKind), 'video');
  expect(apply().props.label).toBe(ru.gallery.nothingMatched);
  expect(apply().props.disabled).toBe(true);

  // A draft is not applied until the button: the feed is as it was, and closing leaves it that way.
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
  await act(async () => filterSheet(screen).props.onCancel());
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
  expect(screen.icon(ru.gallery.filters)().props.dot).toBe(false);
});

test('an applied filter cuts the feed and its count, lights the button, and is what the sheet opens on', async () => {
  world();
  const screen = await open();
  await openFilter(screen);
  await act(async () => control(filterSheet(screen), Chip, 'Лиза').props.onPress());
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  expect(screen.root.findAllByType(FilterSheet)).toHaveLength(0);
  expect(screen.feed()).toEqual(['b', 'c']);
  expect(screen.root.findByType(BlockHead).props.count).toBe(ru.memory.frames(2));
  expect(screen.icon(ru.gallery.filters)().props.dot).toBe(true);

  // The sheet opens on what is applied, so a change is a change to it — and «Сбросить» is live.
  await openFilter(screen);
  expect(control(filterSheet(screen), Chip, 'Лиза').props.selected).toBe(true);
  const reset = control(filterSheet(screen), Button, ru.gallery.reset);
  expect(reset.props.disabled).toBe(false);
  await act(async () => reset.props.onPress());
  expect(filterSheet(screen).findAllByType(Button).at(-1)!.props.label).toBe(ru.gallery.showAll);
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  expect(screen.feed()).toEqual(['a', 'b', 'c', 'd', 'e']);
  expect(screen.icon(ru.gallery.filters)().props.dot).toBe(false);
});

test('a day of the filter is the frames of that day, counted on its chip', async () => {
  world();
  const screen = await open();
  await openFilter(screen);
  const chip = (label: string) => control(filterSheet(screen), Chip, label);
  expect(chip('13 сент').props.count).toBe('2');
  expect(chip('12 сент').props.count).toBe('2');
  await act(async () => chip('12 сент').props.onPress());
  await act(async () => chip('11 сент').props.onPress());
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  expect(screen.feed()).toEqual(['c', 'd', 'e']);
  // «Все дни» is the absence of a choice: pressing it empties the set.
  await openFilter(screen);
  expect(chip(ru.gallery.anyDay).props.selected).toBe(false);
  await act(async () => chip(ru.gallery.anyDay).props.onPress());
  expect(chip(ru.gallery.anyDay).props.selected).toBe(true);
});

test('«Другая дата» opens the calendar; a day picked on it is a chip of its own, and picking it again takes it off', async () => {
  world();
  const screen = await open();
  await openFilter(screen);
  const apply = () => filterSheet(screen).findAllByType(Button).at(-1)!;
  expect(filterSheet(screen).findAllByType(Calendar)).toHaveLength(0);
  const other = () => control(filterSheet(screen), Chip, ru.gallery.otherDay);
  expect(other().props.selected).toBe(false);
  await act(async () => other().props.onPress());
  // Held in while the calendar is open, and out of tomorrow like every calendar of a memory.
  expect(other().props.selected).toBe(true);
  const calendar = () => filterSheet(screen).findByType(Calendar);
  expect(startOfDay(calendar().props.max as Date).getTime()).toBe(startOfDay(new Date()).getTime());

  // A day the memory has frames on: it is the same chip as the row already offered.
  await act(async () => calendar().props.onPick(new Date(2026, 8, 11, 17)));
  expect(control(filterSheet(screen), Chip, '11 сент').props.selected).toBe(true);
  expect(apply().props.label).toBe(ru.gallery.show(1));
  // A day it has nothing on gets a chip too, with a count of nothing, so there is something to press
  // to take it off — and the button will not promise what it cannot show.
  await act(async () => calendar().props.onPick(new Date(2026, 8, 5)));
  expect(control(filterSheet(screen), Chip, '5 сент').props.count).toBe('0');
  expect(apply().props.label).toBe(ru.gallery.show(1));
  await act(async () => calendar().props.onPick(new Date(2026, 8, 11)));
  expect(apply().props.label).toBe(ru.gallery.nothingMatched);
  await act(async () => calendar().props.onPick(new Date(2026, 8, 5)));
  expect(
    filterSheet(screen)
      .findAllByType(Chip)
      .filter((one) => one.props.label === '5 сент'),
  ).toHaveLength(0);
  expect(apply().props.label).toBe(ru.gallery.showAll);
  await act(async () => other().props.onPress());
  expect(filterSheet(screen).findAllByType(Calendar)).toHaveLength(0);
});

test('the marked frames are counted inside the filter: «выбрать все» takes what the feed shows and nothing held back', async () => {
  world();
  const screen = await open();
  await openFilter(screen);
  await act(async () => control(filterSheet(screen), Chip, 'Лиза').props.onPress());
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  await screen.startPicking();
  await screen.pressCapsule();
  expect(screen.capsule().title).toBe(ru.gallery.picked(2));
  expect(screen.mark('b')).toBe('keep');
  // «Я» is filtered out of the feed and not marked, for all that every frame of it could be.
  expect(screen.root.findAllByType(Tile).map((one) => one.props.pick)).toEqual(['keep', 'keep']);
});

/**
 * The date spine (spec 7.8, detail 66, `MemoryScrub`). Whether it is there at all takes three
 * measurements the list makes — how tall the films block over the frames came out, and how the
 * feed compares to the screen — so the test says them the way the list does, through the props the
 * list hangs them on.
 */
function measure(screen: Screen, { header = 300, content = 2400, view = 844 } = {}) {
  return act(async () => {
    // The films block and the heading over the frames stand in one view that measures itself; of
    // everything that listens for a layout and has the heading inside it, that is the innermost.
    screen.root
      .findAll(
        (one) =>
          typeof one.props.onLayout === 'function' && one.findAllByType(BlockHead).length > 0,
      )
      .at(-1)!
      .props.onLayout({ nativeEvent: { layout: { height: header } } });
    const list = screen.root.findByType(FlatList);
    list.props.onContentSizeChange(390, content);
    list.props.onLayout({ nativeEvent: { layout: { height: view } } });
  });
}
const spine = (screen: Screen) =>
  screen.root
    .findAllByType(DateSpine)
    .flatMap((one) => one.props.marks as { label: string; top: number }[]);

test('a feed longer than the screen has a spine with a pill on the seam where a day begins, and none on a shared seam', async () => {
  world();
  const screen = await open();
  // Not measured yet: nothing to hang a pill on.
  expect(spine(screen)).toEqual([]);
  await measure(screen);
  const marks = spine(screen);
  // Three to a row: a, b, c stand in the first row, d and e in the second. The 12th begins in the
  // first row, on the seam the 13th already opens, and a seam carries one pill — so no pill for it.
  expect(marks.map((one) => one.label)).toEqual(['13 сент', '11 сент']);
  const pitch = (390 - FEED_GAP * 2) / 3 + FEED_GAP;
  const first = height.roundViewer + space.s4 + 300 + FEED_GAP;
  // Centred on the seam: half a gutter and half a pill above the row that opens the day.
  expect(marks[0].top).toBeCloseTo(first - (FEED_GAP / 2 + 8));
  expect(marks[1].top - marks[0].top).toBeCloseTo(pitch);
});

test('the spine waits for the block over the frames to be measured: the marks are counted from the first row, and until then there is none to count from', async () => {
  world();
  const screen = await open();
  // The list has said how tall it is and how tall the screen is, and the block over the frames has not.
  await act(async () => {
    const list = screen.root.findByType(FlatList);
    list.props.onContentSizeChange(390, 2400);
    list.props.onLayout({ nativeEvent: { layout: { height: 844 } } });
  });
  expect(spine(screen)).toEqual([]);
  await measure(screen);
  expect(spine(screen)).toHaveLength(2);
});

test('a feed no longer than the screen has no spine at all', async () => {
  world();
  const screen = await open();
  await measure(screen, { content: 700, view: 844 });
  expect(spine(screen)).toEqual([]);
  // Exactly as tall as the screen is nothing to scroll either.
  await measure(screen, { content: 844, view: 844 });
  expect(spine(screen)).toEqual([]);
  await measure(screen, { content: 845, view: 844 });
  expect(spine(screen)).toHaveLength(2);
});

test('with the dates written between the days, or the feed cut by people or by kind, the spine is gone', async () => {
  world();
  const screen = await open();
  await measure(screen);
  expect(spine(screen)).toHaveLength(2);
  await openSort(screen);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(true),
  );
  expect(spine(screen)).toEqual([]);
  await act(async () =>
    control(sortSheet(screen), RowToggle, ru.gallery.datesBetween).props.onValueChange(false),
  );
  expect(spine(screen)).toHaveLength(2);
  await choose(() => segment(sortSheet(screen), ru.gallery.groupBy), 'person');
  expect(spine(screen)).toEqual([]);
  await choose(() => segment(sortSheet(screen), ru.gallery.groupBy), 'kind');
  expect(spine(screen)).toEqual([]);
});

test('read oldest first the spine reads the same way down: the marks follow the feed', async () => {
  world();
  const screen = await open();
  await measure(screen);
  await openSort(screen);
  await choose(() => segment(sortSheet(screen), ru.gallery.order), 'oldest');
  // e, d, c | b, a — the 12th begins at d, in the first row, so it shares the 11th's seam; the 13th
  // begins at b, which opens the second.
  expect(spine(screen).map((one) => one.label)).toEqual(['11 сент', '13 сент']);
});

test('one day of material is one pill, and a feed of one day needs no more', async () => {
  world({
    media: [
      photo('a', 'me', at(13, 10)),
      photo('b', 'me', at(13, 11)),
      photo('c', 'me', at(13, 12)),
      photo('d', 'me', at(13, 13)),
    ],
  });
  const screen = await open();
  await measure(screen);
  expect(spine(screen).map((one) => one.label)).toEqual(['13 сент']);
});

/**
 * While the worker is still making something the feed reads again by itself, every three seconds and
 * quietly. Fake timers stand for those seconds; nothing else about the clock is touched.
 */
const SECONDS = 3000;
const clock = () =>
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
const stillDeveloping = (id: string, day: number) => ({
  ...developing(id, 'me', at(day, 14)),
  thumbnail_url: null,
});

test('a quiet read that was in the air when frames were deleted does not put them back', async () => {
  clock();
  try {
    const stale = later<MediaItem[]>();
    const w = world({
      media: [photo('a', 'me', at(13, 10)), stillDeveloping('d', 12)],
      read: (nth) => (nth === 2 ? stale.promise : undefined),
    });
    const screen = await open();
    expect(screen.root.findAllByType(Tile)).toHaveLength(2);

    // The three seconds go by and the read starts — and is still on its way while the person deletes.
    const before = [...w.media];
    await wait(SECONDS);
    expect(w.reads).toBe(2);
    await screen.startPicking();
    await screen.tap('a');
    await screen.press(screen.icon(ru.action.delete));
    await act(async () => screen.sheet().props.onConfirm());
    expect(screen.root.findAllByType(Tile)).toHaveLength(1);

    // The api's answer to the read that began before the delete: the frame is still in it.
    await act(async () => stale.settle(before));
    expect(screen.root.findAllByType(Tile)).toHaveLength(1);
    expect(screen.feed()).not.toContain('a');

    // And the loop was not lost with it: the developing frame is still being waited on, and turns.
    w.media = [photo('d', 'me', at(12, 14))];
    await wait(SECONDS);
    expect(w.reads).toBe(3);
    expect(screen.tile('d')().props.state).toBe('ready');
  } finally {
    vi.useRealTimers();
  }
});

test('the quiet read leaves a finished frame’s link alone, takes what changed as it came, and stops when nothing is developing', async () => {
  clock();
  try {
    const w = world({ media: [photo('a', 'me', at(13, 10)), stillDeveloping('d', 12)] });
    const screen = await open();
    expect(screen.tile('a')().props.uri).toBe('https://r2.example/a');
    expect(screen.root.findAllByType(Tile)[1].props.state).toBe('processing');

    // The api signs every link afresh on every answer; the developing frame is done by now.
    w.media = [
      photo('a', 'me', at(13, 10), { thumbnail_url: 'https://r2.example/a?signed=2' }),
      photo('d', 'me', at(12, 14), { thumbnail_url: 'https://r2.example/d?signed=2' }),
    ];
    await wait(SECONDS);
    expect(w.reads).toBe(2);
    // The finished frame keeps the link it had — a new url is a new file to the picture library.
    expect(screen.root.findAllByType(Tile)[0].props.uri).toBe('https://r2.example/a');
    expect(screen.root.findAllByType(Tile)[1].props.uri).toBe('https://r2.example/d?signed=2');
    expect(screen.root.findAllByType(Tile)[1].props.state).toBe('ready');
    // Nothing is developing any more: the loop ends, and no read follows however long it waits.
    await wait(SECONDS * 5);
    expect(w.reads).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test('a quiet read that fails is silent: the feed stays as it was, and the loop tries again', async () => {
  clock();
  try {
    const w = world({
      media: [photo('a', 'me', at(13, 10)), stillDeveloping('d', 12)],
      read: (nth) => (nth === 2 ? 'offline' : undefined),
    });
    const screen = await open();
    await wait(SECONDS);
    expect(w.reads).toBe(2);
    expect(screen.root.findAllByType(Tile)).toHaveLength(2);
    expect(screen.root.findAllByType(Banner)).toHaveLength(0);
    await wait(SECONDS);
    expect(w.reads).toBe(3);
  } finally {
    vi.useRealTimers();
  }
});

const spineLayer = (screen: Screen) =>
  screen.root.findAll(
    (one) => one.props.pointerEvents !== undefined && one.findAllByType(DateSpine).length > 0,
  )[0];
/** The strip at the right edge a finger takes hold of — a view with the responder handlers and its own width. */
const grabber = (screen: Screen) =>
  screen.root.findAll(
    (one) =>
      typeof one.props.onResponderGrant === 'function' &&
      JSON.stringify(one.props.style ?? '').includes('"width":32'),
  )[0];

test('dragging the spine throws the feed to where the finger stands on it, held inside the strip at either end', async () => {
  const scrollToOffset = vi
    .spyOn(FlatList.prototype, 'scrollToOffset')
    .mockImplementation(() => {});
  try {
    world();
    const screen = await open();
    await measure(screen, { content: 2400, view: 844 });
    const reach = 2400 - 844;
    // The strip is the right edge between the two glasses: from under the bar to above the bottom layer.
    const top = height.roundViewer;
    const span = 844 - board.footerGallery - top;
    const finger = (pageY: number) =>
      act(async () => grabber(screen).props.onResponderGrant(touch({ y: pageY })));
    await finger(top + span / 2);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: reach / 2, animated: false });
    await finger(top + span / 4);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: reach / 4, animated: false });
    // Above the strip is the top of the feed, below it the end, and neither runs past.
    await finger(0);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
    await finger(5000);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: reach, animated: false });
    // A drag carries on from the press: each move is where the feed goes.
    await act(async () =>
      grabber(screen).props.onResponderMove(
        touch({ y: top + span * 0.75, fromY: top + span * 0.5 }),
      ),
    );
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: reach * 0.75, animated: false });
  } finally {
    scrollToOffset.mockRestore();
  }
});

test('the spine answers a finger only while it can be seen: a touch brings it up, and a second after the last one it goes', async () => {
  const scrollToOffset = vi
    .spyOn(FlatList.prototype, 'scrollToOffset')
    .mockImplementation(() => {});
  clock();
  try {
    world();
    const screen = await open();
    await measure(screen);
    expect(spineLayer(screen).props.pointerEvents).toBe('none');
    await act(async () => grabber(screen).props.onResponderGrant(touch({ y: 300 })));
    expect(spineLayer(screen).props.pointerEvents).toBe('box-none');
    // Held still on the strip it does not fade: every touch of it is a reason to stay.
    await wait(900);
    await act(async () => grabber(screen).props.onResponderMove(touch({ y: 310, fromY: 300 })));
    await wait(900);
    expect(spineLayer(screen).props.pointerEvents).toBe('box-none');
    await wait(200);
    expect(spineLayer(screen).props.pointerEvents).toBe('none');
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
    scrollToOffset.mockRestore();
  }
});

/**
 * Taking the marked frames home — «Скачать N» and «Поделиться» (spec 8, `FramesPicking`). The phone's
 * side (`@/lib/downloads`) is stood in for and its calls are noted; what is read is which files it was
 * asked about, in what order, what the screen said while it went and after, and what was shut.
 */
const original = (id: string, kind: 'photo' | 'video' = 'photo') => ({
  id,
  kind,
  url: `https://r2.example/original/${id}`,
});
const download = (screen: Screen) => screen.footer().download;
const said = (screen: Screen) => notice(screen);
const downloadButton = (screen: Screen, n: number) => () =>
  screen.root.findAllByType(Button).find((one) => one.props.label === ru.gallery.download(n))!;

test('downloading takes what is marked, and only that: the grant, the links, then one file after another with the count said as it goes', async () => {
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('c', 'a');
  // What the buttons are while each file is coming down: shut, so a second press cannot start a second run.
  const seen: { id: string; off: boolean }[] = [];
  downloads.saveToPhone.mockImplementation(async (file: { id: string }) => {
    seen.push({ id: file.id, off: download(screen).disabled });
  });
  await screen.press(downloadButton(screen, 2));
  expect(downloads.maySaveToPhone).toHaveBeenCalledTimes(1);
  expect(w.log.filter((one) => one.path === '/memories/m1/media/download')).toHaveLength(1);
  // The links come in the gallery's own order — «a» before «c» — and only the two marked are saved.
  expect(downloads.saveToPhone.mock.calls.map((call) => call[0])).toEqual([
    original('a'),
    original('c'),
  ]);
  expect(seen).toEqual([
    { id: 'a', off: true },
    { id: 'c', off: true },
  ]);
  expect(said(screen)).toEqual([ru.save.all(2)]);
  expect(download(screen).disabled).toBe(false);
});

test('while each file comes down the screen says which of how many it is, and the buttons stay shut for the whole run', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'b', 'c');
  const gates = [later<void>(), later<void>(), later<void>()];
  downloads.saveToPhone.mockImplementation(
    () => gates[downloads.saveToPhone.mock.calls.length - 1].promise,
  );
  await act(async () => void downloadButton(screen, 3)().props.onPress());
  expect(said(screen)).toEqual([ru.save.nth(1, 3)]);
  expect(download(screen).disabled).toBe(true);
  await act(async () => gates[0].settle());
  expect(said(screen)).toEqual([ru.save.nth(2, 3)]);
  await act(async () => gates[1].settle());
  expect(said(screen)).toEqual([ru.save.nth(3, 3)]);
  expect(download(screen).disabled).toBe(true);
  await act(async () => gates[2].settle());
  expect(said(screen)).toEqual([ru.save.all(3)]);
  expect(download(screen).disabled).toBe(false);
});

test('while frames are being deleted every button of the mode is shut, and they open again when the run is over', async () => {
  const gate = later<unknown>();
  const w = world();
  w.log = serve((asked) =>
    asked.method === 'DELETE'
      ? gate.promise
      : asked.path.endsWith('/members')
        ? w.members
        : asked.path.endsWith('/labels')
          ? []
          : w.media,
  );
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.action.delete));
  await act(async () => void screen.sheet().props.onConfirm());
  const foot = () => screen.footer();
  expect(foot().share).toBe(true);
  expect(foot().remove).toBe(true);
  expect(foot().download.disabled).toBe(true);
  expect(screen.icon(ru.gallery.leaveSelect)().props.disabled).toBe(true);
  await act(async () => gate.settle({ ok: true }));
  expect(screen.icon(ru.gallery.leaveSelect)().props.disabled).toBe(false);
  // Nothing marked is left to act on, so those three are off for that reason and not for this one.
  expect(screen.capsule().title).toBe(ru.gallery.pickNothing);
});

test('a file that will not come down is counted and the rest still do, and the summary says how many made it', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  downloads.saveToPhone.mockImplementation(async (file: { id: string }) => {
    if (file.id === 'b') throw new Error('cut off');
  });
  await screen.press(downloadButton(screen, 4));
  expect(downloads.saveToPhone).toHaveBeenCalledTimes(4);
  expect(said(screen)).toEqual([ru.save.some(3, 4)]);
});

test('without the phone’s grant nothing is signed and nothing is saved: the screen says the phone refused, and the buttons come back', async () => {
  const w = world();
  downloads.maySaveToPhone.mockResolvedValue(false);
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(downloadButton(screen, 1));
  expect(said(screen)).toEqual([ru.error.galleryRefused]);
  expect(w.log.filter((one) => one.path === '/memories/m1/media/download')).toEqual([]);
  expect(downloads.saveToPhone).not.toHaveBeenCalled();
  expect(download(screen).disabled).toBe(false);
});

test('links the api would not sign are the api’s own words, and any other failure the screen’s', async () => {
  const w = world({ originals: refused(503, 'no bucket') });
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(downloadButton(screen, 1));
  expect(said(screen)).toEqual(['no bucket']);
  w.log = serve((asked) =>
    asked.path.endsWith('/download')
      ? 'offline'
      : asked.path.endsWith('/members')
        ? w.members
        : asked.path.endsWith('/labels')
          ? []
          : w.media,
  );
  await screen.press(downloadButton(screen, 1));
  // No connection is not an api answer, so it is the screen’s own line about saving.
  expect(said(screen)).toEqual([ru.save.failedAll]);
});

test('a frame that went while it was marked is not counted and not asked for: the button says what the download will find', async () => {
  const w = world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'b');
  expect(download(screen).label).toBe(ru.gallery.download(2));
  // Somebody else deleted «b», and the feed is read again.
  w.media = w.media.filter((one) => one.id !== 'b');
  await screen.pull();
  expect(download(screen).label).toBe(ru.gallery.download(1));
  expect(screen.capsule().title).toBe(ru.gallery.picked(1));
  await screen.press(downloadButton(screen, 1));
  expect(downloads.saveToPhone.mock.calls.map((call) => call[0].id)).toEqual(['a']);
});

test('leaving the screen mid-way stops the errand between two files and not inside one', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.pressCapsule();
  downloads.saveToPhone.mockImplementation(async () => {
    await screen.unmount();
  });
  await screen.press(downloadButton(screen, 4));
  // The one in flight landed; the three after it were never started.
  expect(downloads.saveToPhone).toHaveBeenCalledTimes(1);
});

test('sharing hands the marked files to the phone’s sheet in one go, says it is getting ready, and says nothing after', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a', 'c');
  let line: string[] = [];
  let off = false;
  downloads.shareFiles.mockImplementation(async () => {
    line = said(screen);
    off = screen.icon(ru.action.share)().props.disabled as boolean;
  });
  await screen.press(screen.icon(ru.action.share));
  expect(downloads.shareFiles).toHaveBeenCalledTimes(1);
  expect(downloads.shareFiles.mock.calls[0][0]).toEqual([original('a'), original('c')]);
  expect(line).toEqual([ru.viewer.sharing]);
  expect(off).toBe(true);
  expect(said(screen)).toEqual([]);
  expect(screen.icon(ru.action.share)().props.disabled).toBe(false);
  // The chain of sheets stops when the screen is left, and only then.
  const keepGoing = downloads.shareFiles.mock.calls[0][1] as () => boolean;
  expect(keepGoing()).toBe(true);
  await screen.unmount();
  expect(keepGoing()).toBe(false);
});

test('a share that fell over is the api’s word when it was the api, and the window’s own when it was the phone', async () => {
  world({ originals: refused(403, 'not yours') });
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.action.share));
  expect(said(screen)).toEqual(['not yours']);
  vi.unstubAllGlobals();
  world();
  downloads.shareFiles.mockRejectedValue(new Error('no sheet'));
  await screen.press(screen.icon(ru.action.share));
  expect(said(screen)).toEqual([ru.viewer.shareFailed]);
});

test('until the first read answers the feed is waiting and not empty; then it is the frames, and the pull is off', async () => {
  const first = later<unknown>();
  world({ read: (nth) => (nth === 1 ? first.promise : undefined) });
  const screen = await open();
  expect(screen.root.findAllByType(Waiting)).toHaveLength(1);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);
  expect(screen.root.findByType(RefreshControl).props.refreshing).toBe(true);
  await act(async () => first.settle(frames()));
  expect(screen.root.findAllByType(Waiting)).toHaveLength(0);
  expect(screen.root.findByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.feed()).toHaveLength(5);
});

test('a read that fails is a banner in place of the feed with a way to try again, and the try is a loud read', async () => {
  let up = false;
  serve((asked) =>
    !up
      ? 'offline'
      : asked.path.endsWith('/members')
        ? roster()
        : asked.path.endsWith('/labels')
          ? []
          : frames(),
  );
  const screen = await open();
  expect(notice(screen)).toEqual([ru.error.offline]);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);
  expect(screen.root.findAllByType(Waiting)).toHaveLength(0);
  expect(screen.root.findByType(RefreshControl).props.refreshing).toBe(false);
  up = true;
  // A press hands its own argument along, and the first one here is «read quietly» — so it is called.
  await screen.press(screen.button(ru.action.retry));
  expect(notice(screen)).toEqual([]);
  expect(screen.feed()).toHaveLength(5);
});

test('a pull that failed over frames already on screen does not come back as the answer to «nothing here» once they are all deleted', async () => {
  const w = world({ media: [photo('a', 'me', at(13, 10))] });
  const screen = await open();
  // The pull fails and the frame stays where it was.
  w.log = serve(() => 'offline');
  await screen.pull();
  expect(screen.feed()).toEqual(['a']);
  // Then the last frame goes. What is on screen now is an empty feed, and it says so.
  w.log = serve((asked) =>
    asked.method === 'DELETE'
      ? { ok: true }
      : asked.path.endsWith('/members')
        ? w.members
        : asked.path.endsWith('/labels')
          ? []
          : w.media,
  );
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.action.delete));
  await act(async () => screen.sheet().props.onConfirm());
  expect(screen.feed()).toEqual([]);
  expect(notice(screen)).toEqual([]);
  expect(screen.root.findAllByType(Empty)).toHaveLength(1);
});

test('a memory of one frame is a feed and not the empty sign', async () => {
  world({ media: [photo('only', 'me', at(13, 10))] });
  const screen = await open();
  expect(screen.feed()).toEqual(['only']);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);
  expect(screen.icon(ru.gallery.select)()).toBeDefined();
  expect(screen.icon(ru.gallery.filters)()).toBeDefined();
  expect(screen.root.findByType(BlockHead).props.count).toBe(ru.memory.frames(1));
});

test('each tile is called out in the line it is drawn with, and a video says how long it runs — or, with no length, that it is one', async () => {
  world({
    media: [
      photo('ok', 'me', at(13, 10)),
      photo('clip', 'me', at(13, 9), { kind: 'video', duration_seconds: 12 }),
      photo('bare', 'me', at(13, 8), { kind: 'video', duration_seconds: null }),
      { ...developing('wait', 'me', at(13, 7)), thumbnail_url: 'https://r2.example/wait' },
      photo('lost', 'me', at(13, 6), {
        status: 'failed',
        thumbnail_url: 'https://r2.example/lost',
      }),
      // Ready, and nothing was ever made for it: drawn as a fallen frame, and told as one.
      photo('empty', 'me', at(13, 5), { thumbnail_url: null }),
    ],
  });
  const screen = await open();
  const tiles = () => screen.root.findAllByType(Tile).map((one) => one.props);
  expect(tiles().map((one) => one.label)).toEqual([
    ru.media.photo,
    ru.media.video,
    ru.media.video,
    `${ru.media.photo}, ${ru.gallery.waiting.processing}`,
    `${ru.media.photo}, ${ru.gallery.waiting.failed}`,
    `${ru.media.photo}, ${ru.gallery.waiting.ready}`,
  ]);
  expect(tiles().map((one) => one.state)).toEqual([
    'ready',
    'ready',
    'ready',
    'processing',
    'failed',
    'failed',
  ]);
  // A video is marked in the corner by its length, and one that came without says the word instead.
  expect(tiles().map((one) => one.length)).toEqual([
    undefined,
    '0:12',
    ru.media.video,
    undefined,
    undefined,
    undefined,
  ]);
});

test('the capsule says the days of the event and how many are in the memory, and before the memory is read only what is known', async () => {
  world();
  const screen = await open({ memory: memory({ member_count: 3 }), error: null, reload: () => {} });
  expect(screen.capsule()).toEqual({
    title: 'Свадьба Лизы и Марка',
    meta: `12–13 сентября · ${ru.memory.people(3)}`,
  });
  expect(screen.root.findByType(GlassBar).props.capsuleLabel).toBe(
    ru.memory.settings('Свадьба Лизы и Марка'),
  );

  vi.unstubAllGlobals();
  world();
  const unread = await open({ memory: null, error: null, reload: () => {} });
  expect(unread.capsule().title).toBe(ru.memory.fallbackTitle);
  expect(unread.capsule().meta).toBe(ru.memory.nothingYet);
});

test('while picking the capsule is read out as the count and the way it is pressed, and a selection with no known weight says only what it is made of', async () => {
  world({
    media: [
      photo('a', 'me', at(13, 10), { size_bytes: '' }),
      photo('b', 'me', at(13, 9), { kind: 'video', size_bytes: '' }),
    ],
  });
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  expect(screen.root.findByType(GlassBar).props.capsuleLabel).toBe(
    `${ru.gallery.picked(1)}. ${ru.gallery.selectAll}`,
  );
  expect(screen.capsule()).toEqual({
    title: ru.gallery.picked(1),
    meta: ru.gallery.pickedKinds(1, 0),
  });
  await screen.tap('b');
  expect(screen.capsule().meta).toBe(ru.gallery.pickedKinds(1, 1));
});

test('the delete sheet shows the first frame it is about, and a refusal that is not «not yours» is the api’s own word', async () => {
  const w = world({ onDelete: { a: refused(500, 'disk on fire') } });
  const screen = await open();
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.action.delete));
  expect(screen.sheet().props.thumb).toBe('https://r2.example/a');
  await act(async () => screen.sheet().props.onConfirm());
  expect(notice(screen)).toEqual(['disk on fire']);
  expect(deletes(w.log)).toEqual(['a']);
});

/** The window the feed raises over a frame, and what it is handed. */
const opened = (screen: Screen) => screen.root.findAllByType(FrameViewer)[0];

test('a tap opens the frame in the window, which is handed the feed’s own row in the feed’s own order, and closing puts it away', async () => {
  world();
  const screen = await open();
  expect(opened(screen)).toBeUndefined();
  await screen.press(screen.tile('b'));
  expect(opened(screen).props.item.id).toBe('b');
  expect(opened(screen).props.frames.map((one: MediaItem) => one.id)).toEqual([
    'a',
    'b',
    'c',
    'd',
    'e',
  ]);
  expect(opened(screen).props.roster.map((one: Member) => one.id)).toEqual(['me', 'liza']);
  expect(opened(screen).props.memoryId).toBe('m1');
  // Walked from inside the window, it follows.
  await act(async () => opened(screen).props.onOpen('c'));
  expect(opened(screen).props.item.id).toBe('c');
  await act(async () => opened(screen).props.onClose());
  expect(opened(screen)).toBeUndefined();
});

test('the strip under the window reads the way the feed does: oldest first is oldest first there, and a filter leaves only what it leaves', async () => {
  world();
  const screen = await open();
  await openSort(screen);
  await choose(() => segment(sortSheet(screen), ru.gallery.order), 'oldest');
  await act(async () => sortSheet(screen).props.onDone());
  await screen.press(screen.tile('b'));
  expect(opened(screen).props.frames.map((one: MediaItem) => one.id)).toEqual([
    'e',
    'd',
    'c',
    'b',
    'a',
  ]);
  await act(async () => opened(screen).props.onClose());

  await openFilter(screen);
  await act(async () => control(filterSheet(screen), Chip, 'Лиза').props.onPress());
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  await screen.press(screen.tile('b'));
  expect(opened(screen).props.frames.map((one: MediaItem) => one.id)).toEqual(['c', 'b']);
});

test('a frame taken out from the window leaves the feed and shuts the window; the rights it is told are the feed’s', async () => {
  const w = world();
  const screen = await open();
  await screen.press(screen.tile('a'));
  const [a, b] = frames();
  // The organizer may take out anybody’s; the window is told so, and asked nothing else.
  expect(opened(screen).props.mayDelete(a)).toBe(true);
  expect(opened(screen).props.mayDelete(b)).toBe(true);
  await act(async () => opened(screen).props.onRemoved('a'));
  expect(screen.feed()).toEqual(['b', 'c', 'd', 'e']);
  expect(opened(screen)).toBeUndefined();
  // The window took it out on the server; the feed did not read again to find that out.
  expect(w.reads).toBe(1);

  who.id = 'liza';
  const contributor = await open();
  await contributor.press(contributor.tile('b'));
  expect(opened(contributor).props.mayDelete(a)).toBe(false);
  expect(opened(contributor).props.mayDelete(b)).toBe(true);
});

test('the window is handed the line each frame is called out as, the same one the tile wears, and a frame that goes takes its window with it', async () => {
  const w = world();
  const screen = await open();
  await screen.press(screen.tile('a'));
  const [a] = frames();
  expect(opened(screen).props.nameOf(a, frameOf(a), false)).toBe(ru.media.photo);
  expect(opened(screen).props.nameOf(a, frameOf(a), true)).toBe(
    `${ru.media.photo}, ${ru.gallery.open}`,
  );
  // Deleted by somebody else while it is open: the next read has no such frame, and the window is gone.
  w.media = w.media.filter((one) => one.id !== 'a');
  await screen.pull();
  expect(opened(screen)).toBeUndefined();
});

test('a quiet read that began before a frame was taken out from the window does not bring it back', async () => {
  clock();
  try {
    const stale = later<MediaItem[]>();
    const w = world({
      media: [photo('a', 'me', at(13, 10)), stillDeveloping('d', 12)],
      read: (nth) => (nth === 2 ? stale.promise : undefined),
    });
    const screen = await open();
    const before = [...w.media];
    await wait(SECONDS);
    await screen.press(screen.tile('a'));
    await act(async () => opened(screen).props.onRemoved('a'));
    await act(async () => stale.settle(before));
    expect(screen.feed()).not.toContain('a');
    expect(screen.root.findAllByType(Tile)).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

test('a label the filter holds stays on it when the labels are read again, while there are other labels to read', async () => {
  const boxes = [
    label({ id: 'best', title: 'Лучшее' }),
    label({ id: 'mine', title: 'Для себя', shared: false }),
  ];
  world({
    labels: boxes,
    media: [
      photo('a', 'me', at(13, 10), { label_ids: ['best'] }),
      photo('b', 'me', at(13, 9), { label_ids: ['best'] }),
      photo('c', 'me', at(12, 9)),
    ],
  });
  const screen = await open();
  await openFilter(screen);
  await act(async () => control(filterSheet(screen), Chip, 'Лучшее').props.onPress());
  await act(async () => filterSheet(screen).findAllByType(Button).at(-1)!.props.onPress());
  expect(screen.feed()).toEqual(['a', 'b']);
  // The labels sheet is raised from the picking mode and read back on the way out.
  await screen.startPicking();
  await screen.tap('a');
  await screen.press(screen.icon(ru.gallery.labelsPut));
  await act(async () => screen.root.findByType(LabelSheets).props.onClose());
  expect(screen.feed()).toEqual(['a', 'b']);
  await screen.stopPicking();
  expect(screen.icon(ru.gallery.filters)().props.dot).toBe(true);
});

test('a memory that would not read is a line under the bar with a way to read it again, and the feed under it goes on', async () => {
  world();
  const reload = vi.fn();
  const screen = await open({ memory: null, error: 'Нет связи', reload });
  expect(notice(screen)).toEqual(['Нет связи']);
  expect(screen.feed()).toHaveLength(5);
  await screen.press(screen.button(ru.action.retry));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('the way out of the memory is the back it arrived on, or the list when there is none', async () => {
  world();
  const screen = await open();
  await screen.press(screen.icon(ru.action.back));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  router.canGoBack.mockReturnValue(false);
  await screen.press(screen.icon(ru.action.back));
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('while picking the back button is the labels button, and the way out of the memory is the mode’s to leave first', async () => {
  world();
  const screen = await open();
  await screen.startPicking();
  expect(
    screen.root.findAllByType(IconButton).filter((one) => one.props.label === ru.action.back),
  ).toHaveLength(0);
  expect(screen.icon(ru.gallery.labelsPut)()).toBeDefined();
  await screen.stopPicking();
  expect(screen.icon(ru.action.back)()).toBeDefined();
});
