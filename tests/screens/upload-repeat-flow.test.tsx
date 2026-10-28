import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Asset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  creationTime: number;
  modificationTime: number;
  duration: number;
  width: number;
  height: number;
};

const { router, params, lib, uploads } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  params: { id: 'm1' } as { id: string; sent?: string },
  lib: {
    access: null as null | { granted: boolean; canAskAgain: boolean },
    ask: vi.fn(),
    getAssetsAsync: vi.fn(),
    getAssetInfoAsync: vi.fn(),
    presentPermissionsPickerAsync: vi.fn(),
  },
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
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'session', user: { id: 'me' }, datesBetweenDays: false }),
}));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useLocalSearchParams: () => params,
  useRouter: () => router,
}));
vi.mock('expo-media-library/legacy', () => ({
  usePermissions: () => [lib.access, lib.ask],
  getAssetsAsync: lib.getAssetsAsync,
  getAssetInfoAsync: lib.getAssetInfoAsync,
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
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

import { memory, photo, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import UploadScreen from '@/app/memory/[id]/upload';
import { Button, ConfirmSheet, Tile } from '@/kit';
import { ru } from '@/strings';

/**
 * TASK-584: a file picked off the phone that this same person already gave this memory is asked
 * about before the sending, and the answer decides what goes into the queue — everything, or only
 * what is new. The phone's gallery and the queue are stood in for; what is read is what «Отправить»
 * hands over after each of the two answers.
 */

mountsTrees();

const at = (day: number, hour = 12, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();
const asset = (id: string, when: number, over: Partial<Asset> = {}): Asset => ({
  id,
  uri: `ph://${id}`,
  filename: `IMG_${id}.HEIC`,
  mediaType: 'photo',
  creationTime: when,
  modificationTime: when,
  duration: 0,
  width: 4032,
  height: 3024,
  ...over,
});

/** Two frames of the 13th and one of the 12th, newest first. */
const roll = (): Asset[] => [
  asset('a1', at(13, 20)),
  asset('a2', at(13, 15)),
  asset('b1', at(12, 18)),
];

const when = (day: number, hour = 12, minute = 0) => new Date(at(day, hour, minute)).toISOString();

beforeEach(() => {
  lib.access = { granted: true, canAskAgain: true };
  lib.ask.mockReset();
  lib.getAssetsAsync.mockReset();
  lib.getAssetsAsync.mockResolvedValue({
    assets: roll(),
    hasNextPage: false,
    endCursor: undefined,
  });
  // The original is on the phone for every picked asset: a path to open, and nothing more is said
  // about its size here — the disk stand-in has not been handed those files, which is «cannot tell».
  lib.getAssetInfoAsync.mockReset();
  lib.getAssetInfoAsync.mockImplementation(async (one: Asset) => ({
    ...one,
    localUri: `file:///photos/${one.id}`,
  }));
  lib.presentPermissionsPickerAsync.mockReset();
  for (const fn of [uploads.enqueue, uploads.drop, uploads.wake, uploads.answerAskAll])
    fn.mockReset();
  for (const key of Object.keys(params)) delete params[key as keyof typeof params];
  params.id = 'm1';
  uploads.queue = [];
  uploads.asking = null;
  serve((asked) => {
    if (asked.path === '/memories') return [memory()];
    // This person already gave a1 to this memory; liza gave one shot at the same instant as a2,
    // and hers says nothing about what this person has sent.
    if (asked.path === '/memories/m1/media')
      return [
        photo('own-a1', 'me', when(13, 20), { size_bytes: '4000000' }),
        photo('liza-a2', 'liza', when(13, 15), { size_bytes: '4000000' }),
      ];
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<UploadScreen />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const screen = {
    press,
    tile: (id: string) => () =>
      root.findAllByType(Tile).find((one) => one.props.uri === `ph://${id}`)!,
    send: () => root.findAllByType(Button).find((one) => one.props.wide)!,
    ask: () => root.findAllByType(ConfirmSheet)[0],
  };
  return screen;
}

test('a file this person already gave the memory is not sent in silence: the question comes up instead', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(() => screen.send());
  // Nothing went: the answer comes first, and it names the one copy that is already there.
  expect(uploads.enqueue).not.toHaveBeenCalled();
  expect(screen.ask().props.visible).toBe(true);
  expect(screen.ask().props.title).toBe(ru.upload.alreadyThere(1));
  expect(ru.upload.alreadyThere(1)).toBe('Этот файл уже есть в воспоминании');
  expect(screen.ask().props.confirmLabel).toBe('Да');
  expect(screen.ask().props.cancelLabel).toBe('Нет');
});

test('«Да» sends everything picked, the copies included', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.tile('a2'));
  await screen.press(() => screen.send());
  expect(screen.ask().props.visible).toBe(true);
  // One repeat of two picked files: the question names one, the count says many.
  expect(screen.ask().props.title).toBe(ru.upload.alreadyThere(1));
  await act(async () => screen.ask().props.onConfirm());
  expect(uploads.enqueue).toHaveBeenCalledWith('m1', [
    expect.objectContaining({ id: 'a1' }),
    expect.objectContaining({ id: 'a2' }),
  ]);
});

test('«Нет» sends only what is new, and a selection of nothing but copies sends nothing at all', async () => {
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.tile('a2'));
  await screen.press(() => screen.send());
  await act(async () => screen.ask().props.onCancel());
  expect(uploads.enqueue).toHaveBeenCalledTimes(1);
  expect(uploads.enqueue).toHaveBeenCalledWith('m1', [expect.objectContaining({ id: 'a2' })]);

  // The next pick is the copy alone: «Нет» leaves nothing to send, and the queue is not touched.
  uploads.enqueue.mockReset();
  const again = await open();
  await again.press(again.tile('a1'));
  await again.press(() => again.send());
  expect(again.ask().props.visible).toBe(true);
  await act(async () => again.ask().props.onCancel());
  expect(uploads.enqueue).not.toHaveBeenCalled();
});

test('a pick with nothing repeated sends without a question', async () => {
  const screen = await open();
  await screen.press(screen.tile('a2'));
  await screen.press(() => screen.send());
  expect(screen.ask().props.visible).toBe(false);
  expect(uploads.enqueue).toHaveBeenCalledWith('m1', [expect.objectContaining({ id: 'a2' })]);
});

test('several repeats are said as a count, and choosing every frame repeats every one of them', async () => {
  lib.getAssetsAsync.mockResolvedValue({
    assets: [asset('a1', at(13, 20)), asset('b1', at(12, 18))],
    hasNextPage: false,
    endCursor: undefined,
  });
  serve((asked) => {
    if (asked.path === '/memories') return [memory()];
    if (asked.path === '/memories/m1/media')
      return [
        photo('own-a1', 'me', when(13, 20), { size_bytes: '4000000' }),
        photo('own-b1', 'me', when(12, 18), { size_bytes: '4000000' }),
      ];
    return undefined;
  });
  const screen = await open();
  await screen.press(screen.tile('a1'));
  await screen.press(screen.tile('b1'));
  await screen.press(() => screen.send());
  expect(screen.ask().props.visible).toBe(true);
  expect(screen.ask().props.title).toBe(ru.upload.alreadyThere(2));
  expect(ru.upload.alreadyThere(2)).toBe('2 файла уже есть в воспоминании');
});
