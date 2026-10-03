import { Image } from 'expo-image';
import { reverseGeocodeAsync } from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, downloads, ask, player, turns, platform, phone } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), setParams: vi.fn() },
  downloads: { maySaveToPhone: vi.fn(), saveToPhone: vi.fn(), shareFile: vi.fn() },
  ask: { id: 'me' },
  // The one player of the window, a bag of the few things it is read for and told to do.
  player: {
    play: vi.fn(),
    pause: vi.fn(),
    currentTime: 0,
    duration: 0,
    playing: false,
    muted: false,
    timeUpdateEventInterval: 0,
  },
  // What the window asks of the orientation lock, and which platform it thinks it is on.
  turns: vi.fn(),
  platform: { os: 'android' as 'android' | 'ios' },
  // The phone's own screen, standing at first — a test that wants the other three turns it
  // (TASK-475). Not `screen`: that name is this file's own word for the open window.
  phone: { width: 390, height: 844, scale: 3, fontScale: 1 },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: ask.id } }) }));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useRouter: () => router }));
// The phone's geocoder: what the sheet asks it for is the point of some of these tests.
vi.mock('expo-location', () => ({ reverseGeocodeAsync: vi.fn() }));
// Native modules the window stands on. A player that is only a bag of the few things it is read for,
// and a view that draws nothing: what a video *looks* like is the phone's.
vi.mock('expo', () => ({ useEvent: () => undefined }));
vi.mock('expo-video', () => ({
  // Made the way the hook makes it: the source it was handed, and the setup run once over the player.
  useVideoPlayer: vi.fn((_source: unknown, setup?: (p: typeof player) => void) => {
    setup?.(player);
    return player;
  }),
  VideoView: () => null,
}));
vi.mock('@/lib/orientation', () => ({ useTurnsWithPhone: turns }));
// The window raises a film differently on iOS, where a modal raised over another one is swallowed.
// And the screen's own size, which is how the window knows which way up the phone is (TASK-475) —
// the four `Viewer*` layouts are told apart by nothing else.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Platform: new Proxy(rn.Platform, {
      get: (target, key) => (key === 'OS' ? platform.os : Reflect.get(target, key)),
    }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
    useWindowDimensions: () => phone,
  };
});
vi.mock('@/lib/downloads', () => downloads);

import { expectReachable, targets } from '@tests/helpers/access';
import { type Asked, later, member, memory, photo, refused, serve } from '@tests/helpers/api';
import { touch } from '@tests/helpers/gesture';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { sheetBox } from '@tests/helpers/sheet';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import type { FrameInfo, MediaItem, Member } from '@/api';
import {
  ActionMenu,
  Banner,
  ConfirmSheet,
  Empty,
  Filmstrip,
  Icon,
  IconButton,
  RowAction,
  RowFilmAt,
  RowSummary,
  VideoTrack,
  ViewerBar,
} from '@/kit';
import { setLanguage } from '@/lib/language';
import { FrameViewer, frameBox } from '@/screens/memory/frame-viewer';
import { FrameInfoSheet } from '@/screens/memory/frames-sheets';
import { ru, strings } from '@/strings';

/**
 * `Viewer` (spec 8, «Просмотр медиа») — one frame on the whole of the phone: the three glass buttons,
 * the menu the «⋯» drops, the sheet of what the frame is, and the strip. The window is handed the
 * material and the two answers only the feed can give (`mayDelete`, `nameOf`), so what is read here
 * is what it does with them: who is shown a delete, what one press sends, what the sheet says, and
 * which answer of which read it will let in.
 */

mountsTrees();

const geocode = vi.mocked(reverseGeocodeAsync);

beforeEach(() => {
  ask.id = 'me';
  platform.os = 'android';
  Object.assign(player, {
    currentTime: 0,
    duration: 0,
    playing: false,
    muted: false,
    timeUpdateEventInterval: 0,
  });
  for (const fn of [
    router.push,
    router.back,
    router.setParams,
    turns,
    player.play,
    player.pause,
    ...Object.values(downloads),
    geocode,
  ])
    fn.mockReset();
  downloads.maySaveToPhone.mockResolvedValue(true);
  downloads.saveToPhone.mockResolvedValue(undefined);
  downloads.shareFile.mockResolvedValue(undefined);
  geocode.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).toISOString();
const shots = (): MediaItem[] => [
  photo('a', 'liza', at(13, 21), {
    thumbnail_url: 'https://r2.example/a',
    preview_url: 'https://r2.example/a-big',
  }),
  photo('b', 'me', at(13, 9)),
  { ...photo('c', 'me', at(12, 9)), status: 'processing', thumbnail_url: null },
  photo('d', 'me', at(11, 9)),
];
const roster: Member[] = [
  member('me', 'organizer', { name: 'Я' }),
  member('liza', 'contributor', { name: 'Марк Ковалёв' }),
];

const told = (over: Partial<FrameInfo> = {}): FrameInfo => ({
  id: 'a',
  file_name: 'IMG_4471.HEIC',
  size_bytes: '4200000',
  captured_at: at(13, 21),
  created_at: at(15, 9),
  width: 4032,
  height: 3024,
  camera_model: 'iPhone 15 Pro',
  focal_length_mm: 24,
  aperture: 1.8,
  latitude: null,
  longitude: null,
  uploaded_by: { id: 'liza', username: 'liza', name: 'Марк Ковалёв', media_count: 96 },
  montages: [],
  labels: [],
  ...over,
});

type Props = Partial<React.ComponentProps<typeof FrameViewer>>;

const props = (over: Props = {}): React.ComponentProps<typeof FrameViewer> => ({
  memoryId: 'm1',
  item: shots()[0],
  frames: shots(),
  roster,
  memory: memory({ title: 'Свадьба Лизы и Марка' }),
  mayDelete: (one) => one.uploaded_by === ask.id || ask.id === 'me',
  nameOf: (one, _frame, current) => `${one.id}${current ? ':open' : ''}`,
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onRemoved: vi.fn(),
  ...over,
});

async function open(over: Props = {}) {
  const shown = props(over);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<FrameViewer {...shown} />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const screen = {
    root,
    shown,
    press,
    /** Re-rendered with another record, the way the feed hands the window the next frame. */
    show: (next: Props) => act(async () => tree.update(<FrameViewer {...{ ...shown, ...next }} />)),
    pill: () => root.findByType(ViewerBar),
    bar: () =>
      root.findByType(ViewerBar).props as { date: string; meta: string; onPress: () => void },
    icon: (label: string) => () =>
      root.findAllByType(IconButton).find((one) => one.props.label === label)!,
    row: (label: string) =>
      root.findAllByType(RowAction).filter((one) => one.props.label === label),
    menu: () => press(screen.icon(ru.viewer.more)),
    info: () => root.findByType(FrameInfoSheet),
    confirm: () => root.findByType(ConfirmSheet),
    notices: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    facts: () =>
      root
        .findByType(FrameInfoSheet)
        .findAllByType(RowSummary)
        .map((one) => [one.props.label, one.props.value]),
  };
  return screen;
}

const patches = (log: Asked[], method: string) => log.filter((one) => one.method === method);

test('the pill over the frame is who and when: the day of the shot without its year, the clock and the name', async () => {
  serve(() => undefined);
  const screen = await open();
  expect(screen.bar().date).toBe('13 сентября');
  expect(screen.bar().meta).toBe(
    `${new Date(at(13, 21)).toLocaleTimeString('ru', { hour: 'numeric', minute: '2-digit' })} · Марк Ковалёв`,
  );
  // A frame from somebody who has since left the memory is by «кто-то», never blank.
  await screen.show({ item: { ...shots()[0], uploaded_by: 'gone' } });
  expect(screen.bar().meta).toContain(ru.memory.someone);
});

test('the menu is share, save, and a red delete that only somebody who may delete is shown', async () => {
  serve(() => undefined);
  const screen = await open();
  expect(screen.row(ru.viewer.remove)).toHaveLength(0);
  await screen.menu();
  expect(screen.row(ru.action.share)).toHaveLength(1);
  expect(screen.row(ru.viewer.saveToPhone)).toHaveLength(1);
  expect(screen.row(ru.viewer.remove)).toHaveLength(1);
  expect(screen.row(ru.viewer.remove)[0].props.danger).toBe(true);

  // Somebody else's frame, and not the organizer: nothing greyed, nothing there at all.
  ask.id = 'vera';
  const viewer = await open({ mayDelete: (one) => one.uploaded_by === 'vera' });
  await viewer.menu();
  expect(viewer.row(ru.viewer.remove)).toHaveLength(0);
  expect(viewer.row(ru.action.share)).toHaveLength(1);
  expect(viewer.row(ru.viewer.saveToPhone)).toHaveLength(1);
});

test('the «⋯» stays lit while its menu is out, every errand puts the menu away, and a tap beside it does too', async () => {
  serve(() => ({ url: 'https://r2.example/original' }));
  const screen = await open();
  const more = () => screen.icon(ru.viewer.more)();
  const shown = () => screen.root.findByType(ActionMenu).props.visible as boolean;
  expect(shown()).toBe(false);
  expect(more().props.style).toBeNull();
  await screen.menu();
  expect(shown()).toBe(true);
  expect(more().props.style).not.toBeNull();
  await act(async () => screen.root.findByType(ActionMenu).props.onCancel());
  expect(shown()).toBe(false);
  expect(more().props.style).toBeNull();
  for (const label of [ru.action.share, ru.viewer.saveToPhone, ru.viewer.remove]) {
    await screen.menu();
    await screen.press(() => screen.row(label)[0]);
    expect(shown(), label).toBe(false);
    if (label === ru.viewer.remove) await act(async () => screen.confirm().props.onCancel());
  }
});

test('the close button closes the window, and while an errand is running the «⋯» waits', async () => {
  const slow = later<unknown>();
  serve(() => slow.promise);
  const screen = await open();
  await screen.press(screen.icon(ru.action.close));
  expect(screen.shown.onClose).toHaveBeenCalledTimes(1);
  await screen.menu();
  await act(async () => void screen.row(ru.action.share)[0].props.onPress());
  expect(screen.icon(ru.viewer.more)().props.disabled).toBe(true);
  expect(screen.notices()).toEqual([ru.viewer.sharing]);
  await act(async () => slow.settle({ url: 'https://r2.example/original' }));
  expect(screen.icon(ru.viewer.more)().props.disabled).toBe(false);
  expect(screen.notices()).toEqual([]);
});

test('the delete asks first, on a sheet that names the frame, and only the confirm sends it', async () => {
  const log = serve((asked) => (asked.method === 'DELETE' ? { ok: true } : undefined));
  const screen = await open();
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.remove)[0]);
  expect(screen.confirm().props.visible).toBe(true);
  expect(screen.confirm().props.title).toBe(ru.gallery.deleteAsk('photo'));
  expect(screen.confirm().props.meta).toContain('Марк Ковалёв');
  // Spec 4, `SheetConfirmDelete`: 380 with 18 between blocks, the frame's picture beside the question.
  expect(sheetBox(screen.confirm())).toEqual({ gap: 18, minHeight: 380 });
  expect(patches(log, 'DELETE')).toEqual([]);
  await act(async () => screen.confirm().props.onCancel());
  expect(screen.confirm().props.visible).toBe(false);
  expect(screen.shown.onRemoved).not.toHaveBeenCalled();

  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.remove)[0]);
  await act(async () => screen.confirm().props.onConfirm());
  expect(patches(log, 'DELETE')).toEqual([
    { method: 'DELETE', path: '/memories/m1/media/a', body: null },
  ]);
  expect(screen.shown.onRemoved).toHaveBeenCalledWith('a');
});

test('a frame somebody else has already deleted is gone all the same; any other refusal stays on the screen with its reason', async () => {
  for (const [answer, gone, said] of [
    [refused(404), true, undefined],
    [refused(403), false, ru.gallery.deleteDenied],
    [refused(500, 'boom'), false, 'boom'],
    ['offline', false, ru.error.offline],
  ] as const) {
    serve(() => answer);
    const screen = await open();
    await screen.menu();
    await screen.press(() => screen.row(ru.viewer.remove)[0]);
    await act(async () => screen.confirm().props.onConfirm());
    expect(screen.shown.onRemoved, String(said)).toHaveBeenCalledTimes(gone ? 1 : 0);
    expect(screen.notices(), String(said)).toEqual(said === undefined ? [] : [said]);
    vi.unstubAllGlobals();
  }
});

test('saving asks the phone for the one grant, then signs the original and keeps it — and without the grant it says so and asks the api for nothing', async () => {
  const log = serve((asked) =>
    asked.path.endsWith('/download') ? { url: 'https://r2.example/original' } : undefined,
  );
  downloads.maySaveToPhone.mockResolvedValue(false);
  const screen = await open();
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.saveToPhone)[0]);
  expect(screen.notices()).toEqual([ru.error.galleryRefused]);
  expect(log).toEqual([]);

  downloads.maySaveToPhone.mockResolvedValue(true);
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.saveToPhone)[0]);
  expect(log.map((one) => one.path)).toEqual(['/memories/m1/media/a/download']);
  expect(downloads.saveToPhone).toHaveBeenCalledWith({
    id: 'a',
    kind: 'photo',
    url: 'https://r2.example/original',
  });
  expect(screen.notices()).toEqual([ru.save.done]);
});

test('a save the phone could not finish is said in the window’s words and the api’s own refusal in the api’s', async () => {
  serve(() => ({ url: 'https://r2.example/original' }));
  downloads.saveToPhone.mockRejectedValue(new Error('disk full'));
  const screen = await open();
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.saveToPhone)[0]);
  expect(screen.notices()).toEqual([ru.save.failedOne]);
  vi.unstubAllGlobals();

  serve(() => refused(404, 'still uploading'));
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.saveToPhone)[0]);
  expect(screen.notices()).toEqual(['still uploading']);
});

test('sharing hands the phone’s own sheet a copy of the original, and says nothing after it', async () => {
  serve(() => ({ url: 'https://r2.example/original' }));
  const screen = await open();
  await screen.menu();
  await screen.press(() => screen.row(ru.action.share)[0]);
  expect(downloads.shareFile).toHaveBeenCalledWith({
    id: 'a',
    kind: 'photo',
    url: 'https://r2.example/original',
  });
  expect(screen.notices()).toEqual([]);
  // Nothing is written to the gallery by sharing, and nothing asks for that permission.
  expect(downloads.maySaveToPhone).not.toHaveBeenCalled();
  expect(downloads.saveToPhone).not.toHaveBeenCalled();
});

test('a share that fell over is the api’s word when it was the api, and the window’s own when it was the phone', async () => {
  serve(() => refused(403, 'not yours'));
  const screen = await open();
  await screen.menu();
  await screen.press(() => screen.row(ru.action.share)[0]);
  expect(screen.notices()).toEqual(['not yours']);
  expect(downloads.shareFile).not.toHaveBeenCalled();
  vi.unstubAllGlobals();

  serve(() => ({ url: 'https://r2.example/original' }));
  downloads.shareFile.mockRejectedValue(new Error('no sheet'));
  await screen.menu();
  await screen.press(() => screen.row(ru.action.share)[0]);
  expect(screen.notices()).toEqual([ru.viewer.shareFailed]);
});

test('the pill raises the frame’s sheet, and the read behind it fills the four lines the server knows', async () => {
  const log = serve((asked) =>
    asked.path === '/memories/m1/media/a' ? told({ latitude: 1.234, longitude: 5.678 }) : undefined,
  );
  const screen = await open();
  expect(screen.info().props.visible).toBe(false);
  expect(log).toEqual([]);
  await screen.press(screen.pill);
  expect(screen.info().props.visible).toBe(true);
  expect(screen.info().props.title).toBe(
    `13 сентября, ${new Date(at(13, 21)).toLocaleTimeString('ru', { hour: 'numeric', minute: '2-digit' })}`,
  );
  expect(screen.info().props.meta).toBe('воскресенье · Свадьба Лизы и Марка');
  expect(screen.facts()).toEqual([
    [ru.viewer.file, 'IMG_4471.HEIC · 4,2 МБ'],
    [ru.viewer.pixels, '4032 × 3024'],
    [ru.viewer.camera, 'iPhone 15 Pro · 24 мм · f/1.8'],
    // The geocoder named nothing, so the point stands as the numbers it is.
    [ru.viewer.place, ru.viewer.coords(1.234, 5.678)],
  ]);
  expect(log.map((one) => one.path)).toEqual(['/memories/m1/media/a']);
});

test('the place is the name the phone gave the point, once it has; the numbers until then', async () => {
  serve(() => told({ latitude: 55.1, longitude: 37.1 }));
  const answer = later<unknown>();
  geocode.mockReturnValueOnce(answer.promise as never);
  const screen = await open();
  await screen.press(screen.pill);
  expect(screen.facts().at(-1)).toEqual([ru.viewer.place, ru.viewer.coords(55.1, 37.1)]);
  await act(async () => answer.settle([{ name: 'Усадьба «Остафьево»', city: 'Москва' }]));
  expect(screen.facts().at(-1)).toEqual([ru.viewer.place, 'Усадьба «Остафьево», Москва']);
});

test('a frame with no point has no place line, whatever the geocoder would say', async () => {
  serve(() => told({ latitude: null, longitude: null }));
  geocode.mockResolvedValue([{ city: 'Москва' }] as never);
  const screen = await open();
  await screen.press(screen.pill);
  expect(screen.facts().map(([label]) => label)).not.toContain(ru.viewer.place);
  expect(geocode).not.toHaveBeenCalled();
});

test('a frame the worker never read has none of its lines, and the sheet is the head and the person', async () => {
  serve(() =>
    told({
      file_name: undefined,
      size_bytes: '0',
      width: null,
      height: null,
      camera_model: null,
      focal_length_mm: null,
      aperture: null,
      latitude: null,
      longitude: null,
      montages: [],
      labels: [],
    }),
  );
  const screen = await open();
  await screen.press(screen.pill);
  expect(screen.facts()).toEqual([]);
  expect(screen.info().findAllByType(RowFilmAt)).toHaveLength(0);
});

test('a film the frame stands in is a row, and pressing it shuts the window and asks the memory for that film', async () => {
  serve(() => told({ montages: [{ id: 'f1', duration_seconds: 60, start_seconds: 72 }] }));
  const screen = await open();
  await screen.press(screen.pill);
  const rows = screen.info().findAllByType(RowFilmAt);
  expect(rows).toHaveLength(1);
  expect(rows[0].props.title).toBe(ru.montage.ofLength('1:00'));
  expect(rows[0].props.at).toBe(ru.viewer.at('1:12'));
  await act(async () => rows[0].props.onPress());
  // The window goes first and the film is asked for on the memory's own screen (on Android at once).
  expect(screen.shown.onClose).toHaveBeenCalledTimes(1);
  expect(router.setParams).toHaveBeenCalledWith({ montage: 'f1' });
});

test('a read that fails is the api’s word in the sheet, and the head is still there', async () => {
  serve(() => refused(500, 'boom'));
  const screen = await open();
  await screen.press(screen.pill);
  expect(screen.info().props.error).toBe('boom');
  expect(screen.info().props.info).toBeNull();
  expect(screen.info().props.title).toContain('13 сентября');
});

test('an answer to an earlier opening never lands in the sheet of a later one — the frame before, or its failure', async () => {
  const first = later<unknown>();
  const second = later<unknown>();
  const queue = [first, second];
  serve(() => queue.shift()!.promise);
  const screen = await open();
  // Opened on frame «a», shut before it answers, then the strip is walked and «b» is opened.
  await screen.press(screen.pill);
  await act(async () => screen.info().props.onClose());
  await screen.show({ item: shots()[1] });
  await screen.press(screen.pill);

  await act(async () =>
    second.settle(told({ id: 'b', file_name: 'B.JPG', size_bytes: '1000000' })),
  );
  expect(screen.facts()[0]).toEqual([ru.viewer.file, 'B.JPG · 1 МБ']);
  // The first read comes in late with the frame before it, and is not let in.
  await act(async () => first.settle(told({ id: 'a', file_name: 'A.JPG' })));
  expect(screen.facts()[0]).toEqual([ru.viewer.file, 'B.JPG · 1 МБ']);
  expect(screen.info().props.error).toBeNull();
});

test('nor does the failure of the first read lay itself over the details the second one brought', async () => {
  const first = later<unknown>();
  const second = later<unknown>();
  const queue = [first, second];
  serve(() => queue.shift()!.promise);
  const screen = await open();
  await screen.press(screen.pill);
  await act(async () => screen.info().props.onClose());
  await screen.press(screen.pill);
  await act(async () => second.settle(told({ file_name: 'B.JPG', size_bytes: '1000000' })));
  await act(async () => first.settle(refused(500, 'late failure')));
  expect(screen.info().props.error).toBeNull();
  expect(screen.facts()[0]).toEqual([ru.viewer.file, 'B.JPG · 1 МБ']);
});

test('a place found for the frame before is not written into the sheet of the next one', async () => {
  const slow = later<unknown>();
  geocode.mockImplementation(((where: { latitude: number }) =>
    where.latitude === 40.5 ? slow.promise : Promise.resolve([{ city: 'Казань' }])) as never);
  const infos = [
    told({ latitude: 40.5, longitude: 50.5 }),
    told({ id: 'b', latitude: 41.5, longitude: 51.5 }),
  ];
  serve(() => infos.shift());
  const screen = await open();
  await screen.press(screen.pill);
  await act(async () => screen.info().props.onClose());
  await screen.show({ item: shots()[1] });
  await screen.press(screen.pill);
  expect(screen.facts().at(-1)).toEqual([ru.viewer.place, 'Казань']);
  // The first point’s answer arrives now, for a frame that is no longer the one in the sheet.
  await act(async () => slow.settle([{ city: 'Москва' }]));
  expect(screen.facts().at(-1)).toEqual([ru.viewer.place, 'Казань']);
});

test('the strip is the feed’s own row of frames, and a tap on one opens it — unless it is still developing', async () => {
  serve(() => undefined);
  const screen = await open();
  const strip = screen.root.findByType(Filmstrip);
  expect(strip.props.frames).toHaveLength(4);
  expect(strip.props.index).toBe(0);
  await act(async () => strip.props.onPick(1));
  expect(screen.shown.onOpen).toHaveBeenCalledWith('b');
  (screen.shown.onOpen as ReturnType<typeof vi.fn>).mockClear();
  // «c» is still being made: it stays in the strip, and there is nothing behind it to open.
  await act(async () => strip.props.onPick(2));
  expect(screen.shown.onOpen).not.toHaveBeenCalled();
  await act(async () => strip.props.onPick(3));
  expect(screen.shown.onOpen).toHaveBeenCalledWith('d');
  // The strip stands on the frame in hand.
  await screen.show({ item: shots()[3] });
  expect(screen.root.findByType(Filmstrip).props.index).toBe(3);
});

test('a finger that leaves the strip resting on a frame opens it — and one still developing is told no', async () => {
  // TASK-474: the strip is the one horizontal scroll in the product, and it was asked by name only.
  // Scrolling it moved the strip and left the picture standing — «не меняет элементы при листании».
  //
  // It is asked through the very same `walk` a tap goes through, which is what the equality below
  // says: one rule about what opens, asked twice. And the answer goes back to the strip, because a
  // frame it will not open has to put the strip back on the frame in hand rather than leave it
  // standing centred over one this window never opened.
  serve(() => undefined);
  const screen = await open();
  const strip = () => screen.root.findByType(Filmstrip).props;
  expect(strip().onSettle).toBe(strip().onPick);

  expect(strip().onSettle(1)).toBe(true);
  expect(screen.shown.onOpen).toHaveBeenLastCalledWith('b');
  (screen.shown.onOpen as ReturnType<typeof vi.fn>).mockClear();
  // «c» is still being made: it stays in the strip, and the answer is «no» rather than a frame the
  // window has nothing to put behind.
  expect(strip().onSettle(2)).toBe(false);
  expect(screen.shown.onOpen).not.toHaveBeenCalled();
  expect(strip().onSettle(3)).toBe(true);
  expect(screen.shown.onOpen).toHaveBeenLastCalledWith('d');
});

test('a frame with nothing behind it is «кадр не открылся», with the strip and the delete still there', async () => {
  serve(() => undefined);
  const bare = { ...shots()[1], thumbnail_url: null, preview_url: null };
  const screen = await open({ item: bare, frames: [shots()[0], bare] });
  expect(screen.root.findAllByType(Empty).map((one) => one.props.text)).toEqual([
    ru.viewer.notOpened,
  ]);
  expect(screen.root.findAllByType(Filmstrip)).toHaveLength(1);
  await screen.menu();
  expect(screen.row(ru.viewer.remove)).toHaveLength(1);
});

test('a video with its own file carries a scrubber and a photograph carries none', async () => {
  serve(() => undefined);
  const film = {
    ...shots()[0],
    id: 'v',
    kind: 'video' as const,
    preview_url: 'https://r2.example/v.mp4',
    duration_seconds: 20,
  };
  const still = await open();
  expect(still.root.findAllByType(VideoTrack)).toHaveLength(0);
  const video = await open({ item: film, frames: [film] });
  expect(video.root.findAllByType(VideoTrack)).toHaveLength(1);
  // A video whose 720p was never made is a picture again, drawn off its poster.
  const noFile = await open({ item: { ...film, preview_url: null }, frames: [film] });
  expect(noFile.root.findAllByType(VideoTrack)).toHaveLength(0);
});

test('the glass starts where the status line ends, and the scrubber keeps 16 at the sides with the sound 8 into the right one', async () => {
  // `Viewer` / `ViewerVideo` (Viewer.json, ViewerVideo.json): the three pieces of glass at `top 52`
  // — the status line and nothing more (spec 7.1, detail 5); the app put 8 under it. The scrubber
  // row (spec 7.10: `0 16`, the sound `margin-right: −8`): «0:24» at 16, the 36 sound button at
  // 346, its edge 8 short of the screen's — the app ran both to the edges.
  serve(() => undefined);
  const film = {
    ...shots()[0],
    id: 'v',
    kind: 'video' as const,
    preview_url: 'https://r2.example/v.mp4',
    duration_seconds: 20,
  };
  const screen = await open({ item: film, frames: [film] });
  // The phone's insets are 0 under node: the glass stands at the top of the window itself.
  expect(StyleSheet.flatten(screen.pill().props.style)).toMatchObject({ top: 0 });
  // And the menu still falls 8 under the button it came out of.
  expect(screen.root.findByType(ActionMenu).props.top).toBe(48 + 8);
  const [row] = screen.root
    .findAllByType(View)
    .filter((one) => (one.props.children as { type?: unknown } | undefined)?.type === VideoTrack);
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ paddingHorizontal: 16 });
  const sound = screen.root.findByType(VideoTrack).props.sound;
  expect(StyleSheet.flatten(sound.props.style)).toMatchObject({ marginRight: -8 });
  expect(390 - 16 + 8 - 36).toBe(346);
});

/**
 * The picture is walked with a finger (TASK-182). The gesture is taken by the picture alone, once it
 * has plainly gone sideways, and lets go of a lift as «the next one» or «the one before» — over the
 * whole gallery, past whatever is still being developed.
 */
async function swipe(screen: Awaited<ReturnType<typeof open>>, dx: number, dy = 0) {
  const stage = () => stageOf(screen);
  let taken = false;
  await act(async () => {
    taken = stage().props.onMoveShouldSetResponderCapture(
      touch({ x: 200 + dx, y: 300 + dy, fromX: 200, fromY: 300 }),
    );
  });
  if (taken)
    await act(async () => stage().props.onResponderRelease(touch({ x: 200 + dx, y: 300 + dy })));
  return taken;
}

const opened = (screen: Awaited<ReturnType<typeof open>>) =>
  (screen.shown.onOpen as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);

/** The stage: the view the finger walks the gallery with, and the one a tap lands on (TASK-476). */
const stageOf = (screen: Awaited<ReturnType<typeof open>>) =>
  screen.root.findAll((one) => typeof one.props.onMoveShouldSetResponderCapture === 'function')[0];

/**
 * A tap on the picture, as the responder system hands it over: the stage takes the finger down, the
 * finger does not go anywhere, and it lifts. The dx and dy say how far it came, so a tap that
 * drifted is a tap that drifted.
 */
async function tap(screen: Awaited<ReturnType<typeof open>>, dx = 0, dy = 0) {
  await act(async () => stageOf(screen).props.onStartShouldSetResponder(touch({ x: 200, y: 300 })));
  await act(async () =>
    stageOf(screen).props.onResponderRelease(touch({ x: 200 + dx, y: 300 + dy })),
  );
}

/** What the window draws over the frame — the glass, the shades and the tools (TASK-476). */
const tools = (screen: Awaited<ReturnType<typeof open>>) => ({
  bar: screen.root.findAllByType(ViewerBar).length,
  strip: screen.root.findAllByType(Filmstrip).length,
  scrubber: screen.root.findAllByType(VideoTrack).length,
});

test('a swipe to the left opens the next frame and a swipe to the right the one before, and neither goes past the ends', async () => {
  serve(() => undefined);
  const first = await open({ item: shots()[0] });
  expect(await swipe(first, -100)).toBe(true);
  expect(opened(first)).toEqual(['b']);
  expect(await swipe(first, 100)).toBe(true);
  // Nothing before the first frame: the gesture is taken and there is nowhere to go.
  expect(opened(first)).toEqual(['b']);

  const last = await open({ item: shots()[3] });
  await swipe(last, -100);
  expect(opened(last)).toEqual([]);
});

test('a swipe carries on past a frame still being developed, in both directions, rather than stopping at it', async () => {
  serve(() => undefined);
  // a, b, [c developing], d.
  const forward = await open({ item: shots()[1] });
  await swipe(forward, -100);
  expect(opened(forward)).toEqual(['d']);
  const back = await open({ item: shots()[3] });
  await swipe(back, 100);
  expect(opened(back)).toEqual(['b']);
});

test('a strip that ends in frames still developing has nowhere to swipe on to', async () => {
  serve(() => undefined);
  const list = [shots()[0], shots()[1], shots()[2]];
  const screen = await open({ item: list[1], frames: list });
  await swipe(screen, -100);
  expect(opened(screen)).toEqual([]);
});

test('a short lift is a change of mind, and a movement that is more up and down than sideways is not the picture’s', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  // Under 56 points in all: the finger was taken (it went sideways) and let go of without a step.
  expect(await swipe(screen, -40)).toBe(true);
  expect(opened(screen)).toEqual([]);
  // Barely moved at all: not taken, so a tap on a button under it is still a tap.
  expect(await swipe(screen, -8)).toBe(false);
  // Further down than across: a scroll or a drag of something else.
  expect(await swipe(screen, -100, 150)).toBe(false);
  expect(opened(screen)).toEqual([]);
  // Just past the threshold it walks.
  expect(await swipe(screen, -57)).toBe(true);
  expect(opened(screen)).toEqual(['b']);
});

test('the swipe walks from the frame on screen now, not the one the window was opened on', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  await screen.show({ item: shots()[3] });
  await swipe(screen, 100);
  // From the last, back past the developing one — the gesture was built once and reads the render it is in.
  expect(opened(screen)).toEqual(['b']);
});

test('a lift of exactly 56 walks and a movement of exactly 12 is not yet a swipe; from the second frame the first can be reached', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[1] });
  expect(await swipe(screen, -12)).toBe(false);
  expect(await swipe(screen, -13)).toBe(true);
  expect(opened(screen)).toEqual([]);
  // Just enough is enough: 56 is the step, and a step to the right from the second is the first.
  expect(await swipe(screen, 56)).toBe(true);
  expect(opened(screen)).toEqual(['a']);
});

/**
 * A tap on the picture (TASK-476): the whole of the window over the frame goes away and comes back,
 * and nothing of the frame itself goes with it.
 */
test('a tap on the picture puts the glass, the strip and the shades away, and a second tap brings them back', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 0 });
  await tap(screen);
  expect(tools(screen)).toEqual({ bar: 0, strip: 0, scrubber: 0 });
  // The picture is what is left — the frame itself is never taken away with the tools.
  expect(screen.root.findAllByType(Image).some((one) => one.props.contentFit === 'cover')).toBe(
    true,
  );
  await tap(screen);
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 0 });
});

test('the shades go with the tools: what stands without them is the frame and nothing drawn over it', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  // The two darkenings, read off the tree as the views that take no finger and carry a gradient.
  const shades = () =>
    screen.root
      .findAllByType(View)
      .filter(
        (one) =>
          one.props.pointerEvents === 'none' &&
          StyleSheet.flatten(one.props.style)?.experimental_backgroundImage !== undefined,
      );
  expect(shades()).toHaveLength(2);
  await tap(screen);
  expect(shades()).toHaveLength(0);
});

test('a tap that drifted is still a tap, and one that went sideways is a swipe that walks instead', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  // A finger that wobbled under the 12 points at which the picture takes a swipe is still a tap.
  await tap(screen, 8, -9);
  expect(tools(screen)).toEqual({ bar: 0, strip: 0, scrubber: 0 });
  await tap(screen);
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 0 });
  // Past it the gesture is the gallery's, and a gesture never hides anything — it walks (AC #4).
  expect(await swipe(screen, -100)).toBe(true);
  expect(opened(screen)).toEqual(['b']);
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 0 });
});

test('tools that were put away come back on a swipe and on a step along the strip, whatever it walked to', async () => {
  serve(() => undefined);
  // A swipe past the last frame has nowhere to go and still brings the tools back (AC #3): nobody
  // who put them away is left with a picture and no way out of it but another tap.
  const last = await open({ item: shots()[3] });
  await tap(last);
  expect(tools(last).bar).toBe(0);
  expect(await swipe(last, -100)).toBe(true);
  expect(opened(last)).toEqual([]);
  expect(tools(last).bar).toBe(1);

  // And the strip's own answer, when a finger has already flung it and the tools go away mid-fling:
  // the frame it comes to rest on is named after the fact, and it brings the tools back with it.
  const strip = await open({ item: shots()[0] });
  const flung = strip.root.findByType(Filmstrip).props as {
    onSettle: (at: number) => boolean;
  };
  await tap(strip);
  await act(async () => void flung.onSettle(3));
  expect(opened(strip)).toEqual(['d']);
  expect(tools(strip).bar).toBe(1);
});

test('a video taps to play and to stand still, and its 72 stays where it is in both states', async () => {
  serve(() => undefined);
  const clip = { ...shots()[0], kind: 'video' as const, preview_url: 'https://r2.example/v.mp4' };
  player.playing = false;
  const screen = await open({ item: clip, frames: [clip] });
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 1 });
  await tap(screen);
  expect(player.play).toHaveBeenCalled();
  // A video's tap never hides anything — the transport is the frame's own business (AC #5).
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 1 });

  player.playing = true;
  await act(async () => screen.show({ item: clip, frames: [clip] }));
  expect(screen.icon(ru.viewer.pause)().props.size).toBe(72);
  await tap(screen);
  expect(player.pause).toHaveBeenCalled();
  expect(tools(screen)).toEqual({ bar: 1, strip: 1, scrubber: 1 });
  // And the button itself is still there and still its own — not taken by the tap, and not hidden.
  expect(screen.root.findAllByType(IconButton).filter((one) => one.props.size === 72)).toHaveLength(
    1,
  );
});

test('the picture is one control to a screen reader, named by what its tap will do', async () => {
  serve(() => undefined);
  const screen = await open({ item: shots()[0] });
  const said = () => stageOf(screen).props as Record<string, unknown>;
  expect(said().accessible).toBe(true);
  expect(said().accessibilityRole).toBe('button');
  expect(said().accessibilityLabel).toBe(ru.viewer.hideTools);
  // The action is `activate` — the one name iOS and Android both answer to.
  expect(said().accessibilityActions).toEqual([{ name: 'activate' }]);
  await act(async () =>
    (said().onAccessibilityAction as (e: unknown) => void)({
      nativeEvent: { actionName: 'activate' },
    }),
  );
  expect(tools(screen).bar).toBe(0);
  // Named by what it will do now, which is the other way round.
  expect(stageOf(screen).props.accessibilityLabel).toBe(ru.viewer.showTools);
  await act(async () =>
    (stageOf(screen).props.onAccessibilityAction as (e: unknown) => void)({
      nativeEvent: { actionName: 'activate' },
    }),
  );
  expect(tools(screen).bar).toBe(1);
});

test('a video is not marked as a control: the play and pause a reader reaches is the 72, under its own name', async () => {
  serve(() => undefined);
  const clip = { ...shots()[0], kind: 'video' as const, preview_url: 'https://r2.example/v.mp4' };
  const screen = await open({ item: clip, frames: [clip] });
  // Marking the stage would be marking it on top of that button, and on iOS a container marked
  // accessible is read instead of its children — the play and pause would go missing.
  expect(stageOf(screen).props.accessible).toBeUndefined();
  expect(screen.icon(ru.viewer.play)().props.label).toBe(ru.viewer.play);
});

test('the window opens quiet: nothing busy, no sheet up, and the phone is allowed to turn while it is open', async () => {
  serve(() => undefined);
  const screen = await open();
  expect(screen.icon(ru.viewer.more)().props.disabled).toBeFalsy();
  expect(screen.confirm().props.visible).toBe(false);
  expect(screen.info().props.visible).toBe(false);
  expect(screen.root.findByType(ActionMenu).props.visible).toBe(false);
  expect(turns).toHaveBeenCalledWith(true);
  expect(turns).not.toHaveBeenCalledWith(false);
});

test('every errand shuts the «⋯» while it runs and opens it again after — saving, sharing and deleting', async () => {
  for (const [row, route] of [
    [ru.viewer.saveToPhone, (asked: Asked) => asked.path.endsWith('/download')],
    [ru.action.share, (asked: Asked) => asked.path.endsWith('/download')],
    [ru.viewer.remove, (asked: Asked) => asked.method === 'DELETE'],
  ] as const) {
    const gate = later<unknown>();
    serve((asked) => (route(asked) ? gate.promise : undefined));
    const screen = await open();
    await screen.menu();
    if (row === ru.viewer.remove) {
      await screen.press(() => screen.row(row)[0]);
      await act(async () => void screen.confirm().props.onConfirm());
    } else {
      await act(async () => void screen.row(row)[0].props.onPress());
    }
    expect(screen.icon(ru.viewer.more)().props.disabled, row).toBe(true);
    await act(async () => gate.settle({ url: 'https://r2.example/original', ok: true }));
    expect(screen.icon(ru.viewer.more)().props.disabled, row).toBe(false);
    vi.unstubAllGlobals();
  }
});

test('the delete sheet puts itself away when it is answered, and both sheets show the frame they are about', async () => {
  serve(() => ({ ok: true }));
  const screen = await open();
  expect(screen.confirm().props.thumb).toBe('https://r2.example/a');
  expect(screen.info().props.thumb).toBe('https://r2.example/a');
  await screen.menu();
  await screen.press(() => screen.row(ru.viewer.remove)[0]);
  expect(screen.confirm().props.visible).toBe(true);
  await act(async () => screen.confirm().props.onConfirm());
  expect(screen.confirm().props.visible).toBe(false);
  // A frame the worker never made a picture for has no thumbnail to show, and the sheets say none.
  const bare = { ...shots()[1], thumbnail_url: null };
  const other = await open({ item: bare, frames: [bare] });
  expect(other.confirm().props.thumb).toBeUndefined();
  expect(other.info().props.thumb).toBeUndefined();
});

test('opening the frame’s sheet puts the menu away, and the sheet’s own close puts it away', async () => {
  serve(() => told({ montages: [{ id: 'f1', duration_seconds: 60, start_seconds: 72 }] }));
  const screen = await open();
  await screen.menu();
  expect(screen.root.findByType(ActionMenu).props.visible).toBe(true);
  await screen.press(screen.pill);
  expect(screen.root.findByType(ActionMenu).props.visible).toBe(false);
  expect(screen.info().props.visible).toBe(true);
  await act(async () => screen.info().props.onClose());
  expect(screen.info().props.visible).toBe(false);
  // Raised again, the sheet is a fresh one: what a film was chosen on it is the window’s to carry out.
  await screen.press(screen.pill);
  await act(async () => screen.info().findAllByType(RowFilmAt)[0].props.onPress());
  expect(screen.shown.onClose).toHaveBeenCalledTimes(1);
});

test('on iOS the film is asked for only once the window has gone, because a modal raised over another is lost there', async () => {
  platform.os = 'ios';
  serve(() => told({ montages: [{ id: 'f1', duration_seconds: 60, start_seconds: 72 }] }));
  const screen = await open();
  const window = () => screen.root.findAllByType(Modal)[0];
  // A dismissal that is nobody’s errand raises nothing.
  await act(async () => window().props.onDismiss());
  expect(screen.shown.onClose).not.toHaveBeenCalled();
  await screen.press(screen.pill);
  await act(async () => screen.info().findAllByType(RowFilmAt)[0].props.onPress());
  // The window shuts first, and nothing is asked of the memory’s screen yet.
  expect(window().props.visible).toBe(false);
  expect(screen.shown.onClose).not.toHaveBeenCalled();
  expect(router.setParams).not.toHaveBeenCalled();
  // And once it has gone, the film is asked for — once.
  await act(async () => window().props.onDismiss());
  expect(screen.shown.onClose).toHaveBeenCalledTimes(1);
  expect(router.setParams).toHaveBeenCalledExactlyOnceWith({ montage: 'f1' });
});

test('the lines of the frame’s sheet stand in one card, and a film with no known length is called by its count', async () => {
  serve(() => told({ montages: [{ id: 'f9', duration_seconds: null, start_seconds: 5 }] }));
  const screen = await open();
  await screen.press(screen.pill);
  expect(
    screen
      .info()
      .findAllByType(RowSummary)
      .map((one) => one.props.divider),
  ).toEqual([false, true, true]);
  const row = screen.info().findByType(RowFilmAt);
  expect(row.props.title).toBe(ru.montage.count(1));
  expect(row.props.at).toBe(ru.viewer.at('0:05'));
});

/** A video with its own file, and the words the window reads a player through. */
const video = (over: Partial<MediaItem> = {}): MediaItem => ({
  ...shots()[0],
  id: 'v',
  kind: 'video',
  preview_url: 'https://r2.example/v.mp4',
  duration_seconds: 40,
  ...over,
});

test('a video is streamed off its own file by one player, set up to report four times a second and to start playing', async () => {
  serve(() => undefined);
  const clip = video();
  const screen = await open({ item: clip, frames: [clip] });
  expect(vi.mocked(useVideoPlayer)).toHaveBeenLastCalledWith(
    'https://r2.example/v.mp4',
    expect.any(Function),
  );
  expect(player.timeUpdateEventInterval).toBe(0.25);
  expect(player.play).toHaveBeenCalled();
  // Its transport is the row under the strip and the button in the middle: the platform’s own is off.
  const view = screen.root.findByType(VideoView);
  expect(view.props.nativeControls).toBe(false);
  expect(view.props.player).toBe(player);
  // A playing video draws no picture under it — the frame in hand is the player, and the strip's
  // own thumbnails are the only other `Image` on the window (they carry no `cacheKey`).
  expect(screen.root.findAllByType(Image).filter((one) => one.props.source?.cacheKey)).toHaveLength(
    0,
  );
  // Covered into the frame's own box, exactly like the photograph under it — one rule for the two.
  expect(view.props.contentFit).toBe('cover');
});

test('a photograph is a player with no source, and a video whose file was never made is a picture again, off its poster', async () => {
  serve(() => undefined);
  const still = await open();
  expect(vi.mocked(useVideoPlayer)).toHaveBeenLastCalledWith(null, expect.any(Function));
  expect(still.root.findAllByType(VideoView)).toHaveLength(0);
  const big = still.root.findAllByType(Image).find((one) => one.props.contentFit === 'cover')!;
  // Filed under the record and by which of its two derivatives it is, and not by its signed link.
  expect(big.props.source).toEqual({ uri: 'https://r2.example/a-big', cacheKey: 'a:preview' });

  const small = shots()[1];
  const thumb = await open({ item: small, frames: [small] });
  expect(
    thumb.root.findAllByType(Image).find((one) => one.props.contentFit === 'cover')!.props.source,
  ).toEqual({
    uri: 'https://r2.example/b',
    cacheKey: 'b:thumb',
  });

  const clip = video({ preview_url: null });
  const poster = await open({ item: clip, frames: [clip] });
  expect(poster.root.findAllByType(VideoView)).toHaveLength(0);
  expect(poster.root.findAllByType(VideoTrack)).toHaveLength(0);
  expect(
    poster.root.findAllByType(Image).find((one) => one.props.contentFit === 'cover')!.props.source
      .cacheKey,
  ).toBe('v:thumb');
});

test('the transport reads the player: the middle button is play while it is stopped and pause while it plays, and each does what it says', async () => {
  serve(() => undefined);
  const clip = video();
  player.playing = false;
  const paused = await open({ item: clip, frames: [clip] });
  // The window itself started the film once when it was made; this is the person’s press on top of it.
  player.play.mockClear();
  await paused.press(paused.icon(ru.viewer.play));
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(player.pause).not.toHaveBeenCalled();
  expect(paused.icon(ru.viewer.pause)()).toBeUndefined();

  player.playing = true;
  const running = await open({ item: clip, frames: [clip] });
  player.play.mockClear();
  await running.press(running.icon(ru.viewer.pause));
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(player.play).not.toHaveBeenCalled();
});

test('the sound button says what pressing it will do, and does it', async () => {
  serve(() => undefined);
  const clip = video();
  player.muted = false;
  const loud = await open({ item: clip, frames: [clip] });
  await loud.press(loud.icon(ru.viewer.mute));
  expect(player.muted).toBe(true);
  const quiet = await open({ item: clip, frames: [clip] });
  await quiet.press(quiet.icon(ru.viewer.unmute));
  expect(player.muted).toBe(false);
});

test('the scrubber reads the player’s place against the api’s own length, and winds the film to where it is pressed', async () => {
  serve(() => undefined);
  const clip = video({ duration_seconds: 40 });
  player.currentTime = 10;
  const screen = await open({ item: clip, frames: [clip] });
  const track = () => screen.root.findByType(VideoTrack).props;
  expect(track().at).toBe('0:10');
  expect(track().of).toBe('0:40');
  expect(track().value).toBe(0.25);
  track().onSeek(0.5);
  expect(player.currentTime).toBe(20);
});

test('a length the api did not send is the player’s, and one nobody knows is a scrubber that cannot be wound', async () => {
  serve(() => undefined);
  player.duration = 45;
  player.currentTime = 9;
  const own = video({ duration_seconds: null });
  const played = await open({ item: own, frames: [own] });
  expect(played.root.findByType(VideoTrack).props.of).toBe('0:45');
  expect(played.root.findByType(VideoTrack).props.value).toBe(0.2);
  expect(played.root.findByType(VideoTrack).props.onSeek).toBeDefined();

  player.duration = 0;
  player.currentTime = 0;
  const unknown = await open({ item: own, frames: [own] });
  expect(unknown.root.findByType(VideoTrack).props.value).toBe(0);
  expect(unknown.root.findByType(VideoTrack).props.onSeek).toBeUndefined();

  // A clip one second long is a length like any other: it can be wound.
  player.currentTime = 0.5;
  const short = video({ duration_seconds: 1 });
  const brief = await open({ item: short, frames: [short] });
  expect(brief.root.findByType(VideoTrack).props.onSeek).toBeDefined();
  expect(brief.root.findByType(VideoTrack).props.value).toBe(0.5);
});

test('the strip is the feed’s frames by picture and by whether they move, and each one is called out as the feed calls it', async () => {
  serve(() => undefined);
  const list = [shots()[0], video(), shots()[2]];
  const screen = await open({ item: list[0], frames: list });
  const strip = screen.root.findByType(Filmstrip).props;
  expect(strip.frames).toEqual([
    { uri: 'https://r2.example/a', video: false },
    { uri: 'https://r2.example/a', video: true },
    // Still being made: it stays in the strip with nothing to draw yet.
    { uri: '', video: false },
  ]);
  expect(strip.index).toBe(0);
  expect(strip.labelAt(0)).toBe('a:open');
  expect(strip.labelAt(1)).toBe('v');
  expect(strip.labelAt(2)).toBe('c');
});

test.each([
  ['a photograph', () => shots()[0]],
  ['a video', () => video({ id: 'a' })],
])(
  'on %s the pill of when and who wears no chevron, is a button of its own size, and the finger on it raises the sheet',
  async (_, item) => {
    // Spec 1, rule 9, and 7.1, detail 5: `Viewer` and `ViewerVideo` share the pill, and in both it
    // is the capsule itself that is pressed — no arrow in it, the same 20 on either side of the words.
    const log = serve((asked) => (asked.path === '/memories/m1/media/a' ? told() : undefined));
    const shown = item();
    const screen = await open({ item: shown, frames: [shown] });
    const pill = screen
      .pill()
      .findAllByType(Pressable)
      .find((one) => String(one.props.accessibilityLabel).startsWith(ru.viewer.details))!;
    expect(pill.props.accessibilityRole).toBe('button');
    expect(pill.props.accessibilityLabel).toBe(
      `${ru.viewer.details}: ${screen.bar().date}, ${screen.bar().meta}`,
    );
    expect(pill.findAllByType(Icon)).toHaveLength(0);
    const box = StyleSheet.flatten(pill.props.style);
    // A floor: on large type the date and the author wrap, and the pill grows down (TASK-400).
    expect(box.minHeight).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeUndefined();
    expect(box.paddingHorizontal).toBe(20);
    expect(box.paddingRight).toBeUndefined();

    await act(async () => pill.props.onPress());
    expect(screen.info().props.visible).toBe(true);
    expect(log.map((one) => one.path)).toEqual(['/memories/m1/media/a']);
  },
);

/** The nearest style, walking up from a node, that says something about `key` — the box it stands in. */
function boxAround(node: ReactTestInstance, key: string) {
  for (let up = node.parent; up; up = up.parent) {
    // The component and not the element it draws: what a `View` was handed, not what the web made of it.
    if (up.type !== View) continue;
    const style = StyleSheet.flatten(up.props.style) as Record<string, number> | undefined;
    if (style && style[key] !== undefined) return style;
  }
  throw new Error(`nothing around this node says ${key}`);
}

/** Every height a subtree is drawn with, off its own style and its scroll content's. */
const heightsIn = (node: ReactTestInstance) =>
  node
    .findAll(() => true)
    .flatMap((one) => [one.props.style, one.props.contentContainerStyle])
    .map((style) => (typeof style === 'function' ? undefined : StyleSheet.flatten(style)?.height))
    .filter((one): one is number => typeof one === 'number');

test.each([
  ['a photograph', () => shots()[0], false],
  ['a video', () => video(), true],
])(
  'the foot of the window is the strip over the picture: %s is 48 tall, %i',
  async (_, item, isVideo) => {
    // Spec 8, `Viewer*` (TASK-475): the picture is drawn in a box of its own proportions in the
    // middle of the phone, and the strip lies over it — so the window has no foot in the old sense,
    // no 96 or 140 of space reserved under the picture. What it does have is the strip itself,
    // standing `board.bottom` off the bottom edge, and over a video its scrubber 14 above that.
    serve(() => undefined);
    const shown = item();
    const screen = await open({ item: shown, frames: [shown] });
    const strip = screen.root.findByType(Filmstrip);
    const tools = boxAround(strip, 'paddingBottom');
    expect(tools.paddingBottom).toBe(30);
    expect(heightsIn(strip)).toContain(48);
    expect(tools.gap).toBe(14);
    if (isVideo) {
      // The scrubber row is as tall as the sound button beside it, and the strip stands 14 under it.
      expect(screen.icon(ru.viewer.mute)().props.size).toBe(36);
    }
    // The scrubber is inside the same box as the strip, above it, on a video alone.
    expect(screen.root.findAllByType(VideoTrack)).toHaveLength(isVideo ? 1 : 0);
  },
);

test('a frame is drawn in a box of its own proportions, not fitted to the screen by contain', () => {
  // TASK-475, the whole of it: `contentFit="contain"` in whatever room the stage had left is what
  // left a horizontal frame small and centred on the screen. The layout draws 390 × 520 upright for
  // a 3:4 frame, 390 × 260 for a 3:2 one, 585 × 390 turned for that 3:2 and 293 × 390 for the 3:4
  // — every one of them the frame's own shape as large as it goes without leaving the screen.
  const standing = frameBox(3024, 2016, 390, 844);
  expect(Math.round(standing.width)).toBe(390);
  expect(Math.round(standing.height)).toBe(260);
  // Turned, the same frame lies along the other axis: the height of the screen and the width the
  // frame's own proportions give it.
  const turned = frameBox(3024, 2016, 844, 390);
  expect(Math.round(turned.width)).toBe(585);
  expect(Math.round(turned.height)).toBe(390);
  // And a vertical frame the other way round: 390 wide and 520 tall upright, 293 × 390 turned.
  const tall = frameBox(3024, 4032, 390, 844);
  expect(Math.round(tall.width)).toBe(390);
  expect(Math.round(tall.height)).toBe(520);
  expect(Math.round(frameBox(3024, 4032, 844, 390).width)).toBe(293);
  expect(frameBox(3024, 4032, 844, 390).height).toBe(390);
  // A record the worker has not measured has no proportions to lay out, and takes the whole screen
  // rather than a guessed shape. That is the honest answer until the numbers arrive, not a zero.
  expect(frameBox(null, null, 390, 844)).toEqual({ width: 390, height: 844 });
  expect(frameBox(4032, null, 390, 844)).toEqual({ width: 390, height: 844 });
  // A frame is its own shape whatever the phone is: a 10000 × 500 panorama across a standing phone is
  // 390 wide and 19.5 tall, and a 1000 × 10000 one upright is clamped to the 844 of the screen
  // rather than running off the top and bottom of it.
  const panorama = frameBox(10000, 500, 390, 844);
  expect(panorama.width).toBe(390);
  expect(panorama.height).toBeCloseTo(19.5);
  expect(frameBox(1000, 10000, 390, 844)).toEqual({ width: 390, height: 844 });
});

test('«Пауза» in the middle of a video is 72, dark, with no colour of the glass or of the viewer’s own on it', async () => {
  serve(() => undefined);
  const clip = video();
  for (const playing of [true, false]) {
    player.playing = playing;
    const screen = await open({ item: clip, frames: [clip] });
    const button = screen.icon(playing ? ru.viewer.pause : ru.viewer.play)();
    expect(button.props).toMatchObject({ size: 72, tone: 'video' });
    // The glyph takes its paper from the tone: nothing here overrides it with a white of its own.
    expect(button.props.tint).toBeUndefined();
  }
});

test.each(['ru', 'en'] as const)(
  'in %s the open frame — photograph or video, sheet down or up — has a name and a role on everything a finger can press, and none of them is under 44',
  async (language) => {
    await act(async () => setLanguage(language));
    try {
      serve(() => undefined);
      for (const item of [shots()[0], video()]) {
        const screen = await open({ item, frames: [item] });
        const found = expectReachable(screen.root);
        const names = found.map((one) => one.name);
        const s = strings[language];
        for (const name of [s.action.close, s.viewer.more])
          expect(names, `${item.kind}: ${name}`).toContain(name);
        if (item.kind === 'video')
          for (const name of [s.viewer.play, s.viewer.mute])
            expect(names, `${item.kind}: ${name}`).toContain(name);
        // The pill that raises the sheet is a button that says what it opens and for which frame.
        expect(names.some((name) => name.startsWith(s.viewer.details))).toBe(true);
      }
    } finally {
      await act(async () => setLanguage('ru'));
    }
  },
);

test('turned, the window keeps every name, role and 44 that it has standing', async () => {
  // TASK-475: the phone lying on its side is the same window with the same controls on glass, and a
  // screen reader must not lose one of them because the picture is drawn the other way round. The
  // bar's own round buttons drop from 48 to 44 — the layout's — and a 44 with its slop is still the
  // floor, so they keep meeting it. The strip's shots are the layout's 26 × 36 and 38 × 40, which do
  // not: they grow as far as the 2 gap between two shots allows and no further, because reaching
  // past that puts a tap on the frame the person did not touch. That is `ViewerRotated*`'s own
  // numbers, and it is said here rather than hidden by not asking.
  serve(() => undefined);
  const standing = { width: 390, height: 844 };
  // The strip's own shots are told by what they are drawn at: a control on the window is 44 or more
  // across, and nothing in the strip is. A control whose width the layout decides — the pill, which
  // is as long as the day and the name in it — is not one of them and is not short of anything: it
  // has no width to be short in, and reading `undefined` as 0 filed the window's own glass in the
  // strip.
  const inStrip = (one: { width: number | undefined }) => one.width !== undefined && one.width < 44;
  // The strip has to have neighbours in it for any of this to mean anything. It was opened on a
  // strip of one frame and the neighbour checks ran over an empty list — a check that can only pass
  // is not a check, and the 44 it waved through was the 44 of a strip that was not there.
  const beside = (item: MediaItem): MediaItem[] => {
    const others = shots().filter((one) => one.id !== item.id);
    return [others[0], video({ id: 'w' }), item, others[1], others[2]];
  };
  try {
    for (const item of [shots()[0], video()]) {
      Object.assign(phone, standing);
      const upright = targets((await open({ item, frames: beside(item) })).root);
      Object.assign(phone, { width: 844, height: 390 });
      const sideways = targets((await open({ item, frames: beside(item) })).root);

      // The same controls, in the same words, on the same job — only the geometry moved.
      expect(sideways.map((one) => one.name).sort()).toEqual(upright.map((one) => one.name).sort());
      for (const one of upright) {
        expect(sideways.find((two) => two.name === one.name)?.role, one.name).toBe(one.role);
      }
      // Every control a finger reaches for on its own is still 44 by 44, standing or turned.
      for (const one of sideways.filter((two) => !inStrip(two))) {
        expect(one.role, one.name).toBeTruthy();
        expect(one.name, 'a control with no name').not.toBe('');
        if (one.width !== undefined)
          expect(one.width, `«${one.name}» is ${one.width} wide`).toBeGreaterThanOrEqual(44);
        if (one.height !== undefined)
          expect(one.height, `«${one.name}» is ${one.height} high`).toBeGreaterThanOrEqual(44);
      }
      // And the strip's own frames keep the names and roles they had, at the sizes the layout draws.
      // Standing, a neighbour is 30 across and the frame in hand 44, so the strip is four neighbours
      // and no current one; turned, the frame in hand is 38 and counts as one of the strip's five —
      // the same layout gap said the other way round, and the reason the counts are pinned.
      const stripUpright = upright.filter(inStrip);
      const stripTurned = sideways.filter(inStrip);
      expect(stripUpright).toHaveLength(4);
      expect(stripTurned).toHaveLength(5);
      for (const one of stripUpright) {
        expect(one.role, one.name).toBe('button');
        expect(one.name, 'a strip frame with no name').not.toBe('');
        // 30 wide with the half of the gap either side of it — never less than the layout's own.
        expect(one.width, one.name).toBeGreaterThanOrEqual(30);
      }
      for (const one of stripTurned) {
        expect(one.role, one.name).toBe('button');
        expect(one.name, 'a strip frame with no name').not.toBe('');
        if (one.width !== undefined) expect(one.width, one.name).toBeGreaterThanOrEqual(26);
        // And here it is said rather than hidden: turned, the strip is short of 44 across, the
        // neighbours at 28 and the frame in hand at 40. Those are `ViewerRotated*`'s own numbers
        // and they are still the numbers — this is here so that a change to them cannot pass as
        // «the 44 held anyway», which is what an empty neighbour list would have let it do.
        expect(one.width, `«${one.name}» is ${one.width} wide`).toBeLessThan(44);
        // It is still 44 tall, so it is only the distance across that a finger comes up short on.
        expect(one.height, `«${one.name}» is ${one.height} high`).toBeGreaterThanOrEqual(44);
      }
    }
  } finally {
    Object.assign(phone, standing);
  }
});
