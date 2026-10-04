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
import { bannersSaid, mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, RefreshControl } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { MediaItem, Member } from '@/api';
import { Banner, Empty, IconButton, Tile, Waiting } from '@/kit';
import { keepKept } from '@/lib/frames-kept';
import { Frames } from '@/screens/memory/frames';
import type { Head } from '@/screens/memory/head';
import { ru } from '@/strings';
import { duration } from '@/theme';

/**
 * The connection on a memory's screen (TASK-514, doc-12; `HomeOffline` and `HomeOnline` by words —
 * there is no offline mock of this screen to build from).
 *
 * The subject is what the plate is *allowed* to do, and every test here is written to fail if the
 * line it is about stops happening. Three of them are the ones a green run says nothing about:
 *
 * - the plate must appear on a break **and** the feed must stay where it is, whole and scrollable —
 *   checked against the list's own node and its rows, not against a count;
 * - it must **not** appear when the api answers, including when the api *refuses*: a refusal is the
 *   server's word, and putting «нет связи» over a feed that is fine is a lie about why;
 * - a read under the drawn feed must **never** light it — neither the catch-up on focus nor the
 *   three-second poll, which is the one that would put a banner over somebody's photographs every
 *   time a frame turns `ready`.
 *
 * And the last one is about the moment between the request going out and the answer coming back, on
 * purpose: every other check in this file reads the tree after the promise settled, and a spinner or
 * a banner that lights *during* the wait is invisible to all of them.
 */

mountsTrees();

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

/**
 * The api behind this test, over the three routes the screen reads. What the media listing answers
 * is the test's to change while the screen stands — that is the connection dropping and coming back,
 * which is the only thing this file is about.
 */
function world(over: { media?: MediaItem[]; read?: (nth: number) => unknown } = {}) {
  const w = {
    media: frames() as MediaItem[],
    members: people(),
    reads: 0,
    ...over,
    log: [] as Asked[],
  };
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

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<Frames id={ID} head={HEAD} />));
  });
  const root = tree.root;
  return {
    root,
    unmount: () => act(async () => tree.unmount()),
    /** The frames on the feed, in the order drawn. */
    feed: () => root.findAllByType(Tile).map((one) => String(one.props.uri).split('/').pop()),
    /** What every line on the screen says, with the sign beside it. */
    banners: () => bannersSaid(root).map(([words]) => words),
    /** The plate itself, apart from any other line — with the cross and the words beside it. */
    plate: () =>
      root
        .findAllByType(Banner)
        .map((one) => one.props)
        .filter((one) => one.text === ru.home.offline || one.text === ru.home.online)
        .map((one) => ({
          text: one.text as string,
          tone: one.tone as string | undefined,
          // The cross by its label: whether one is there at all is the whole of what is checked,
          // and a `Banner` carrying an `onPress` is not a difference anybody can see.
          hide: one.hide === undefined ? null : (one.hide as { label: string }).label,
        })),
    /** The cross on the plate, pressed. */
    hide: () =>
      act(async () =>
        root
          .findAllByType(IconButton)
          .find((one) => one.props.label === ru.action.hide)!
          .props.onPress(),
      ),
    /** The pull — a read somebody asked for, and the only one that may light the plate. */
    pull: () => act(async () => root.findByType(RefreshControl).props.onRefresh()),
    /** The list the finger is on. */
    list: () => root.findByType(FlatList),
    /**
     * The records the rows carry, in the order drawn — the feed's own contents rather than a count
     * of them, since a row is three frames wide and an emptied row and a rebuilt one can both come
     * to the same number of rows.
     */
    rows: () =>
      (root.findByType(FlatList).props.data as { frames?: { id: string }[] }[]).flatMap((row) =>
        (row.frames ?? []).map((one) => one.id),
      ),
    /** Every sign standing where the feed should be. */
    signs: () => ({
      waiting: root.findAllByType(Waiting).length,
      empty: root.findAllByType(Empty).length,
      refreshing: root.findByType(RefreshControl).props.refreshing as boolean,
    }),
  };
}

/** The phone as a previous launch left it — so the screen opens on the feed, not on a wait. */
const keptOnPhone = () => keepKept(ID, frames(), people());

beforeEach(() => {
  who.id = 'me';
  vi.clearAllMocks();
  keptOnPhone();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * #1 — the plate itself. The connection drops under a feed that is already on screen and stands where
 * a person can read it; the frames do not move, do not thin out and stay on a list that scrolls.
 */
test('a break puts a line above the feed and the feed is still there and still scrollable', async () => {
  const w = world();
  const screen = await open();
  expect(screen.feed()).toEqual(['a', 'b']);
  // The list a finger is on before anything happens to it.
  const wasList = screen.list();

  // The connection goes.
  w.log = serve(() => 'offline');
  await screen.pull();

  // Said where it is about what is under it, and it can be put away (`HomeOffline`, detail 47).
  expect(screen.plate()).toEqual([
    { text: ru.home.offline, tone: undefined, hide: ru.action.hide },
  ]);
  // The feed did not blink, did not thin out, and is still the same list a finger was on: the same
  // node with the same rows, not a rebuilt one that happens to look the same.
  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.list()).toBe(wasList);
  expect(screen.rows()).toEqual(['a', 'b']);
  // And nothing took the finger off it: the list is drawn, it is not told not to scroll, and neither
  // a wait nor an empty sign stands where the photographs were.
  expect(screen.list().props.scrollEnabled).not.toBe(false);
  expect(screen.signs()).toEqual({ waiting: 0, empty: 0, refreshing: false });
});

/**
 * The moment the answer has not come yet. Read after the promise settled this would be green in both
 * directions — a banner that stands only while the request is in the air is gone by the time the
 * test looks — so the check is between the start and the answer.
 *
 * Twice, and the second time matters more: a *quiet* read in flight is the catch-up TASK-512 put
 * under the feed, and an *asked* one is the pull. A plate lit on the way out rather than on the way
 * back is only visible between the two, and the pull is the read a person is watching.
 */
test('while a read is in the air the feed is left alone — no plate, no spinner over it', async () => {
  const answered = later<unknown>();
  world({ read: () => answered.promise });
  const screen = await open();

  await act(async () => {});
  // The read went out under a feed that is already drawn and nothing is lit over it.
  expect(screen.plate()).toEqual([]);
  expect(screen.signs()).toEqual({ waiting: 0, empty: 0, refreshing: false });
  expect(screen.feed()).toEqual(['a', 'b']);

  await act(async () => answered.settle(frames()));
  expect(screen.plate()).toEqual([]);
});

test('the pull lights nothing while it is in the air — the plate waits for an answer, either way', async () => {
  const answered = later<unknown>();
  const w = world({ read: () => answered.promise });
  const screen = await open();
  expect(screen.plate()).toEqual([]);

  // A pull out on a slow connection, which is the ordinary case rather than a broken one. The pull
  // hands the refresh control a read and does not wait for the answer, so the screen is standing
  // here with the request in the air.
  await screen.pull();
  // In the air: the connection has not been found to be gone. Nobody has said so yet, and the line
  // is about what the api did, not about how long it is taking.
  expect(screen.plate()).toEqual([]);
  expect(screen.feed()).toEqual(['a', 'b']);

  // And what the pull actually got is what the line then says.
  w.reads = 0;
  await act(async () => answered.settle(frames()));
  expect(screen.plate()).toEqual([]);
});

/**
 * The other side of the same line: a connection that never went is never announced, and — this is
 * the one a naive check misses — a server that *answers* is not a lost connection either, however
 * unfriendly the answer is.
 */
test('a connection that answers is never called a lost one — not even a refusal', async () => {
  const w = world();
  const screen = await open();
  expect(screen.plate()).toEqual([]);

  // The api is there and says no.
  w.log = serve((asked) => (asked.path.endsWith('/media') ? refused(403, 'forbidden') : people()));
  await screen.pull();
  expect(screen.plate()).toEqual([]);

  // And it is there and says yes, again and again.
  w.log = world().log;
  await screen.pull();
  await screen.pull();
  expect(screen.plate()).toEqual([]);
});

/**
 * #2 — it leaves by itself, and it is not waiting to be told. Three seconds, on a timer of its own
 * (spec 7.6: «через три секунды полосы уже не будет»), so a screen nobody touches any more finishes
 * saying it by itself.
 */
test('the news that the connection is back goes by itself after its own three seconds', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const w = world();
  const screen = await open();
  w.log = serve(() => 'offline');
  await screen.pull();
  expect(screen.plate()).toEqual([
    { text: ru.home.offline, tone: undefined, hide: ru.action.hide },
  ]);

  w.log = world().log;
  await screen.pull();
  // `HomeOnline`: one line, and no cross on it — it is already going, and a button on something
  // already going is a button nobody reaches.
  expect(screen.plate()).toEqual([{ text: ru.home.online, tone: 'done', hide: null }]);

  await act(async () => void vi.advanceTimersByTime(duration.hold - 500));
  expect(screen.plate()).toHaveLength(1);
  await act(async () => void vi.advanceTimersByTime(500));
  expect(screen.plate()).toEqual([]);
  expect(screen.feed()).toEqual(['a', 'b']);
});

/**
 * Putting the message away is not the connection coming back. Fold `hushed` into `ok` and somebody
 * who dismissed the line is never told when it returns — the quiet half of the pair (spec 7.6).
 */
test('the cross puts the message away and the good news is still owed afterwards', async () => {
  const w = world();
  const screen = await open();
  w.log = serve(() => 'offline');
  await screen.pull();
  await screen.hide();
  expect(screen.plate()).toEqual([]);

  // The connection comes back to somebody who had put the message away.
  w.log = world().log;
  await screen.pull();
  expect(screen.plate()).toEqual([{ text: ru.home.online, tone: 'done', hide: null }]);
});

/**
 * A read landing while the good news is already standing does not restart its three seconds — the
 * same object comes back, so a poll must not be able to hold the line there for as long as it keeps
 * answering.
 */
test('a read while the good news stands does not start its three seconds over', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const w = world();
  const screen = await open();
  w.log = serve(() => 'offline');
  await screen.pull();
  w.log = world().log;
  await screen.pull();
  expect(screen.plate()).toHaveLength(1);

  await act(async () => void vi.advanceTimersByTime(duration.hold - 500));
  // Another asked read, while the line is still standing.
  await screen.pull();
  await act(async () => void vi.advanceTimersByTime(500));
  expect(screen.plate()).toEqual([]);
});

/**
 * The meaning of `under`, and the reason this card sits on top of TASK-512's cache: a read the
 * screen makes underneath itself lights nothing. Neither the catch-up on focus — the screen opened
 * on what the phone had, and the api could not be reached at all — nor the three-second poll, which
 * is the one that would stand a banner over somebody's photographs every time a frame turned `ready`.
 */
test('a read under the drawn feed lights neither the plate nor a spinner, not even the poll', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  // Something still being made, so the three-second poll is running for as long as the screen stands.
  world({ media: [photo('a', 'me', at(13, 10)), developing('b', 'liza', at(12, 15))] });
  serve(() => 'offline');
  const screen = await open();

  // The focus read went out under the feed this phone had and came back with nothing at all.
  expect(screen.feed()).toHaveLength(2);
  expect(screen.plate()).toEqual([]);
  expect(screen.signs()).toEqual({ waiting: 0, empty: 0, refreshing: false });

  // And the poll, twice over — the read that is asked for by nothing but a frame turning `ready`.
  await act(async () => void vi.advanceTimersByTime(3000));
  await act(async () => void vi.advanceTimersByTime(3000));
  expect(screen.plate()).toEqual([]);
  expect(screen.signs()).toEqual({ waiting: 0, empty: 0, refreshing: false });
  expect(screen.feed()).toHaveLength(2);
});

/**
 * #3 — a break in the middle of working with the feed leaves a screen somebody can carry on with.
 * The plate is a line and not a state the screen gets stuck in: the frames underneath keep answering
 * a finger, and the next read that works clears the line on its own.
 */
test('a break mid-work leaves a screen still working, and the next answer clears the line', async () => {
  const w = world();
  const screen = await open();

  w.log = serve(() => 'offline');
  await screen.pull();
  expect(screen.plate()).toHaveLength(1);

  // The screen is not stuck: the feed is still drawn, still whole, and still on a scrolling list,
  // and the pull's spinner is not left spinning over any of it.
  expect(screen.feed()).toEqual(['a', 'b']);
  expect(screen.list().props.scrollEnabled).not.toBe(false);
  expect(screen.signs()).toEqual({ waiting: 0, empty: 0, refreshing: false });

  // And the way out is a read that works, not a button somebody has to hunt for.
  w.log = world().log;
  await screen.pull();
  expect(screen.plate()).toHaveLength(1);
  expect(screen.plate()[0].text).toBe(ru.home.online);
});
