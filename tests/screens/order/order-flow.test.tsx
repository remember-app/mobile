import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));

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
vi.mock('@/lib/music', () => ({
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

import { act, BEAT_BY_BEAT, drives } from '@tests/helpers/drive';
import { frame } from '@tests/helpers/labels';
import { mountsTrees } from '@tests/helpers/renderer';
import { Fragment, type ReactElement, useSyncExternalStore } from 'react';
import TestRenderer, { act as reactAct } from 'react-test-renderer';
import type {
  MediaItem,
  Montage,
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
import {
  Banner,
  Button,
  ConfirmSheet,
  IconButton,
  LengthSlider,
  RowTrack,
  Segment,
  Tile,
  TileTemplate,
} from '@/kit';
import { currentLanguage, setLanguage } from '@/lib/language';
import { ENTER_MS, OrderProvider, READ_MS, useOrder, type Wizard } from '@/screens/order/wizard';
import { ru, strings } from '@/strings';

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
  /**
   * A refusal of the next totals, until it is set back to `undefined` — with this body, if given:
   * one the api would send, or one this app has never seen.
   */
  refuse?: { status: 409 | 400; body?: object | string };
  /** A call that never reaches the api, until it is set back to `undefined`. */
  offline?: keyof typeof CALLS;
  /** A call the api falls over on (500), until it is set back to `undefined`. */
  failing?: keyof typeof CALLS;
  /** How many times the wizard has read the material. */
  reads: number;
  previews: Body[];
  orders: Body[];
};

/** The two templates the api gives something to say about their music — one wish per track. */
const WISHES: Partial<Record<MontageTemplateId, Record<string, string>>> = {
  parents: { warm: 'Склейки под музыку, но мягкие.' },
  dopamine: { bright: 'Первым, склейка на каждый удар.', road: 'Вторым, к финалу.' },
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
/** The reads a test can cut off: the material, the six, and the range the material carries. */
const CALLS = {
  media: '/m1/media',
  templates: '/m1/montage-templates',
  preview: '/m1/montages/preview',
} as const;

/**
 * `materialLeft` of the api's `montages.ts`: what is ready once the crossed-out frames are gone,
 * and the longest film it makes — every frame's own length, less a half-second crossfade on each
 * join, never under nothing. Too little is under three frames or a ceiling of nothing.
 */
function weigh(server: Server, exclude: ReadonlySet<string> = new Set()) {
  const left = server.material.filter((item) => item.status === 'ready' && !exclude.has(item.id));
  const seconds = left.reduce(
    (sum, item) => sum + (item.kind === 'video' ? (item.duration_seconds ?? 0) : 2.5),
    -0.5 * Math.max(left.length - 1, 0),
  );
  const max = Math.max(0, Math.floor(Math.min(600, server.ceiling, seconds)));
  return { left, max, min: Math.min(10, max), short: left.length < 3 || max === 0 };
}

/** The order's 409, body and all. */
const tooLittle = (ready: number) =>
  json({ error: 'not enough material for a montage', ready_items: ready, need: 3 }, 409);

/** `checkOrder` of the api's `montages.ts`, cut to the refusals a wizard can earn. */
function total(server: Server, body: Body): Response {
  if (server.refuse?.body) return json(server.refuse.body, server.refuse.status);
  const exclude = new Set(body.exclude_media_ids);
  if (body.include_media_ids?.some((id) => exclude.has(id))) return json({ error: 'both' }, 400);
  const named = [...(body.include_media_ids ?? []), ...exclude];
  const missing = named.filter(
    (id) => !server.material.some((item) => item.id === id && item.status === 'ready'),
  );
  if (missing.length > 0)
    return json({ error: 'no such ready media in this memory', media_ids: missing }, 400);
  // A wish is about one of the order's own tracks, or it is refused by name (api `montages.ts`).
  const stray = Object.keys(body.music_wishes ?? {}).filter(
    (track) => !body.music_tracks?.includes(track),
  );
  if (stray.length > 0)
    return json({ error: 'music wish for a track not in music_tracks', music_wishes: stray }, 400);
  if (Object.values(body.music_wishes ?? {}).some((wish) => wish.length > 500))
    return json({ error: 'body/music_wishes must NOT have more than 500 characters' }, 400);

  const { left, max, min, short } = weigh(server, exclude);
  if (server.refuse?.status === 409 || short) return tooLittle(left.length);
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
// What an order that leaves p7 out can carry: 6 photos × 2.5 s + the video's 120 s, less 0.5 s on
// each of the six joins between those seven frames.
const CEILING = 132;

function serve(over: Partial<Server> = {}): Server {
  const server: Server = {
    material: material(),
    templates: [],
    ceiling: 600,
    reads: 0,
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
      music_wishes: WISHES[id] ?? {},
    }));

  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    const path = url.replace(/^.*\/memories/, '');
    const body = init.body ? (JSON.parse(init.body) as Body) : {};
    if (server.offline && path === CALLS[server.offline])
      throw new TypeError('Network request failed');
    if (server.failing && path === CALLS[server.failing])
      return json({ error: 'internal server error' }, 500);
    if (path === '/m1/media') {
      server.reads += 1;
      return json(server.material);
    }
    if (path === '/m1/montage-templates') {
      // Weighed as an order with nothing said, the way the api's `templates.ts` weighs the six.
      const { left, short } = weigh(server);
      return short ? tooLittle(left.length) : json(server.templates);
    }
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

beforeEach(async () => {
  vi.useFakeTimers();
  calm.on = false;
  nav.reset();
  await setLanguage('ru');
});
afterEach(() => {
  reactAct(() => tree?.unmount());
  tree = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
drives();

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
/** The wish field under a chosen track, while it is unfolded — named by the track it is about. */
const wishField = (track: string) =>
  root()
    .findAllByType('input-stub' as never)
    .find((one) => one.props.label === ru.montage.wishAbout(track));
/** A chosen row of «Выбрано», by the track's name. */
const chosen = (track: string) =>
  root()
    .findAllByType(RowTrack)
    .find((row) => row.props.picked && row.props.title === track)!;
/** The pencil in that row, a wish typed into what it unfolds, and the field let go of. */
async function wishTo(track: string, text: string) {
  await press(new RegExp(`^(${ru.montage.wishAbout(track)}|${ru.montage.wishEdit(track)})$`));
  await act(async () => wishField(track)!.props.onChangeText(text));
  await act(async () => wishField(track)!.props.onBlur());
}
const sheet = () => root().findAllByType(ConfirmSheet).at(-1)!;
const shown = () => JSON.stringify(tree!.toJSON());
const tile = (id: MontageTemplateId) =>
  root()
    .findAllByType(TileTemplate)
    .find((one) => one.props.title === ru.montage.template[id])!;

/** The app's words in the language it is speaking: Russian, unless a test switches it. */
const say = () => strings[currentLanguage()];
const NEXT = (): Record<string, string | RegExp> => ({
  frames: new RegExp(`^${say().montage.next} — `),
  story: say().montage.next,
  music: say().montage.next,
  build: say().montage.toSummary,
});
/** One press of the step's own button — what a person does with nothing to change. */
const forward = () => press(NEXT()[nav.top()!]!);
/** The line of the banner on top: the step's own, over whatever stands under it. */
const banner = () => root().findAllByType(Banner).at(-1)?.props.text;

/** The wizard walked by hand up to the total, with nothing said on any step. */
async function walkToSummary() {
  await press(say().montage.ownSetup);
  while (nav.top() !== 'summary') await forward();
  await run(0);
}

/* ── Ordering by a template ─────────────────────────────────────────────── */

test.each(SIX.map(([id]) => id))(
  'template %s: one press walks the steps, and the order sent is the total the summary showed',
  BEAT_BY_BEAT,
  async (id) => {
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
      // Each of the template's wishes under its own track — `parents` has one, `dopamine` two.
      ...(Object.keys(template.music_wishes).length > 0
        ? { music_wishes: template.music_wishes }
        : {}),
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
  },
);

test(
  'a template’s length the material cannot carry is held inside what it can, before the order',
  BEAT_BY_BEAT,
  async () => {
    const raw = (seconds: number): MontageTemplate => ({
      id: 'for_myself',
      story_text: 'История.',
      target_seconds: seconds,
      orientation: 'landscape',
      music_tracks: ['calm'],
      music_wishes: {},
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
  },
);

test(
  'with motion reduced nothing is typed: each step lands whole and the order is the same',
  BEAT_BY_BEAT,
  async () => {
    calm.on = true;
    const server = serve();
    await open();
    await act(async () => tile('dopamine').props.onPress());
    // Step 1 has nothing to fill in, and is still left standing to be read: the setting takes away
    // what moves, never the time to take in what landed (TASK-279).
    await run(ENTER_MS + READ_MS - 50);
    expect(nav.top()).toBe('frames');
    await run(100);
    // And the story lands whole — but only once the step it lands on has finished arriving.
    expect(nav.top()).toBe('story');
    expect(wizard.order.story).toBe('');
    await run(ENTER_MS);
    expect(wizard.order.story).toBe(fullStory('dopamine'));
    await settle();

    expect(nav.top()).toBe('summary');
    await press(ru.montage.startCut);
    expect(server.orders[0]).toMatchObject({
      music_tracks: ['bright', 'road'],
      music_wishes: WISHES.dopamine,
      target_seconds: 45,
      orientation: 'portrait',
    });
  },
);

/* ── Too little material at the way in ──────────────────────────────────── */

/** Three videos: enough frames by the count, and only as long as the worker has measured them. */
const videos = (seconds: number | null): MediaItem[] =>
  ['v1', 'v2', 'v3'].map((id) => ({
    ...frame(id),
    kind: 'video' as const,
    duration_seconds: seconds,
  }));

test.each([
  [ru.gallery.add, { pathname: '/memory/[id]/upload', params: { id: 'm1' } }],
  [ru.montage.later, { pathname: '/memory/[id]', params: { id: 'm1' } }],
])(
  'three videos nobody measured: the api’s 409 on the six raises «Материала пока мало», and «%s» works as ever',
  async (label, landed) => {
    serve({ material: videos(null) });
    await open();

    // The count of frames lets it through; the api's weighing does not, and its refusal is the sheet.
    expect(shown()).toContain(ru.montage.tooLittleTitle);
    expect(shown()).toContain(ru.montage.tooLittleText(3));
    // Nothing of the wizard stands under it: no tile, no door beside them, no line about a failure.
    expect(root().findAllByType(TileTemplate)).toHaveLength(0);
    expect(has(ru.montage.ownSetup)).toBe(false);
    expect(root().findAllByType(Banner)).toHaveLength(0);

    await press(label);
    expect(nav.state.landed).toEqual(landed);
  },
);

test('the same three videos, measured, are enough: the six are drawn and the order goes through', async () => {
  const server = serve({ material: videos(5) });
  await open();
  expect(shown()).not.toContain(ru.montage.tooLittleTitle);
  expect(root().findAllByType(TileTemplate)).toHaveLength(6);

  await walkToSummary();
  await press(ru.montage.startCut);
  expect(server.orders).toHaveLength(1);
});

test.each([
  ['cannot be reached', { offline: 'templates' }, ru.error.offline],
  ['falls over', { failing: 'templates' }, ru.error.status(500)],
] as const)(
  'the six the api %s on are a banner with «Повторить», not the sheet',
  async (_, over, said) => {
    const server = serve(over);
    await open();
    expect(shown()).toContain(said);
    expect(shown()).not.toContain('internal server error');
    expect(shown()).not.toContain(ru.montage.tooLittleTitle);
    expect(has(ru.montage.ownSetup)).toBe(true);

    server.offline = server.failing = undefined;
    await press(ru.action.retry);
    await run(0);
    expect(shown()).not.toContain(said);
    expect(root().findAllByType(TileTemplate)).toHaveLength(6);
  },
);

/* ── Ordering by hand ───────────────────────────────────────────────────── */

test(
  '«Настроить самому»: frames, story, several tracks, length and shape reach the api as one order',
  BEAT_BY_BEAT,
  async () => {
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

    // Three tracks, and a wish to two of them — each behind its own pencil.
    await press(ru.montage.addTrack(ru.montage.track.warm));
    await press(ru.montage.addTrack(ru.montage.track.road));
    await press(ru.montage.addTrack(ru.montage.track.calm));
    await wishTo(ru.montage.track.warm, '  плавно, на сборы  ');
    await wishTo(ru.montage.track.calm, 'потом бодрее');
    await forward();

    await act(async () => root().findByType(LengthSlider).props.onChange(97));
    await act(async () => root().findByType(Segment).props.onChange('portrait'));
    await forward();
    await run(0);

    expect(nav.top()).toBe('summary');
    const expected = {
      orientation: 'portrait',
      music_tracks: ['warm', 'road', 'calm'],
      target_seconds: 97,
      story_text: 'Про море и закат',
      music_wishes: { warm: 'плавно, на сборы', calm: 'потом бодрее' },
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
  },
);

test(
  'nothing said is a legal order: no music goes out as an empty list, and the length is the api’s',
  BEAT_BY_BEAT,
  async () => {
    const server = serve();
    await open();
    await press(ru.montage.ownSetup);
    await forward();
    await forward();

    // A track taken and given back takes the wish about it with it — the api answers 400 to one alone.
    await press(ru.montage.addTrack(ru.montage.track.calm));
    await wishTo(ru.montage.track.calm, 'тихо');
    await press(ru.montage.dropTrack(ru.montage.track.calm));
    await forward();
    await forward();
    await run(0);

    const expected = { orientation: 'landscape', music_tracks: [], exclude_media_ids: ['p7'] };
    expect(server.previews.at(-1)).toEqual(expected);
    await press(ru.montage.startCut);
    expect(server.orders).toEqual([expected]);
  },
);

test('a wish is written to one of several tracks, stands under its name, and can be wiped', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  const { warm, calm } = ru.montage.track;
  // Nothing taken yet: «Выбрано» stands empty and says what the film will sound like.
  expect(shown()).toContain(ru.montage.nothingAdded);
  expect(shown()).toContain(ru.montage.noMusic);
  await press(ru.montage.addTrack(warm));
  await press(ru.montage.addTrack(calm));
  expect(shown()).not.toContain(ru.montage.nothingAdded);
  // The shelf's own button turns into the tick that gives the track back.
  expect(has(ru.montage.unpickTrack(calm))).toBe(true);

  // The pencil in «Спокойная» unfolds a field under that row alone, holding nothing yet.
  expect(wishField(calm)).toBeUndefined();
  await press(ru.montage.wishAbout(calm));
  expect(wishField(calm)?.props.value).toBe('');
  expect(wishField(calm)?.props.placeholder).toBe(ru.montage.wishAbout(calm));
  expect(wishField(warm)).toBeUndefined();
  await act(async () => wishField(calm)!.props.onChangeText('На сборы, тихо, под голоса'));
  // Folded, the words stand under the name, and the pencil says there is something to change.
  await act(async () => wishField(calm)!.props.onBlur());
  expect(wishField(calm)).toBeUndefined();
  expect(chosen(calm).props.wish).toBe('На сборы, тихо, под голоса');
  expect(has(ru.montage.wishEdit(calm))).toBe(true);
  expect(has(ru.montage.wishAbout(calm))).toBe(false);
  // The other track is untouched by it.
  expect(chosen(warm).props.wish).toBeUndefined();
  expect(has(ru.montage.wishAbout(warm))).toBe(true);

  // One field at a time: opening «Тёплая» folds «Спокойная» away.
  await press(ru.montage.wishEdit(calm));
  expect(wishField(calm)?.props.value).toBe('На сборы, тихо, под голоса');
  await press(ru.montage.wishAbout(warm));
  expect(wishField(calm)).toBeUndefined();
  expect(wishField(warm)?.props.value).toBe('');
  await act(async () => wishField(warm)!.props.onBlur());

  // Dragged elsewhere, the wish goes along with its track.
  expect(wizard.order.tracks.map((track) => track.key)).toEqual(['warm', 'calm']);
  await act(async () =>
    chosen(calm).props.grip.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }),
  );
  expect(wizard.order.tracks.map((track) => track.key)).toEqual(['calm', 'warm']);
  expect(chosen(calm).props.wish).toBe('На сборы, тихо, под голоса');

  // Wiped, it is nothing again: no line under the name, the pencil back to its question.
  await wishTo(calm, '   ');
  expect(chosen(calm).props.wish).toBeUndefined();
  expect(has(ru.montage.wishAbout(calm))).toBe(true);

  await forward();
  await forward();
  await run(0);
  await press(ru.montage.startCut);
  expect(server.orders).toHaveLength(1);
  expect(server.orders[0]?.music_tracks).toEqual(['calm', 'warm']);
  expect(server.orders[0]).not.toHaveProperty('music_wishes');
});

test('a track taken out with a wish takes the wish along, and comes back without one', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  const { warm, road } = ru.montage.track;
  await press(ru.montage.addTrack(warm));
  await press(ru.montage.addTrack(road));
  await wishTo(warm, 'Тёплая на сборы');
  await wishTo(road, 'Дорога в конце');

  // Out by its cross in «Выбрано», and its wish is nowhere in the order any more.
  await press(ru.montage.dropTrack(warm));
  expect(chosen(warm)).toBeUndefined();
  expect(wizard.order.tracks).toEqual([{ key: 'road', name: null, wish: 'Дорога в конце' }]);
  // Taken again, it is a new track: nothing written, the field folded.
  await press(ru.montage.addTrack(warm));
  expect(chosen(warm).props.wish).toBeUndefined();
  expect(wishField(warm)).toBeUndefined();

  // And out by the tick on the shelf, with its field open at the time.
  await press(ru.montage.wishEdit(road));
  await press(ru.montage.unpickTrack(road));
  expect(wishField(road)).toBeUndefined();
  await press(ru.montage.addTrack(road));
  expect(wishField(road)).toBeUndefined();
  expect(chosen(road).props.wish).toBeUndefined();

  await forward();
  await forward();
  await run(0);
  await press(ru.montage.startCut);
  expect(server.orders[0]?.music_tracks).toEqual(['warm', 'road']);
  expect(server.orders[0]).not.toHaveProperty('music_wishes');
});

test(
  'a template’s wishes land on their tracks and stand under their names on the music step',
  BEAT_BY_BEAT,
  async () => {
    serve();
    await open();
    await act(async () => tile('dopamine').props.onPress());
    await until(() => wizard.order.tracks.length === 2);
    const { bright, road } = ru.montage.track;
    expect(chosen(bright).props.wish).toBe(WISHES.dopamine?.bright);
    expect(chosen(road).props.wish).toBe(WISHES.dopamine?.road);
    expect(has(ru.montage.wishEdit(bright))).toBe(true);
    expect(has(ru.montage.wishEdit(road))).toBe(true);
    await settle();
    expect(nav.top()).toBe('summary');
  },
);

test(
  'the pencil pressed while a template walks takes the wheel: the field stays, and so does the step',
  BEAT_BY_BEAT,
  async () => {
    serve();
    await open();
    await act(async () => tile('dopamine').props.onPress());
    await until(() => wizard.order.tracks.length === 1);
    const { bright } = ru.montage.track;
    await press(ru.montage.wishEdit(bright));
    await settle();

    expect(wizard.auto).toBeNull();
    expect(nav.top()).toBe('music');
    expect(wishField(bright)?.props.value).toBe(WISHES.dopamine?.bright);
    // Only what had landed stays, with the person's own words on it.
    await act(async () => wishField(bright)!.props.onChangeText('Моё'));
    expect(wizard.order.tracks).toEqual([{ key: 'bright', name: null, wish: 'Моё' }]);
  },
);

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

test(
  '«Стоп» in the middle of the story leaves the whole story and the walk where it stands',
  BEAT_BY_BEAT,
  async () => {
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
  },
);

test(
  'typing into the story takes the wheel, and what was typed is not written over',
  BEAT_BY_BEAT,
  async () => {
    await startTyping();
    await type('Мой текст');
    await settle();

    expect(wizard.order.story).toBe('Мой текст');
    expect(wizard.order.ownStory).toBe(true);
    expect(nav.top()).toBe('story');
    expect(wizard.auto).toBeNull();
  },
);

test(
  '«Стоп» on the music leaves the tracks that had landed, and the rest is the person’s',
  BEAT_BY_BEAT,
  async () => {
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
    // The track that landed brought its own wish, and the one that never landed took its away.
    expect(server.orders[0]).toMatchObject({
      music_tracks: ['bright'],
      music_wishes: { bright: WISHES.dopamine?.bright },
      story_text: fullStory('dopamine'),
    });
    expect(server.orders[0]?.music_wishes).not.toHaveProperty('road');
    expect(server.orders[0]).not.toHaveProperty('music_note');
    expect(server.orders[0]).not.toHaveProperty('target_seconds');
  },
);

test(
  '«Стоп» while the length rides up leaves it where it got to, and the walk goes no further',
  BEAT_BY_BEAT,
  async () => {
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
  },
);

test(
  '«Назад» and «Отмена» are hands on the wheel too, and nothing comes back to life after them',
  BEAT_BY_BEAT,
  async () => {
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
  },
);

/* ── When the total is refused ──────────────────────────────────────────── */

test(
  '409 on the total leads back to the frames, and after a change the total is asked again',
  BEAT_BY_BEAT,
  async () => {
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
  },
);

/** The slider on step 4 as it stands: the two walls, the figure, and what «Всё» would set. */
const slider = () => {
  const found = root().findAllByType(LengthSlider).at(-1);
  if (!found) return null;
  const { min, max, value, presets } = found.props;
  return { min, max, value, all: presets.at(-1).value };
};

async function walkToLength() {
  await press(say().montage.ownSetup);
  while (nav.top() !== 'build') await forward();
  await run(0);
}

test(
  'the ceiling falls while the wizard stands open: back on the length, the range is the new one',
  BEAT_BY_BEAT,
  async () => {
    const server = serve();
    await open();
    await walkToLength();
    expect(slider()).toEqual({ min: 10, max: CEILING, value: 60, all: CEILING });
    await act(async () => root().findByType(LengthSlider).props.onChange(120));

    // Somebody deleted material while the wizard stood open: the ceiling is under 120 now.
    server.ceiling = 60;
    await forward();
    await run(0);
    expect(shown()).toContain(ru.montage.lengthOff('0:10', '1:00'));
    expect(has(ru.montage.startCut)).toBe(false);

    const reads = server.reads;
    await press(ru.montage.toLength);
    expect(nav.top()).toBe('build');
    await until(() => slider()?.max === 60);
    // The material was read again and the range asked again off it: the walls are the api's new ones,
    // «Всё» is what is there now, and the figure already chosen is held inside them.
    expect(server.reads).toBe(reads + 1);
    expect(slider()).toEqual({ min: 10, max: 60, value: 60, all: 60 });

    // Nothing more to do by hand: the total agrees, and the order goes out with the length it showed.
    await forward();
    await run(0);
    expect(server.previews.at(-1)?.target_seconds).toBe(60);
    await press(ru.montage.startCut);
    expect(server.orders).toEqual([server.previews.at(-1)]);
  },
);

test(
  'a frame deleted under the order is a 400 about frames: it leads to the frames, read again',
  BEAT_BY_BEAT,
  async () => {
    const server = serve();
    await open();
    await walkToLength();

    // Somebody deleted p7 — the one the automatic pass dropped, which the order names to leave out.
    server.material = server.material.filter((item) => item.id !== 'p7');
    await forward();
    await run(0);
    expect(shown()).toContain(ru.montage.framesGone);
    expect(has(ru.montage.toLength)).toBe(false);

    await press(ru.montage.toFrames);
    expect(nav.top()).toBe('frames');
    await until(() => root().findAllByType(Tile).length === 7);
    expect(
      root()
        .findAllByType(Tile)
        .map((one) => one.props.label),
    ).not.toContain(ru.montage.outOfMovie);

    // What is there now is what is ordered: the deleted frame is named nowhere any more.
    while (nav.top() !== 'summary') await forward();
    await run(0);
    expect(has(ru.montage.startCut)).toBe(true);
    await press(ru.montage.startCut);
    expect(server.orders).toEqual([{ orientation: 'landscape', music_tracks: [] }]);
  },
);

test.each(['ru', 'en'] as const)(
  '409 on the length step and on the total is the app’s «too little», in %s',
  BEAT_BY_BEAT,
  async (language) => {
    await setLanguage(language);
    const s = strings[language];
    serve({ refuse: { status: 409 } });
    await open();
    await walkToLength();
    expect(banner()).toBe(s.montage.tooLittle);

    await forward();
    await run(0);
    expect(nav.top()).toBe('summary');
    expect(banner()).toBe(s.montage.tooLittle);
    expect(has(s.montage.toFrames)).toBe(true);
    expect(shown()).not.toContain('not enough material');
  },
);

test.each(['ru', 'en'] as const)(
  'a length out of range is said with the edges the api refused it with, on both steps, in %s',
  BEAT_BY_BEAT,
  async (language) => {
    await setLanguage(language);
    const s = strings[language];
    const server = serve({ refuse: { status: 400 } });
    await open();
    await walkToLength();
    // Asked with no length at all and refused all the same: the line carries the range it was given.
    expect(banner()).toBe(s.montage.lengthOff('0:10', '2:12'));

    server.ceiling = 60;
    await forward();
    await run(0);
    expect(nav.top()).toBe('summary');
    expect(banner()).toBe(s.montage.lengthOff('0:10', '1:00'));
    expect(has(s.montage.toLength)).toBe(true);
    expect(shown()).not.toContain('out of range');
  },
);

test.each([
  [400, { error: 'no such music track', music_tracks: ['calm'] }],
  [400, { error: 'target_seconds out of range', max_seconds: 'a lot' }],
  [400, 'Bad Request'],
  [409, { error: 'montage has not failed' }],
] as const)(
  'a %i this app does not know is its own plain line on both steps, and leads nowhere',
  async (status, body) => {
    serve({ refuse: { status, body } });
    await open();
    await walkToLength();
    expect(banner()).toBe(ru.error.status(status));

    await forward();
    await run(0);
    expect(nav.top()).toBe('summary');
    expect(banner()).toBe(ru.error.status(status));
    expect(shown()).not.toContain(typeof body === 'string' ? body : body.error);
    for (const way of [ru.montage.toLength, ru.montage.toFrames, ru.montage.startCut]) {
      expect(has(way)).toBe(false);
    }
  },
);

test.each([
  ['cannot be reached', { offline: 'preview' }, ru.error.offline],
  ['falls over', { failing: 'preview' }, ru.error.status(500)],
] as const)(
  'a total the api %s on is asked again with «Повторить», off the order as it is now',
  BEAT_BY_BEAT,
  async (_, over, said) => {
    const server = serve();
    await open();
    await walkToLength();
    Object.assign(server, over);
    await forward();
    await run(0);
    expect(nav.top()).toBe('summary');
    expect(banner()).toBe(said);
    expect(has(ru.montage.startCut)).toBe(false);

    // Meanwhile somebody deleted p7, which the order names to leave out: the body that failed would
    // now be refused for it, and the one asked again is built from what is there.
    server.offline = server.failing = undefined;
    server.material = server.material.filter((item) => item.id !== 'p7');
    await press(ru.action.retry);
    await until(() => has(ru.montage.startCut));
    expect(server.previews.at(-1)).toEqual({ orientation: 'landscape', music_tracks: [] });

    // Asked again once, and nothing goes on asking by itself.
    const asked = server.previews.length;
    await run(5_000);
    expect(server.previews.length).toBe(asked);

    await press(ru.montage.startCut);
    expect(server.orders).toEqual([server.previews.at(-1)]);
  },
);

test(
  'the material that could not be read is asked for again with «Повторить»',
  BEAT_BY_BEAT,
  async () => {
    const server = serve({ offline: 'media' });
    await open();
    expect(shown()).toContain(ru.error.offline);
    expect(has(ru.montage.ownSetup)).toBe(false);

    server.offline = undefined;
    await press(ru.action.retry);
    await run(0);
    expect(shown()).not.toContain(ru.error.offline);
    expect(has(ru.montage.ownSetup)).toBe(true);
    expect(server.reads).toBe(1);
  },
);

test.each([
  ['cannot be reached', { offline: 'preview' }, ru.error.offline],
  ['falls over', { failing: 'preview' }, ru.error.status(500)],
] as const)(
  'the range the api %s on is asked again with «Повторить», not waited on',
  BEAT_BY_BEAT,
  async (_, over, said) => {
    const server = serve(over);
    await open();
    await walkToLength();
    expect(slider()).toBeNull();
    expect(banner()).toBe(said);
    expect(shown()).not.toContain('internal server error');

    server.offline = server.failing = undefined;
    await press(ru.action.retry);
    await until(() => slider() !== null);
    expect(slider()).toEqual({ min: 10, max: CEILING, value: 60, all: CEILING });
    expect(shown()).not.toContain(said);
  },
);
