import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Asset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  creationTime: number;
  duration: number;
};

const { router, lib, uploads } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  // The phone's library: what the grant says, what each page of the roll holds, and the two calls.
  lib: {
    access: null as null | { granted: boolean; canAskAgain: boolean; accessPrivileges?: string },
    ask: vi.fn(),
    getAssetsAsync: vi.fn(),
    presentPermissionsPickerAsync: vi.fn(),
  },
  // The queue the screen hands the material to, as far as the screen can see it.
  uploads: {
    queue: [] as unknown[],
    asking: null as string | null,
    enqueue: vi.fn(),
    drop: vi.fn(),
    wake: vi.fn(),
    answerAskAll: vi.fn(),
  },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// The account's «Даты между днями» is off, and «Ваши кадры» draws the day between its strips all the same (spec 8).
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'session', user: { id: 'me' }, datesBetweenDays: false }),
}));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ id: 'm1' }),
  useRouter: () => router,
}));
vi.mock('expo-media-library/legacy', () => ({
  usePermissions: () => [lib.access, lib.ask],
  getAssetsAsync: lib.getAssetsAsync,
  presentPermissionsPickerAsync: lib.presentPermissionsPickerAsync,
}));
vi.mock('@/lib/upload/send', () => ({
  useUploads: () => uploads.queue,
  useAskAll: () => uploads.asking,
  enqueue: uploads.enqueue,
  drop: uploads.drop,
  wake: uploads.wake,
  answerAskAll: uploads.answerAskAll,
}));
// A phone's width: under node the window is 0 × 0. The `Modal` is the plain container the setup
// makes of it, mocked again because this replaces that mock.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

import { later, memory, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import { isValidElement } from 'react';
import { FlatList, Linking, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import UploadScreen from '@/app/memory/[id]/upload';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  CardMessage,
  DayMark,
  Empty,
  FEED_GAP,
  GlassBar,
  HintNote,
  IconButton,
  RowStuck,
  Sheet,
  Text,
  Tile,
  Upload,
  Waiting,
} from '@/kit';
import { ru } from '@/strings';

/**
 * `Upload`, «Ваши кадры» (spec 8): the phone's roll drawn the way a memory's feed is, with the mode of
 * picking on from the first moment and one button to send what is marked. The queue that carries the
 * files up and the phone's library are stood in for; what is read is what the screen does with them —
 * which days it draws and in what order, what a seam and a tile mark, what «Отправить» hands over, and
 * which of the states of the layout the screen is in.
 */

mountsTrees();

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).getTime();
const asset = (id: string, when: number, over: Partial<Asset> = {}): Asset => ({
  id,
  uri: `ph://${id}`,
  filename: `IMG_${id}.HEIC`,
  mediaType: 'photo',
  creationTime: when,
  duration: 0,
  ...over,
});

/**
 * The roll, as the phone hands it over — newest first. Three frames of the 13th (one of them a
 * video), two of the 12th, and one from the 5th, which the event was not on. The memory is the 12th
 * and 13th.
 */
const roll = (): Asset[] => [
  asset('a1', at(13, 20)),
  asset('a2', at(13, 15), { mediaType: 'video', duration: 42 }),
  asset('a3', at(13, 9)),
  asset('b1', at(12, 18)),
  asset('b2', at(12, 8)),
  asset('c1', at(5, 12)),
];

beforeEach(() => {
  lib.access = { granted: true, canAskAgain: true };
  lib.ask.mockReset();
  lib.getAssetsAsync.mockReset();
  lib.getAssetsAsync.mockResolvedValue({
    assets: roll(),
    hasNextPage: false,
    endCursor: undefined,
  });
  lib.presentPermissionsPickerAsync.mockReset();
  lib.presentPermissionsPickerAsync.mockResolvedValue(undefined);
  for (const fn of [
    uploads.enqueue,
    uploads.drop,
    uploads.wake,
    uploads.answerAskAll,
    router.back,
    router.replace,
  ])
    fn.mockReset();
  router.canGoBack.mockReturnValue(true);
  uploads.queue = [];
  uploads.asking = null;
  serve((asked) => (asked.path === '/memories' ? [memory()] : undefined));
});
afterEach(() => vi.unstubAllGlobals());

/** Whether an element, drawn or not, holds these words anywhere in what it was handed. */
const carries = (node: unknown, words: string): boolean =>
  node === words ||
  (Array.isArray(node)
    ? node.some((one) => carries(one, words))
    : isValidElement(node) && carries((node.props as { children?: unknown }).children, words));

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  const draw = () => act(async () => tree.update(<UploadScreen />));
  await act(async () => {
    tree = mounted(TestRenderer.create(<UploadScreen />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const screen = {
    root,
    press,
    /** The screen drawn again — after the queue or the grant was changed under it. */
    redraw: draw,
    tile: (id: string) => () =>
      root.findAllByType(Tile).find((one) => one.props.uri === `ph://${id}`)!,
    /** Which of the marks a frame wears: `off`, `send`, or `undefined` for no circle at all. */
    mark: (id: string) =>
      root.findAllByType(Tile).find((one) => one.props.uri === `ph://${id}`)!.props.pick as
        | string
        | undefined,
    tiles: () => root.findAllByType(Tile).map((one) => String(one.props.uri).replace('ph://', '')),
    seams: () => root.findAllByType(DayMark),
    seam: (n: number) => () => root.findAllByType(DayMark)[n],
    button: (label: string) =>
      root.findAllByType(Button).filter((one) => one.props.label === label),
    icon: (label: string) =>
      root.findAllByType(IconButton).filter((one) => one.props.label === label),
    send: () => root.findAllByType(Button).find((one) => one.props.wide)!,
    text: () => JSON.stringify(tree.toJSON()),
    banners: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    // Found by the question it asks, drawn or not: the heading stands in the sheet's head (TASK-384).
    asking: () =>
      root.findAllByType(Sheet).find((one) => carries(one.props.head, ru.upload.askAll))!,
  };
  return screen;
}

test('the roll is cut into days, the event’s own days first, and every day is a seam over its frames three to a row', async () => {
  const screen = await open();
  // The 13th and the 12th, then the 5th — which is behind them though it is the oldest, being the only
  // day outside the event, and each run reads newest first.
  expect(screen.seams().map((one) => one.props.label)).toEqual([
    ru.upload.shotOn('13 сентября 2026'),
    ru.upload.shotOn('12 сентября 2026'),
    ru.upload.shotOn('5 сентября 2026'),
  ]);
  expect(screen.seams().map((one) => one.props.count)).toEqual([
    ru.memory.frames(3),
    ru.memory.frames(2),
    ru.memory.frames(1),
  ]);
  expect(screen.tiles()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'c1']);
  // A video is marked by how long it runs, and a photograph by nothing.
  expect(screen.tile('a2')().props.length).toBe('0:42');
  expect(screen.tile('a1')().props.length).toBeUndefined();
  // The plate over the roll names the memory and when it was.
  expect(lib.getAssetsAsync).toHaveBeenCalledWith(
    expect.objectContaining({ mediaType: ['photo', 'video'], sortBy: ['creationTime'] }),
  );
});

test('the mode of picking is on from the first moment, and the button is there and off until something is marked', async () => {
  const screen = await open();
  for (const id of ['a1', 'b1', 'c1']) expect(screen.mark(id)).toBe('off');
  expect(screen.icon(ru.upload.picking)[0].props.on).toBe(true);
  expect(screen.send().props.label).toBe(ru.action.send);
  expect(screen.send().props.disabled).toBe(true);
  // No line of counting over the button until there is something to count.
  expect(screen.root.findByType(ActionBar).props.above).toBeUndefined();
});

test('a tap marks a frame, and the button counts what it will send, and says how much of the roll that is', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.tile('b2'));
  expect(screen.mark('a1')).toBe('send');
  expect(screen.send().props.label).toBe(ru.upload.send(2));
  expect(screen.send().props.disabled).toBe(false);
  expect(screen.text()).toContain(ru.upload.pickedOf(2, 6));
  // The same tap again takes it back.
  await screen.press(screen.tile('a1'));
  expect(screen.mark('a1')).toBe('off');
  expect(screen.send().props.label).toBe(ru.upload.send(1));
  // «Снять» empties the whole selection at once.
  await screen.press(() => screen.button(ru.action.clear)[0]);
  expect(screen.send().props.disabled).toBe(true);
  expect(screen.mark('b2')).toBe('off');
});

test('a seam takes the whole of its day and gives it back, and never touches another day’s marks', async () => {
  const screen = await open();
  await screen.press(screen.tile('c1'));
  await screen.press(screen.seam(0));
  expect(['a1', 'a2', 'a3'].map(screen.mark)).toEqual(['send', 'send', 'send']);
  expect(screen.seam(0)().props.picked).toBe(true);
  expect(screen.seam(1)().props.picked).toBe(false);
  expect(screen.mark('c1')).toBe('send');
  await screen.press(screen.seam(0));
  expect(['a1', 'a2', 'a3'].map(screen.mark)).toEqual(['off', 'off', 'off']);
  expect(screen.seam(0)().props.picked).toBe(false);
  // The other day’s mark stayed where it was through both presses.
  expect(screen.mark('c1')).toBe('send');
});

test('a seam over a day with one frame marked completes the day instead of clearing it', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.seam(0));
  expect(['a1', 'a2', 'a3'].map(screen.mark)).toEqual(['send', 'send', 'send']);
  expect(screen.seam(0)().props.picked).toBe(true);
  // And a seam is full only when every frame of its day is marked, one short is not a full circle.
  await screen.press(screen.tile('a3'));
  expect(screen.seam(0)().props.picked).toBe(false);
});

test('the seam says how many frames it takes, so «выбрать все» is a number and not a guess', async () => {
  const screen = await open();
  expect(screen.seams().map((one) => one.props.pressLabel)).toEqual([
    ru.upload.selectDay(3),
    ru.upload.selectDay(2),
    ru.upload.selectDay(1),
  ]);
});

test('sending hands the marked frames to the queue in the order of the roll, empties the selection, and asks nothing yet', async () => {
  const screen = await open();
  // Marked in the order b1, then a2, then a1: the roll’s own order is what goes.
  await screen.press(screen.tile('b1'));
  await screen.press(screen.tile('a2'));
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.send());
  expect(uploads.enqueue).toHaveBeenCalledTimes(1);
  expect(uploads.enqueue).toHaveBeenCalledWith('m1', [
    expect.objectContaining({ id: 'a1' }),
    expect.objectContaining({ id: 'a2' }),
    expect.objectContaining({ id: 'b1' }),
  ]);
  // What was handed over is no longer marked, and the button is off again.
  expect(['a1', 'a2', 'b1'].map(screen.mark)).toEqual(['off', 'off', 'off']);
  expect(screen.send().props.disabled).toBe(true);
  // The queue still holds it, so the question about «is that all» is not up.
  expect(screen.asking().props.visible).toBe(false);
});

test('once everything this visit sent is in and the queue is asking, the sheet counts it and puts the two answers side by side', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.tile('a3'));
  await screen.press(() => screen.send());
  // The queue is still working: nothing is asked while anything of this memory is left in it.
  uploads.asking = 'm1';
  uploads.queue = [
    {
      assetId: 'a1',
      memoryId: 'm1',
      filename: 'IMG_a1.HEIC',
      kind: 'photo',
      capturedAt: null,
      durationSeconds: null,
      parts: {},
    },
  ];
  await screen.redraw();
  expect(screen.asking().props.visible).toBe(false);
  uploads.queue = [];
  await screen.redraw();
  expect(screen.asking().props.visible).toBe(true);
  expect(screen.text()).toContain(ru.upload.sentToMemory(2));
  // TASK-384 (R8), `SheetAskAll.json`: «Это всё?» at 79, 26 tall, and its paragraph at 113 — one
  // block, 8 apart, where the sheet's own gap had put it 18 under; the paragraph 15 / 22, two lines
  // and not three at 16 / 23; the line of what went 14 / 600.
  const said = (words: string) =>
    screen
      .asking()
      .findAllByType(Text)
      .find((one) => one.props.children === words)!;
  const question = said(ru.upload.askAll);
  const paragraph = said(ru.upload.askAllText);
  expect(question.props.role).toBe('sheetTitle');
  expect(paragraph.props.role).toBe('bodySm');
  expect(said(ru.upload.sentToMemory(2)).props.role).toBe('rowSm');
  let block = paragraph.parent;
  while (block && StyleSheet.flatten(block.props.style)?.gap === undefined) block = block.parent;
  expect(block?.findAllByType(Text)).toContain(question);
  expect(StyleSheet.flatten(block?.props.style)).toMatchObject({ gap: 113 - (79 + 26) });
  const answers = screen.asking().findAllByType(Button);
  expect(answers.map((one) => one.props.label)).toEqual([ru.upload.thatsAll, ru.upload.moreToCome]);
  await act(async () => answers[0].props.onPress());
  expect(uploads.answerAskAll).toHaveBeenLastCalledWith('done');
  await act(async () => answers[1].props.onPress());
  expect(uploads.answerAskAll).toHaveBeenLastCalledWith('more_coming');
  // A tap beside the sheet is no answer at all, and sets no standing.
  await act(async () => screen.asking().props.onCancel());
  expect(uploads.answerAskAll).toHaveBeenLastCalledWith(null);
});

test('the question is not asked on a visit that sent nothing, nor about a different memory', async () => {
  const screen = await open();
  uploads.asking = 'm1';
  await screen.redraw();
  expect(screen.asking().props.visible).toBe(false);
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.send());
  uploads.asking = 'other';
  await screen.redraw();
  expect(screen.asking().props.visible).toBe(false);
});

test('while the roll is still coming a seam does not answer, and the count is of the marks alone', async () => {
  const second = later<unknown>();
  lib.getAssetsAsync
    .mockResolvedValueOnce({ assets: roll().slice(0, 3), hasNextPage: true, endCursor: 'next' })
    .mockReturnValueOnce(second.promise);
  const screen = await open();
  expect(screen.tiles()).toEqual(['a1', 'a2', 'a3']);
  expect(screen.seam(0)().props.onPress).toBeUndefined();
  expect(screen.text()).toContain(ru.upload.reading);
  await screen.press(screen.tile('a1'));
  expect(screen.text()).toContain(ru.upload.picked(1));
  expect(screen.text()).not.toContain(ru.upload.pickedOf(1, 3));
  // The second page comes: the seams answer, and the whole roll is what the count is against.
  await act(async () =>
    second.settle({ assets: roll().slice(3), hasNextPage: false, endCursor: undefined }),
  );
  expect(lib.getAssetsAsync).toHaveBeenLastCalledWith(expect.objectContaining({ after: 'next' }));
  expect(screen.tiles()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'c1']);
  expect(screen.seam(0)().props.onPress).toBeDefined();
  expect(screen.text()).toContain(ru.upload.pickedOf(1, 6));
  expect(screen.text()).not.toContain(ru.upload.reading);
});

test('a partial grant shows only what was handed over: a seam is a caption, each day says the rest is unseen, and «Отдать ещё» reads the roll again', async () => {
  lib.access = { granted: true, canAskAgain: true, accessPrivileges: 'limited' };
  const screen = await open();
  expect(screen.seams().every((one) => one.props.limited === true)).toBe(true);
  expect(screen.seams().every((one) => one.props.onPress === undefined)).toBe(true);
  expect(screen.text().split(ru.upload.restUnseen)).toHaveLength(4);
  expect(screen.root.findAllByType(HintNote)).toHaveLength(1);
  // Tapping a frame still marks it: it is the day that cannot be taken whole.
  await screen.press(screen.tile('a1'));
  expect(screen.mark('a1')).toBe('send');

  const before = lib.getAssetsAsync.mock.calls.length;
  await screen.press(() => screen.button(ru.upload.chooseMore)[0]);
  expect(lib.presentPermissionsPickerAsync).toHaveBeenCalledWith(['photo', 'video']);
  expect(lib.getAssetsAsync.mock.calls.length).toBeGreaterThan(before);
});

test('with the mode off the circles go, a tap opens the frame as it was shot, and the seams and the button go with it', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.icon(ru.upload.picking)[0]);
  for (const id of ['a1', 'b1', 'c1']) expect(screen.mark(id)).toBeUndefined();
  expect(screen.seams().every((one) => one.props.onPress === undefined)).toBe(true);
  expect(screen.root.findAllByType(ActionBar)).toHaveLength(0);
  const opened = () =>
    screen.root.findAllByType(Image).filter((one) => one.props.contentFit === 'contain');
  expect(opened()).toHaveLength(0);
  await screen.press(screen.tile('a2'));
  expect(opened().map((one) => one.props.source.uri)).toEqual(['ph://a2']);
  expect(opened()[0].props.accessibilityLabel).toBe(`${ru.media.video} IMG_a2.HEIC`);
  await screen.press(() => screen.icon(ru.action.close)[0]);
  expect(opened()).toHaveLength(0);
  // And on again: the circles are back, and looking at a frame did not throw away what was marked —
  // two hundred taps are not lost to a peek at one photograph.
  await screen.press(() => screen.icon(ru.upload.picking)[0]);
  expect(screen.mark('a1')).toBe('send');
});

test('a roll that is empty is the dashed sign and nothing to send with', async () => {
  lib.getAssetsAsync.mockResolvedValue({ assets: [], hasNextPage: false, endCursor: undefined });
  const screen = await open();
  expect(screen.root.findAllByType(Empty)).toHaveLength(1);
  expect(screen.root.findByType(Empty).props.title).toBe(ru.upload.emptyTitle);
  expect(screen.root.findAllByType(ActionBar)).toHaveLength(0);
});

test('a phone that has not been asked yet says it is checking, and one that may still be asked has a button that asks', async () => {
  lib.access = null;
  let screen = await open();
  expect(screen.root.findAllByType(Waiting)).toHaveLength(1);
  expect(lib.getAssetsAsync).not.toHaveBeenCalled();
  // The wait stands in the middle of the body, which grows to it and is never `flex: 1`: a body that
  // is a scroll gives a block that fills it no height at all, and the block comes out of the scroll.
  let holder = screen.root.findByType(Waiting).parent;
  while (holder && !StyleSheet.flatten(holder.props.style)?.justifyContent) holder = holder.parent;
  expect(StyleSheet.flatten(holder?.props.style)).toMatchObject({ flexGrow: 1 });
  expect(StyleSheet.flatten(holder?.props.style).flex).toBeUndefined();

  lib.access = { granted: false, canAskAgain: true };
  screen = await open();
  expect(screen.root.findByType(CardMessage).props.text).toBe(ru.upload.explain);
  await screen.press(() => screen.button(ru.upload.allow)[0]);
  expect(lib.ask).toHaveBeenCalledTimes(1);
  expect(lib.getAssetsAsync).not.toHaveBeenCalled();
});

test('a phone that has stopped asking sends the person to its settings, and reads nothing', async () => {
  const openSettings = vi.fn();
  (Linking as unknown as { openSettings: () => void }).openSettings = openSettings;
  lib.access = { granted: false, canAskAgain: false };
  const screen = await open();
  expect(screen.root.findByType(CardMessage).props.text).toBe(ru.upload.refused);
  await screen.press(() => screen.button(ru.action.openSettings)[0]);
  expect(openSettings).toHaveBeenCalledTimes(1);
  expect(lib.ask).not.toHaveBeenCalled();
});

test('a gallery that will not open is said in the phone’s words, and «Повторить» reads it again', async () => {
  lib.getAssetsAsync.mockRejectedValueOnce(new Error('boom'));
  const screen = await open();
  expect(screen.root.findByType(CardMessage).props.text).toBe(ru.upload.cannotRead);
  expect(screen.root.findAllByType(Tile)).toHaveLength(0);
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(screen.tiles()).toHaveLength(6);
  expect(screen.root.findAllByType(CardMessage)).toHaveLength(0);
});

test('an api that cannot be reached costs only the event window: the roll is cut all the same, and picking carries on', async () => {
  serve(() => 'offline');
  const screen = await open();
  expect(screen.banners()).toEqual([ru.error.offline]);
  // No event to lift to the top, so the roll is in its own order — newest day first.
  expect(screen.seams().map((one) => one.props.label)).toEqual([
    ru.upload.shotOn('13 сентября 2026'),
    ru.upload.shotOn('12 сентября 2026'),
    ru.upload.shotOn('5 сентября 2026'),
  ]);
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.send());
  expect(uploads.enqueue).toHaveBeenCalledWith('m1', [expect.objectContaining({ id: 'a1' })]);
});

test('the event’s days lead the roll even when they are the oldest in it', async () => {
  // The same roll with the event on the 5th instead: that day comes first though it is the oldest.
  serve((asked) =>
    asked.path === '/memories'
      ? [memory({ event_start: new Date(2026, 8, 5).toISOString(), event_end: null })]
      : undefined,
  );
  const screen = await open();
  expect(screen.seams().map((one) => one.props.label)[0]).toBe(ru.upload.shotOn('5 сентября 2026'));
});

test('a queue with something in it says how much is left, and the parked files are named with their reasons and can be let go of', async () => {
  uploads.queue = [
    {
      assetId: 'a1',
      memoryId: 'm1',
      filename: 'IMG_a1.HEIC',
      kind: 'photo',
      capturedAt: null,
      durationSeconds: null,
      size: 100,
      partSize: 50,
      parts: { 1: 'e' },
    },
    {
      assetId: 'b1',
      memoryId: 'm1',
      filename: 'IMG_b1.HEIC',
      kind: 'photo',
      capturedAt: null,
      durationSeconds: null,
      parts: {},
      error: { reason: 'offline' },
    },
    // Somebody else’s memory in the same queue is not this screen’s business.
    {
      assetId: 'z9',
      memoryId: 'other',
      filename: 'IMG_z9.HEIC',
      kind: 'photo',
      capturedAt: null,
      durationSeconds: null,
      parts: {},
      error: { reason: 'gone' },
    },
  ];
  const screen = await open();
  const bar = screen.root.findByType(Upload);
  // Two of this memory’s: one going up, one parked. The bar stands at what the one going up has sent.
  expect(bar.props.meta).toBe(ru.upload.stillToSend(2));
  expect(bar.props.value).toBe(0.5);
  const stuck = screen.root.findAllByType(RowStuck);
  expect(stuck).toHaveLength(1);
  expect(stuck[0].props.name).toBe('IMG_b1.HEIC');
  expect(stuck[0].props.reason).toBe(ru.error.offline);
  await act(async () => stuck[0].findByType(IconButton).props.onPress());
  expect(uploads.drop).toHaveBeenCalledWith('m1', 'b1');
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(uploads.wake).toHaveBeenCalledTimes(1);
});

test('the way out is the back it arrived on, or the list when there is none', async () => {
  const screen = await open();
  await screen.press(() => screen.icon(ru.action.back)[0]);
  expect(router.back).toHaveBeenCalledTimes(1);
  router.canGoBack.mockReturnValue(false);
  await screen.press(() => screen.icon(ru.action.back)[0]);
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('a day is cut into strips of three, whatever the day holds, and every frame stands in exactly one', async () => {
  const day = Array.from({ length: 7 }, (_, i) => asset(`s${i}`, at(13, 8 + i)));
  lib.getAssetsAsync.mockResolvedValue({ assets: day, hasNextPage: false, endCursor: undefined });
  const screen = await open();
  const rows = screen.root.findByType(FlatList).props.data as {
    key: string;
    frames?: { id: string }[];
    day?: unknown;
  }[];
  expect(rows.filter((one) => one.frames).map((one) => one.frames!.map((f) => f.id))).toEqual([
    ['s0', 's1', 's2'],
    ['s3', 's4', 's5'],
    ['s6'],
  ]);
  // A key for every row, and none the same: a list with two rows under one key drops one of them.
  expect(new Set(rows.map((one) => one.key)).size).toBe(rows.length);
  // And each tile is a third of the width, less the two gutters between them.
  expect(screen.tile('s0')().props.style).toEqual({ width: (390 - FEED_GAP * 2) / 3 });
});

test('until the first page comes the roll is being read: one line saying so, no empty sign, and no seam to press', async () => {
  const first = later<unknown>();
  lib.getAssetsAsync.mockReturnValue(first.promise);
  const screen = await open();
  expect(screen.root.findAllByType(Waiting)).toHaveLength(1);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);
  expect(screen.text().split(ru.upload.reading)).toHaveLength(2);
  await act(async () => first.settle({ assets: roll(), hasNextPage: false, endCursor: undefined }));
  expect(screen.root.findAllByType(Waiting)).toHaveLength(0);
  expect(screen.tiles()).toHaveLength(6);
});

test('a page that lands after the roll was read again is not added to it', async () => {
  lib.access = { granted: true, canAskAgain: true, accessPrivileges: 'limited' };
  const stale = later<unknown>();
  lib.getAssetsAsync.mockReturnValueOnce(stale.promise).mockResolvedValue({
    assets: [asset('fresh', at(13, 12))],
    hasNextPage: false,
    endCursor: undefined,
  });
  const screen = await open();
  // The wider grant is chosen while the first read is still in the air, and the roll is read from the top.
  await screen.press(() => screen.button(ru.upload.chooseMore)[0]);
  expect(screen.tiles()).toEqual(['fresh']);
  await act(async () =>
    stale.settle({ assets: [asset('old', at(13, 9))], hasNextPage: false, endCursor: undefined }),
  );
  expect(screen.tiles()).toEqual(['fresh']);
});

test('one file sent is enough to ask whether that is all, and a partial grant’s button is a small one', async () => {
  lib.access = { granted: true, canAskAgain: true, accessPrivileges: 'limited' };
  const screen = await open();
  expect(screen.button(ru.upload.chooseMore)[0].props.wide).toBe(false);
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.send());
  uploads.asking = 'm1';
  await screen.redraw();
  expect(screen.asking().props.visible).toBe(true);
  expect(screen.text()).toContain(ru.upload.sentToMemory(1));
});

test('the block of sending is there only while this memory has something in the queue, and stands at nought when everything of it is parked', async () => {
  const one = {
    assetId: 'a1',
    memoryId: 'm1',
    filename: 'IMG_a1.HEIC',
    kind: 'photo',
    capturedAt: null,
    durationSeconds: null,
    parts: {},
  };
  const screen = await open();
  expect(screen.root.findAllByType(Upload)).toHaveLength(0);
  expect(screen.root.findAllByType(RowStuck)).toHaveLength(0);
  uploads.queue = [one];
  await screen.redraw();
  expect(screen.root.findAllByType(Upload)).toHaveLength(1);
  expect(screen.root.findByType(Upload).props.meta).toBe(ru.upload.stillToSend(1));
  expect(screen.root.findByType(Upload).props.value).toBe(0);
  // Everything of it parked: the bar has nothing going up to stand at, and the parked file shows its own picture.
  uploads.queue = [
    { ...one, assetId: 'b1', filename: 'IMG_b1.HEIC', error: { reason: 'offline' } },
  ];
  await screen.redraw();
  expect(screen.root.findByType(Upload).props.value).toBe(0);
  expect(screen.root.findByType(RowStuck).props.uri).toBe('ph://b1');
  // A file the phone no longer has is not in the roll, and the row draws a glyph square instead.
  uploads.queue = [
    { ...one, assetId: 'gone', filename: 'IMG_gone.HEIC', error: { reason: 'gone' } },
  ];
  await screen.redraw();
  expect(screen.root.findByType(RowStuck).props.uri).toBeUndefined();
  expect(screen.root.findByType(RowStuck).props.reason).toBe(ru.upload.gone('IMG_gone.HEIC'));
});

test('the plate over the roll names the memory and says when it was — and without a memory, or a day that will not read, says less and never a dot alone', async () => {
  const screen = await open();
  expect(screen.root.findByType(GlassBar).props.meta).toBe(ru.upload.into('Свадьба Лизы и Марка'));
  expect(screen.root.findByType(GlassBar).props.capsuleLabel).toBe(
    `${ru.upload.title}, ${ru.upload.into('Свадьба Лизы и Марка')}`,
  );

  // With the roll empty the plain bar takes over, and names the memory and its days under the heading.
  lib.getAssetsAsync.mockResolvedValue({ assets: [], hasNextPage: false, endCursor: undefined });
  const plain = await open();
  expect(plain.root.findByType(AppBar).props.subtitle).toBe(
    'Свадьба Лизы и Марка · 12–13 сентября',
  );
  vi.unstubAllGlobals();
  serve((asked) =>
    asked.path === '/memories'
      ? [memory({ event_start: 'not a day', event_end: null })]
      : undefined,
  );
  const unreadable = await open();
  expect(unreadable.root.findByType(AppBar).props.subtitle).toBe('Свадьба Лизы и Марка');
  vi.unstubAllGlobals();
  serve(() => 'offline');
  const unknown = await open();
  expect(unknown.root.findByType(AppBar).props.subtitle).toBeUndefined();
});
