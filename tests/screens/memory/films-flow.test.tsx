import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, asked } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), setParams: vi.fn() },
  /** The `montage` parameter the route was opened with — what a frame’s sheet sets on the screen. */
  asked: { montage: undefined as string | undefined },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => ({ montage: asked.montage }),
    useRouter: () => router,
  };
});
// The player is `expo-video` over a window of its own — `film-player` is not what these tests are about.
vi.mock('@/screens/memory/film-player', () => ({
  FilmPlayer: () => null,
}));

import { expectReachable } from '@tests/helpers/access';
import { type Asked, later, memory, refused, serve } from '@tests/helpers/api';
import { thisYear2026 } from '@tests/helpers/clock';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { MONTAGE_STAGES, type Montage } from '@/api';
import { Banner, Button, CardMontage, CardMontageNew, EmptyMontages } from '@/kit';
import { setLanguage } from '@/lib/language';
import { FilmPlayer } from '@/screens/memory/film-player';
import { Films } from '@/screens/memory/films';
import { BlockHead } from '@/screens/memory/head';
import { ru, strings } from '@/strings';

/**
 * The «Ролики» block at the head of a memory's feed (spec 8, `MemoryFrames` / `FilmsEmpty`): the
 * real api client over a stand-in server, and the fake clock for the seconds it waits while a film is
 * being cut. What is asserted is which cards stand in the strip and in which state, where a press on
 * each of them leads, who is offered the two buttons that are the organizer's, and what the strip
 * does with a read that is late.
 */

mountsTrees();

const SECONDS = 5000;
const clock = () =>
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  asked.montage = undefined;
  for (const fn of Object.values(router)) fn.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const film = (id: string, status: Montage['status'], over: Partial<Montage> = {}): Montage => ({
  id,
  memory_id: 'm1',
  ordered_by: { id: 'me', username: 'me', name: null },
  status,
  name: `Ролик ${id}`,
  template: null,
  size_bytes: null,
  duration_seconds: status === 'ready' ? 150 : null,
  params: {},
  error_text: null,
  created_at: new Date(2026, 8, 14, 12).toISOString(),
  video_url: status === 'ready' ? `https://r2.example/${id}.mp4` : null,
  poster_url: `https://r2.example/${id}.jpg`,
  stages: null,
  ...over,
});

type World = {
  films: Montage[];
  reads: number;
  read?: (nth: number) => unknown;
  onRetry?: unknown;
  log: Asked[];
};

function world(films: Montage[], over: Partial<Pick<World, 'read' | 'onRetry'>> = {}): World {
  const w: World = { films, reads: 0, log: [], ...over };
  w.log = serve((one) => {
    if (one.path === '/memories/m1/montages' && one.method === 'GET') {
      w.reads += 1;
      return w.read?.(w.reads) ?? w.films;
    }
    if (one.method === 'POST' && one.path.endsWith('/retry'))
      return w.onRetry ?? film(one.path.split('/')[4], 'queued');
    return undefined;
  });
  return w;
}

async function open(role: 'organizer' | 'contributor' | 'viewer' = 'organizer') {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<Films id="m1" memory={memory({ role, recent_thumbnail_urls: [] })} />),
    );
  });
  const root = tree.root;
  const screen = {
    root,
    press: (find: () => { props: { onPress?: () => void } }) =>
      act(async () => find().props.onPress?.()),
    cards: () => root.findAllByType(CardMontage),
    card: (id: string) =>
      root.findAllByType(CardMontage).find((one) => one.props.title === `Ролик ${id}`)!,
    heading: () => root.findByType(BlockHead).props as { title: string; count?: string },
    button: (label: string) =>
      root.findAllByType(Button).filter((one) => one.props.label === label),
    notices: () => root.findAllByType(Banner).map((one) => one.props.text as string),
  };
  return screen;
}

test('the heading counts the films, and says none yet while there are none — and nothing at all until the list has come', async () => {
  world([film('a', 'ready'), film('b', 'failed')]);
  const screen = await open();
  expect(screen.heading()).toMatchObject({ title: ru.montage.title, count: '2' });
  vi.unstubAllGlobals();
  world([]);
  const empty = await open();
  expect(empty.heading().count).toBe(ru.montage.noneYet);
});

test('a memory with no film is the dashed block and offers to cut one to the organizer alone', async () => {
  world([]);
  const organizer = await open('organizer');
  expect(organizer.root.findAllByType(EmptyMontages)).toHaveLength(1);
  expect(organizer.root.findByType(EmptyMontages).props.text).toBe(ru.montage.emptyNote);
  expect(organizer.cards()).toHaveLength(0);
  await organizer.press(() => organizer.button(ru.montage.makeIt)[0]);
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/memory/[id]/order',
    params: { id: 'm1' },
  });

  for (const role of ['contributor', 'viewer'] as const) {
    vi.unstubAllGlobals();
    world([]);
    const other = await open(role);
    expect(other.root.findAllByType(EmptyMontages), role).toHaveLength(1);
    expect(other.button(ru.montage.makeIt), role).toHaveLength(0);
  }
});

test.each(['ru', 'en'] as const)(
  'in %s «Смонтировать» on the empty strip is the paper 36 with its plus, felt at 44 and named for a screen reader',
  async (language) => {
    // Spec 8, detail 40 and 10.10: the plus and the words are one button, and it is a real one for a
    // finger — 36 drawn, the rest of the 44 the slop around it.
    await act(async () => setLanguage(language));
    try {
      world([]);
      const organizer = await open('organizer');
      const label = strings[language].montage.makeIt;
      const [make] = organizer.button(label);
      expect(make.props).toMatchObject({ variant: 'paper', size: 'mini', wide: false });
      expect(make.props.icon).toBe(Plus);
      expect(expectReachable(make)).toEqual([
        { name: label, role: 'button', width: undefined, height: 44 },
      ]);
    } finally {
      await act(async () => setLanguage('ru'));
    }
  },
);

test('the dashed «Новый ролик» stands first in the strip for the organizer only, and leads to the order', async () => {
  world([film('a', 'ready')]);
  const organizer = await open('organizer');
  expect(organizer.root.findAllByType(CardMontageNew)).toHaveLength(1);
  expect(organizer.root.findByType(CardMontageNew).props.label).toBe(ru.montage.newOne);
  await organizer.press(() => organizer.root.findByType(CardMontageNew));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/memory/[id]/order',
    params: { id: 'm1' },
  });
  // First: ahead of the film in the strip, in the order the cards are drawn.
  const order = organizer.root
    .findAll((one) => one.type === CardMontageNew || one.type === CardMontage)
    .map((one) => one.type);
  expect(order).toEqual([CardMontageNew, CardMontage]);

  for (const role of ['contributor', 'viewer'] as const) {
    vi.unstubAllGlobals();
    world([film('a', 'ready')]);
    const other = await open(role);
    expect(other.root.findAllByType(CardMontageNew), role).toHaveLength(0);
    // Everybody who brought material reads the strip, the viewer included.
    expect(other.cards(), role).toHaveLength(1);
  }
});

test('the three states of a film are three cards, and each leads where it should: the making, the film’s page, or the journal of the attempt that broke', async () => {
  world([
    film('q', 'queued'),
    film('p', 'processing'),
    film('r', 'ready', { params: { orientation: 'landscape', music_tracks: ['warm'] } }),
    film('f', 'failed'),
  ]);
  const screen = await open();
  expect(screen.cards().map((one) => one.props.state)).toEqual([
    'pending',
    'pending',
    'ready',
    'failed',
  ]);
  // Still being cut: the page that shows how far it has got.
  await screen.press(() => screen.card('q'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/montage/[montageId]',
    params: { id: 'm1', montageId: 'q' },
  });
  await screen.press(() => screen.card('p'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/montage/[montageId]',
    params: { id: 'm1', montageId: 'p' },
  });
  // Finished: the film’s own page.
  await screen.press(() => screen.card('r'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/montage/[montageId]/film',
    params: { id: 'm1', montageId: 'r' },
  });
  // Fallen: the same screen as a film being cut, stopped at the stage that broke — and the words say where.
  await screen.press(() => screen.card('f'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/memory/[id]/montage/[montageId]',
    params: { id: 'm1', montageId: 'f' },
  });
  expect(screen.card('f').props.caption).toBe(ru.montage.broke);
  // `MemoryFrames`: a film still being cut says its count and its scale, and no line under them.
  expect(screen.card('q').props.caption).toBeUndefined();
  expect(screen.card('p').props.caption).toBeUndefined();
  expect(screen.card('r').props.caption).toBeUndefined();
  // The badge on a card in the strip is the small one (spec 7.4, detail 24: 10 on `4 / 9`).
  for (const id of ['q', 'r', 'f']) expect(screen.card(id).props.badge.props.sm, id).toBe(true);
});

test('«Ролики» stands on a 24 line and the strip 10 under it, which puts the strip where the layout does', async () => {
  // `MemoryFrames` / `FilmsEmpty` (design/screens/*.html): the heading row is `height: 24px` in a
  // column with `gap: 10px` — the strip at 150 under a heading at 116, where the app had 10 under
  // an 18 line and stood 5 short.
  world([film('a', 'ready')]);
  const screen = await open();
  const head = screen.root.findByType(BlockHead);
  expect(StyleSheet.flatten(head.props.style)).toMatchObject({ minHeight: 24 });
  const block = screen.root.findAllByType(View)[0];
  expect(StyleSheet.flatten(block.props.style)).toMatchObject({ gap: 10 });
});

test('a finished film says what it was made of, and the ones that have nothing to show say nothing of it', async () => {
  world([
    film('r', 'ready', {
      params: { orientation: 'portrait', music_tracks: ['warm', 'music/abc'] },
    }),
    film('old', 'ready', { params: { music_track_id: 'road' } }),
    film('bare', 'ready'),
    film('p', 'processing', { params: { orientation: 'portrait' } }),
  ]);
  thisYear2026();
  const screen = await open();
  // «14 сентября · Тёплая» (`MemoryFrames.json` e16): the day a film was made, this year's, without
  // its year (spec 9).
  const day = '14 сентября';
  expect(screen.card('r').props.meta).toBe(
    `${day} · ${ru.montage.orientation.portrait} · ${ru.montage.track.warm} · ${ru.montage.ownTrackShort}`,
  );
  // Before the list of tracks there were two single fields, and an older film still names its track.
  expect(screen.card('old').props.meta).toBe(`${day} · ${ru.montage.track.road}`);
  expect(screen.card('bare').props.meta).toBe(day);
  expect(screen.card('p').props.meta).toBeUndefined();
});

test('a film being cut carries the stage it is on, «N из 5», counted the way the screen it leads to counts it — and one the worker has not opened carries none', async () => {
  // Five rows written at once: the stage being worked on is the one, and between two stages it is the one just done.
  const stages = (...states: ('done' | 'running' | 'failed' | 'pending')[]) =>
    MONTAGE_STAGES.map((stage, i) => ({ stage, state: states[i] ?? ('pending' as const) }));
  world([
    film('a', 'processing', { stages: stages('done', 'done', 'running') }),
    film('between', 'processing', { stages: stages('done', 'done') }),
    film('broke', 'failed', { stages: stages('done', 'failed') }),
    film('b', 'queued', { stages: null }),
    film('c', 'ready'),
  ]);
  const screen = await open();
  const step = (id: string) => screen.card(id).props.step;
  expect(step('a')).toEqual({ at: 3, of: 5, count: ru.montage.live.doneOf(3, 5) });
  expect(step('between')).toEqual({ at: 2, of: 5, count: ru.montage.live.doneOf(2, 5) });
  // A fallen film stands at the stage that fell over, and says it is that one.
  expect(step('broke')).toEqual({
    at: 2,
    of: 5,
    count: ru.montage.live.doneOf(2, 5),
    failed: true,
  });
  expect(step('b')).toBeUndefined();
  expect(step('c')).toBeUndefined();
});

test('only the organizer has the button under a fallen card, and it queues that very film again', async () => {
  const w = world([film('f', 'failed'), film('r', 'ready')]);
  const contributor = await open('contributor');
  expect(contributor.button(ru.action.retry)).toHaveLength(0);
  const screen = await open('organizer');
  expect(screen.button(ru.action.retry)).toHaveLength(1);
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(w.log.filter((one) => one.method === 'POST')).toEqual([
    { method: 'POST', path: '/memories/m1/montages/f/retry', body: null },
  ]);
  // The answer replaces the card without the list being read a second time: the same row, not a new one.
  expect(screen.cards().map((one) => one.props.title)).toEqual(['Ролик f', 'Ролик r']);
  expect(screen.card('f').props.state).toBe('pending');
  expect(w.reads).toBe(2);
  expect(screen.notices()).toEqual([]);
});

test('a retry that came too late says the film has moved on and reads the list again; a refusal says who may; anything else is the api’s word', async () => {
  const w = world([film('f', 'failed')], { onRetry: refused(409, 'not failed') });
  const screen = await open();
  const before = w.reads;
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(screen.notices()).toEqual([ru.montage.movedOn]);
  expect(w.reads).toBe(before + 1);

  w.onRetry = refused(403, 'no');
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(screen.notices()).toEqual([ru.montage.retryDenied]);

  w.onRetry = refused(500, 'boom');
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(screen.notices()).toEqual(['boom']);
});

test('a refusal or a failure of the retry gives the button back and does not read the list again; only «already moved on» does', async () => {
  const w = world([film('f', 'failed')], { onRetry: refused(403, 'no') });
  const screen = await open();
  expect(screen.button(ru.action.retry)[0].props.disabled).toBeFalsy();
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(w.reads).toBe(1);
  expect(screen.button(ru.action.retry)[0].props.disabled).toBe(false);
  w.onRetry = refused(500, 'boom');
  await screen.press(() => screen.button(ru.action.retry)[0]);
  expect(w.reads).toBe(1);
  expect(screen.button(ru.action.retry)[0].props.disabled).toBe(false);
});

test('a list that has not come yet is not a list being made: nothing reads it again until it has, and then only if something in it is owed', async () => {
  clock();
  const first = later<unknown>();
  const w = world([film('r', 'ready')], { read: (nth) => (nth === 1 ? first.promise : undefined) });
  const screen = await open();
  await wait(SECONDS * 3);
  expect(w.reads).toBe(1);
  await act(async () => first.settle([film('r', 'ready')]));
  await wait(SECONDS * 3);
  expect(w.reads).toBe(1);
  expect(screen.cards()).toHaveLength(1);
});

test('while a retry is in the air the button waits', async () => {
  const slow = later<unknown>();
  world([film('f', 'failed')], { onRetry: slow.promise });
  const screen = await open();
  await act(async () => void screen.button(ru.action.retry)[0].props.onPress());
  expect(screen.button(ru.action.retry)[0].props.disabled).toBe(true);
  await act(async () => slow.settle(film('f', 'queued')));
  expect(screen.card('f').props.state).toBe('pending');
});

test('a list that will not come is a banner over the strip with a way to try again — and the memory’s feed is not its business', async () => {
  let up = false;
  serve(() => (up ? [film('a', 'ready')] : 'offline'));
  const screen = await open();
  expect(screen.notices()).toEqual([ru.error.offline]);
  expect(screen.cards()).toHaveLength(0);
  expect(screen.heading().count).toBeUndefined();
  up = true;
  await act(async () => screen.button(ru.action.retry)[0].props.onPress());
  expect(screen.notices()).toEqual([]);
  expect(screen.cards()).toHaveLength(1);
});

test('while a film is being cut the strip reads again on its own, quietly, and stops when nothing is left to wait for', async () => {
  clock();
  const w = world([film('a', 'processing'), film('r', 'ready')]);
  const screen = await open();
  expect(w.reads).toBe(1);
  // Not yet: five seconds and no sooner.
  await wait(SECONDS - 1);
  expect(w.reads).toBe(1);
  // The film is done by now, its link signed afresh, and so is the finished one’s.
  w.films = [
    film('a', 'ready', { poster_url: 'https://r2.example/a2.jpg' }),
    film('r', 'ready', { poster_url: 'https://r2.example/r-signed-again.jpg' }),
  ];
  await wait(1);
  expect(w.reads).toBe(2);
  expect(screen.card('a').props.state).toBe('ready');
  expect(screen.card('a').props.poster).toBe('https://r2.example/a2.jpg');
  // The finished film keeps the link it had: a new url is a new player, and a film somebody is
  // watching would start again.
  expect(screen.card('r').props.poster).toBe('https://r2.example/r.jpg');
  // Nothing in the list is being made now, so the loop is over.
  await wait(SECONDS * 4);
  expect(w.reads).toBe(2);
});

test('a quiet read that was in the air when a film was retried does not put the old answer back over it', async () => {
  clock();
  const stale = later<Montage[]>();
  const w = world([film('a', 'processing'), film('f', 'failed')], {
    read: (nth) => (nth === 2 ? stale.promise : undefined),
  });
  const screen = await open('organizer');
  const before = [...w.films];
  await wait(SECONDS);
  expect(w.reads).toBe(2);
  // While that read is on its way the organizer starts the fallen film again.
  await act(async () => screen.button(ru.action.retry)[0].props.onPress());
  expect(screen.card('f').props.state).toBe('pending');
  // The answer that began before the press still has the film as fallen.
  await act(async () => stale.settle(before));
  expect(screen.card('f').props.state).toBe('pending');
  expect(screen.button(ru.action.retry)).toHaveLength(0);
});

test('a quiet read that fails says nothing and the loop goes on', async () => {
  clock();
  const w = world([film('a', 'processing')], {
    read: (nth) => (nth === 2 ? 'offline' : undefined),
  });
  const screen = await open();
  await wait(SECONDS);
  expect(screen.notices()).toEqual([]);
  expect(screen.cards()).toHaveLength(1);
  await wait(SECONDS);
  expect(w.reads).toBe(3);
});

test('the film a frame’s sheet asked for is raised once and the parameter is spent, so coming back does not raise it again', async () => {
  asked.montage = 'r';
  world([film('r', 'ready')]);
  const screen = await open();
  expect(router.setParams).toHaveBeenCalledWith({ montage: '' });
  expect(screen.root.findByType(FilmPlayer).props.film).toMatchObject({ id: 'r' });
  await act(async () => screen.root.findByType(FilmPlayer).props.onClose());
  expect(screen.root.findByType(FilmPlayer).props.film).toBeNull();
});

test('a film nobody asked for is not raised, and one that is not in the list raises nothing', async () => {
  world([film('r', 'ready')]);
  const screen = await open();
  expect(screen.root.findByType(FilmPlayer).props.film).toBeNull();
  expect(router.setParams).not.toHaveBeenCalled();
  asked.montage = 'gone';
  const other = await open();
  expect(other.root.findByType(FilmPlayer).props.film).toBeNull();
});
