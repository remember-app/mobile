import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: session.token, user: { id: 'me' } }) }));
// The router is what the screens are handed and not what these tests are about: focus is «now, once»,
// the route's own parameters are whatever the test names, and what a screen asks the router to do is
// kept to be read.
const { session, route, router } = vi.hoisted(() => ({
  session: { token: '' },
  route: { params: {} as Record<string, string> },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: () => true,
    setParams: vi.fn(),
  },
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => route.params,
    useRouter: () => router,
  };
});
// The window of the phone and the type size it is set to. Under node the window is nothing at all,
// which is what every test here but the one about the smallest phone wants: it is left alone until a
// test gives it a size.
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
// The player of the finished film is a window over the page and is not what these tests read.
vi.mock('@/lib/orientation', () => ({ lockPortrait: () => {}, useTurnsWithPhone: () => {} }));
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
vi.mock('@/lib/downloads', () => ({
  maySaveToPhone: () => false,
  saveToPhone: async () => {},
  saveAndShare: async () => {},
  shareFile: async () => {},
}));

import { measure, scrolled } from '@tests/helpers/board';
import { act, BEAT_BY_BEAT, drives, settle } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Unlink, WifiOff } from 'lucide-react-native';
import { AppState, FlatList, Text as RNText, StyleSheet, View } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import type {
  JournalEntry,
  JournalFile,
  Montage,
  MontageJournal,
  MontageStage,
  MontageStep,
} from '@/api';
import { MONTAGE_STAGES } from '@/api';
import MontageDoneScreen from '@/app/memory/[id]/montage/[montageId]/done';
import MontageLiveScreen from '@/app/memory/[id]/montage/[montageId]/index';
import MontageLiveStageScreen from '@/app/memory/[id]/montage/[montageId]/stage/[stage]';
import {
  ActionBar,
  AppBar,
  Avatar,
  BackButton,
  BadgeDecision,
  Banner,
  Button,
  CardMontage,
  CardNow,
  Chip,
  Icon,
  JournalLine,
  LogEntry,
  NoteThought,
  RowStep,
  ShotGaze,
  StepLink,
  StepNote,
  Tag,
  TileNumber,
  WatchingPill,
} from '@/kit';
import { setLanguage } from '@/lib/language';
import { marksOf, useMontageJournal, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { Films } from '@/screens/memory/films';
import { SheetLiveFile } from '@/screens/memory/live-file';
import { ru, strings } from '@/strings';
import {
  BROKE,
  bodyOf,
  fellOver,
  listPath,
  liveSteps,
  load,
  MEMORY,
  MONTAGE,
  OLD,
  PEOPLE,
  QUEUED,
  type Replay,
  replay,
  type Scenario,
  type Step,
  step,
  TOKEN,
} from './recorded';

/**
 * The screens of the journal on the state the recorded answers produce: the real screens, the real
 * api client and the real hook, with the network answered from `responses_*.json` by request. What is
 * checked is what a screen is handed and draws — the pieces the kit gets as props — read against the
 * numbers and sentences in the recording, not against a second copy of the code that made them.
 *
 * What a phone does with these (the picture, the gaze square moving, the typing) is outside anything
 * node can see and is not here.
 */

mountsTrees();

const SCENARIOS: Scenario[] = ['director', 'algorithm'];
/** Not part of the recording: who the memory's people are called, which the journal names by id. */
const ROSTER = [
  {
    id: PEOPLE.organizer,
    name: 'Аня Петрова',
    username: 'anya',
    role: 'organizer',
    contribution_status: 'done',
    media_count: 7,
  },
  {
    id: PEOPLE.contributor,
    name: 'Марк',
    username: 'marko',
    role: 'contributor',
    contribution_status: 'done',
    media_count: 6,
  },
  {
    id: PEOPLE.viewer,
    name: null,
    username: 'lena',
    role: 'viewer',
    contribution_status: null,
    media_count: 0,
  },
];
const nameOf = (id: string) => ROSTER.find((one) => one.id === id)!.name ?? 'lena';
const MEMBERS = `/memories/${MEMORY}/members`;
const extra = {
  '/memories': [
    { id: MEMORY, title: 'День рождения', role: 'organizer', recent_thumbnail_urls: [] },
  ],
  [MEMBERS]: ROSTER,
};

/** Seconds after 2026-01-01T00:00:00Z: the recording's own clock, so no stage has run «for minutes». */
const NOW = Date.parse('2026-01-01T00:00:20Z');

beforeEach(() => {
  Object.assign(handset, { height: 0, fontScale: 0 });
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(router))
    if (typeof mock === 'function' && 'mockClear' in mock) mock.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
drives();

/* ── driving the tree ──────────────────────────────────────────────────── */

async function mount(
  element: React.ReactElement,
  api: Replay,
  as: keyof typeof TOKEN = 'organizer',
) {
  session.token = TOKEN[as];
  vi.stubGlobal('fetch', api.fetch);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(element));
  });
  await settle();
  return {
    root: tree.root,
    unmount: () => act(() => tree.unmount()),
    /** One beat of the screen's own clock, and the read it starts. */
    tick: async () => {
      await act(async () => {
        vi.advanceTimersByTime(WHILE_LIVE_MS);
      });
      await settle();
    },
    press: async (instance: ReactTestInstance) => {
      await act(async () => instance.props.onPress());
      await settle();
    },
  };
}
type Screen = Awaited<ReturnType<typeof mount>>;

/** Every string the tree draws, in order. */
function words(root: ReactTestInstance): string {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') out.push(node);
    else node.children.forEach(walk);
  };
  walk(root);
  return out.join('\n');
}

/** Every banner on the screen: its words, and the glyph drawn beside them. */
const banners = (screen: Screen) =>
  screen.root
    .findAllByType(Banner)
    .map((one) => [one.props.text, one.findByType(Icon).props.icon] as const);

const nodeProps = (node: unknown) => (node as { props: Record<string, unknown> }).props;
/** «1:12» — written here on its own, to the whole second, as the film's own length is. */
const clock = (seconds: number) =>
  `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;

/* ── what the recording says was on the api's side at the moment a screen looked ──────────── */

type Truth = {
  entries: JournalEntry[];
  files: Map<string, JournalFile>;
  last: MontageJournal;
};

/** Everything the api has said in the journal answers served so far — the records once each. */
function truthOf(steps: Step[], served: string[]): Truth {
  const entries = new Map<number, JournalEntry>();
  const files = new Map<string, JournalFile>();
  let last: MontageJournal | undefined;
  for (const name of served) {
    const found = steps.find((one) => one.name === name);
    if (!found?.request.path.endsWith('/journal')) continue;
    last = found.response.body as MontageJournal;
    for (const entry of last.entries) entries.set(entry.id, entry);
    for (const file of last.files) files.set(file.id, file);
  }
  return {
    entries: [...entries.values()].sort((a, b) => b.id - a.id),
    files,
    last: last!,
  };
}

/** The stage the worker is at: the one running, or the last it reached. */
const atWork = (stages: MontageStage[]) =>
  stages.find((one) => one.state === 'running') ??
  stages.filter((one) => one.state !== 'pending').at(-1);

const sitting = (steps: Step[]) => [
  ...liveSteps(steps).map((one) => one.name),
  'journal_after_ready_nothing_new',
];

/** The screen of the making left open beat by beat until it leaves for the film's page, looked at on every beat. */
async function sitThrough(screen: Screen, steps: Step[], look: () => void) {
  let beats = 0;
  while (router.replace.mock.calls.length === 0) {
    if (beats++ > sitting(steps).length + 2) throw new Error('the screen never left the making');
    look();
    await screen.tick();
  }
  return beats;
}

/** What the screen says of where the making is: the number in «Этап N из 5» and the minutes of «осталось ≈», each null when unsaid. */
const whereOf = (text: string) => ({
  stage: [1, 2, 3, 4, 5].find((n) => text.includes(ru.montage.live.stageOf(n, 5))) ?? null,
  minutes:
    Array.from({ length: 30 }, (_, i) => i).find((n) =>
      text.includes(ru.montage.live.leftAbout(n)),
    ) ?? null,
});

describe.each(SCENARIOS)('%s — «Монтаж идёт»', (scenario) => {
  const steps = load(scenario);
  const only = [...sitting(steps), 'montage_list_while_building'];

  /** What the screen shows, taken off the tree, at whatever moment it is asked. */
  const shown = (screen: Screen) => {
    const card = screen.root.findByType(CardNow);
    const rows = screen.root.findAllByType(RowStep);
    return {
      card: card.props,
      rows,
      notes: screen.root.findAllByType(StepNote),
      watching: screen.root.findAllByType(WatchingPill)[0]?.props,
      text: words(screen.root),
    };
  };

  test(
    'at every beat it draws what the api last said: the frame in hand, the stage, the five stages',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(steps, { only, extra });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api);

      const where: ReturnType<typeof whereOf>[] = [];
      const beats = await sitThrough(screen, steps, () => {
        const truth = truthOf(steps, api.served);
        const now = shown(screen);

        if (truth.last) {
          // The frame in the director's hands is the freshest record that is about a frame.
          const held = truth.entries.find((one) => one.media_id !== null);
          if (held) {
            const file = truth.files.get(held.media_id!);
            expect(`${now.card.thought}${now.card.unsaid}`).toBe(held.thought ?? '');
            expect(now.card.uri).toBe(file?.thumbnail_url);
            expect(now.card.author).toBe(nameOf(file!.uploaded_by));
            expect(now.card.standing).toBe(
              held.decision === null ? ru.montage.live.thinking : ru.montage.live.decided,
            );
            if (held.decision === null) expect(now.card.decision).toBeUndefined();
            else {
              expect(nodeProps(now.card.decision).label).toBe(marksOf(held, ru)[0]);
              expect(nodeProps(now.card.decision).kind).toBe(
                held.decision === 'take' ? 'take' : 'pass',
              );
            }
            expect(now.card.gaze !== undefined).toBe(held.focus !== null);
            expect(now.card.waiting).toBeUndefined();
          } else {
            // Nothing in hand yet, and the montage is being made: not «в очереди», and no frame.
            expect(now.card.waiting).toBe(ru.montage.status.processing);
          }

          // «Этап N из 5»: the place of the stage at work in the pipeline — and none while all five
          // still wait, when the worker has opened the job and not yet begun a stage. «осталось ≈» is
          // said with it, for as long as some stage is not done.
          const at = atWork(truth.last.stages);
          const said = whereOf(now.text);
          expect(said.stage).toBe(at ? MONTAGE_STAGES.indexOf(at.stage) + 1 : null);
          expect(said.minutes !== null).toBe(
            at !== undefined && truth.last.stages.some((one) => one.state !== 'done'),
          );

          // All five, always accounted for (`MontageLive`): a row of its own for every stage the
          // api says was reached, standing as it says, and the ones not reached yet — `pending`, or
          // not written at all — named in one faint line under them.
          const standing = (code: (typeof MONTAGE_STAGES)[number]) => {
            const row = truth.last.stages.find((one) => one.stage === code);
            return row ? (row.state === 'pending' ? 'waiting' : row.state) : 'waiting';
          };
          const reached = MONTAGE_STAGES.filter((code) => standing(code) !== 'waiting');
          const ahead = MONTAGE_STAGES.filter((code) => standing(code) === 'waiting');
          expect(now.rows.map((one) => [one.props.title, one.props.state])).toEqual([
            ...reached.map((code) => [ru.montage.stage[code], standing(code)]),
            ...(ahead.length
              ? [
                  [
                    ru.montage.live.ahead(ahead.map((code) => ru.montage.stageAhead[code])),
                    'waiting',
                  ],
                ]
              : []),
          ]);
          const screening = truth.last.stages.find((one) => one.stage === 'screening');
          if (screening?.state === 'done') {
            expect(now.rows[0].props.meta).toContain(
              ru.montage.live.kept(screening.outcome.kept!, screening.outcome.of!),
            );
          }

          // The stage at work is the one opened out, with its last two records — freshest first.
          const open = now.rows.filter((one) => one.props.open);
          expect(open.length).toBeLessThanOrEqual(1);
          if (open.length === 1) {
            const opened = reached[now.rows.indexOf(open[0])];
            expect(opened).toBe(at?.stage);
            const last = truth.entries.filter((one) => one.stage === opened).slice(0, 2);
            expect(now.notes.map((one) => one.props.text)).toEqual(
              last.map((one) => one.thought ?? ''),
            );
          }

          // Who is watching: nobody is no pill, and somebody is everybody the api named.
          expect(now.watching?.names).toEqual(
            truth.last.viewers.length ? truth.last.viewers.map((one) => one.username) : undefined,
          );
          expect(now.watching?.label).toBe(
            truth.last.viewers.length
              ? ru.montage.live.watching(truth.last.viewers.length)
              : undefined,
          );
          expect(now.text).not.toContain(ru.montage.live.lost);
          // A making on air has nothing to carry at the bottom, so there is no bottom layer to see.
          expect(screen.root.findAllByType(ActionBar)).toEqual([]);
          where.push(whereOf(now.text));
        }
      });

      // The very first look is the job opened and nothing begun: five rows waiting, no stage named, no
      // time promised. From there the number only goes forward and the minutes never grow or go under one.
      expect(where[0]).toEqual({ stage: null, minutes: null });
      const numbers = where.flatMap((one) => one.stage ?? []);
      expect(numbers).toEqual([...numbers].sort());
      expect(numbers.at(-1)).toBe(5);
      const minutes = where.flatMap((one) => one.minutes ?? []);
      expect(minutes.length).toBeGreaterThan(0);
      minutes.forEach((one, at) => {
        expect(one).toBeGreaterThanOrEqual(1);
        if (at > 0) expect(one).toBeLessThanOrEqual(minutes[at - 1]);
      });

      // The whole making was sat through, beat by beat — not a first look and out.
      // A poll is one read and then every page `has_more` promised, so it takes fewer beats than there
      // are recorded answers — by exactly the answers that were followed at once.
      const names = sitting(steps);
      const polls = names.filter(
        (_, at) => at === 0 || !bodyOf(steps, names[at - 1]).has_more,
      ).length;
      expect(beats).toBe(polls - 1);
      expect(api.served.filter((one) => names.includes(one))).toEqual(names);

      // Ready while it was being watched: it goes to the film's page, by replacing itself — and never
      // reads the journal again.
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/memory/[id]/montage/[montageId]/done',
        params: { id: MEMORY, montageId: MONTAGE },
      });
      const asked = api.served.length;
      await screen.tick();
      await screen.tick();
      expect(api.served).toHaveLength(asked);
      expect(api.unmatched).toEqual([]);
      await screen.unmount();
    },
  );

  test(
    'the bar says what was ordered in the poster’s figures, and where the making is in 12 / 600 and 12 / 500',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(steps, { only, extra });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api);
      // `MontageLive`: «Для родителей · 2:30 · 16:9» — the length as a running time and the shape as
      // a ratio, the way the finished poster says them. These montages were ordered with a length
      // and with no shape, which the api reads as horizontal; the app said the length alone. (The
      // template's name is not something the api hands back.)
      const ordered = step(steps, 'montage_list_while_building').response.body as Montage[];
      const { target_seconds, orientation } = ordered.find((one) => one.id === MONTAGE)!.params;
      expect(orientation).toBeUndefined();
      expect(screen.root.findByType(AppBar).props.subtitle).toBe(
        `${clock(target_seconds!)} · 16:9`,
      );

      let beats = 0;
      while (whereOf(words(screen.root)).minutes === null) {
        if (beats++ > sitting(steps).length) throw new Error('the making never said where it was');
        await screen.tick();
      }
      const { stage, minutes } = whereOf(words(screen.root));
      const style = (said: string) =>
        StyleSheet.flatten(
          screen.root.find((node) => node.type === RNText && node.props.children === said).props
            .style,
        );
      // `MontageLive`: «Этап 3 из 5» Onest 12 / 600 and «осталось ≈ 8 мин» Onest 12 / 500 `muted`,
      // both tabular. The app drew both in the 11 / 700 badge with its tracking — a line 3 short.
      expect(style(ru.montage.live.stageOf(stage!, 5))).toMatchObject({
        fontSize: 12,
        fontFamily: 'Onest_600SemiBold',
        fontVariant: ['tabular-nums'],
      });
      expect(style(ru.montage.live.leftAbout(minutes!))).toMatchObject({
        fontSize: 12,
        fontFamily: 'Onest_500Medium',
        fontVariant: ['tabular-nums'],
      });
      await screen.unmount();
    },
  );

  test('a montage still in the queue is «ждём очереди» over the five not yet reached, not an error', async () => {
    const api = replay(steps, { only: ['journal_of_queued_montage'], extra });
    route.params = { id: MEMORY, montageId: QUEUED };
    const screen = await mount(<MontageLiveScreen />, api);
    const now = shown(screen);

    expect(now.card.waiting).toBe(ru.montage.live.inQueue);
    // Nothing reached: all five are the one line of what is ahead, and not a road into anything.
    expect(now.rows.map((one) => [one.props.title, one.props.state])).toEqual([
      [ru.montage.live.ahead(MONTAGE_STAGES.map((code) => ru.montage.stageAhead[code])), 'waiting'],
    ]);
    expect(now.rows[0].props.onPress).toBeUndefined();
    expect(now.notes).toEqual([]);
    expect(now.text).not.toContain(ru.montage.live.lost);
    expect(now.text).not.toContain('Этап');
    // The api named one person looking — the organizer, on the screen themselves.
    expect(now.watching?.names).toEqual(['anya']);
    expect(router.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });
});

describe.each(SCENARIOS)('%s — who is watching, on both live screens', (scenario) => {
  const steps = load(scenario);
  const people = (n: number) =>
    Array.from({ length: n }, (_, at) => ({ id: `viewer-${at}`, username: `user${at + 1}` }));

  /** One of the two live screens over the recording with its viewers swapped for these. */
  async function mountWith(which: 'making' | 'stage', viewers: ReturnType<typeof people>) {
    const swap = (body: unknown) => ({ ...(body as MontageJournal), viewers });
    if (which === 'making') {
      const api = replay(steps, {
        only: ['journal_of_queued_montage'],
        extra,
        patch: { journal_of_queued_montage: swap },
      });
      route.params = { id: MEMORY, montageId: QUEUED };
      return mount(<MontageLiveScreen />, api);
    }
    const api = replay(steps, {
      only: ['journal_of_ready_montage'],
      cutFrom: 'journal_of_ready_montage',
      extra,
      patch: { journal_of_ready_montage: swap },
    });
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
    return mount(<MontageLiveStageScreen />, api);
  }

  test.each(['making', 'stage'] as const)(
    'on the %s screen nobody watching is no pill at all — not a pill saying zero',
    async (which) => {
      const screen = await mountWith(which, []);
      expect(screen.root.findAllByType(WatchingPill)).toEqual([]);
      await screen.unmount();
    },
  );

  test.each([
    ['making', 'ru'],
    ['making', 'en'],
    ['stage', 'ru'],
    ['stage', 'en'],
  ] as const)(
    'on the %s screen in %s the pill is everybody the api named, in its order, counted as a figure and read out as one sentence',
    async (which, language) => {
      await act(async () => setLanguage(language));
      try {
        for (const many of [1, 4, 7]) {
          const viewers = people(many);
          const screen = await mountWith(which, viewers);
          const [pill] = screen.root.findAllByType(WatchingPill);
          expect(pill.props.names).toEqual(viewers.map((one) => one.username));
          expect(pill.props.count).toBe(many);
          expect(pill.props.label).toBe(strings[language].montage.live.watching(many));
          // Three faces and the count of the rest from the fifth person on — the count is the whole
          // of them, and the faces are the 24 stack.
          const circles = pill.findAllByType(Avatar);
          expect(circles.map((one) => one.props.size)).toEqual(
            Array.from({ length: Math.min(many, many > 4 ? 3 : 4) }, () => 24),
          );
          await screen.unmount();
        }
      } finally {
        await act(async () => setLanguage('ru'));
      }
    },
  );
});

describe.each(SCENARIOS)('%s — the journal of one stage and the card of a file', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');

  async function open(stage: string, patch?: Record<string, (body: unknown) => unknown>) {
    const api = replay(steps, {
      only: ['journal_of_ready_montage'],
      cutFrom: 'journal_of_ready_montage',
      extra,
      patch,
    });
    route.params = { id: MEMORY, montageId: MONTAGE, stage };
    return { api, screen: await mount(<MontageLiveStageScreen />, api) };
  }
  const recordsOn = (stage: string) => whole.entries.filter((one) => one.stage === stage);
  const inList = (screen: Screen) => screen.root.findAllByType(LogEntry);
  const thoughtOf = (log: ReactTestInstance) => {
    const plate = log.findAllByType(NoteThought)[0];
    return plate
      ? `${plate.props.text}${plate.props.unsaid ?? ''}`
      : `${log.props.text}${log.props.unsaid ?? ''}`;
  };

  test('on the smallest phone at the largest type the bar and the chips scroll with the records, and the line behind the list goes', async () => {
    const { screen } = await open('directing');
    const bar = () => screen.root.findAllByType(AppBar);
    const chips = () => screen.root.findAllByType(Chip);
    // Standing: the bar and the four chips above the list, the line laid behind it.
    await measure(screen.root, { bar: 200 });
    expect([bar().length, chips().length]).toEqual([1, 4]);
    expect(scrolled(bar()[0])).toBe(false);
    expect(chips().map(scrolled)).toEqual([false, false, false, false]);
    expect(screen.root.findAllByType(JournalLine)).toHaveLength(1);

    // At ×3.571 on 320 × 568 a bar and chips 520 tall still leave the records a line — at ×2, as
    // far as the body's words grow (`TYPE_MOST`, TASK-401) — and they stand.
    Object.assign(handset, { height: 568, fontScale: 3.571 });
    await measure(screen.root, { bar: 520 });
    expect(scrolled(bar()[0])).toBe(false);
    // 540 leave none: the bar and the chips are the list's own head, once each, and the line —
    // which would run behind them — is not drawn.
    await measure(screen.root, { bar: 540 });
    expect([bar().length, chips().length]).toEqual([1, 4]);
    expect(scrolled(bar()[0])).toBe(true);
    expect(chips().map(scrolled)).toEqual([true, true, true, true]);
    expect(screen.root.findAllByType(JournalLine)).toHaveLength(0);
    // The records are still there, and a chip still answers.
    expect(inList(screen).length).toBeGreaterThan(0);
    await screen.press(chips()[1]);
    await screen.unmount();
  });

  test('the chips stand 12 under the bar, and the records begin 24 under the chips', async () => {
    // `MontageLiveStage`: the bar's row ends at 96 and the chips stand 108 to 142; the first record's
    // «сейчас» is at 166, its dot at 171 and the journal's line from 170 — from the dot, not above
    // it. The app stood the chips right under the bar and the records 16 under them.
    const { screen } = await open('directing');
    await measure(screen.root, { bar: 200 });
    /** The innermost view holding what `holds` finds — the one that lays it out. */
    const around = (holds: (view: ReactTestInstance) => boolean) =>
      StyleSheet.flatten(
        screen.root.findAll((node) => node.type === View && holds(node)).at(-1)!.props.style,
      );
    const chips = around((view) => view.findAllByType(Chip).length === 4);
    expect(chips).toMatchObject({ paddingTop: 108 - 96, gap: 6 });
    const feed = around((view) => view.findAllByType(FlatList).length === 1);
    expect(feed).toMatchObject({ marginTop: 166 - 142 });
    expect(feed.paddingTop).toBeUndefined();
    await screen.unmount();
  });

  test('«directing» is that stage’s records, freshest first, under the counts the api keeps', async () => {
    const { api, screen } = await open('directing');
    const row = whole.stages.find((one) => one.stage === 'directing')!;
    const bar = screen.root.findByType(AppBar).props;

    // `MontageLiveStage`: «Строит историю» — the bar also carries who is watching, and the journal is
    // the director's own, so the director is not named in its head.
    expect(bar.title).toBe('Строит историю');
    expect(bar.title).toBe(ru.montage.stageHead.directing);
    expect(bar.subtitle).toContain(ru.montage.live.stageOf(3, 5));
    // Narrowed on the server: the request said which stage, and only that stage’s records came.
    expect(api.served.some((one) => one.includes('stage=directing'))).toBe(true);

    const chips = Object.fromEntries(
      screen.root.findAllByType(Chip).map((one) => [one.props.label, one.props.count]),
    );
    expect(chips).toEqual({
      [ru.montage.live.all]: undefined,
      [ru.montage.live.thoughts]: undefined,
      [ru.montage.live.took]: String(row.taken_count),
      [ru.montage.live.skip]: String(row.skipped_count),
    });

    const expected = recordsOn('directing');
    // A list draws its first page; what it draws is the newest records, in order.
    const drawn = inList(screen);
    expect(drawn.length).toBe(Math.min(expected.length, 10));
    expect(drawn.map(thoughtOf)).toEqual(
      expected.slice(0, drawn.length).map((one) => one.thought ?? ''),
    );
    expect(expected.filter((one) => one.decision === 'take')).toHaveLength(row.taken_count);
    await screen.unmount();
  });

  const pillsOf = (log: ReactTestInstance) =>
    (log.props.marks as { props: { label: string } }[]).map((one) => one.props.label);

  test('every record wears the decision and the reason the worker gave, in the app’s words', async () => {
    // Screening is where the reasons are: blurred, too dark or too bright, would not open.
    const { screen } = await open('screening');
    const drawn = recordsOn('screening');
    const logs = inList(screen);
    expect(logs).toHaveLength(Math.min(drawn.length, 10));

    logs.forEach((log, at) => {
      const record = drawn[at];
      expect(record.decision).toBe('skip');
      expect(pillsOf(log)).toEqual([
        ru.montage.live.skip,
        ru.montage.live.reason[record.reason as 'blur'],
      ]);
    });
    expect(new Set(drawn.map((one) => one.reason)).size).toBeGreaterThan(1);
    await screen.unmount();
  });

  test('a reason the app has never heard of still draws, as «не подходит»', async () => {
    const api = replay(steps, {
      only: ['journal_of_ready_montage'],
      cutFrom: 'journal_of_ready_montage',
      extra,
      patch: {
        journal_of_ready_montage: (body) => ({
          ...(body as MontageJournal),
          entries: (body as MontageJournal).entries.map((one) =>
            one.stage === 'screening' ? { ...one, reason: 'shaky_pan' } : one,
          ),
        }),
      },
    });
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'screening' };
    const screen = await mount(<MontageLiveStageScreen />, api);

    const logs = inList(screen);
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs)
      expect(pillsOf(log)).toEqual([ru.montage.live.skip, ru.montage.live.reason.other]);
    await screen.unmount();
  });

  test('a frame the organizer asked for wears «Взят по слову организатора» beside «Беру», in the journal and on its card', async () => {
    const { screen } = await open('directing');
    const first = recordsOn('directing').slice(0, inList(screen).length);
    const kindsOf = (log: ReactTestInstance) =>
      (log.props.marks as { props: { kind: string } }[]).map((one) => one.props.kind);
    const asked = first.filter((one) => one.reason === 'included');
    expect(asked.length, 'the recording has a frame the organizer asked for').toBeGreaterThan(0);

    for (const record of asked) {
      const log = inList(screen)[first.indexOf(record)];
      expect(record.decision).toBe('take');
      expect(pillsOf(log)).toEqual([marksOf(record, ru)[0], ru.montage.live.reason.included]);
      expect(kindsOf(log)).toEqual(['take', 'part']);

      await screen.press(log);
      const sheet = screen.root.findByType(SheetLiveFile);
      expect(
        sheet.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label]),
      ).toEqual([
        ['take', marksOf(record, ru)[0]],
        ['part', ru.montage.live.reason.included],
      ]);
      await act(async () => sheet.props.onCancel());
    }

    // Every other frame taken is taken with no reason pill: the organizer's word is theirs alone.
    for (const record of first.filter(
      (one) => one.decision === 'take' && one.reason !== 'included',
    )) {
      expect(pillsOf(inList(screen)[first.indexOf(record)])).not.toContain(
        ru.montage.live.reason.included,
      );
    }
    await screen.unmount();
  });

  test('the three narrow chips cut by the decision, as the api counts them', async () => {
    const { screen } = await open('directing');
    const row = whole.stages.find((one) => one.stage === 'directing')!;
    const chip = (label: string) =>
      screen.root.findAllByType(Chip).find((one) => one.props.label === label)!;

    for (const [label, count] of [
      [ru.montage.live.took, row.taken_count],
      [ru.montage.live.skip, row.skipped_count],
      [ru.montage.live.thoughts, row.thought_count],
    ] as const) {
      await screen.press(chip(label));
      expect(inList(screen).length, label).toBe(count);
    }
    await screen.press(chip(ru.montage.live.all));
    expect(inList(screen).length).toBe(Math.min(recordsOn('directing').length, 10));
    await screen.unmount();
  });

  test('a record about a frame opens the frame’s card: whose it is, what was seen, the thought, where it went', async () => {
    const { screen } = await open('directing');
    const files = new Map(whole.files.map((one) => [one.id, one]));
    const first = recordsOn('directing').slice(0, inList(screen).length);
    const placed = first.filter(
      (one) => one.decision === 'take' && files.get(one.media_id!)?.places.length,
    );
    const target = placed.find((one) => one.thought) ?? placed[0];
    expect(target, 'the recording has a taken, placed frame on the first page').toBeDefined();
    const file = files.get(target.media_id!)!;

    await screen.press(inList(screen)[first.indexOf(target)]);
    const sheet = screen.root.findByType(SheetLiveFile);
    expect(sheet.props.entry.id).toBe(target.id);
    expect(sheet.props.file).toEqual(file);
    expect(sheet.props.author).toBe(nameOf(file.uploaded_by));

    expect(sheet.findByType(ShotGaze).props.uri).toBe(file.thumbnail_url);
    expect(sheet.findByType(ShotGaze).props.gaze !== undefined).toBe(target.focus !== null);
    expect(sheet.findAllByType(Tag).map((one) => one.props.label)).toEqual(target.labels ?? []);
    // The decision, and beside it the organizer's word where that is why it was taken.
    expect(
      sheet.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label]),
    ).toEqual([
      ['take', marksOf(target, ru)[0]],
      ...(target.reason === 'included' ? [['part', ru.montage.live.reason.included]] : []),
    ]);
    // The thought, where there is one, and where the frame went: the part of the story, and the
    // seconds of the film it plays for.
    expect(sheet.findAllByType(NoteThought).map((one) => one.props.text)).toEqual(
      target.thought ? [target.thought] : [],
    );
    const [place] = file.places;
    expect(words(sheet)).toContain(
      `${clock(place.start_seconds)}–${clock(place.start_seconds + place.duration_seconds)}`,
    );
    if (target.story_part !== null) expect(words(sheet)).toContain(`Часть ${target.story_part}`);

    await act(async () => sheet.props.onCancel());
    expect(screen.root.findAllByType(SheetLiveFile)).toEqual([]);
    await screen.unmount();
  });

  test('a frame nothing was said about still says where it lay: no plate, the line alone', async () => {
    const { screen } = await open('directing');
    const files = new Map(whole.files.map((one) => [one.id, one]));
    const first = recordsOn('directing').slice(0, inList(screen).length);
    const silent = first.filter(
      (one) =>
        one.decision !== 'skip' && one.thought === null && files.get(one.media_id!)?.places.length,
    );
    // Both roads have them: the frame the organizer asked for on either, and every frame taken on the
    // road without the director, who has no thoughts to say.
    expect(silent.length).toBeGreaterThan(0);
    if (scenario === 'algorithm') {
      expect(silent).toEqual(first.filter((one) => one.decision === 'take'));
    }

    for (const record of silent) {
      await screen.press(inList(screen)[first.indexOf(record)]);
      const sheet = screen.root.findByType(SheetLiveFile);
      const [place] = files.get(record.media_id!)!.places;
      expect(sheet.findAllByType(NoteThought)).toEqual([]);
      expect(words(sheet), `record ${record.id}`).toContain(
        `${clock(place.start_seconds)}–${clock(place.start_seconds + place.duration_seconds)}`,
      );
      await act(async () => sheet.props.onCancel());
    }
    await screen.unmount();
  });

  // NOT WORDS OF THE API — the recording predates a clip cut into pieces (TASK-449). Its taken clip
  // is taken a second time, later in the plan, and so stands in the film a second time, later on.
  test('a clip taken twice: each «беру» opens on its own place in the film, not the first one twice', async () => {
    const files = new Map(whole.files.map((one) => [one.id, one]));
    const once = recordsOn('directing').find(
      (one) => one.decision === 'take' && files.get(one.media_id!)?.kind === 'video',
    )!;
    const clip = files.get(once.media_id!)!;
    const [first] = clip.places;
    const places = [first, { start_seconds: first.start_seconds + 20, duration_seconds: 2 }];
    const again = { ...once, id: Math.max(...whole.entries.map((one) => one.id)) + 1 };
    const { screen } = await open('directing', {
      journal_of_ready_montage: (body) => {
        const journal = body as MontageJournal;
        return {
          ...journal,
          entries: [again, ...journal.entries],
          files: journal.files.map((one) => (one.id === clip.id ? { ...one, places } : one)),
        };
      },
    });
    const listed = [again, ...recordsOn('directing')];
    const span = ({ start_seconds, duration_seconds }: (typeof places)[number]) =>
      `${clock(start_seconds)}–${clock(start_seconds + duration_seconds)}`;

    for (const [record, own, other] of [
      [once, places[0], places[1]],
      [again, places[1], places[0]],
    ] as const) {
      await screen.press(inList(screen)[listed.indexOf(record)]);
      const sheet = screen.root.findByType(SheetLiveFile);
      expect(sheet.props.entry.id).toBe(record.id);
      expect(words(sheet), `record ${record.id}`).toContain(span(own));
      expect(words(sheet), `record ${record.id}`).not.toContain(span(other));
      await act(async () => sheet.props.onCancel());
    }
    await screen.unmount();
  });

  test('the rhythm is the fourth of five with music or without, and says under its name what it came to', async () => {
    const { screen } = await open('rhythm');
    const { track, cuts } = whole.stages.find((one) => one.stage === 'rhythm')!.outcome;
    const bar = screen.root.findByType(AppBar).props;
    expect(bar.subtitle).toContain(ru.montage.live.stageOf(4, 5));
    expect(bar.subtitle).toContain(
      track!.length === 0 ? ru.montage.live.noTrack : ru.montage.live.cuts(cuts!),
    );
    expect(bar.subtitle).not.toContain(ru.montage.live.cuts(0));
    await screen.unmount();
  });

  test('a stage that came to no records at all is an empty list, not a wait and not an error', async () => {
    const { screen } = await open('assembly');
    expect(inList(screen)).toEqual([]);
    expect(words(screen.root)).not.toContain(ru.state.loading);
    expect(words(screen.root)).not.toContain(ru.montage.live.lost);
    await screen.unmount();
  });

  test('a first read that does not come back is «Связь пропала, ждём», not «Загружаем…», and the records come with the connection', async () => {
    let failing: 'offline' | undefined = 'offline';
    const api = replay(steps, {
      only: ['journal_of_ready_montage'],
      cutFrom: 'journal_of_ready_montage',
      extra,
      refuse: () => failing,
    });
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
    const screen = await mount(<MontageLiveStageScreen />, api);

    // TASK-405: this used to be «Загружаем…» for as long as the connection stayed away.
    expect(banners(screen)).toEqual([[ru.montage.live.lost, WifiOff]]);
    expect(words(screen.root)).not.toContain(ru.state.loading);
    expect(inList(screen)).toEqual([]);

    // On the smallest phone at the largest type the banner goes with the bar and the chips into the
    // head of the list — scrolled to, never out of reach.
    Object.assign(handset, { height: 568, fontScale: 3.571 });
    await measure(screen.root, { bar: 640 });
    expect(scrolled(screen.root.findByType(Banner))).toBe(true);
    expect(banners(screen)).toHaveLength(1);

    failing = undefined;
    await screen.tick();
    expect(banners(screen)).toEqual([]);
    expect(inList(screen).length).toBeGreaterThan(0);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  // Ready under the journal of one stage that was read while the film was being made. The files it
  // holds were sent with their records, before the film was laid out, so they have no places; the
  // ready montage has them. What is asked of the screen: at «готов» the frames' cards know where the
  // frames went, for the price of one more read — and the screen of the making itself, which leaves
  // for the film's page and reads there, does not read again (see «Монтаж идёт» above). The narrowed
  // answers here are cut moment by moment from the recording (`moments` in `recorded.ts`), not words
  // of the api.
  test(
    'read through the making, it learns where the frames went with one more read at «готов»',
    BEAT_BY_BEAT,
    async () => {
      const names = sitting(steps);
      const api = replay(steps, {
        only: [],
        moments: names,
        cutFrom: 'journal_of_ready_montage',
        extra,
      });
      route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
      const screen = await mount(<MontageLiveStageScreen />, api);
      const reads = () => api.served.filter((one) => one.includes('/journal')).length;
      const files = new Map(whole.files.map((one) => [one.id, one]));
      const placed = (id: string | null) => (id ? (files.get(id)?.places.length ?? 0) : 0);
      const cardOf = async (log: ReactTestInstance) => {
        await screen.press(log);
        const sheet = screen.root.findByType(SheetLiveFile);
        const file = sheet.props.file as JournalFile;
        await act(async () => sheet.props.onCancel());
        return file;
      };

      // Through the making one read a beat, and none of the frames has a place yet.
      for (let moment = 1; moment < names.length - 1; moment++) {
        api.moment = moment;
        const from = reads();
        await screen.tick();
        expect(reads() - from, names[moment]).toBe(1);
      }
      const pressable = () => inList(screen).filter((log) => log.props.onPress);
      expect(pressable().length).toBeGreaterThan(0);
      expect((await cardOf(pressable()[0])).places).toEqual([]);

      // «Готов»: the beat's own read, and one more.
      api.moment = names.length - 1;
      const from = reads();
      await screen.tick();
      expect(reads() - from).toBe(2);

      // Every frame on the list is now the ready montage's own, the layout in it.
      const shown = recordsOn('directing').slice(0, inList(screen).length);
      expect(
        shown.some((one) => placed(one.media_id) > 0),
        'some of these frames are in the film',
      ).toBe(true);
      for (const [at, record] of shown.entries()) {
        if (record.media_id === null) continue;
        expect(await cardOf(inList(screen)[at]), `record ${record.id}`).toEqual(
          files.get(record.media_id),
        );
      }

      // And that was the last: a ready montage is not asked about again.
      await screen.tick();
      await screen.tick();
      expect(reads() - from).toBe(2);
      await screen.unmount();
    },
  );
});

describe.each(SCENARIOS)('%s — «Ролик готов» and «Как собирался»', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  const only = [
    'journal_of_ready_montage',
    'journal_of_old_ready_montage',
    'montage_list_after_ready',
  ];

  test('the film’s page says how long it took, in three figures and five rows, all done', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageDoneScreen />, api);
    const outcome = (code: string) => whole.stages.find((one) => one.stage === code)!.outcome;
    const text = words(screen.root);

    expect(screen.root.findByType(AppBar).props.title).toBe(ru.montage.live.doneTitle);
    const worked = whole.stages.reduce(
      (sum, one) => sum + Date.parse(one.finished_at!) - Date.parse(one.started_at!),
      0,
    );
    expect(screen.root.findByType(AppBar).props.subtitle).toContain(
      ru.montage.live.madeIn(Math.max(1, Math.ceil(worked / 60000))),
    );
    const film = step(steps, 'montage_list_after_ready').response.body as {
      id: string;
      poster_url: string;
      duration_seconds: number;
    }[];
    const ready = film.find((one) => one.id === MONTAGE)!;
    expect(screen.root.findByType(CardMontage).props.poster).toBe(ready.poster_url);
    expect(screen.root.findByType(CardMontage).props.meta).toContain(clock(ready.duration_seconds));

    expect(text).toContain(ru.montage.live.howMade);
    expect(
      screen.root.findAllByType(TileNumber).map((one) => [one.props.figure, one.props.label]),
    ).toEqual([
      [String(outcome('screening').of), ru.montage.live.watched],
      [String(outcome('directing').frames), ru.montage.live.tookIn],
      [String(outcome('assembly').cuts), ru.montage.live.glued(outcome('assembly').cuts!)],
    ]);

    const rows = screen.root.findAllByType(RowStep);
    expect(rows.map((one) => [one.props.title, one.props.state])).toEqual(
      MONTAGE_STAGES.map((code) => [ru.montage.stage[code], 'done']),
    );
    // Five stages with or without music; the rhythm of a film with none says there was nothing to fit
    // to rather than «0 склеек», and one with music counts the cuts that moved to it.
    const rhythm = rows[MONTAGE_STAGES.indexOf('rhythm')].props.meta as string;
    const { track, cuts } = outcome('rhythm');
    expect(rhythm).toContain(
      track!.length === 0 ? ru.montage.live.noTrack : ru.montage.live.cuts(cuts!),
    );
    expect(rhythm).not.toContain(ru.montage.live.cuts(0));
    // `MontageLiveDone` draws the five closed: no records under any of them, no second way in.
    expect(rows.filter((one) => one.props.open)).toEqual([]);
    expect(screen.root.findAllByType(StepNote)).toEqual([]);
    expect(screen.root.findAllByType(StepLink)).toEqual([]);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  test('every stage is still the way into its own journal, and a frame’s card is there', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageDoneScreen />, api);

    const rows = screen.root.findAllByType(RowStep);
    for (const [at, row] of rows.entries()) {
      await screen.press(row);
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
        params: { id: MEMORY, montageId: MONTAGE, stage: MONTAGE_STAGES[at] },
      });
    }
    expect(router.push).toHaveBeenCalledTimes(MONTAGE_STAGES.length);
    await screen.unmount();

    // And on the journal it leads to, a record about a frame opens that frame's card — read off the
    // same finished montage.
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
    const journal = await mount(
      <MontageLiveStageScreen />,
      replay(steps, {
        only: ['journal_of_ready_montage'],
        cutFrom: 'journal_of_ready_montage',
        extra,
      }),
    );
    const files = new Map(whole.files.map((one) => [one.id, one]));
    const record = journal.root.findAllByType(LogEntry).find((one) => one.props.uri)!;
    await journal.press(record);
    const sheet = journal.root.findByType(SheetLiveFile);
    const file = files.get((sheet.props.entry as JournalEntry).media_id!)!;
    expect(sheet.props.file).toEqual(file);
    expect(sheet.props.author).toBe(nameOf(file.uploaded_by));
    expect(sheet.findByType(ShotGaze).props.uri).toBe(file.thumbnail_url);
    await journal.unmount();
  });

  // NOT WORDS OF THE API — the recording's journal is a single page, and a film's runs to hundreds of
  // records. This one is the recorded journal said over `TIMES` times, stage by stage, under ids of its
  // own, with the stages' counts multiplied to match; every read of it is a page cut out of it by the
  // api's rule (`cutEvery` in `recorded.ts`). Its newest page is the directing and nothing else.
  const TIMES = 30;
  const oldestFirst = [...whole.entries].reverse();
  const hundreds: MontageJournal = {
    ...whole,
    entries: MONTAGE_STAGES.flatMap((code) =>
      Array<JournalEntry[]>(TIMES)
        .fill(oldestFirst.filter((one) => one.stage === code))
        .flat(),
    )
      .map((one, at) => ({ ...one, id: at + 1 }))
      .reverse(),
    stages: whole.stages.map((one) => ({
      ...one,
      taken_count: one.taken_count * TIMES,
      skipped_count: one.skipped_count * TIMES,
      thought_count: one.thought_count * TIMES,
    })),
  };

  /** The film's page over `hundreds`, and every read of the journal it sent, limit and all. */
  async function openHundreds(
    refuse?: (query: URLSearchParams, path: string) => number | undefined,
  ) {
    const api = replay(steps, {
      only,
      cutFrom: 'journal_of_ready_montage',
      cutEvery: true,
      patch: { journal_of_ready_montage: () => hundreds },
      refuse,
      extra,
    });
    const reads: Record<string, string>[] = [];
    const answer = api.fetch;
    api.fetch = ((input: string, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/journal')) reads.push(Object.fromEntries(url.searchParams));
      return answer(input, init);
    }) as typeof fetch;
    route.params = { id: MEMORY, montageId: MONTAGE };
    return { api, reads, screen: await mount(<MontageDoneScreen />, api) };
  }

  test('a journal of hundreds is one read, and every stage still says what it came to', async () => {
    expect(hundreds.entries.slice(0, 200).every((one) => one.stage === 'directing')).toBe(true);
    const { api, reads, screen } = await openHundreds();

    // What each row says is the stage's own outcome from the api, whatever the page held of it —
    // the newest page is all directing, and the screening still says what it kept.
    const rows = screen.root.findAllByType(RowStep);
    expect(rows.map((one) => one.props.state)).toEqual(Array(MONTAGE_STAGES.length).fill('done'));
    const screening = hundreds.stages.find((one) => one.stage === 'screening')!.outcome;
    expect(rows[0].props.meta).toContain(ru.montage.live.kept(screening.kept!, screening.of!));

    // The whole journal's newest page and nothing more: the rows are closed, so no stage is read
    // for records of its own, and the film is finished, so its journal does not move.
    expect(reads).toEqual([{}]);
    await screen.tick();
    await screen.tick();
    expect(reads).toEqual([{}]);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  const poster = (step(steps, 'montage_list_after_ready').response.body as Montage[]).find(
    (one) => one.id === MONTAGE,
  )!.poster_url;
  /** «Сохранить» and «Поделиться» under the poster, as they are drawn. */
  const keepAndHand = (screen: Screen) =>
    screen.root
      .findAllByType(Button)
      .filter((one) => [ru.action.save, ru.action.share].includes(one.props.label));

  test('a journal that does not come back is the connection banner over the film, and «Как собирался» comes back with it', async () => {
    let failing: number | undefined = 500;
    const { screen } = await openHundreds((_, path) =>
      path.endsWith('/journal') ? failing : undefined,
    );

    // TASK-405: the block used to go without a word. The film itself is there, and works.
    expect(banners(screen)).toEqual([[ru.montage.live.lost, WifiOff]]);
    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowStep)).toEqual([]);
    expect(screen.root.findByType(CardMontage).props.poster).toBe(poster);
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([false, false]);

    failing = undefined;
    await screen.tick();
    expect(banners(screen)).toEqual([]);
    expect(words(screen.root)).toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowStep)).toHaveLength(MONTAGE_STAGES.length);
    await screen.unmount();
  });

  test('without a connection the page says so over whatever it has, keeps asking, and is whole again once it answers', async () => {
    let failing: 'offline' | undefined = 'offline';
    const api = replay(steps, { only, extra, refuse: () => failing });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageDoneScreen />, api);
    const knocks = (route: string) =>
      api.served.filter((one) => one.endsWith(`${route} (refused)`)).length;

    // Nothing read at all: one banner, the connection's own glyph and words, first in the page and
    // in its scroll — within reach on any phone at any type size. Under it the poster without a
    // film and the two buttons, which have nothing to keep or hand on yet.
    expect(banners(screen)).toEqual([[ru.montage.live.lost, WifiOff]]);
    expect(scrolled(screen.root.findByType(Banner))).toBe(true);
    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findByType(CardMontage).props.poster).toBeUndefined();
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([true, true]);

    // «ждём» is not a figure of speech: both reads are asked again on every beat.
    const before = [knocks('/journal'), knocks(listPath)];
    await screen.tick();
    await screen.tick();
    expect([knocks('/journal'), knocks(listPath)]).toEqual(before.map((n) => n + 2));

    // Back: the banner goes by itself, and the whole page is there — the poster with its film, both
    // buttons live, «Как собирался» and its five rows.
    failing = undefined;
    await screen.tick();
    expect(banners(screen)).toEqual([]);
    expect(screen.root.findByType(CardMontage).props.poster).toBe(poster);
    expect(screen.root.findByType(CardMontage).props.onPress).toBeTypeOf('function');
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([false, false]);
    expect(words(screen.root)).toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowStep)).toHaveLength(MONTAGE_STAGES.length);

    // And nothing is asked after that: the film is finished, and the list has answered.
    const calls = api.calls;
    await screen.tick();
    await screen.tick();
    expect(api.calls).toBe(calls);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  // A stranger, or somebody taken out of the memory: the api answers 404 to either read, and it will
  // answer the same the next time. The journal's 404 to a stranger is the recording's own; the list's
  // is `refuse` — not words of the api.
  test.each([
    ['a stranger, refused both', 'stranger', ['journal_of_stranger'], 'both'],
    ['the list refused', 'organizer', only, 'list'],
    ['the journal refused', 'organizer', only, 'journal'],
  ] as const)(
    '%s: «Вас больше нет в этом воспоминании», the way back, and nothing dead under it',
    async (_name, as, recorded, which) => {
      const api = replay(steps, {
        only: recorded,
        extra,
        refuse: (_query, path) =>
          (which !== 'journal' && path === listPath) ||
          (which === 'journal' && path.endsWith('/journal'))
            ? 404
            : undefined,
      });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageDoneScreen />, api, as);

      // The one line every screen of a memory says it with, under a tie that is cut and not a
      // signal that is lost — and nothing of the film: no poster to press, no buttons that could
      // only be refused, no journal.
      expect(banners(screen)).toEqual([[ru.memory.gone, Unlink]]);
      expect(screen.root.findByType(AppBar).props.title).toBe(ru.montage.live.doneTitle);
      expect(screen.root.findAllByType(CardMontage)).toEqual([]);
      expect(keepAndHand(screen)).toEqual([]);
      expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
      expect(words(screen.root)).not.toContain(ru.montage.live.lost);

      // Not knocked on again, and «Назад» leads out.
      const calls = api.calls;
      for (let beat = 0; beat < 3; beat++) await screen.tick();
      expect(api.calls).toBe(calls);
      await screen.press(screen.root.findByType(BackButton));
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(api.unmatched).toEqual([]);
      await screen.unmount();
    },
  );

  test('a film cut before the journal is the poster and the two buttons, with no «Как собирался»', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: OLD };
    const screen = await mount(<MontageDoneScreen />, api);
    const text = words(screen.root);

    expect(text).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(TileNumber)).toEqual([]);
    expect(screen.root.findAllByType(RowStep)).toEqual([]);
    expect(screen.root.findByType(AppBar).props.subtitle).not.toContain('собран за');
    expect(screen.root.findByType(CardMontage).props.poster).toContain('old.jpg');
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });
});

describe.each(SCENARIOS)('%s — the strip of films on the memory', (scenario) => {
  const steps = load(scenario);
  const memory = { id: MEMORY, role: 'organizer' } as never;

  test(
    'the film being cut shows how far along it is; once it is ready the strip shows none',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(steps, {
        only: ['montage_list_while_building', 'montage_list_after_ready'],
        extra,
      });
      route.params = { id: MEMORY };
      const screen = await mount(<Films id={MEMORY} memory={memory} />, api);

      const cards = () => screen.root.findAllByType(CardMontage);
      // Newest first: the one in the queue, the one being cut, the old ready one.
      expect(cards().map((one) => one.props.state)).toEqual(['pending', 'pending', 'ready']);
      // The one being cut says «2 из 5» over two lit bars of five — one stage done, the second at work,
      // and it is the one at work that is counted — straight off the list; the one waiting has no
      // stages yet and no scale, and a finished one has none left.
      expect(cards().map((one) => one.props.step)).toEqual([
        undefined,
        { at: 2, of: 5, count: ru.montage.live.doneOf(2, 5) },
        undefined,
      ]);
      const building = cards()[1];
      await screen.press(building);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id: MEMORY, montageId: MONTAGE },
      });

      // The worker finishes; the strip reads again by itself and the scale goes.
      for (let beat = 0; beat < 4 && cards()[1].props.state === 'pending'; beat++) {
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });
        await settle();
      }
      expect(cards().map((one) => one.props.state)).toEqual(['pending', 'ready', 'ready']);
      expect(cards().map((one) => one.props.step)).toEqual([undefined, undefined, undefined]);
      expect(api.unmatched).toEqual([]);
      await screen.unmount();
    },
  );

  // The list and the journal are two answers about one making, and the card in the strip and the
  // screen it opens must name the same stage at every step of it (spec 7.6, detail 38): with all
  // five waiting, between two stages, and with a counter that has come to its end before its stage.
  // The screen reads the sitting beat by beat; at each of its states the strip is handed the list the
  // api would send at that moment — the recorded list with the five stages taken from that answer.
  test(
    'the card and the screen it opens name the same stage at every step of the making',
    BEAT_BY_BEAT,
    async () => {
      const recorded = step(steps, 'montage_list_while_building').response.body as Montage[];
      const api = replay(steps, {
        only: [...sitting(steps), 'montage_list_while_building'],
        extra,
      });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api);
      const moments: {
        stages: { stage: MontageStep['stage']; state: MontageStep['state'] }[];
        on: number | null;
      }[] = [];
      await sitThrough(screen, steps, () => {
        const { stages } = truthOf(steps, api.served).last;
        moments.push({
          stages: stages.map(({ stage, state }) => ({ stage, state })),
          on: whereOf(words(screen.root)).stage,
        });
      });
      expect(api.unmatched).toEqual([]);
      await screen.unmount();

      const distinct = new Map(moments.map((one) => [JSON.stringify(one.stages), one]));
      expect(distinct.size, 'the sitting has more than a few different moments').toBeGreaterThan(8);
      route.params = { id: MEMORY };
      for (const { stages, on } of distinct.values()) {
        const list = recorded.map((one) => (one.id === MONTAGE ? { ...one, stages } : one));
        const strip = await mount(
          <Films id={MEMORY} memory={memory} />,
          replay(steps, { only: [], extra: { ...extra, [listPath]: list } }),
        );
        const card = strip.root.findAllByType(CardMontage)[1].props.step;
        await strip.unmount();
        const asked = stages.map((one) => `${one.stage}:${one.state}`).join(' ');
        expect(card?.at ?? null, asked).toBe(on);
        if (card)
          expect(card, asked).toEqual({ at: on, of: 5, count: ru.montage.live.doneOf(on!, 5) });
      }
      // Both ends are in it: all five waiting is no stage on either, and the last is the fifth on both.
      expect([...distinct.values()].map((one) => one.on)).toEqual(
        expect.arrayContaining([null, 1, 2, 3, 4, 5]),
      );
    },
  );
});

describe.each(SCENARIOS)('%s — a montage that fell over', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  const journalReads = (api: Replay) =>
    api.served.filter((one) => one === 'journal_of_ready_montage').length;

  test.each(['organizer', 'contributor', 'viewer'] as const)(
    'its card opens the journal of the attempt that broke, for the %s',
    BEAT_BY_BEAT,
    async (role) => {
      route.params = { id: MEMORY };
      const strip = await mount(
        <Films id={MEMORY} memory={{ id: MEMORY, role } as never} />,
        replay(fellOver(steps, role), { extra }),
        role,
      );
      const card = strip.root.findAllByType(CardMontage)[1];
      expect(card.props.state).toBe('failed');
      // The stage it broke on, counted the way the screen it opens counts it, and painted apart.
      expect(card.props.step).toEqual({
        at: 2,
        of: 5,
        count: ru.montage.live.doneOf(2, 5),
        failed: true,
      });
      // The card's own «Повторить» stays where it was: the organizer's, and nobody else's.
      expect(card.findAllByType(Button).map((one) => one.props.label)).toEqual(
        role === 'organizer' ? [ru.action.retry] : [],
      );
      await strip.press(card);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id: MEMORY, montageId: MONTAGE },
      });
      await strip.unmount();

      // Opened cold, nobody having watched it break: the screen stopped at `failed`.
      const api = replay(fellOver(steps, role), {
        extra: { ...extra, '/memories': [{ ...extra['/memories'][0], role }] },
      });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api, role);
      const rows = screen.root.findAllByType(RowStep);
      const text = words(screen.root);
      expect(screen.root.findByType(AppBar).props.title).toBe(ru.montage.status.failed);
      // The two it reached, and the three it did not in one line.
      expect(rows.map((one) => one.props.state)).toEqual(['done', 'failed', 'waiting']);
      // The stage that broke is the one opened out, with its last two records.
      expect(rows.filter((one) => one.props.open)).toEqual([rows[1]]);
      expect(rows[1].findAllByType(StepNote).map((one) => one.props.text)).toEqual(
        whole.entries
          .filter((one) => one.stage === 'understanding')
          .slice(0, 2)
          .map((one) => one.thought ?? ''),
      );
      expect(text).toContain(ru.montage.live.stageOf(2, 5));
      expect(text).toContain(BROKE);
      expect(text).not.toContain(ru.montage.live.lost);
      // «Повторить монтаж» under it for the organizer, and for nobody else — in the kit's ordinary
      // bottom layer, which a screen with nothing to carry there does not draw.
      const again = screen.root
        .findAllByType(Button)
        .filter((one) => one.props.label === ru.montage.live.retry);
      expect(again).toHaveLength(role === 'organizer' ? 1 : 0);
      const layers = screen.root.findAllByType(ActionBar);
      expect(layers.map((one) => one.props.footer)).toEqual(
        role === 'organizer' ? [undefined] : [],
      );
      if (role === 'organizer') expect(layers[0].findByType(Button)).toBe(again[0]);

      // And it stays there: read once, not polled, and nothing moves anybody off it.
      await screen.tick();
      await screen.tick();
      expect(journalReads(api)).toBe(1);
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
      expect(api.unmatched).toEqual([]);
      await screen.unmount();
    },
  );
});

describe('a journal the api will not give', () => {
  // A stranger, or somebody taken out of the memory while the screen was open: the api answers 404
  // {"error":"not found"} and it will answer the same the next time. That is not a lost connection,
  // and there is nothing to keep knocking for.
  async function sitInFront() {
    const api = replay(load('director'), { only: ['journal_of_stranger'], extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    return { api, screen: await mount(<MontageLiveScreen />, api, 'stranger') };
  }
  const knocks = (api: Replay) => api.served.filter((one) => one === 'journal_of_stranger').length;

  /** The glyph each banner on the screen draws beside its words. */
  const glyphs = (screen: Screen) =>
    screen.root.findAllByType(Banner).map((one) => one.findByType(Icon).props.icon);

  test('is not said to be a lost connection', async () => {
    const { api, screen } = await sitInFront();
    expect(knocks(api)).toBe(1);
    expect(words(screen.root)).not.toContain(ru.montage.live.lost);
    expect(words(screen.root)).toContain(ru.memory.gone);
    // One banner, and not under the «no signal» glyph either: a tie that is cut.
    expect(glyphs(screen)).toEqual([Unlink]);
    expect(glyphs(screen)).not.toContain(WifiOff);
    await screen.unmount();
  });

  test('is not asked for again every second and a half', BEAT_BY_BEAT, async () => {
    const { api, screen } = await sitInFront();
    for (let beat = 0; beat < 5; beat++) await screen.tick();
    expect(knocks(api)).toBe(1);
    await screen.unmount();
  });

  test(
    'the journal of one stage says the same, and stops asking the same',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(load('director'), {
        only: ['journal_of_stranger'],
        cutFrom: 'journal_of_stranger',
        extra,
        refuse: () => 404,
      });
      route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
      const screen = await mount(<MontageLiveStageScreen />, api, 'stranger');
      for (let beat = 0; beat < 3; beat++) await screen.tick();

      expect(api.served.filter((one) => one.includes('/journal'))).toHaveLength(1);
      expect(words(screen.root)).toContain(ru.memory.gone);
      expect(words(screen.root)).not.toContain(ru.montage.live.lost);
      expect(glyphs(screen)).toEqual([Unlink]);
      await screen.unmount();
    },
  );
});

/**
 * How the journal is held when a read goes wrong — the hook itself, read off a bare component, so
 * what is looked at is what it hands a screen: the standing, what is still held, and whether it keeps
 * asking. A 404 (`refused`) is the api saying this reader is not in the memory: it says the same the
 * next time, and it is said on the page further back as on the poll. A 500 or a dropped connection
 * (`offline`) is a moment: what was read stays, and the asking goes on until it comes back.
 */
describe('a read that goes wrong in the middle of a journal', () => {
  const steps = load('director');
  let failing: number | 'offline' | undefined;
  beforeEach(() => {
    failing = undefined;
  });

  function Probe({
    montageId,
    into,
  }: {
    montageId: string;
    into: { now?: ReturnType<typeof useMontageJournal> };
  }) {
    into.now = useMontageJournal(session.token, MEMORY, montageId);
    return null;
  }
  async function watch(api: Replay, as: 'organizer' | 'viewer') {
    const into: { now?: ReturnType<typeof useMontageJournal> } = {};
    const screen = await mount(<Probe montageId={MONTAGE} into={into} />, api, as);
    return { screen, journal: () => into.now! };
  }
  const idsOf = (entries: JournalEntry[]) => entries.map((one) => one.id);

  /** A viewer half way through: the newest page held, and the rest of the journal behind it. */
  const halfWay = () =>
    replay(steps, {
      only: ['live_viewer_opens_mid_build'],
      cutFrom: 'journal_of_ready_montage',
      extra,
      refuse: (query) => (query.has('before') ? failing : undefined),
    });

  test(
    'a 404 on the page further back stops the asking, keeps what was read, and is not a lost connection',
    BEAT_BY_BEAT,
    async () => {
      const api = halfWay();
      const { screen, journal } = await watch(api, 'viewer');
      const read = idsOf(journal().entries);
      expect(journal().hasOlder).toBe(true);

      failing = 404;
      await act(async () => journal().loadOlder());
      await settle();
      expect(journal().standing).toBe('refused');
      expect(journal().offline).toBe(false);
      expect(idsOf(journal().entries)).toEqual(read);

      const asked = api.calls;
      for (let beat = 0; beat < 5; beat++) await screen.tick();
      expect(api.calls).toBe(asked);
      await screen.unmount();
    },
  );

  test(
    'a 500 on the page further back is «нет связи»: what was read stays, the asking goes on, and it comes back',
    BEAT_BY_BEAT,
    async () => {
      const api = halfWay();
      const { screen, journal } = await watch(api, 'viewer');
      const read = idsOf(journal().entries);

      failing = 500;
      await act(async () => journal().loadOlder());
      await settle();
      expect(journal().standing).toBe('offline');
      expect(journal().refused).toBe(false);
      expect(idsOf(journal().entries)).toEqual(read);

      const asked = api.calls;
      for (let beat = 0; beat < 3; beat++) await screen.tick();
      expect(api.calls - asked).toBe(3);

      failing = undefined;
      await act(async () => journal().loadOlder());
      await settle();
      expect(journal().offline).toBe(false);
      expect(Math.min(...idsOf(journal().entries))).toBeLessThan(Math.min(...read));
      await screen.unmount();
    },
  );

  test.each([500, 'offline'] as const)(
    '%s on the live poll is «нет связи»: what was read stays, the asking goes on, and it comes back',
    BEAT_BY_BEAT,
    async (kind) => {
      const names = sitting(steps);
      const api = replay(steps, { only: names, extra, refuse: () => failing });
      const { screen, journal } = await watch(api, 'organizer');
      await screen.tick();
      await screen.tick();
      const read = idsOf(journal().entries);
      expect(read.length).toBeGreaterThan(0);
      expect(journal().standing).toBe('live');

      failing = kind;
      const asked = api.calls;
      for (let beat = 0; beat < 3; beat++) await screen.tick();
      expect(api.calls - asked).toBe(3);
      expect(journal().standing).toBe('offline');
      expect(journal().refused).toBe(false);
      expect(idsOf(journal().entries)).toEqual(read);

      // The connection is back: the next beat asks after the same cursor and the journal moves on.
      failing = undefined;
      await screen.tick();
      expect(journal().standing).toBe('live');
      expect(journal().entries.length).toBeGreaterThan(read.length);
      await screen.unmount();
    },
  );
});
