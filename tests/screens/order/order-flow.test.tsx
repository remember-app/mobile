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
// The shelf's speaker and the phone's file picker are native. The speaker is never pressed here; the
// picker answers what a test sets (a cancelled pick by default), and the upload of the chosen file
// to storage answers with the key it was given, or fails.
const phone = vi.hoisted(() => ({
  pick: { canceled: true } as { canceled: boolean; assets?: { uri: string; name: string }[] },
  send: async (_file: { uri: string; name: string }): Promise<string> => 'music/own',
}));
vi.mock('@/lib/music', () => ({
  useTrackPreview: () => ({ playing: null, toggle: async () => {} }),
  sendOwnTrack: (_token: string, _memory: string, file: { uri: string; name: string }) =>
    phone.send(file),
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: async () => phone.pick }));
// The window of the phone the wizard is on, and the type size it is set to. Under node the window is
// nothing at all, which is what every test but the one about the smallest phone wants: it is left
// alone until a test gives it a size.
const handset = vi.hoisted(() => ({ height: 0, fontScale: 0 }));
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => {
      const own = rn.useWindowDimensions();
      return {
        ...own,
        height: handset.height || own.height,
        fontScale: handset.fontScale || own.fontScale,
      };
    },
    // The plain container `vitest.setup.ts` makes of it: this mock replaces that one, it does not add.
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
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

import { expectReachable } from '@tests/helpers/access';
import { later } from '@tests/helpers/api';
import { measure, scrolled } from '@tests/helpers/board';
import { orderRefusal } from '@tests/helpers/contract';
import { contrast } from '@tests/helpers/contrast';
import { act, BEAT_BY_BEAT, drives } from '@tests/helpers/drive';
import { frame } from '@tests/helpers/labels';
import { mountsTrees, themesShown } from '@tests/helpers/renderer';
import { Fragment, type ReactElement, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
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
  BlockPicked,
  Board,
  Button,
  CardDirector,
  ConfirmSheet,
  IconButton,
  Text as KitText,
  LengthSlider,
  NameHeading,
  RowRejected,
  RowTrack,
  Segment,
  Sheet,
  SummarySection,
  Tile,
  TileTemplate,
  WizardBar,
} from '@/kit';
import { formatRuntime } from '@/lib/dates';
import { currentLanguage, setLanguage } from '@/lib/language';
import { ENTER_MS, OrderProvider, READ_MS, useOrder, type Wizard } from '@/screens/order/wizard';
import { ru, strings } from '@/strings';
import { type as scale, setTheme, themes } from '@/theme';

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

/**
 * `checkOrder` of the api's `montages.ts`, cut to the refusals a wizard can earn — behind the
 * schema the api holds the body to first (`orderRefusal`, the same one every stand-in shares).
 */
function total(server: Server, body: Body): Response {
  const bad = orderRefusal(body);
  if (bad) return bad;
  if (server.refuse?.body) return json(server.refuse.body, server.refuse.status);
  const exclude = new Set(body.exclude_media_ids);
  if (body.include_media_ids?.some((id) => exclude.has(id))) return json({ error: 'both' }, 400);
  const named = [...(body.include_media_ids ?? []), ...exclude];
  const missing = named.filter(
    (id) => !server.material.some((item) => item.id === id && item.status === 'ready'),
  );
  if (missing.length > 0)
    return json({ error: 'no such ready media in this memory', media_ids: missing }, 400);

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
  Object.assign(handset, { height: 0, fontScale: 0 });
  nav.reset();
  phone.pick = { canceled: true };
  phone.send = async () => 'music/own';
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

    // The total is headed by the name the film will get — the template's own (spec 8, chief's table).
    expect(root().findByType(NameHeading).props.name).toBe(ru.montage.defaultName[id]);

    await press(ru.montage.startCut);
    // The order is the total, and beside it the two things the film keeps: which template it started
    // from and what it is called.
    expect(server.orders).toEqual([
      { ...expected, template: id, name: ru.montage.defaultName[id] },
    ]);
    // Onto the waiting for the montage that was just made, with the count of frames going in.
    expect(nav.state.landed).toEqual({
      pathname: '/memory/[id]/montage/[montageId]',
      params: { id: 'm1', montageId: 'made', frames: 7 },
    });
  },
);

test('the name heads the total, and the one typed over it on its sheet goes with the order', async () => {
  const server = serve();
  await open();
  await walkToSummary();
  const heading = () => root().findByType(NameHeading);
  // No template: the name is the length's, which the api says itself — so none goes out.
  expect(heading().props.name).toMatch(/^Ролик на \d+:\d\d$/);
  expect(heading().props.label).toBe(ru.montage.film.renameNow(heading().props.name));

  await act(async () => heading().props.onPress());
  // Nothing new typed, nothing to save.
  expect(buttons(ru.action.save).at(-1)!.props.disabled).toBe(true);
  await type('Лето на даче');
  await press(ru.action.save);
  expect(heading().props.name).toBe('Лето на даче');

  await press(ru.montage.startCut);
  expect(server.orders.at(-1)).toMatchObject({ name: 'Лето на даче' });
  expect(server.orders.at(-1)).not.toHaveProperty('template');
});

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

test.each([
  ['with no such field', {}],
  ['with it null', { music_wishes: null }],
  ['with it empty', { music_wishes: {} }],
] as const)(
  'a template that says nothing about its music’s wishes %s walks to the total, its tracks bare',
  BEAT_BY_BEAT,
  async (_, said) => {
    // The docs promise the field on every template; an older api, or a slip of this one, is still
    // a template — with nothing to say about its tracks, and not a reason to fall over on the press.
    const bare = {
      id: 'dopamine',
      story_text: 'История.',
      target_seconds: 45,
      orientation: 'portrait',
      music_tracks: ['bright', 'road'],
      ...said,
    } as unknown as MontageTemplate;
    const server = serve({ templates: [bare] });
    await open();
    await act(async () => tile('dopamine').props.onPress());
    await settle();

    expect(nav.top()).toBe('summary');
    expect(wizard.auto).toBeNull();
    const { bright, road } = ru.montage.track;
    expect(chosen(bright).props.wish).toBeUndefined();
    expect(chosen(road).props.wish).toBeUndefined();
    await press(ru.montage.startCut);
    expect(server.orders[0]?.music_tracks).toEqual(['bright', 'road']);
    expect(server.orders[0]).not.toHaveProperty('music_wishes');
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

test('«Формат» is the wizard’s one segment: two words, Wide first, at 14, on the screen’s own ground', async () => {
  serve();
  await open();
  await walkToSummary();
  // The summary is drawn; the build step underneath it is still mounted with its segment.
  const segment = root().findByType(Segment).props;
  expect(segment).toMatchObject({ label: ru.montage.shape });
  expect(segment.options).toEqual([
    { value: 'landscape', label: 'Горизонтальный' },
    { value: 'portrait', label: 'Вертикальный' },
  ]);
  expect([segment.small, segment.onSurface, segment.hideLabel]).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
});

test.each([
  ['an ordinary phone at the system’s own type', { height: 667, fontScale: 1 }, false],
  ['the smallest phone at the largest type', { height: 568, fontScale: 3.571 }, true],
])(
  '%s: on every step «Отмена» and the step’s button are there once, standing or scrolled with the step, and answer',
  async (_, phoneNow, whole) => {
    serve();
    await open();
    Object.assign(handset, phoneNow);
    // The button that moves each step on, and where it stands: the step's own bar and bottom layer.
    const forwards = (): Record<string, string | RegExp> => ({
      index: say().montage.ownSetup,
      ...NEXT(),
      summary: say().montage.startCut,
    });
    /** Where the step on top has its button and its «Отмена»: true when they scroll with its body. */
    const seen: [string, boolean, boolean | 'none'][] = [];
    const bodies: [string, string][] = [];
    const look = async () => {
      const step = nav.top()!;
      // What a phone would report: an ordinary bar and layer, or the same grown with the type.
      await measure(root(), whole ? { bar: 260, footer: 380 } : { bar: 150, footer: 120 });
      // Every step stays mounted under the one on top, so what is asked is asked of the top one.
      const top = root().findAllByType(Board).at(-1)!;
      const inTop = (label: string | RegExp) =>
        top.findAll(
          (node) =>
            (node.type === Button || node.type === IconButton) &&
            typeof node.props.label === 'string' &&
            (typeof label === 'string' ? node.props.label === label : label.test(node.props.label)),
        );
      const [main, ...more] = inTop(forwards()[step]!);
      const cancel = inTop(ru.action.cancel);
      expect([step, more.length], 'the step’s button, once').toEqual([step, 0]);
      expect(main, `${step}: the step’s button`).toBeDefined();
      expect(cancel.length, `${step}: «Отмена»`).toBe(step === 'summary' ? 0 : 1);
      seen.push([step, scrolled(main), cancel.length === 0 ? 'none' : scrolled(cancel[0])]);
      // The step's own column: the screen's 16 at the sides and room to grow — never `flex: 1` — and
      // for the one step that is a list, no column at all: the list is the body.
      if (step !== 'summary') {
        const { body, list } = top.props;
        const column = StyleSheet.flatten(body) ?? {};
        bodies.push([
          step,
          list ? 'list' : `${column.paddingHorizontal}/${column.flexGrow}/${column.flex}`,
        ]);
      }
      return { main, cancel };
    };
    await look();
    await press(say().montage.ownSetup);
    await look();
    while (nav.top() !== 'summary') {
      await forward();
      await look();
    }
    expect(seen).toEqual(
      ['index', 'frames', 'story', 'music', 'build', 'summary'].map((step) => [
        step,
        whole,
        step === 'summary' ? 'none' : whole,
      ]),
    );
    expect(bodies).toEqual([
      ['index', '16/1/undefined'],
      ['frames', 'list'],
      ['story', '16/1/undefined'],
      ['music', '16/1/undefined'],
      ['build', '16/1/undefined'],
    ]);
  },
);

test('every face of the wizard wears the bar it should: the way in and the total drop the scale, only the total drops «Отмена»', async () => {
  serve();
  await open();
  // Every step of the walk stays mounted under the one on top, so the last bar is the one on screen.
  const bar = () => root().findAllByType(WizardBar).at(-1)!.props;
  const faces: [string, string, string, boolean][] = [];
  const note = () =>
    faces.push([nav.top()!, bar().variant, bar().label, bar().cancel?.label === ru.action.cancel]);
  note();
  await press(say().montage.ownSetup);
  note();
  while (nav.top() !== 'summary') {
    await forward();
    note();
  }
  expect(faces).toEqual([
    ['index', 'entry', ru.montage.newOne, true],
    ['frames', 'step', ru.montage.step(1, 4), true],
    ['story', 'step', ru.montage.step(2, 4), true],
    ['music', 'step', ru.montage.step(3, 4), true],
    ['build', 'step', ru.montage.step(4, 4), true],
    ['summary', 'summary', ru.montage.summaryTitle, false],
  ]);
  expect(bar().steps).toBe(4);
  expect(bar().back.props.label).toBe(ru.action.back);
  // «Назад» hangs 10 past the screen's margin, as every «Назад» does (spec 7.1).
  expect(StyleSheet.flatten(bar().back.props.style)).toMatchObject({ marginLeft: -10 });
  expect(bar().cancel).toBeUndefined();
});

test('each step’s body starts where the layout pins it, under whatever its heading ends with', async () => {
  // TASK-384 (R3). Spec 4 pins the body of a step — «190–238 — тело шага мастера», «190 — тело
  // итога» — and the app lays the heading out in flow, so each pin is kept as the gap under the
  // heading's last line. Read off the layout (`m28-mock-measure/<Screen>.json`): the line under the
  // heading of `MontageTemplate` stands at 149 and is 19 tall, the grid at 190; `MontageStory`'s
  // line at 197, the plate at 238; `MontageMusic`'s at 168, «Выбрано» at 206; the heading of
  // `MontageBuild` at 129 and 29 tall, «ДЛИНА» at 190. The bodies stood right under their headings
  // — 13 to 36 too high. The total is headed by the film's name since 27 September: 106–156, the
  // poster at 190 (detail 79).
  const pinned = {
    index: 190 - (149 + 19),
    story: 238 - (197 + 19),
    music: 206 - (168 + 19),
    build: 190 - (129 + 29),
    summary: 190 - 156,
  };
  serve();
  await open();
  const lead = () => StyleSheet.flatten(root().findAllByType(Board).at(-1)!.props.body)?.paddingTop;
  const drawn: Record<string, unknown> = { index: lead() };
  await press(say().montage.ownSetup);

  // Step 1 is a list: its count and «Что сняли» stand under the heading in the bar — 10 under the
  // heading (129 + 29 → 168), 44 tall, and the grid 20 under them, at 232.
  // «Что сняли» is the outlined small one (spec 7.2; TASK-384 R6): 13 / 600, 14 a side, a `line`
  // hairline — 93.95 wide in the layout, where the step's 16 / 600 made it 119.3 — and it hangs 4
  // past the screen's margin (its right edge at 378, the margin at 374).
  const dropped = buttons(ru.montage.whatDropped).at(-1)!;
  expect(dropped.props.variant).toBe('small');
  expect(dropped.props.size).toBeUndefined();
  expect(StyleSheet.flatten(dropped.props.style)).toMatchObject({ marginRight: 374 - 378 });
  let head = dropped;
  while (head.parent && StyleSheet.flatten(head.props.style)?.paddingBottom === undefined)
    head = head.parent;
  expect(StyleSheet.flatten(head.props.style)).toMatchObject({
    paddingTop: 168 - (129 + 29),
    paddingBottom: 232 - (168 + 44),
  });

  while (nav.top() !== 'summary') {
    await forward();
    drawn[nav.top()!] = lead();
  }
  await until(() => lead() !== undefined);
  drawn.summary = lead();
  expect(drawn).toEqual(pinned);
});

test('«Что сняли» opens a sheet that reports: the paragraph 8 under the heading, the reasons one list', async () => {
  serve({
    material: [
      ...material(),
      { ...frame('p8'), screening_rejected: true, screening_reason: 'duplicate' },
    ],
  });
  await open();
  await press(say().montage.ownSetup);
  await press(ru.montage.whatDropped);

  // TASK-384 (R8), `SheetRejected.json`: the heading at 31, two lines, 52 tall; the paragraph at 91,
  // 14 / 400 / 20 — one block, 8 under it. It was 16 / 23 and the sheet's own 18 under. The sheet's
  // own heading and its lead: the lead is the body's first words and scrolls with the rows, so on the
  // smallest phone at large type it no longer leaves them a slit (TASK-401); the 8 is the kit's.
  const dropped = root()
    .findAllByType(Sheet)
    .find((one) => one.props.title === ru.montage.droppedTitle)!;
  expect(dropped.props.visible).toBe(true);
  const paragraph = dropped.props.lead;
  expect(paragraph.type).toBe(KitText);
  expect(paragraph.props.children).toBe(ru.montage.droppedText(2, 9));
  expect(
    dropped.findAll((one) => one.props.children === ru.montage.droppedText(2, 9)),
  ).not.toHaveLength(0);
  expect(scale[paragraph.props.role as keyof typeof scale]).toMatchObject({
    fontSize: 14,
    lineHeight: 20,
  });

  // The reasons are rows of one list — «Вернуть» 40 with 10 over and under, a hairline between —
  // and not blocks of the sheet 18 apart: the rows stood 83 apart where the layout has 68.
  const rows = root().findAllByType(RowRejected);
  expect(rows).toHaveLength(2);
  expect(rows[0].parent).toBe(rows[1].parent);
  expect(rows[0].parent?.type).not.toBe(ScrollView);
  expect(rows.map((row) => row.props.divider)).toEqual([false, true]);
});

test('the heading over the length and the one over the shape are the layout’s eyebrows, in muted', async () => {
  // TASK-384 (R5), `MontageBuild.json`: «ДЛИНА» and «ФОРМАТ», 12 / 700 in caps, #A4A1B2. «ДЛИНА» was
  // drawn in `paper`, «Формат» as a 13 / 600 line in `paper` (the segment's own heading).
  serve();
  await open();
  await press(say().montage.ownSetup);
  while (nav.top() !== 'build') await forward();
  const eyebrows = root()
    .findAllByType(KitText)
    .filter((one) => one.props.role === 'eyebrow')
    .map((one) => [one.props.children, one.props.tone]);
  expect(eyebrows).toContainEqual([ru.montage.howLong.toUpperCase(), 'muted']);
  expect(eyebrows).toContainEqual([ru.montage.shape.toUpperCase(), 'muted']);
  // And «ФОРМАТ» stands where the layout has it: the length's block ends at 399, «ФОРМАТ» at 417.
  const body = StyleSheet.flatten(root().findAllByType(Board).at(-1)!.props.body);
  expect(body?.gap).toBe(417 - 399);
});

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

test.each([
  ['an ordinary phone at the system’s own type', { height: 667, fontScale: 1 }, false],
  ['the smallest phone at the largest type', { height: 568, fontScale: 3.571 }, true],
])(
  '%s: the six that did not come stand as a banner in the body, and «Настроить самому» is the way on from wherever the layer is',
  async (_, phoneNow, whole) => {
    const server = serve({ failing: 'templates' });
    await open();
    Object.assign(handset, phoneNow);
    await measure(root(), whole ? { bar: 260, footer: 380 } : { bar: 150, footer: 120 });
    const inTop = (label: string) =>
      root()
        .findAllByType(Board)
        .at(-1)!
        .findAll(
          (node) =>
            (node.type === Button || node.type === IconButton) && node.props.label === label,
        );
    // The banner and its «Повторить» are in the body, whichever way the board stands.
    expect(inTop(ru.action.retry)).toHaveLength(1);
    expect(scrolled(inTop(ru.action.retry)[0])).toBe(true);
    // The way on is the layer's: standing where the phone has room, and the layer's own place in the
    // scroll where it has not — once, and not gone with the six.
    expect(inTop(ru.montage.ownSetup)).toHaveLength(1);
    expect(scrolled(inTop(ru.montage.ownSetup)[0])).toBe(whole);
    await press(ru.montage.ownSetup);
    expect(nav.top()).toBe('frames');
    server.failing = undefined;
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

test('the music can be handed to the director, and the order says so instead of naming tracks', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();
  expect(nav.top()).toBe('music');

  // The card stands between «Выбрано» and the shelf, unpicked, and the block is the empty view.
  const card = () => root().findAllByType(CardDirector).at(-1)!;
  const block = () => root().findAllByType(BlockPicked).at(-1)!;
  expect(card().props.picked).toBe(false);
  expect(card().props.label).toBe(ru.montage.directorOffer);
  expect(block().props.empty).toBeDefined();

  await act(async () => card().props.onPress());
  expect(card().props.picked).toBe(true);
  expect(card().props.label).toBe(ru.montage.directorPicked);
  // «Выбрано» stands in its third view: the director's words and no tracks to draw.
  expect(block().props.director).toEqual({
    title: ru.montage.directorBlockTitle,
    note: ru.montage.directorBlockNote,
  });
  expect(block().props.empty).toBeUndefined();

  // The choice holds while the step is left and come back to: the answers live above the steps.
  await forward();
  expect(nav.top()).toBe('build');
  await press(ru.action.back);
  expect(nav.top()).toBe('music');
  expect(card().props.picked).toBe(true);
  expect(block().props.director).toBeDefined();

  // The shelf stays live under it: one plus takes the choice back and names that track instead.
  await press(ru.montage.addTrack(ru.montage.track.warm));
  expect(card().props.picked).toBe(false);
  expect(wizard.order.tracks.map((track) => track.key)).toEqual(['warm']);

  // And the card again gives that track up with it — one question, one answer.
  await act(async () => card().props.onPress());
  expect(wizard.order.tracks).toEqual([]);
  expect(card().props.picked).toBe(true);

  await forward();
  await forward();
  await settle();
  expect(nav.top()).toBe('summary');
  // The total is asked off the body the order sends: the flag in place of the list.
  expect(server.previews.at(-1)).toMatchObject({ music_director: true });
  expect(server.previews.at(-1)).not.toHaveProperty('music_tracks');
  // And the total's music section reads the choice back, not a list of tracks.
  const musicSection = root()
    .findAllByType(SummarySection)
    .find((one) => one.props.title === ru.montage.music)!;
  expect(musicSection.findAllByType(KitText).map((one) => one.props.children)).toContain(
    ru.montage.directorChoice,
  );

  await press(ru.montage.startCut);
  expect(server.orders).toHaveLength(1);
  expect(server.orders[0]).toMatchObject({ music_director: true });
  expect(server.orders[0]).not.toHaveProperty('music_tracks');
  expect(server.orders[0]).not.toHaveProperty('music_wishes');
});

test('a template pressed over the director’s choice answers the question with its own tracks', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();
  await act(async () => root().findAllByType(CardDirector).at(-1)!.props.onPress());
  expect(wizard.order.director).toBe(true);

  // The way into the wizard is still mounted under the steps, and its tile fills the whole order in,
  // music and all: the template names its own tracks, so the choice handed over goes with it.
  await act(async () => tile('parents').props.onPress());
  await settle();
  expect(nav.top()).toBe('summary');
  expect(wizard.order.director).toBe(false);
  expect(wizard.order.tracks.map((track) => track.key)).toEqual(['warm']);

  await press(ru.montage.startCut);
  expect(server.orders[0]).toMatchObject({ template: 'parents', music_tracks: ['warm'] });
  expect(server.orders[0]).not.toHaveProperty('music_director');
});

test('the music step in daylight, a wish standing under one track and a field open under another, wears only the day', async () => {
  const musicStep = async () => {
    serve();
    await open();
    await press(ru.montage.ownSetup);
    await forward();
    await forward();
    await press(ru.montage.addTrack(ru.montage.track.warm));
    await press(ru.montage.addTrack(ru.montage.track.calm));
    await wishTo(ru.montage.track.warm, 'Тихо, на сборы');
    await press(ru.montage.wishAbout(ru.montage.track.calm));
    return themesShown(root().findAllByType(MusicStep).at(-1)!);
  };
  // The night is what the harness starts in, and the detector sees it on this very step.
  expect((await musicStep()).night.length).toBeGreaterThan(0);
  await act(async () => tree?.unmount());
  nav.reset();
  await setTheme('light');
  try {
    const shown = await musicStep();
    expect(shown.night).toEqual([]);
    expect(shown.day.length).toBeGreaterThan(0);
  } finally {
    await setTheme('dark');
  }
});

test('a track from the phone waits for its upload, joins the list under its file name, takes a wish and goes out under its own key', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  const next = () => buttons(ru.montage.next).at(-1)!;
  const upload = later<string>();
  phone.pick = { canceled: false, assets: [{ uri: 'file:///a.mp3', name: 'Первый танец.mp3' }] };
  phone.send = () => upload.promise;
  await press(ru.montage.ownTrackShort);
  // While the file goes up the wizard cannot move on, nor take a second file, and nothing is on the list.
  expect(next().props.busy).toBe(true);
  expect(buttons(ru.montage.ownTrackShort).at(-1)!.props.disabled).toBe(true);
  expect(wizard.order.tracks).toEqual([]);
  await act(async () => upload.settle('music/aaa'));
  expect(next().props.busy).toBe(false);
  expect(chosen('Первый танец.mp3')).toBeDefined();

  // A second file, and a shelf track between them.
  await press(ru.montage.addTrack(ru.montage.track.warm));
  phone.pick = { canceled: false, assets: [{ uri: 'file:///b.mp3', name: 'Финал.mp3' }] };
  phone.send = async () => 'music/bbb';
  await press(ru.montage.ownTrackShort);
  expect(wizard.order.tracks.map((one) => one.key)).toEqual(['music/aaa', 'warm', 'music/bbb']);
  // The pencil of a file's row is named by the file, and the wish goes under the key R2 answered with.
  await wishTo('Первый танец.mp3', 'Тихо, на сборы');
  expect(chosen('Первый танец.mp3').props.wish).toBe('Тихо, на сборы');
  expect(chosen('Финал.mp3').props.wish).toBeUndefined();

  await forward();
  await forward();
  await run(0);
  await press(ru.montage.startCut);
  expect(server.orders[0]).toMatchObject({
    music_tracks: ['music/aaa', 'warm', 'music/bbb'],
    music_wishes: { 'music/aaa': 'Тихо, на сборы' },
  });
});

test('a cancelled pick changes nothing, and a file that cannot be sent says so and leaves the list as it was', async () => {
  serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  await press(ru.montage.ownTrackShort);
  expect(wizard.order.tracks).toEqual([]);
  expect(banner()).toBeUndefined();

  phone.pick = { canceled: false, assets: [{ uri: 'file:///a.mp3', name: 'Первый танец.mp3' }] };
  phone.send = async () => {
    throw new TypeError('Network request failed');
  };
  await press(ru.montage.ownTrackShort);
  expect(wizard.order.tracks).toEqual([]);
  expect(banner()).toBe(ru.error.offline);
  expect(buttons(ru.montage.next).at(-1)!.props.busy).toBe(false);
  expect(buttons(ru.montage.ownTrackShort).at(-1)!.props.disabled).toBe(false);

  // Tried again and sent: the notice is gone with the next try.
  phone.send = async () => 'music/aaa';
  await press(ru.montage.ownTrackShort);
  expect(banner()).toBeUndefined();
  expect(chosen('Первый танец.mp3')).toBeDefined();
});

test.each(['ru', 'en'] as const)(
  'in %s the fiftieth track goes in and the fifty-first does not, off the shelf or off the phone, and the step says why',
  BEAT_BY_BEAT,
  async (language) => {
    await setLanguage(language);
    const s = strings[language];
    const server = serve();
    await open();
    await press(s.montage.ownSetup);
    await forward();
    await forward();

    /** The next file the phone's picker hands over, and the key its upload answers with. */
    const file = (n: number) => {
      phone.pick = { canceled: false, assets: [{ uri: `file:///${n}.mp3`, name: `${n}.mp3` }] };
      phone.send = async () => `music/${n}`;
    };
    const keys = () => wizard.order.tracks.map((track) => track.key);
    const { bright, warm, calm, night, road } = s.montage.track;
    // Four off the shelf and 45 of their own: one short of the api's fifty, and the files count too.
    for (const track of [bright, warm, calm, night]) await press(s.montage.addTrack(track));
    for (let n = 1; n <= 45; n += 1) {
      file(n);
      await press(s.montage.ownTrackShort);
    }
    expect(keys()).toHaveLength(49);

    // The fiftieth, a file off the phone, goes in as any other did.
    file(46);
    await press(s.montage.ownTrackShort);
    expect(keys()).toHaveLength(50);
    expect(keys().at(-1)).toBe('music/46');
    expect(banner()).toBeUndefined();

    // The fifty-first is turned away at both doors, in words — and no file goes up for nothing.
    await press(s.montage.addTrack(road));
    expect(keys()).toHaveLength(50);
    expect(keys()).not.toContain('road');
    expect(banner()).toBe(s.montage.tracksFull(50));
    let sent = false;
    phone.send = async () => {
      sent = true;
      return 'music/51';
    };
    await press(s.montage.ownTrackShort);
    expect(sent).toBe(false);
    expect(keys()).toHaveLength(50);
    expect(banner()).toBe(s.montage.tracksFull(50));

    // One taken out makes room — but a file going up holds that place, so the shelf cannot take it.
    await press(s.montage.unpickTrack(bright));
    expect(banner()).toBeUndefined();
    const upload = later<string>();
    file(47);
    phone.send = () => upload.promise;
    await press(s.montage.ownTrackShort);
    await press(s.montage.addTrack(bright));
    expect(banner()).toBe(s.montage.tracksFull(50));
    await act(async () => upload.settle('music/47'));
    expect(keys()).toHaveLength(50);
    expect(keys().at(-1)).toBe('music/47');
    expect(keys()).not.toContain('bright');

    // And fifty is an order the api takes.
    await forward();
    await forward();
    await run(0);
    await press(s.montage.startCut);
    expect(server.orders[0]?.music_tracks).toHaveLength(50);
  },
);

test('an order of fifty tracks, every one with a wish of five hundred letters, is one the api takes, and the wishes go out trimmed under their own keys', async () => {
  const server = serve();
  await open();
  await press(ru.montage.ownSetup);
  await forward();
  await forward();

  // Fifty files, and the wish of each as long as the api lets one be — the last with the spaces a
  // field can be left with, which the api counts before it trims and the app trims before it sends.
  const fifty = Array.from({ length: 50 }, (_, at) => ({
    key: `music/${at}`,
    name: `${at}.mp3`,
    wish: at === 49 ? ` ${'я'.repeat(500)} ` : 'ю'.repeat(500),
  }));
  await act(async () => wizard.change({ tracks: fifty }));
  await forward();
  await forward();
  await run(0);
  expect(server.previews.at(-1)?.music_tracks).toHaveLength(50);
  await press(ru.montage.startCut);

  const [sent] = server.orders;
  expect(sent.music_tracks).toEqual(fifty.map((track) => track.key));
  expect(Object.keys(sent.music_wishes ?? {})).toEqual(sent.music_tracks);
  for (const wish of Object.values(sent.music_wishes ?? {})) expect([...wish]).toHaveLength(500);
  expect(sent.music_wishes?.['music/49']).toBe('я'.repeat(500));
});

test.each([
  ['dark', 'ru', 7.12],
  ['dark', 'en', 7.12],
  ['light', 'ru', 5.34],
  ['light', 'en', 5.34],
] as const)(
  'in the %s theme, in %s, the count over «Выбрано» is `muted` on its block at 4.5 : 1 or better — nothing added, the shelf with its time, a file with none',
  BEAT_BY_BEAT,
  async (theme, language, spec) => {
    await setLanguage(language);
    await setTheme(theme);
    try {
      const s = strings[language];
      serve();
      await open();
      await press(s.montage.ownSetup);
      await forward();
      await forward();

      /** The ink the line is set in, the block it stands on, and how well the one reads on the other. */
      const readable = (line: string) => {
        const words = root()
          .findAllByType(MusicStep)
          .at(-1)!
          .findAll((one) => one.type === Text && [one.props.children].flat().join('') === line);
        expect(words, line).toHaveLength(1);
        const ink = StyleSheet.flatten(words[0].props.style).color as string;
        let ground: string | undefined;
        for (let up = words[0].parent; up && !ground; up = up.parent)
          if (typeof up.props.style !== 'function')
            ground = StyleSheet.flatten(up.props.style)?.backgroundColor;
        return { ink, ground, ratio: contrast(ink, ground as string) };
      };
      const { muted, surface } = themes[theme].color;
      const held = (line: string) => {
        const { ink, ground, ratio } = readable(line);
        // The tokens by name, and the ratio worked out by WCAG off what was drawn — never off a literal.
        expect(ink, line).toBe(muted);
        expect(ground, line).toBe(surface);
        expect(ratio, `${line}: ${ratio.toFixed(2)} : 1`).toBeGreaterThanOrEqual(4.5);
        expect(ratio, line).toBeCloseTo(spec, 2);
      };

      held(s.montage.nothingAdded);
      // The heading it stands beside is the same `muted`, so the pair is one voice on one block.
      held(s.montage.picked.toUpperCase());
      await press(s.montage.addTrack(s.montage.track.warm));
      await press(s.montage.addTrack(s.montage.track.calm));
      // 126 and 110 seconds: «2 трека · 3:56».
      held(`${s.montage.tracksPicked(2)} · ${formatRuntime(126 + 110)}`);
      // A file off the phone has a length nobody here has heard: the tracks are counted, the time is not.
      phone.pick = {
        canceled: false,
        assets: [{ uri: 'file:///a.mp3', name: 'Первый танец.mp3' }],
      };
      phone.send = async () => 'music/aaa';
      await press(s.montage.ownTrackShort);
      held(s.montage.tracksPicked(3));
    } finally {
      await setTheme('dark');
      await setLanguage('ru');
    }
  },
);

test.each(['ru', 'en'] as const)(
  'in %s the music step with a wish written, one being written and none: every control is named, sized for a finger, and the field takes at most 500 letters',
  async (language) => {
    await setLanguage(language);
    const s = strings[language];
    serve();
    await open();
    await press(s.montage.ownSetup);
    await forward();
    await forward();

    const { warm, calm, road } = s.montage.track;
    for (const track of [warm, calm, road]) await press(s.montage.addTrack(track));
    const field = (track: string) =>
      root()
        .findAllByType('input-stub' as never)
        .find((one) => one.props.label === s.montage.wishAbout(track));
    await press(s.montage.wishAbout(warm));
    await act(async () => field(warm)!.props.onChangeText('  Тихо, на сборы  '));
    await act(async () => field(warm)!.props.onBlur());
    // «Calm» has its pencil pressed and its field open; «Road» has nothing.
    await press(s.montage.wishAbout(calm));
    expect(field(calm)!.props.maxLength).toBe(500);
    expect(field(warm)).toBeUndefined();

    // This step alone: the ones under it stay mounted, and a window of no width sizes their tiles at nothing.
    const names = expectReachable(root().findAllByType(MusicStep).at(-1)!).map((one) => one.name);
    for (const name of [
      s.montage.wishEdit(warm),
      s.montage.wishAbout(calm),
      s.montage.wishAbout(road),
      s.montage.dropTrack(warm),
      s.montage.dropTrack(road),
      s.montage.addTrack(s.montage.track.bright),
      s.montage.unpickTrack(warm),
      s.montage.next,
    ])
      expect(names, name).toContain(name);
    // A wish typed and a wish being typed: the first stands under its track and is read out with it.
    expect(chosen(warm).props.wish).toBe('Тихо, на сборы');
    const grip = chosen(warm).props.grip;
    expect(grip.accessibilityLabel).toContain('Тихо, на сборы');
    expect(grip.accessibilityRole).toBe('adjustable');
  },
);

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
