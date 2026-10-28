import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, focus, phone } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn() },
  // How many times the screen has come into focus: the effect that reads the list runs again on each.
  focus: { n: 0 },
  // The phone's window and the type size it is set to; under node a window is nothing at all.
  phone: { height: 0, fontScale: 1 },
}));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({
      width: 360,
      height: phone.height,
      scale: 3,
      fontScale: phone.fontScale,
    }),
    // The plain container `vitest.setup.ts` makes of it: this mock replaces that one, it does not add.
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run, focus.n]),
    useRouter: () => router,
  };
});

import { later, memory, refused, serve } from '@tests/helpers/api';
import { measure, scrolled } from '@tests/helpers/board';
import { thisYear2026 } from '@tests/helpers/clock';
import { mounted, mountsTrees, themesShown } from '@tests/helpers/renderer';
import { FlatList, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Memory } from '@/api';
import HomeScreen from '@/app/index';
import {
  BadgeFilms,
  BadgeOrganizer,
  Banner,
  Board,
  Button,
  CardMemory,
  Empty,
  IconButton,
  Waiting,
} from '@/kit';
import { ru } from '@/strings';
import { duration, setTheme } from '@/theme';

/**
 * The list of memories (spec 8, `Main`): which card leads on the large one, what each card is handed —
 * the cover the organizer chose, the frames the listing signed, the bar of who has brought theirs —
 * and where the connection stands, drawn as a line over the list and never as a replacement for it.
 */

mountsTrees();

beforeEach(() => {
  focus.n = 0;
  Object.assign(phone, { height: 0, fontScale: 1 });
  for (const fn of Object.values(router)) fn.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const wedding = (over: Partial<Memory> = {}) =>
  memory({
    id: 'w',
    title: 'Свадьба',
    media_count: 486,
    recent_thumbnail_urls: ['https://r2.example/1', 'https://r2.example/2'],
    member_count: 5,
    contributed_member_count: 3,
    montage_count: 2,
    ...over,
  });

/**
 * What the listing answers: the memories themselves, `'offline'` for a connection that never came,
 * or a `refused(…)` **called on every read**. The call matters — a `Response` body is one-shot, so a
 * response handed back twice throws a `TypeError` on the second read, and a `TypeError` is not an
 * `ApiError`, which is the very thing this file is about: the stand-in would turn into the outage it
 * is meant to be about. A refusal is signed per request, as the api signs it.
 */
async function open(list: Memory[] | 'offline' | (() => Response) | Promise<unknown>) {
  const state = { list };
  serve(() => (typeof state.list === 'function' ? state.list() : state.list));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<HomeScreen />));
  });
  const root = tree.root;
  const screen = {
    state,
    root,
    cards: () => root.findAllByType(CardMemory).map((one) => one.props),
    card: (title: string) =>
      root.findAllByType(CardMemory).find((one) => one.props.title === title)!,
    banners: () =>
      root.findAllByType(Banner).map((one) => ({
        text: one.props.text as string,
        tone: one.props.tone as string | undefined,
      })),
    create: () => root.findAllByType(Button).find((one) => one.props.label === ru.home.create)!,
    press: (find: () => { props: { onPress?: () => void } }) =>
      act(async () => find().props.onPress?.()),
    pull: () =>
      act(async () =>
        root
          .findAllByType(Button)
          .find((one) => one.props.label === ru.action.retry)!
          .props.onPress(),
      ),
    /** The screen drawn again, as it is when the phone's window or type size changes under it. */
    redraw: () => act(async () => tree.update(<HomeScreen />)),
    /** Away and back: the screen comes into focus again and reads the list. */
    refocus: async () => {
      focus.n += 1;
      await act(async () => tree.update(<HomeScreen />));
    },
  };
  return screen;
}

test('the freshest memory leads on the large card — but only while it has a photograph to carry', async () => {
  const screen = await open([
    wedding({ id: 'a', title: 'С кадрами' }),
    wedding({ id: 'b', title: 'Вторая' }),
  ]);
  expect(screen.cards().map((one) => one.large)).toEqual([true, false]);
  // The memory just made is the freshest and the emptiest: it takes the ordinary card and its dashed film.
  vi.unstubAllGlobals();
  const fresh = await open([
    wedding({
      id: 'a',
      title: 'Только что',
      media_count: 0,
      recent_thumbnail_urls: [],
      cover_thumbnail_url: null,
    }),
    wedding({ id: 'b', title: 'Вторая' }),
  ]);
  expect(fresh.cards().map((one) => one.large)).toEqual([false, false]);
  // A cover is a photograph just as much, and carries the large card on its own; behind the first it does not.
  vi.unstubAllGlobals();
  const covered = await open([
    wedding({
      id: 'a',
      title: 'С обложкой',
      media_count: 0,
      recent_thumbnail_urls: [],
      cover_thumbnail_url: 'https://r2.example/cover',
    }),
    wedding({ id: 'b', title: 'Вторая', cover_thumbnail_url: 'https://r2.example/other' }),
  ]);
  expect(covered.cards().map((one) => one.large)).toEqual([true, false]);
});

test('each card is handed the cover, the signed frames and the days and count — and an api older than the fields sends none', async () => {
  thisYear2026();
  const screen = await open([
    wedding({ cover_thumbnail_url: 'https://r2.example/cover' }),
    wedding({ id: 'c', title: 'Без обложки', event_end: null, media_count: 1 }),
  ]);
  const [first, second] = screen.cards();
  expect(first.cover).toBe('https://r2.example/cover');
  expect(first.thumbs).toEqual(['https://r2.example/1', 'https://r2.example/2']);
  expect(first.meta).toEqual(['12–13 сентября', ru.memory.frames(486)]);
  expect(second.cover).toBeNull();
  // One day of this year is the day alone, like a span (spec 9: «3 октября»).
  expect(second.meta).toEqual(['12 сентября', ru.memory.frames(1)]);

  // The wider sample the listing drew from the whole memory leads the card when it is sent, and the
  // recent tail is what an api older than that field leaves behind (TASK-544).
  vi.unstubAllGlobals();
  const wider = await open([
    wedding({ card_thumbnail_urls: ['https://r2.example/a', 'https://r2.example/b'] }),
  ]);
  expect(wider.cards()[0].thumbs).toEqual(['https://r2.example/a', 'https://r2.example/b']);

  // Neither field in the answer at all: the same card, and nothing thrown inside the list.
  vi.unstubAllGlobals();
  const old = await open([
    { ...wedding(), cover_thumbnail_url: undefined, recent_thumbnail_urls: undefined } as never,
  ]);
  expect(old.cards()[0].cover).toBeNull();
  expect(old.cards()[0].thumbs).toEqual([]);
  expect(old.cards()[0].large).toBe(false);
});

test('the organizer is told so on the card, and the badge of films is there only where there are films', async () => {
  const screen = await open([
    wedding({ role: 'organizer', montage_count: 2 }),
    wedding({ id: 'c', title: 'Чужая', role: 'contributor', montage_count: 0 }),
  ]);
  const [mine, theirs] = screen.cards();
  expect(mine.organizer.type).toBe(BadgeOrganizer);
  expect(mine.films.type).toBe(BadgeFilms);
  // Filled over the photograph of the large card, outlined on the surface of an ordinary one.
  expect(mine.films.props.filled).toBe(true);
  expect(mine.films.props.label).toBe(ru.montage.count(2));
  expect(theirs.organizer).toBeUndefined();
  expect(theirs.films).toBeUndefined();
});

test('who has brought their frames is the summary the listing counted, on the large card and there alone', async () => {
  const screen = await open([
    wedding({ member_count: 5, contributed_member_count: 3 }),
    wedding({ id: 'b', title: 'Вторая', member_count: 4, contributed_member_count: 4 }),
  ]);
  const [first, second] = screen.cards();
  expect(first.progress).toBeCloseTo(0.6);
  expect(first.progressLabel).toBe(ru.home.brought(3, 5));
  expect(second.progress).toBeUndefined();
  expect(second.progressLabel).toBeUndefined();
  // An api too old to send the count draws no bar at all, rather than a full one over «0 из 0».
  vi.unstubAllGlobals();
  const old = await open([wedding({ member_count: 0, contributed_member_count: 0 })]);
  expect(old.cards()[0].progress).toBeUndefined();
});

test('an empty strip says why: nothing there yet, or frames the worker has not made thumbnails for', async () => {
  const screen = await open([
    wedding({ title: 'Пустая', media_count: 0, recent_thumbnail_urls: [] }),
    wedding({ id: 'b', title: 'Проявляется', media_count: 40, recent_thumbnail_urls: [] }),
  ]);
  expect(screen.card('Пустая').props.emptyText).toBe(ru.home.noFrames);
  expect(screen.card('Проявляется').props.emptyText).toBe(ru.state.preparing);
});

test('a press on a card opens that memory, the account button opens the account, and the one action creates', async () => {
  const screen = await open([wedding()]);
  await screen.press(() => screen.card('Свадьба'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/memory/[id]', params: { id: 'w' } });
  await screen.press(
    () => screen.root.findAllByType(IconButton).find((one) => one.props.label === ru.home.account)!,
  );
  expect(router.push).toHaveBeenLastCalledWith('/profile');
  await screen.press(screen.create);
  expect(router.push).toHaveBeenLastCalledWith('/create');
});

test('a list on its way holds the place with a wait and keeps the one action off; no memories is an invitation', async () => {
  const slow = later<unknown>();
  const loading = await open(slow.promise);
  expect(loading.root.findAllByType(Waiting)).toHaveLength(1);
  expect(loading.root.findAllByType(Empty)).toHaveLength(0);
  expect(loading.create().props.disabled).toBe(true);
  await act(async () => slow.settle([]));
  expect(loading.root.findAllByType(Waiting)).toHaveLength(0);
  const empty = loading.root.findByType(Empty);
  expect(empty.props.title).toBe(ru.home.emptyTitle);
  expect(loading.create().props.disabled).toBe(false);
});

test('the list starts at 114, and what stands in place of it is centred on 114…712', async () => {
  // Spec 4 and 8, `Main`: the first card at 114 — 18 under the bar, which ends at 96 — where the app
  // stood it 16 under. `HomeLoading` and `HomeEmpty` are centred on the body's layer, 114…712: under
  // the bar by the same 18, and over the edge by the bottom layer's gradient (132) rather than by its
  // button block (12 + 56 + 30) — 34 handed back at the foot. `HomeLoading.json` puts the ring at
  // 372, 413 − (44 + 18 + 20) / 2; centred on 96…746 it stood at 380.
  const [lead, overhang] = [114 - 96, 132 - (12 + 56 + 30)];
  const slow = later<unknown>();
  const screen = await open(slow.promise);
  expect(StyleSheet.flatten(screen.root.findByType(Board).props.body)).toMatchObject({
    paddingTop: lead,
    paddingBottom: overhang,
    justifyContent: 'center',
  });
  const list = () =>
    StyleSheet.flatten(screen.root.findByType(FlatList).props.contentContainerStyle);
  await act(async () => slow.settle([]));
  expect(list()).toMatchObject({
    paddingTop: lead,
    paddingBottom: overhang,
    justifyContent: 'center',
  });
  // With cards in it the list runs from the same 114 down, and nothing is centred.
  screen.state.list = [wedding()];
  await screen.refocus();
  expect(list()).toMatchObject({ paddingTop: lead });
  expect(list().justifyContent).toBeUndefined();
  expect(list().paddingBottom).not.toBe(overhang);
});

test('a list that never came is the failure in its place — not «no memories» — with a way to try again, and the action stays live', async () => {
  const screen = await open('offline');
  expect(screen.root.findByType(Empty).props.text).toBe(ru.error.offline);
  expect(screen.root.findAllByType(Empty)[0].props.title).toBeUndefined();
  expect(screen.create().props.disabled).toBe(false);
  screen.state.list = [wedding()];
  await screen.pull();
  expect(screen.cards()).toHaveLength(1);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);
  // Somebody who was shown the failure is told it has passed — that is `HomeOnline`.
  expect(screen.banners()).toEqual([{ text: ru.state.online, tone: 'done' }]);
});

test('a read that fails over a list that is there is a line above it that can be put away; the connection coming back is said once and leaves by itself', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const screen = await open([wedding()]);
  screen.state.list = 'offline';
  await screen.refocus();
  // The list stays: the connection is a line above it and never a replacement for it.
  expect(screen.cards()).toHaveLength(1);
  expect(screen.banners()).toEqual([{ text: ru.state.offline, tone: undefined }]);
  // Spec 4: «112 — … баннер связи на главном» — 16 under the bar's 96, not the list's 18 (the cards
  // then 12 under it, `HomeOffline.json` e4 → e9: 112 + 62 + 12 = 186). It stood at 114 (TASK-397).
  const lead = () =>
    StyleSheet.flatten(screen.root.findByType(FlatList).props.contentContainerStyle).paddingTop;
  expect(lead()).toBe(112 - 96);
  // Put away by hand, and the connection is still not back — so the good news is still owed.
  await screen.press(
    () => screen.root.findAllByType(IconButton).find((one) => one.props.label === ru.action.hide)!,
  );
  expect(screen.banners()).toEqual([]);
  expect(lead()).toBe(114 - 96);
  screen.state.list = [wedding()];
  await screen.refocus();
  expect(screen.banners()).toEqual([{ text: ru.state.online, tone: 'done' }]);
  expect(lead()).toBe(112 - 96);
  // It goes by itself after its time, and a read while it stands does not start the time over.
  await act(async () => void vi.advanceTimersByTime(duration.hold - 500));
  await screen.refocus();
  expect(screen.banners()).toHaveLength(1);
  await act(async () => void vi.advanceTimersByTime(500));
  expect(screen.banners()).toEqual([]);
  expect(screen.cards()).toHaveLength(1);
});

test('a connection that was never lost is never announced: a read that succeeds over a list that is fine says nothing', async () => {
  const screen = await open([wedding()]);
  await screen.refocus();
  expect(screen.banners()).toEqual([]);
});

/**
 * TASK-521 — the two screens asked two different questions and drew the same line.
 *
 * The memory screen (`frames-material.ts`) has stood one question since TASK-275: only a read nobody
 * got an answer at all is the connection, and a refusal is the api's own word about something else.
 * The home screen raised the plate on *any* failure, so every 403 or 404 over a list of memories
 * somebody's phone could read fine put «Нет связи с сервером» over it — the same plate saying «the
 * server is silent» about a server that had just answered.
 *
 * Written to go red the moment the guard goes, and checked from the drawn tree rather than off the
 * screen's state: the failure *is* reported (where there is a place for it), so what is being
 * checked is that the plate does not stand, not that nothing happened.
 */
test('a refusal is the api answering: the plate does not stand over a list that is fine', async () => {
  const screen = await open([wedding()]);
  expect(screen.cards()).toHaveLength(1);
  expect(screen.banners()).toEqual([]);

  // The api is there and says no.
  screen.state.list = () => refused(403, 'forbidden');
  await screen.refocus();

  // No «нет связи» anywhere: not the plate, and not the good news either — nothing was lost.
  expect(screen.banners()).toEqual([]);
  // The list is untouched underneath it, and the sign in the list's own place is not about a network.
  expect(screen.cards()).toHaveLength(1);
  expect(screen.root.findAllByType(Empty)).toHaveLength(0);

  // And it is there and says yes, again and again.
  screen.state.list = [wedding()];
  await screen.refocus();
  expect(screen.banners()).toEqual([]);
});

/** The other side of the same line, and the reason the guard is not just «never fail again». */
test('a real silence still stands the plate, over the same list that a refusal does not', async () => {
  const screen = await open([wedding()]);
  screen.state.list = 'offline';
  await screen.refocus();
  expect(screen.banners()).toEqual([{ text: ru.state.offline, tone: undefined }]);
  expect(screen.cards()).toHaveLength(1);
});

/**
 * A first load that was refused has no list to keep, so the failure stands where the list would have
 * been — and it says the api's own words, not «нет связи». Before the split there was one value for
 * both questions, and this is the case that read the reason off the plate.
 */
test('a first load that was refused is refused in its own words, not as a lost connection', async () => {
  const screen = await open(() => refused(403, 'нет прав'));
  expect(screen.root.findByType(Empty).props.text).toBe('нет прав');
  expect(screen.root.findAllByType(Empty)[0].props.title).toBeUndefined();
  // The list was never there, so there is nothing for a line above it to be about.
  expect(screen.banners()).toEqual([]);
  // And the way out is still there: the action is live and «Повторить» reads again.
  expect(screen.create().props.disabled).toBe(false);
  screen.state.list = [wedding()];
  await screen.pull();
  expect(screen.cards()).toHaveLength(1);
  expect(screen.banners()).toEqual([]);
});

test('in daylight the list is drawn in the day’s tokens and carries none of the night’s', async () => {
  // The night is what the harness starts in, and the detector sees it — or the empty answer below proves nothing.
  expect(themesShown((await open([wedding()])).root).night.length).toBeGreaterThan(0);
  await setTheme('light');
  try {
    const shown = themesShown((await open([wedding()])).root);
    expect(shown.night).toEqual([]);
    expect(shown.day.length).toBeGreaterThan(0);
  } finally {
    await setTheme('dark');
  }
});

/**
 * TASK-372 — the one screen whose body is a list, on the smallest phone at the largest type: the
 * bar and the layer with «Создать» stand still while they and a line of the list fit the window, and
 * once they do not they are the list's own head and foot — in every state the screen has, once each,
 * and both actions still answer.
 */
const STATES: [string, () => Memory[] | 'offline' | (() => Response) | Promise<unknown>][] = [
  ['a list of memories', () => [wedding({ id: 'a' }), wedding({ id: 'b', title: 'Вторая' })]],
  ['no memories', () => []],
  ['a list that never came', () => 'offline'],
  ['a list still on its way', () => later<unknown>().promise],
];

test.each(STATES)(
  '%s: the bar and «Создать» stand on a phone that holds them, and scroll with the body on one that does not',
  async (_, list) => {
    phone.height = 640;
    const screen = await open(list());
    const account = () =>
      screen.root.findAllByType(IconButton).filter((one) => one.props.label === ru.home.account);
    const create = () =>
      screen.root.findAllByType(Button).filter((one) => one.props.label === ru.home.create);
    await measure(screen.root, { bar: 60, footer: 130 });
    await screen.redraw();
    expect(scrolled(create()[0])).toBe(false);
    expect(scrolled(account()[0])).toBe(false);

    // 320 × 568 at ×3.571: the bar and the layer alone are taller than the window.
    Object.assign(phone, { height: 568, fontScale: 3.571 });
    await measure(screen.root, { bar: 150, footer: 420 });
    await screen.redraw();
    expect(create()).toHaveLength(1);
    expect(account()).toHaveLength(1);
    expect(scrolled(create()[0])).toBe(true);
    expect(scrolled(account()[0])).toBe(true);
    await screen.press(() => account()[0]);
    expect(router.push).toHaveBeenCalledWith('/profile');
    // Off while the list is still on its way, and live in every other state.
    const waiting = create()[0].props.disabled === true;
    expect(waiting).toBe(_ === 'a list still on its way');
    if (!waiting) {
      await screen.press(() => create()[0]);
      expect(router.push).toHaveBeenCalledWith('/create');
    }
  },
);
