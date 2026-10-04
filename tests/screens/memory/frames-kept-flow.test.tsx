import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { who, router, downloads } = vi.hoisted(() => ({
  who: { id: 'me' },
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  downloads: { maySaveToPhone: vi.fn(), saveToPhone: vi.fn(), shareFiles: vi.fn() },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'session', user: { id: who.id }, datesBetweenDays: false }),
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useRouter: () => router,
  };
});
vi.mock('@/screens/memory/films', () => ({ Films: () => null }));
vi.mock('@/screens/memory/frame-viewer', () => ({ FrameViewer: () => null }));
vi.mock('@/lib/downloads', () => downloads);
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import { type Asked, later, member, memory, photo, serve } from '@tests/helpers/api';
import { bannersSaid, mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, RefreshControl } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Member } from '@/api';
import { Banner, Empty, IconButton, Tile, Waiting } from '@/kit';
import { keepKept, readKept } from '@/lib/frames-kept';
import { Frames } from '@/screens/memory/frames';
import { BlockHead, type Head } from '@/screens/memory/head';
import { ru } from '@/strings';

/**
 * The memory screen opening on what this phone already has (TASK-512, part 2; doc-12: the screen
 * draws what is on the device first, and the requests go underneath, independently, without holding
 * the interface).
 *
 * The thing this file is careful about above all else, because it is the easiest here to get wrong:
 * **reading the cache and showing it are two different failures.** A screen that opened the file,
 * parsed the answer and put it nowhere would pass every check about the cache and sit on
 * «Загружаем…» forever. So the tests below assert both halves separately — what came off the phone,
 * and what is on screen — and never let one stand in for the other.
 */

mountsTrees();

/** The memory id as the api mints one; the store keeps nothing under any other name. */
const ID = '11111111-2222-3333-4444-555555555555';

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).toISOString();

const frames = () => [photo('a', 'me', at(13, 10)), photo('b', 'liza', at(12, 15))];
const people = (): Member[] => [
  member('me', 'organizer', { name: 'Я' }),
  member('liza', 'contributor', { name: 'Лиза Морозова' }),
];

const HEAD: Head = {
  memory: memory({ member_count: 2, media_count: 2 }),
  error: null,
  reload: () => {},
};

/** The api behind this test, over the three routes the screen reads. */
function world(over: { media?: unknown; members?: unknown; read?: (nth: number) => unknown } = {}) {
  const w = { media: frames(), members: people(), reads: 0, ...over, log: [] as Asked[] };
  w.log = serve((asked) => {
    if (asked.path === `/memories/${ID}/media` && asked.method === 'GET') {
      w.reads += 1;
      return w.read?.(w.reads) ?? w.media;
    }
    if (asked.path === `/memories/${ID}/members`) return w.members;
    if (asked.path === `/memories/${ID}/labels`) return [];
    return undefined;
  });
  return w;
}

/** The phone as a previous launch left it: this memory's feed, kept, with nothing else on it. */
const keptOnPhone = () => keepKept(ID, frames(), people());

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<Frames id={ID} head={HEAD} />));
  });
  const tile = (id: string) => () =>
    tree.root.findAllByType(Tile).find((one) => one.props.cacheKey === `${id}:thumb`)!;
  return {
    root: tree.root,
    unmount: () => act(async () => tree.unmount()),
    tile,
    /** The frames on the feed, in the order drawn. */
    feed: () => tree.root.findAllByType(Tile).map((one) => String(one.props.uri).split('/').pop()),
    /** The links the tiles were handed — what moves when the api signs afresh. */
    links: () => tree.root.findAllByType(Tile).map((one) => one.props.uri),
    /** What each frame is filed under on the phone — the node, not its place in a list. */
    keys: () => tree.root.findAllByType(Tile).map((one) => one.props.cacheKey),
    /** The rows the list was handed, which is what a scroll position is kept against. */
    rows: () =>
      tree.root.findByType(FlatList).props.data as { key: string; frames?: { id: string }[] }[],
    /** The list itself — the same one across an answer is what «the feed was not torn down» means. */
    list: () => tree.root.findByType(FlatList),
    /** The record every frame row stands for, in the order drawn: what the row's own key says. */
    rowKeys: () =>
      (tree.root.findByType(FlatList).props.data as { frames?: { id: string }[] }[])
        .flatMap((row) => row.frames ?? [])
        .map((one) => one.id),
    /** Every sign standing where the feed should be: waiting, empty, an error, the spinner. */
    state: () => ({
      waiting: tree.root.findAllByType(Waiting).length,
      empty: tree.root.findAllByType(Empty).length,
      banners: bannersSaid(tree.root).map(([words]) => words),
      refreshing: tree.root.findByType(RefreshControl).props.refreshing as boolean,
    }),
    /** A press on a control the screen actually drew, by what it is called. */
    pressLabel: async (label: string) =>
      act(async () =>
        tree.root
          .findAllByType(IconButton)
          .find((one) => one.props.label === label)!
          .props.onPress(),
      ),
    tap: async (id: string) => act(async () => tile(id)().props.onPress?.()),
    pull: () => act(async () => tree.root.findByType(RefreshControl).props.onRefresh()),
  };
}

/** The signs a screen shows when it is waiting, and the count over what is on screen. */
const SIGNS = { waiting: 0, empty: 0, banners: [], refreshing: false };

beforeEach(() => {
  vi.clearAllMocks();
  // The phone as a previous launch left it: this memory's feed, kept. Seeded before every test so
  // that one which expects nothing cached says so itself, rather than passing on what the last
  // test happened to leave behind.
  keptOnPhone();
});
// `serve` stands in for `fetch`, and one left standing would answer for the next test's api.
afterEach(() => vi.unstubAllGlobals());

/**
 * The one the card is about: a phone with no connection, opening a memory it has been in before.
 * The feed is on screen on the same tick as the screen that shows it — nothing waiting, nothing
 * empty, no error — and the api is asked underneath anyway.
 */
test('the feed opens on what the phone has, with the api not answering at all', async () => {
  serve(() => 'offline');
  const screen = await open();

  // Shown: the two frames this phone kept, in the feed's own order, and no sign of waiting.
  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.state()).toEqual(SIGNS);
  // Read and shown as a count: the block over the material has a number to count because the roster
  // came off the phone with the frames.
  expect(screen.root.findByType(BlockHead).props.count).toBe(ru.memory.frames(2));
  // And the frames are the same records, not merely the same number of them.
  expect(screen.keys()).toEqual(['a:thumb', 'b:thumb']);
});

test('the read still goes out underneath, and what comes back does not blink the feed', async () => {
  const answered = later<unknown>();
  const w = world({ read: () => answered.promise });
  const screen = await open();

  // Asked while the feed was already drawn — the request goes on independently of the screen, which
  // is the whole of «запросы идут независимо».
  expect(w.reads).toBe(1);
  expect(screen.feed()).toEqual(['a', 'b']);

  // The answer lands. Same two frames and the same links, so nothing on screen goes away and comes
  // back — the catch-up updates in place rather than clearing and redrawing.
  const before = screen.links();
  await act(async () => answered.settle(frames()));
  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.links()).toEqual(before);
  expect(screen.state()).toEqual(SIGNS);
});

// The links this phone drew from have expired by now — the api signs them for a quarter of an hour.
// A catch-up that kept them still would leave every frame on the screen drawing a link that is dead,
// which is the offline screen the card is meant to fix.
test('a catch-up takes the links the api signed afresh, not the expired ones off the phone', async () => {
  const answered = later<unknown>();
  world({ read: () => answered.promise });
  const screen = await open();
  // What came off the phone is the old signature, as a launch an hour later would see it.
  expect(screen.links()).toEqual(['https://r2.example/a', 'https://r2.example/b']);

  const w = world();
  w.media = frames().map((one) => ({ ...one, thumbnail_url: `${one.thumbnail_url}?sig=fresh` }));
  await act(async () => answered.settle(w.media));

  expect(screen.links()).toEqual([
    'https://r2.example/a?sig=fresh',
    'https://r2.example/b?sig=fresh',
  ]);
  // The keys do not move: the same records, not a new sheet.
  expect(screen.keys()).toEqual(['a:thumb', 'b:thumb']);
});

test('what the api sends underneath replaces the feed in place, every frame keeping its node', async () => {
  // A third frame, and the reading order puts it first — so a feed that rebuilt itself from nothing
  // would shift under the person looking at it. The rows are keyed by record, and a record that was
  // on screen stays the same node in the new list.
  const answered = later<unknown>();
  world({ read: () => answered.promise });
  const screen = await open();
  const was = { list: screen.list(), rowKeys: screen.rowKeys() };

  const fresh = [photo('new', 'me', at(14, 9)), ...frames()];
  await act(async () => answered.settle(fresh));

  expect(screen.feed()).toEqual(['new', 'a', 'b']);
  expect(screen.keys()).toEqual(['new:thumb', 'a:thumb', 'b:thumb']);
  // What a scroll position is kept against is the row's own key, and the keys of the frames that
  // were already there have not moved — `a` is still keyed by `a`, so an answer that only added a
  // frame above it does not take the person back to the top.
  expect(screen.rowKeys()).toEqual(['new', 'a', 'b']);
  expect(was.rowKeys).toEqual(['a', 'b']);
  // And the same list the finger is on, which a screen that tore the feed down and built it again
  // would not be: that is the blink.
  expect(screen.list()).toBe(was.list);
  expect(screen.state()).toEqual(SIGNS);
});

// The two halves that read alike, kept apart. This is the first: the cache is read, the answer goes
// into state, and nothing is drawn from it because the screen went on waiting for the network.
test('a cache that was read but never shown is not a cache that works', async () => {
  serve(() => 'offline');
  const screen = await open();

  // Read: the file was opened and it had this in it. Without this the two assertions below would
  // pass on a phone that had simply never cached anything.
  expect(readKept(ID)).not.toBeNull();
  // Shown: and `Waiting` is gone. Standing there is the screen that read the file and threw the
  // answer away — the failure a cache-shaped check cannot see.
  expect(screen.state().waiting).toBe(0);
  expect(screen.state().refreshing).toBe(false);
  expect(screen.feed()).toEqual(['a', 'b']);
});

// Everything a person can do with a feed works over what came off the phone, before the api has said
// a word: a frame opens, frames are marked, the count moves.
test('the cached feed is live — it opens a frame and takes marks, with no answer in the air', async () => {
  serve(() => 'offline');
  const screen = await open();

  // A frame opens: the viewer is mounted off a record that came off the phone.
  await screen.tap('a');
  // And the picking works over the same feed — marked, and nothing the api was asked is behind it.
  await screen.pressLabel(ru.gallery.select);
  await screen.tap('a');
  await screen.pressLabel(ru.gallery.leaveSelect);

  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.state()).toEqual(SIGNS);
  // The mark really went through the screen's own state: on the way out of picking nothing is marked
  // again, so what is checked here is that a tap on a cached frame reached the screen at all.
  expect(screen.tile('a')().props.pick).toBeUndefined();
});

// The rule as the human set it, at the screen rather than in the store: leaving a memory does not
// take the list with it. It is wiped by the session and by nothing else — «после выхода из
// воспоминания список остаётся».
test('leaving the memory leaves the list on the phone', async () => {
  world();
  const screen = await open();
  await screen.unmount();

  // Read: the list is still where the last session left it — the screen going did not take it.
  expect(readKept(ID)).not.toBeNull();
  // And shown: reopened with no network, the same feed is on screen.
  serve(() => 'offline');
  const again = await open();
  expect(again.feed()).toEqual(['a', 'b']);
});

// The other half of the same sentence, and the one that would bite: a read that fails writes
// nothing, so the list the phone had is still the list it has — and the next launch opens on it
// rather than on nothing.
test('a read that fails does not empty what the phone already had', async () => {
  const w = world({ read: () => 'offline' });
  const screen = await open();

  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.state()).toEqual(SIGNS);
  // Read: and the failed answer left the file alone rather than writing an empty list over it.
  expect(readKept(ID)).not.toBeNull();
  expect(w.reads).toBe(1);
});

// A refusal over frames already on screen must not bring a banner with it: the person is looking at
// a feed that is fine, and a reason over it would be a lie about why.
test('a failed read underneath says nothing over the frames that are already there', async () => {
  const answered = later<unknown>();
  const w = world({ read: () => answered.promise });
  const screen = await open();
  expect(screen.feed()).toEqual(['a', 'b']);

  // Refused and unreachable, in turn: neither lights a spinner nor says a word over the feed.
  await act(async () => answered.settle(new Error('refused')));
  expect(screen.state()).toEqual(SIGNS);
  await act(async () => answered.settle(new TypeError('offline')));
  expect(screen.state()).toEqual(SIGNS);
  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.root.findAllByType(Banner)).toHaveLength(0);
  expect(w.reads).toBe(1);
});
