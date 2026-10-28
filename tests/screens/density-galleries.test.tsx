import { afterEach, beforeEach, expect, test, vi } from 'vitest';

/**
 * The pinch that walks the density, in every gallery but the feed (spec 10.14.1, TASK-564): «Мои
 * кадры», the roll of «Добавить кадры» and the montage's picker all read the one value the feed
 * walks, so a two-finger drag right on each of them moves it and re-cuts the grid — down to the
 * single frame at the far end of the scale (spec 10.14.2). The feed's own is
 * `frames-feed-flow.test.tsx`; this file is the other three, and the check that goes red when one
 * of them loses the gesture or stops reading the pick whole.
 */

const { router, lib, uploads } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  // The phone's library, as far as the roll can see it.
  lib: {
    access: null as null | { granted: boolean; canAskAgain: boolean; accessPrivileges?: string },
    ask: vi.fn(),
    getAssetsAsync: vi.fn(),
    presentPermissionsPickerAsync: vi.fn(),
  },
  // The queue the screens hand material to; none of these three tests sends anything.
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
// The screens read on focus, and the router that says when is not here: focus is «now, once».
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => ({ id: 'm1' }),
    useRouter: () => router,
  };
});
vi.mock('@/lib/upload/send', () => ({
  useUploads: () => uploads.queue,
  useAskAll: () => uploads.asking,
  enqueue: uploads.enqueue,
  drop: uploads.drop,
  wake: uploads.wake,
  answerAskAll: uploads.answerAskAll,
}));
vi.mock('expo-media-library/legacy', () => ({
  usePermissions: () => [lib.access, lib.ask],
  getAssetsAsync: lib.getAssetsAsync,
  presentPermissionsPickerAsync: lib.presentPermissionsPickerAsync,
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

import { member, memory, photo, serve } from '@tests/helpers/api';
import { pinch } from '@tests/helpers/gesture';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { MediaItem } from '@/api';
import MyFramesScreen from '@/app/memory/[id]/mine';
import PickFramesStep from '@/app/memory/[id]/order/frames';
import UploadScreen from '@/app/memory/[id]/upload';
import { Tile } from '@/kit';
import { currentDensity, setDensity } from '@/lib/density';
import { DensityPill } from '@/screens/memory/frames-density';
import { OrderProvider } from '@/screens/order/wizard';

mountsTrees();

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).getTime();
const asset = (id: string, when: number) => ({
  id,
  uri: `ph://${id}`,
  filename: `IMG_${id}.HEIC`,
  mediaType: 'photo' as const,
  creationTime: when,
  duration: 0,
});

/** The phone's roll: three frames of the 13th and two of the 12th, newest first. */
const roll = () => [
  asset('a1', at(13, 20)),
  asset('a2', at(13, 15)),
  asset('a3', at(13, 9)),
  asset('b1', at(12, 18)),
  asset('b2', at(12, 8)),
];

/** What the memory holds, one of them this person's own — the material all three galleries cut. */
const material = (): MediaItem[] => [
  photo('a', 'me', new Date(at(13, 20)).toISOString()),
  photo('b', 'liza', new Date(at(13, 9)).toISOString()),
  photo('c', 'liza', new Date(at(12, 15)).toISOString()),
  photo('d', 'me', new Date(at(12, 8)).toISOString()),
  photo('e', 'me', new Date(at(11, 10)).toISOString()),
  photo('f', 'liza', new Date(at(11, 9)).toISOString()),
];

beforeEach(async () => {
  // The density is one value for the whole app, and this file walks it: each test has to start at
  // the layout's three, or the grid it mounts is cut at whatever the last one ended on.
  await setDensity(3);
  lib.access = { granted: true, canAskAgain: true };
  lib.getAssetsAsync.mockReset();
  lib.getAssetsAsync.mockResolvedValue({
    assets: roll(),
    hasNextPage: false,
    endCursor: undefined,
  });
  serve((asked) => {
    if (asked.path === '/memories') return [memory()];
    if (asked.path === '/memories/m1/media') return material();
    if (asked.path === '/memories/m1/members') return [member('me', 'organizer', { name: 'Я' })];
    if (asked.path === '/memories/m1/labels') return [];
    return undefined;
  });
});
afterEach(() => vi.unstubAllGlobals());

/** The view the pinch is hung on, wherever the gallery is — the feed's own testID, on all four. */
const pinchView = (root: TestRenderer.ReactTestInstance) => () =>
  root.find((one) => one.props.testID === 'density-pinch');
/** How wide the grid cuts a frame — the thing the pinch is seen to re-cut. */
const cellWidth = (root: TestRenderer.ReactTestInstance) =>
  StyleSheet.flatten(root.findAllByType(Tile)[0].props.style).width as number;

/** Mount a gallery and hand back what a test drives it by. */
async function mount(drawn: () => React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(drawn()));
  });
  const root = tree.root;
  return {
    root,
    /** Two fingers down, and then moved to `spread` points apart, about where they landed. */
    grant: () => act(async () => pinchView(root)().props.onResponderGrant(pinch({ spread: 200 }))),
    move: (spread: number) =>
      act(async () => pinchView(root)().props.onResponderMove(pinch({ spread }))),
  };
}

test('«Мои кадры»: the pinch walks the density and the grid re-cuts to the single frame', async () => {
  const screen = await mount(() => <MyFramesScreen />);
  const before = cellWidth(screen.root);
  // Nothing of the density is on screen until a second finger lands: the capsule is the bar's own.
  expect(screen.root.findAllByType(DensityPill)).toHaveLength(0);
  await screen.grant();
  expect(screen.root.findAllByType(DensityPill)).toHaveLength(1);
  expect(screen.root.findByType(DensityPill).props.value).toBe(3);
  // Squeezing the fingers together cuts more to a row, and the frames of the grid come out narrower.
  await screen.move(100);
  expect(currentDensity()).toBe(5);
  expect(cellWidth(screen.root)).toBeLessThan(before);
  // Spreading them back apart walks the other way, all the way to the single frame at the far end.
  await screen.move(400);
  expect(currentDensity()).toBe(1);
  expect(screen.root.findByType(DensityPill).props.value).toBe(1);
  // One frame to a row, the whole width and no gutter (spec 10.14.2).
  expect(cellWidth(screen.root)).toBe(390);
});

test('«Добавить кадры»: the pinch walks the density on the roll and re-cuts it to the single frame', async () => {
  const screen = await mount(() => <UploadScreen />);
  const before = cellWidth(screen.root);
  await screen.grant();
  expect(screen.root.findByType(DensityPill).props.value).toBe(3);
  await screen.move(100);
  expect(currentDensity()).toBe(5);
  expect(cellWidth(screen.root)).toBeLessThan(before);
  await screen.move(400);
  expect(currentDensity()).toBe(1);
  expect(cellWidth(screen.root)).toBe(390);
});

test('the montage’s picker: the pinch walks the density and re-cuts the grid to the single frame', async () => {
  const screen = await mount(() => (
    <OrderProvider id="m1">
      <PickFramesStep />
    </OrderProvider>
  ));
  const before = cellWidth(screen.root);
  await screen.grant();
  expect(screen.root.findByType(DensityPill).props.value).toBe(3);
  await screen.move(100);
  expect(currentDensity()).toBe(5);
  expect(cellWidth(screen.root)).toBeLessThan(before);
  // The far end: one column, and the grid's own 16 margins still on either side, so the frame is
  // the width between them with no gutter (spec 10.14.2).
  await screen.move(400);
  expect(currentDensity()).toBe(1);
  expect(cellWidth(screen.root)).toBe(390 - 16 * 2);
});

test('the pick is one value for the whole app: a gallery opens on what the feed walked it to', async () => {
  // The feed's own test walks it and «Мои кадры» is opened cold after: what the pick is, not the
  // layout's three, is where the grid stands (doc-12) — one value, every gallery.
  await setDensity(5);
  const screen = await mount(() => <MyFramesScreen />);
  expect(currentDensity()).toBe(5);
  expect(cellWidth(screen.root)).toBe((390 - 2 * 2) / 5);
});
