import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));

/**
 * The router the wizard walks on, kept in a list: each `push` is one more step standing under the
 * one before it, all of them mounted, the way the app's own stack keeps them — which is what lets a
 * step going away be the wizard's signal to stop the autopilot. `landed` is wherever the wizard sent
 * the app once it left its own routes.
 */
const nav = vi.hoisted(() => {
  type Entry = { key: number; step: string };
  type Href = { pathname: string; params?: Record<string, unknown> };
  let stack: Entry[] = [];
  let seen = stack;
  let keys = 0;
  const watchers = new Set<() => void>();
  const state = {
    landed: null as Href | null,
    /** Every step pushed since the wizard opened — the autopilot's own moves included. */
    pushed: [] as string[],
  };
  const emit = () => {
    seen = [...stack];
    for (const watch of watchers) watch();
  };
  const stepOf = (href: Href) =>
    /^\/memory\/\[id\]\/order(?:\/(\w+))?$/.exec(href.pathname)?.[1] ??
    (href.pathname.endsWith('/order') ? 'index' : null);
  const entry = (step: string): Entry => {
    keys += 1;
    return { key: keys, step };
  };
  const router = {
    push(href: Href) {
      const step = stepOf(href);
      if (step === null) state.landed = href;
      else {
        state.pushed.push(step);
        stack.push(entry(step));
      }
      emit();
    },
    replace(href: Href) {
      const step = stepOf(href);
      if (step === null) {
        state.landed = href;
        stack = [];
      } else stack = [...stack.slice(0, -1), entry(step)];
      emit();
    },
    back() {
      stack = stack.slice(0, -1);
      emit();
    },
    canGoBack: () => stack.length > 1,
    dismissAll() {
      stack = stack.slice(0, 1);
      emit();
    },
    dismissTo(href: Href) {
      const at = stack.map((one) => one.step).lastIndexOf(stepOf(href) ?? '');
      if (at >= 0) stack = stack.slice(0, at + 1);
      emit();
    },
  };
  return {
    router,
    state,
    top: () => stack.at(-1)?.step,
    reset() {
      stack = [entry('index')];
      state.landed = null;
      state.pushed = [];
      emit();
    },
    subscribe(watch: () => void) {
      watchers.add(watch);
      return () => void watchers.delete(watch);
    },
    snapshot: () => seen,
  };
});
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
  useRouter: () => nav.router,
}));
// The shelf's speaker and the phone's file picker are native; this test never presses either.
vi.mock('@/music', () => ({
  useTrackPreview: () => ({ playing: null, toggle: async () => {} }),
  sendOwnTrack: async () => 'music/own',
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: async () => ({ canceled: true }) }));
// A text input listens on the browser's `document`, which a test renderer has none of: both inputs
// stand in as a bare element carrying their props, and a test types by calling `onChangeText`.
//
// The phone's «reduce motion» setting is the person's to flip: off by default, as on a phone that has
// never been asked, so the walk types and rides; a test may switch it on. Node itself answers «on».
const calm = vi.hoisted(() => ({ on: false }));
vi.mock('@/kit', async (original) => {
  const { createElement } = await import('react');
  const input = (props: object) => createElement('input-stub', props);
  return {
    ...(await original<typeof import('@/kit')>()),
    Field: input,
    TextArea: input,
    useReducedMotion: () => calm.on,
  };
});

import { Fragment, useSyncExternalStore, type ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type {
  Montage,
  MediaItem,
  MontagePreview,
  MontageTemplate,
  MontageTemplateId,
  MontageWishes,
} from '@/api';
import BuildStep from '@/app/memory/[id]/order/build';
import PickFramesStep from '@/app/memory/[id]/order/frames';
import TemplatesScreen from '@/app/memory/[id]/order/index';
import MusicStep from '@/app/memory/[id]/order/music';
import StoryStep from '@/app/memory/[id]/order/story';
import SummaryStep from '@/app/memory/[id]/order/summary';
import { Button, ConfirmSheet, IconButton, LengthSlider, Segment, Tile, TileTemplate } from '@/kit';
import { frame } from '@/label-fixtures';
import { OrderProvider, useOrder, type Wizard } from '@/order-wizard';
import { ru } from '@/strings';
import { mountsTrees } from '@/test-renderer';

/**
 * Ordering a movie the way the organizer does, start to finish (doc-03, m-26): the real wizard —
 * its provider, its six routes, the api client — over a stand-in server that answers the way the
 * api's `montages` routes do, and a router that keeps the stack. What is pinned is what people
 * see and what reaches the server: the body of the order is the body the summary was totalled on,
 * «Стоп» and the way out end the autopilot, and each refusal of the total leads to the step that
 * can undo it. The order's arithmetic is `montage.test.ts`, the drawn steps are `order-screens.test.ts`.
 */

mountsTrees();

const SCREENS: Record<string, () => ReactElement> = {
  index: () => <TemplatesScreen />,
  frames: () => <PickFramesStep />,
  story: () => <StoryStep />,
  music: () => <MusicStep />,
  build: () => <BuildStep />,
  summary: () => <SummaryStep />,
};

/* ── The server ─────────────────────────────────────────────────────────── */

type Body = MontageWishes;
type Server = {
  material: MediaItem[];
  /** The six as the api would hand them; the test may hand over ones it did not clamp. */
  templates: MontageTemplate[];
  /** What the api holds the length under, whatever the frames add up to. */
  ceiling: number;
  /** A refusal of the next totals, until it is set back to `undefined`. */
  refuse?: { status: 409 | 400 };
  previews: Body[];
  orders: Body[];
};

const NOTES: Partial<Record<MontageTemplateId, string>> = {
  parents: 'Склейки под музыку, но мягкие.',
  dopamine: 'Два трека подряд.',
};
/** The api's own six (`templates.ts`), before the material has had its say about the length. */
const SIX: [MontageTemplateId, number, 'landscape' | 'portrait', string[]][] = [
  ['for_myself', 180, 'landscape', ['calm']],
  ['quick', 60, 'landscape', ['bright']],
  ['report', 120, 'landscape', ['calm']],
  ['short_form', 30, 'portrait', ['bright']],
  ['parents', 150, 'landscape', ['warm']],
  ['dopamine', 45, 'portrait', ['bright', 'road']],
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** `checkOrder` of the api's `montages.ts`, cut to the refusals a wizard can earn. */
function total(server: Server, body: Body): Response {
  const exclude = new Set(body.exclude_media_ids);
  if (body.include_media_ids?.some((id) => exclude.has(id))) return json({ error: 'both' }, 400);
  if (body.music_note && !body.music_tracks?.length)
    return json({ error: 'note needs tracks' }, 400);

  const left = server.material.filter((item) => item.status === 'ready' && !exclude.has(item.id));
  const seconds = left.reduce(
    (sum, item) => sum + (item.kind === 'video' ? (item.duration_seconds ?? 0) : 2.5),
    0,
  );
  const max = Math.floor(Math.min(600, server.ceiling, seconds));
  const min = Math.min(10, max);
  if (server.refuse?.status === 409 || left.length < 3 || max === 0)
    return json({ error: 'not enough material' }, 409);
  const target = body.target_seconds ?? Math.min(Math.max(60, min), max);
  if (server.refuse?.status === 400 || target < min || target > max) {
    return json({ error: 'target_seconds out of range', min_seconds: min, max_seconds: max }, 400);
  }
  const preview: MontagePreview = {
    photos: left.filter((item) => item.kind === 'photo').length,
    videos: left.filter((item) => item.kind === 'video').length,
    people: new Set(left.map((item) => item.uploaded_by)).size,
    min_seconds: min,
    max_seconds: max,
    target_seconds: target,
    orientation: body.orientation ?? 'landscape',
    estimate_minutes: 4,
  };
  return json(preview);
}

/** Seven ready photos (p7 dropped by the automatic pass), a two-minute video and a frame still in processing. */
const material = (): MediaItem[] => [
  ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => ({ ...frame(id), uploaded_by: 'ann' })),
  { ...frame('p7'), uploaded_by: 'cid', screening_rejected: true, screening_reason: 'blur' },
  { ...frame('v1'), kind: 'video' as const, duration_seconds: 120, uploaded_by: 'bob' },
  { ...frame('busy'), status: 'processing' as const },
];
// What an order that leaves p7 out can carry: 6 photos × 2.5 s + the video's 120 s.
const CEILING = 135;

function serve(over: Partial<Server> = {}): Server {
  const server: Server = {
    material: material(),
    templates: [],
    ceiling: 600,
    previews: [],
    orders: [],
    ...over,
  };
  const clamp = (seconds: number) => Math.min(Math.max(seconds, 10), CEILING);
  server.templates =
    over.templates ??
    SIX.map(([id, seconds, orientation, tracks]) => ({
      id,
      story_text: `История ролика «${id}» — длинная, чтобы набираться по кусочкам, а не сразу.`,
      target_seconds: clamp(seconds),
      orientation,
      music_tracks: tracks,
      music_note: NOTES[id] ?? null,
    }));

  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    const path = url.replace(/^.*\/memories/, '');
    const body = init.body ? (JSON.parse(init.body) as Body) : {};
    if (path === '/m1/media') return json(server.material);
    if (path === '/m1/montage-templates') return json(server.templates);
    if (path === '') return json([{ id: 'm1', title: 'Море' }]);
    if (path === '/m1/montages/preview') {
      server.previews.push(body);
      return total(server, body);
    }
    if (path === '/m1/montages') {
      server.orders.push(body);
      const refused = total(server, body);
      if (!refused.ok) return refused;
      return json(
        { id: 'made', memory_id: 'm1', status: 'queued', params: body } satisfies Partial<Montage>,
        201,
      );
    }
    return json({ error: `unexpected ${path}` }, 404);
  });
  return server;
}

/* ── The wizard, mounted ────────────────────────────────────────────────── */

let wizard!: Wizard;
function Probe() {
  wizard = useOrder();
  return null;
}
function Host() {
  const stack = useSyncExternalStore(nav.subscribe, nav.snapshot);
  return (
    <OrderProvider id="m1">
      {stack.map((entry) => (
        <Fragment key={entry.key}>{SCREENS[entry.step]?.()}</Fragment>
      ))}
      <Probe />
    </OrderProvider>
  );
}

let tree: TestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  calm.on = false;
  nav.reset();
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function open() {
  await act(async () => {
    tree = TestRenderer.create(<Host />);
  });
  await run(0);
}

const run = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** Time moving on in small steps until the wizard is where the test wants it. */
async function until(ready: () => boolean, limit = 20_000) {
  for (let at = 0; !ready() && at < limit; at += 10) await run(10);
  expect(ready()).toBe(true);
}
/** All that is left of the walk, and then some. */
const settle = () => run(15_000);

const root = () => tree!.root;
// Every step of the walk stays mounted under the one on top, so the last match is the one on screen.
const buttons = (label: string | RegExp) =>
  root().findAll(
    (node) =>
      (node.type === Button || node.type === IconButton) &&
      typeof node.props.label === 'string' &&
      (typeof label === 'string' ? node.props.label === label : label.test(node.props.label)),
  );
const has = (label: string) => buttons(label).length > 0;
const press = (label: string | RegExp) => {
  const found = buttons(label).at(-1);
  if (!found) throw new Error(`no button «${label}» on ${nav.top()}`);
  return act(async () => found.props.onPress());
};
const type = (text: string) =>
  act(async () =>
    root()
      .findAllByType('input-stub' as never)
      .at(-1)!
      .props.onChangeText(text),
  );
const sheet = () => root().findAllByType(ConfirmSheet).at(-1)!;
const shown = () => JSON.stringify(tree!.toJSON());
const tile = (id: MontageTemplateId) =>
  root()
    .findAllByType(TileTemplate)
    .find((one) => one.props.title === ru.montage.template[id])!;

const NEXT: Record<string, string | RegExp> = {
  frames: /^Дальше — /,
  story: ru.montage.next,
  music: ru.montage.next,
  build: ru.montage.toSummary,
};
/** One press of the step's own button — what a person does with nothing to change. */
const forward = () => press(NEXT[nav.top()!]!);

/** The wizard walked by hand up to the total, with nothing said on any step. */
async function walkToSummary() {
  await press(ru.montage.ownSetup);
  while (nav.top() !== 'summary') await forward();
  await run(0);
}

/* ── Ordering by a template ─────────────────────────────────────────────── */

test.each(
  SIX.map(([id]) => id),
)('template %s: one press walks the steps, and the order sent is the total the summary showed', async (id) => {
  const server = serve();
  await open();
  await act(async () => tile(id).props.onPress());
  expect(wizard.auto).toBe(id);
  await settle();

  // The walk ends on the total with the wheel handed back.
  expect(nav.top()).toBe('summary');
  expect(wizard.auto).toBeNull();
  const template = server.templates.find((one) => one.id === id)!;
  const expected = {
    orientation: template.orientation,
    music_tracks: template.music_tracks,
    target_seconds: template.target_seconds,
    story_text: template.story_text,
    ...(template.music_note ? { music_note: template.music_note } : {}),
    // What the automatic pass dropped and nobody took back is named, so the api counts what is shown.
    exclude_media_ids: ['p7'],
  };
  expect(server.previews.at(-1)).toEqual(expected);
  expect(shown()).toContain(ru.montage.shots(6, 1));
  expect(shown()).toContain(ru.montage.byPeople(2));

  await press(ru.montage.startCut);
  expect(server.orders).toEqual([expected]);
  // Onto the waiting for the montage that was just made, with the count of frames going in.
  expect(nav.state.landed).toEqual({
    pathname: '/memory/[id]/montage/[montageId]',
    params: { id: 'm1', montageId: 'made', frames: 7 },
  });
});

test('a template’s length the material cannot carry is held inside what it can, before the order', async () => {
  const raw = (seconds: number): MontageTemplate => ({
    id: 'for_myself',
    story_text: 'История.',
    target_seconds: seconds,
    orientation: 'landscape',
    music_tracks: ['calm'],
    music_note: null,
  });
  for (const [asked, held] of [
    [180, CEILING],
    [4, 10],
  ]) {
    const server = serve({ templates: [raw(asked)] });
    nav.reset();
    await open();
    await act(async () => tile('for_myself').props.onPress());
    await settle();

    // The api clamps a template it hands over; this one arrived stale, and the length step, which
    // asks what the frames can carry, is what brings it inside — before the total is asked.
    expect(wizard.order.seconds).toBe(held);
    expect(server.previews.at(-1)?.target_seconds).toBe(held);
    await press(ru.montage.startCut);
    expect(server.orders[0]?.target_seconds).toBe(held);
    act(() => tree?.unmount());
    tree = undefined;
  }
});

test('with motion reduced nothing is typed: each step lands whole and the order is the same', async () => {
  calm.on = true;
  const server = serve();
  await open();
  await act(async () => tile('dopamine').props.onPress());
  await run(200);
  expect(nav.top()).toBe('frames');
  await run(200);
  // One pause per step, long enough to read the step before it fills — and then the story is whole.
  expect(nav.top()).toBe('story');
  expect(wizard.order.story).toBe('');
  await run(400);
  expect(wizard.order.story).toBe(fullStory('dopamine'));
  await settle();

  expect(nav.top()).toBe('summary');
  await press(ru.montage.startCut);
  expect(server.orders[0]).toMatchObject({
    music_tracks: ['bright', 'road'],
    music_note: 'Два трека подряд.',
    target_seconds: 45,
    orientation: 'portrait',
  });
});

/* ── Ordering by hand ───────────────────────────────────────────────────── */

test('«Настроить самому»: frames, story, several tracks, length and shape reach the api as one order', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  expect(nav.top()).toBe('frames');
  expect(wizard.order.template).toBeNull();

  // Step 1: p1 crossed out by hand, and p7, which the pass dropped, put back.
  const tiles = () => root().findAllByType(Tile);
  await act(async () => tiles()[0]!.props.onPress());
  await act(async () => tiles()[6]!.props.onPress());
  await press(/^Дальше — /);

  await type('Про море и закат');
  await forward();

  await press(ru.montage.addTrack(ru.montage.track.warm));
  await press(ru.montage.addTrack(ru.montage.track.road));
  await type('  плавно, потом бодрее  ');
  await forward();

  await act(async () => root().findByType(LengthSlider).props.onChange(97));
  await act(async () => root().findByType(Segment).props.onChange('portrait'));
  await forward();
  await run(0);

  expect(nav.top()).toBe('summary');
  const expected = {
    orientation: 'portrait',
    music_tracks: ['warm', 'road'],
    target_seconds: 97,
    story_text: 'Про море и закат',
    music_note: 'плавно, потом бодрее',
    include_media_ids: ['p7'],
    exclude_media_ids: ['p1'],
  };
  expect(server.previews.at(-1)).toEqual(expected);
  for (const said of [
    'Про море и закат',
    ru.montage.track.warm,
    ru.montage.track.road,
    ru.montage.shots(6, 1),
  ]) {
    expect(shown()).toContain(said);
  }

  await press(ru.montage.startCut);
  expect(server.orders).toEqual([expected]);
  expect(nav.state.landed?.params).toMatchObject({ montageId: 'made' });
});

test('nothing said is a legal order: no music goes out as an empty list, and the length is the api’s', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  // A track taken and given back takes the wish about it with it — the api answers 400 to one alone.
  await press(ru.montage.addTrack(ru.montage.track.calm));
  await type('тихо');
  await press(ru.montage.dropTrack(ru.montage.track.calm));
  await forward();
  await forward();
  await run(0);

  const expected = { orientation: 'landscape', music_tracks: [], exclude_media_ids: ['p7'] };
  expect(server.previews.at(-1)).toEqual(expected);
  await press(ru.montage.startCut);
  expect(server.orders).toEqual([expected]);
});

/* ── «Стоп» and the way out ─────────────────────────────────────────────── */

const fullStory = (id: MontageTemplateId) =>
  `История ролика «${id}» — длинная, чтобы набираться по кусочкам, а не сразу.`;

async function startTyping(id: MontageTemplateId = 'dopamine') {
  serve();
  await open();
  await act(async () => tile(id).props.onPress());
  await until(() => wizard.order.story !== '' && wizard.order.story !== fullStory(id));
  expect(nav.top()).toBe('story');
}

test('«Стоп» in the middle of the story leaves the whole story and the walk where it stands', async () => {
  await startTyping();
  await press(ru.montage.autoStop);
  await settle();

  expect(wizard.order.story).toBe(fullStory('dopamine'));
  expect(wizard.order.ownStory).toBe(false);
  // Nothing after the story was filled in, and no step was turned to.
  expect(wizard.order.tracks).toEqual([]);
  expect(wizard.order.seconds).toBeNull();
  expect(nav.top()).toBe('story');
  expect(nav.state.pushed).toEqual(['frames', 'story']);
  expect(wizard.auto).toBeNull();
  expect(has(ru.montage.autoStop)).toBe(false);
});

test('typing into the story takes the wheel, and what was typed is not written over', async () => {
  await startTyping();
  await type('Мой текст');
  await settle();

  expect(wizard.order.story).toBe('Мой текст');
  expect(wizard.order.ownStory).toBe(true);
  expect(nav.top()).toBe('story');
  expect(wizard.auto).toBeNull();
});

test('«Стоп» on the music leaves the tracks that had landed, and the rest is the person’s', async () => {
  const server = serve();
  await open();
  await act(async () => tile('dopamine').props.onPress());
  await until(() => wizard.order.tracks.length === 1);
  await press(ru.montage.autoStop);
  await settle();

  expect(nav.top()).toBe('music');
  expect(wizard.order.tracks.map((track) => track.key)).toEqual(['bright']);
  expect(wizard.order.seconds).toBeNull();

  // Walking on by hand orders exactly what landed: nothing fills the rest in behind them.
  await forward();
  await forward();
  await run(0);
  await press(ru.montage.startCut);
  expect(server.orders[0]).toMatchObject({
    music_tracks: ['bright'],
    story_text: fullStory('dopamine'),
  });
  expect(server.orders[0]).not.toHaveProperty('music_note');
  expect(server.orders[0]).not.toHaveProperty('target_seconds');
});

test('«Стоп» while the length rides up leaves it where it got to, and the walk goes no further', async () => {
  serve();
  await open();
  await act(async () => tile('for_myself').props.onPress());
  await until(() => wizard.order.seconds !== null);
  await press(ru.montage.autoStop);
  const stopped = wizard.order.seconds;
  await settle();

  expect(wizard.order.seconds).toBe(stopped);
  expect(stopped).toBeLessThan(CEILING);
  expect(nav.top()).toBe('build');
});

test('«Назад» and «Отмена» are hands on the wheel too, and nothing comes back to life after them', async () => {
  await startTyping('parents');
  await press(ru.action.back);
  await settle();
  expect(nav.top()).toBe('frames');
  expect(nav.state.pushed).toEqual(['frames', 'story']);
  expect(wizard.auto).toBeNull();

  // «Стоп» first and «Назад» after: the walk is over, and does not wake on the way back.
  act(() => tree?.unmount());
  tree = undefined;
  nav.reset();
  await startTyping('parents');
  await press(ru.montage.autoStop);
  await press(ru.action.back);
  await settle();
  expect(nav.state.pushed).toEqual(['frames', 'story']);
  expect(wizard.auto).toBeNull();

  act(() => tree?.unmount());
  tree = undefined;
  nav.reset();
  await startTyping('parents');
  await press(ru.action.cancel);
  await settle();
  // Something is in the order, so the way out asks first — and the walk is already over under it.
  expect(sheet().props.visible).toBe(true);
  expect(nav.state.pushed).toEqual(['frames', 'story']);
  await act(async () => sheet().props.onConfirm());
  expect(nav.state.landed).toEqual({ pathname: '/memory/[id]', params: { id: 'm1' } });
});

/* ── When the total is refused ──────────────────────────────────────────── */

test('409 on the total leads back to the frames, and after a change the total is asked again', async () => {
  const server = serve({ refuse: { status: 409 } });
  await open();
  await walkToSummary();

  expect(shown()).toContain(ru.montage.tooLittle);
  expect(has(ru.montage.startCut)).toBe(false);
  await press(ru.montage.toFrames);
  expect(nav.top()).toBe('frames');

  // The material is back; a frame crossed out, and the walk to the total once more.
  server.refuse = undefined;
  const asked = server.previews.length;
  await act(async () => root().findAllByType(Tile)[0]!.props.onPress());
  while (nav.top() !== 'summary') await forward();
  await run(0);

  expect(server.previews.length).toBeGreaterThan(asked);
  expect(server.previews.at(-1)?.exclude_media_ids).toEqual(['p1', 'p7']);
  expect(has(ru.montage.startCut)).toBe(true);
  await press(ru.montage.startCut);
  expect(server.orders[0]).toEqual(server.previews.at(-1));
});

test('400 on the total leads back to the length, and after moving it the total is asked again', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();
  await forward();
  await run(0);
  await act(async () => root().findByType(LengthSlider).props.onChange(120));

  // Somebody deleted material while the wizard stood open: the ceiling is under 120 now.
  server.ceiling = 60;
  await forward();
  await run(0);
  expect(shown()).toContain(ru.montage.lengthOff);
  expect(has(ru.montage.startCut)).toBe(false);

  await press(ru.montage.toLength);
  expect(nav.top()).toBe('build');
  await act(async () => root().findByType(LengthSlider).props.onChange(60));
  await forward();
  await run(0);

  expect(server.previews.at(-1)?.target_seconds).toBe(60);
  await press(ru.montage.startCut);
  expect(server.orders).toEqual([server.previews.at(-1)]);
});
