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
// which is what every test here wants: it is left alone until a test gives it a size.
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

import { scrolled } from '@tests/helpers/board';
import { act, BEAT_BY_BEAT, drives, settle } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Unlink, WifiOff } from 'lucide-react-native';
import { AppState, Text as RNText, StyleSheet } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import type { JournalEntry, JournalFile, Montage, MontageJournal, MontageStep } from '@/api';
import { MONTAGE_STAGES } from '@/api';
import MontageFilmScreen from '@/app/memory/[id]/montage/[montageId]/film';
import MontageLiveScreen from '@/app/memory/[id]/montage/[montageId]/index';
import {
  ActionBar,
  AppBar,
  Avatar,
  BackButton,
  Banner,
  Button,
  CardFilmNow,
  CardMontage,
  FilmBlock,
  FilmStageLine,
  GlassBar,
  Icon,
  PosterFilm,
  RowFilmStage,
  TileNumber,
  TileOrder,
  WatchingPill,
} from '@/kit';
import { formatTime } from '@/lib/dates';
import { setLanguage } from '@/lib/language';
import { marksOf, STAGE_COUNT, useMontageJournal, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { FilmPlayer } from '@/screens/memory/film-player';
import { Films } from '@/screens/memory/films';
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
 * The screens of a film on the state the recorded answers produce: the real screens, the real api
 * client and the real hook, with the network answered from `responses_*.json` by request. What is
 * checked is what a screen is handed and draws — the pieces the kit gets as props — read against the
 * numbers and sentences in the recording, not against a second copy of the code that made them.
 *
 * One screen of a movie in each of its states (spec 8): queued, being made, stopped and out of
 * contact on the way in, and the finished one on the way out. What a phone does with them (the
 * picture, the typing) is outside anything node can see and is not here.
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
const MEMBERS = `/memories/${MEMORY}/members`;
/** «Посмотрели» is a mark the finished film sends once and the recording never took. */
const watched = (montageId: string) => `${listPath}/${montageId}/watched`;
const extra = {
  '/memories': [
    { id: MEMORY, title: 'День рождения', role: 'organizer', recent_thumbnail_urls: [] },
  ],
  [MEMBERS]: ROSTER,
  [watched(MONTAGE)]: {},
  [watched(OLD)]: {},
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
const atWork = (stages: MontageJournal['stages']) =>
  stages.find((one) => one.state === 'running') ??
  stages.filter((one) => one.state !== 'pending').at(-1);

const sitting = (steps: Step[]) => [
  ...liveSteps(steps).map((one) => one.name),
  'journal_after_ready_nothing_new',
];

/** The screen of the making left open beat by beat until it leaves for the finished film, looked at on every beat. */
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

/** The state of the five a stage is drawn in: the api's own word, or «waiting» for one not reached. */
const drawnState = (state: string) => (state === 'pending' ? 'waiting' : state);

describe.each(SCENARIOS)('%s — the screen of a film being made', (scenario) => {
  const steps = load(scenario);
  const only = [...sitting(steps), 'montage_list_while_building'];

  /** What the screen shows, taken off the tree, at whatever moment it is asked. */
  const shown = (screen: Screen) => {
    const line = screen.root.findAllByType(FilmStageLine)[0]?.props;
    const card = screen.root.findAllByType(CardFilmNow)[0]?.props;
    return {
      card,
      line,
      rows: screen.root.findAllByType(RowFilmStage),
      watching: screen.root.findAllByType(WatchingPill)[0]?.props,
      text: words(screen.root),
    };
  };

  test(
    'at every beat it draws what the api last said: the stage in hand, its place, the five stages',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(steps, { only, extra });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api);

      const where: ReturnType<typeof whereOf>[] = [];
      const beats = await sitThrough(screen, steps, () => {
        const truth = truthOf(steps, api.served);
        const now = shown(screen);
        if (!truth.last) return;

        // The line under the bar names the stage in hand and says where it is in the five — and
        // names nothing at all until the worker has begun one.
        const at = atWork(truth.last.stages);
        const said = whereOf(now.text);
        expect(said.stage).toBe(at ? MONTAGE_STAGES.indexOf(at.stage) + 1 : null);
        expect(said.minutes !== null).toBe(
          at !== undefined && truth.last.stages.some((one) => one.state !== 'done'),
        );
        expect(now.line.name).toBe(
          at ? ru.montage.stage[at.stage] : ru.montage.filmScreen.queuedPill,
        );
        expect(now.line.stageOf).toBe(
          at ? ru.montage.live.stageOf(MONTAGE_STAGES.indexOf(at.stage) + 1, STAGE_COUNT) : '',
        );
        // The scale under it has lit everything up to and including the stage in hand.
        expect(now.line.done).toBe(at === undefined ? 0 : MONTAGE_STAGES.indexOf(at.stage) + 1);

        // The card «Сейчас» is the freshest record that is about a frame, in the voice of the stage
        // at work; nothing in hand yet is a card with the frame still to come, not an empty one.
        expect(now.card.who).toBe(ru.montage.live.director);
        expect(now.card.what).toBe(
          at ? ru.montage.filmScreen.at[at.stage] : ru.montage.live.inQueue,
        );
        expect(now.card.now).toBe(ru.montage.live.now);
        const held = truth.entries.find((one) => one.media_id !== null);
        if (held) {
          const file = truth.files.get(held.media_id!);
          expect(now.card.thought ?? '').toBe(held.thought ?? '');
          expect(now.card.uri).toBe(file?.thumbnail_url);
          // A frame the director has not settled on wears no pill at all; a decision wears its own.
          if (held.decision === null) expect(now.card.marks).toBeNull();
          else {
            expect(nodeProps(now.card.marks).label).toBe(marksOf(held, ru)[0]);
            expect(nodeProps(now.card.marks).kind).toBe(held.decision === 'take' ? 'take' : 'pass');
          }
          // …and it is the one press into the journal of the stage in hand.
          expect(now.card.onPress).toBeTypeOf('function');
        } else {
          expect(now.card.uri).toBeUndefined();
          expect(now.card.thought ?? '').toBe('');
        }

        // All five, always, and each standing exactly as the api says.
        expect(now.rows.map((one) => [one.props.at, one.props.title, one.props.state])).toEqual(
          MONTAGE_STAGES.map((code, at) => {
            const row = truth.last.stages.find((one) => one.stage === code)!;
            return [at + 1, ru.montage.stage[code], drawnState(row.state)];
          }),
        );
        // Each row's own line is that stage's, out of the keys of its own outcome.
        const prep = truth.last.stages.find((one) => one.stage === 'prep')!;
        if (prep.state === 'done')
          expect(now.rows[0].props.meta).toBe(
            ru.montage.live.prepCame(
              prep.total_count!,
              prep.outcome.photos!,
              prep.outcome.videos!,
              clock(prep.outcome.video_seconds ?? 0),
            ),
          );

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
      });

      // The very first look is the job opened and nothing begun: no stage named, no time promised.
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

      // Ready while it was being watched: it goes to the finished film by replacing itself — and
      // never reads the journal again.
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/memory/[id]/montage/[montageId]/film',
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
    'the bar names the film over the memory it is in, and where the making is is said in 12 / 600 and 12 / 500',
    BEAT_BY_BEAT,
    async () => {
      const api = replay(steps, { only, extra });
      route.params = { id: MEMORY, montageId: MONTAGE };
      const screen = await mount(<MontageLiveScreen />, api);
      // The bar is the film's own name over the memory's — the api names the film as «Ролик на 0:15»
      // and what it was ordered at is the finished poster's business, not this screen's.
      const ordered = step(steps, 'montage_list_while_building').response.body as Montage[];
      const bar = screen.root.findByType(AppBar).props;
      expect(bar.title).toBe(ordered.find((one) => one.id === MONTAGE)!.name);
      expect(bar.subtitle).toBe(extra['/memories'][0].title);

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
      // «Этап 3 из 5» Onest 12 / 600 and «осталось ≈ 8 мин» Onest 12 / 500 `muted`, both tabular.
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

  test('a film still in the queue is what was ordered and when it starts — and no five rows of nothing', async () => {
    const api = replay(steps, {
      only: ['journal_of_queued_montage', 'montage_list_while_building'],
      extra,
    });
    route.params = { id: MEMORY, montageId: QUEUED };
    const screen = await mount(<MontageLiveScreen />, api);
    const now = shown(screen);

    // Nothing reached: the line says the film is waiting and no stage at all — not a name, not a
    // number, and not five rows standing empty.
    expect(now.line.name).toBe(ru.montage.filmScreen.queuedPill);
    expect(now.line.stageOf).toBe('');
    expect(now.rows).toEqual([]);
    expect(now.text).not.toContain('Этап');
    // What was ordered, said in its own four tiles, and the story under them.
    expect(now.text).toContain(ru.montage.filmScreen.queuedTitle);
    expect(now.text).toContain(
      ru.montage.filmScreen.acceptedAt(
        formatTime(
          (step(steps, 'montage_list_while_building').response.body as Montage[]).find(
            (one) => one.id === QUEUED,
          )!.created_at,
        ),
      ),
    );
    // The api counts the frames once, at the order, and this film predates its columns: what was never
    // counted is not drawn as a zero, it is simply not there — only the shape and the music stand.
    expect(screen.root.findAllByType(TileOrder).map((one) => one.props.label)).toEqual([
      ru.montage.filmScreen.orientation,
      ru.montage.filmScreen.music,
    ]);
    expect(screen.root.findAllByType(FilmBlock)).toEqual([]);
    expect(screen.root.findAllByType(CardFilmNow)).toEqual([]);
    expect(api.unmatched).toEqual([]);
    expect(router.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });
});

describe.each(SCENARIOS)('%s — who is watching, on the screen of a film being made', (scenario) => {
  const steps = load(scenario);
  const people = (n: number) =>
    Array.from({ length: n }, (_, at) => ({ id: `viewer-${at}`, username: `user${at + 1}` }));
  const swap = (viewers: ReturnType<typeof people>) => (body: unknown) => ({
    ...(body as MontageJournal),
    viewers,
  });

  async function open(viewers: ReturnType<typeof people>) {
    const api = replay(steps, {
      only: ['journal_of_queued_montage'],
      extra,
      patch: { journal_of_queued_montage: swap(viewers) },
    });
    route.params = { id: MEMORY, montageId: QUEUED };
    return mount(<MontageLiveScreen />, api);
  }

  test('nobody watching is no pill at all — not a pill saying zero', async () => {
    const screen = await open([]);
    expect(screen.root.findAllByType(WatchingPill)).toEqual([]);
    await screen.unmount();
  });

  test.each(['ru', 'en'] as const)(
    'the pill is everybody the api named, in its order, counted as a figure and read out as one sentence (%s)',
    async (language) => {
      await act(async () => setLanguage(language));
      try {
        for (const many of [1, 4, 7]) {
          const viewers = people(many);
          const screen = await open(viewers);
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

describe.each(SCENARIOS)('%s — the finished film and «Как собирался»', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  const only = [
    'journal_of_ready_montage',
    'journal_of_old_ready_montage',
    'montage_list_after_ready',
  ];
  const filmRow = () =>
    (step(steps, 'montage_list_after_ready').response.body as Montage[]).find(
      (one) => one.id === MONTAGE,
    )!;
  const stageOf = (code: string) => whole.stages.find((one) => one.stage === code)!;

  test('the film first, then how it was cut: the poster, two buttons, the figures and the five rows', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageFilmScreen />, api);
    const film = filmRow();
    const text = words(screen.root);

    // The poster is the card the kit draws, and the press raises the one player this product has.
    const poster = screen.root.findByType(PosterFilm);
    expect(poster.props.poster).toBe(film.poster_url);
    expect(poster.props.meta).toContain(clock(film.duration_seconds!));
    expect(poster.props.ready).toBe(ru.montage.filmScreen.readyPill);
    expect(poster.props.onPress).toBeTypeOf('function');
    expect(screen.root.findAllByType(FilmPlayer)).toHaveLength(1);

    // Two buttons under it, and neither of them is anybody's alone — whoever brought material gets
    // the film back, a viewer included.
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([false, false]);
    expect(text).not.toContain('организатор');

    // «Как собирался» over the whole of it: how many stages and their minutes together, then the
    // three figures the journal carries — every frame looked at, every frame taken in, and every
    // piece glued. The last is the assembly stage's own `total_count`: the api counts the cuts there
    // and writes no `cuts` key into its outcome (`docs/journal.md`, «assembly»).
    expect(text).toContain(ru.montage.live.howMade);
    expect(text).toContain(ru.montage.filmScreen.howMadeTook(MONTAGE_STAGES.length, 1));
    expect(
      screen.root.findAllByType(TileNumber).map((one) => [one.props.figure, one.props.label]),
    ).toEqual([
      [String(stageOf('prep').total_count), ru.montage.live.watched],
      [String(stageOf('directing').taken_count), ru.montage.live.tookIn],
      [
        String(stageOf('assembly').total_count),
        ru.montage.live.glued(stageOf('assembly').total_count!),
      ],
    ]);

    // All five stages, closed, each saying what it came to out of the keys of its own outcome.
    const rows = screen.root.findAllByType(RowFilmStage);
    expect(rows.map((one) => [one.props.at, one.props.title, one.props.state])).toEqual(
      MONTAGE_STAGES.map((code, at) => [at + 1, ru.montage.stage[code], 'done']),
    );
    expect(rows[0].props.meta).toBe(
      ru.montage.live.prepCame(
        stageOf('prep').total_count!,
        stageOf('prep').outcome.photos!,
        stageOf('prep').outcome.videos!,
        clock(stageOf('prep').outcome.video_seconds ?? 0),
      ),
    );
    // Five stages with or without music; the music of a film with none says there was nothing to fit
    // to rather than «0 склеек», and one with music counts the cuts that moved to it.
    const music = rows[MONTAGE_STAGES.indexOf('music')].props.meta as string;
    expect(music).toBe(
      stageOf('music').outcome.tracks!.length === 0
        ? ru.montage.live.noTrack
        : ru.montage.live.musicCame(
            stageOf('music').outcome.tracks![0],
            stageOf('music').outcome.bpm ?? null,
            stageOf('music').total_count,
          ),
    );
    expect(music).not.toContain(ru.montage.live.cuts(0));
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  test('every stage is still a press into its own journal, and the bar carries the film’s own name', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageFilmScreen />, api);

    const rows = screen.root.findAllByType(RowFilmStage);
    for (const [at, row] of rows.entries()) {
      await screen.press(row);
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
        params: { id: MEMORY, montageId: MONTAGE, stage: MONTAGE_STAGES[at] },
      });
    }
    expect(router.push).toHaveBeenCalledTimes(MONTAGE_STAGES.length);
    expect(screen.root.findByType(GlassBar).props.title).toBe(filmRow().name);
    await screen.unmount();
  });

  /** «Скачать» and «Поделиться» under the poster, as they are drawn. */
  const keepAndHand = (screen: Screen) =>
    screen.root
      .findAllByType(Button)
      .filter((one) => [ru.action.download, ru.action.share].includes(one.props.label));

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

  /** The finished film over `hundreds`, and every read of the journal it sent, limit and all. */
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
    return { api, reads, screen: await mount(<MontageFilmScreen />, api) };
  }

  test('a journal of hundreds is one read, and every stage still says what it came to', async () => {
    // Its newest page is the last stage that wrote records at all: the recording's journal was laid out
    // stage by stage and turned over, so the ids at the top are the ones written last.
    const lastWithRecords = [...MONTAGE_STAGES]
      .reverse()
      .find((code) => oldestFirst.some((one) => one.stage === code))!;
    expect(hundreds.entries[0].stage).toBe(lastWithRecords);
    const { api, reads, screen } = await openHundreds();

    // What each row says is the stage's own outcome from the api, whatever page of it was held.
    const rows = screen.root.findAllByType(RowFilmStage);
    expect(rows.map((one) => one.props.state)).toEqual(Array(MONTAGE_STAGES.length).fill('done'));
    const prep = hundreds.stages.find((one) => one.stage === 'prep')!;
    expect(rows[0].props.meta).toBe(
      ru.montage.live.prepCame(
        prep.total_count!,
        prep.outcome.photos!,
        prep.outcome.videos!,
        clock(prep.outcome.video_seconds ?? 0),
      ),
    );

    // The whole journal's newest page and nothing more: the film is finished, so its journal does not
    // move, and no stage is read for the records of its own.
    expect(reads).toEqual([{}]);
    await screen.tick();
    await screen.tick();
    expect(reads).toEqual([{}]);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  const poster = filmRow().poster_url;

  test('a journal that does not come back is the connection banner over the film, and «Как собирался» comes back with it', async () => {
    let failing: number | undefined = 500;
    const { screen } = await openHundreds((_, path) =>
      path.endsWith('/journal') ? failing : undefined,
    );

    // The film itself is there, and works — only the journal is lost.
    expect(banners(screen)).toEqual([[ru.montage.live.lost, WifiOff]]);
    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowFilmStage)).toEqual([]);
    expect(screen.root.findByType(PosterFilm).props.poster).toBe(poster);
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([false, false]);

    failing = undefined;
    await screen.tick();
    expect(banners(screen)).toEqual([]);
    expect(words(screen.root)).toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowFilmStage)).toHaveLength(MONTAGE_STAGES.length);
    await screen.unmount();
  });

  test('without a connection the page says so over whatever it has, keeps asking, and is whole again once it answers', async () => {
    let failing: 'offline' | undefined = 'offline';
    const api = replay(steps, { only, extra, refuse: () => failing });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageFilmScreen />, api);
    const knocks = (where: string) =>
      api.served.filter((one) => one.endsWith(`${where} (refused)`)).length;

    // Nothing read at all: one banner, the connection's own glyph and words, first in the page and
    // in its scroll — within reach on any phone at any type size. Under it the poster without a film
    // and the two buttons, which have nothing to keep or hand on yet.
    expect(banners(screen)).toEqual([[ru.montage.live.lost, WifiOff]]);
    expect(scrolled(screen.root.findByType(Banner))).toBe(true);
    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findByType(PosterFilm).props.poster).toBeUndefined();
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([true, true]);

    // «ждём» is not a figure of speech: both reads are asked again on every beat.
    const before = [knocks('/journal'), knocks(listPath)];
    await screen.tick();
    await screen.tick();
    expect([knocks('/journal'), knocks(listPath)]).toEqual(before.map((n) => n + 2));

    // Back: the banner goes by itself, and the whole page is there.
    failing = undefined;
    await screen.tick();
    expect(banners(screen)).toEqual([]);
    expect(screen.root.findByType(PosterFilm).props.poster).toBe(poster);
    expect(screen.root.findByType(PosterFilm).props.onPress).toBeTypeOf('function');
    expect(keepAndHand(screen).map((one) => one.props.disabled)).toEqual([false, false]);
    expect(words(screen.root)).toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowFilmStage)).toHaveLength(MONTAGE_STAGES.length);

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
      const screen = await mount(<MontageFilmScreen />, api, as);

      // Nothing of the film: no poster to press, no buttons that could only be refused, no journal.
      expect(banners(screen)).toEqual([[ru.memory.gone, Unlink]]);
      expect(screen.root.findAllByType(PosterFilm)).toEqual([]);
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
    const screen = await mount(<MontageFilmScreen />, api);

    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(TileNumber)).toEqual([]);
    expect(screen.root.findAllByType(RowFilmStage)).toEqual([]);
    expect(screen.root.findByType(PosterFilm).props.poster).toContain('old.jpg');
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
      // The one being cut says «2 из 5» over two lit bars of five — one stage done, the second at
      // work, and it is the one at work that is counted — straight off the list; the one waiting has
      // no stages yet and no scale, and a finished one has none left.
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
      const rows = screen.root.findAllByType(RowFilmStage);
      const text = words(screen.root);

      // Nobody is at work: no «Сейчас» card, no live dot, and the stage that broke says why in the
      // words of the app rather than in the worker's own prose.
      expect(screen.root.findAllByType(CardFilmNow)).toEqual([]);
      expect(rows.map((one) => [one.props.at, one.props.state])).toEqual([
        [1, 'done'],
        [2, 'failed'],
        [3, 'waiting'],
        [4, 'waiting'],
        [5, 'waiting'],
      ]);
      expect(rows[1].props.meta).toBe(
        ru.montage.filmScreen.stoppedBecause(ru.montage.live.stopped.other),
      );
      expect(text).toContain(ru.montage.filmScreen.stoppedTitle);
      expect(text).toContain(ru.montage.filmScreen.stoppedOn(ru.montage.stage.analysis));
      expect(text).toContain(BROKE);
      expect(text).not.toContain(ru.montage.live.lost);
      // Nobody is waiting for a time and nothing is at work: the line carries the stopped pill and
      // no «Этап N из 5» — the stage in hand is the one that fell, and the rows below say which.
      const line = screen.root.findByType(FilmStageLine).props;
      expect(line.right).toBe(ru.montage.filmScreen.stoppedPill);
      // The line names the stage it stopped on — it is the one place that says «где». A screen that
      // left the name out here would stand «ждёт» beside «остановился».
      expect(line.name).toBe(ru.montage.stage.analysis);
      expect(line.stageOf).toBe(ru.montage.live.stageOf(2, 5));
      expect(line.stopped).toBe(true);
      // …and no time is left to wait for: the stages behind it still carry the worker's guesses.
      expect(line.right).not.toContain(ru.montage.live.leftAbout(1).slice(-4));
      expect(text).not.toContain(ru.montage.live.leftAbout(1));
      // A member is told who can start it again; the organizer is met by the one button, which stands
      // in the block under the paragraph rather than pinned to the foot of the screen.
      expect(text.includes(ru.montage.filmScreen.retry)).toBe(role === 'organizer');
      expect(text.includes(ru.montage.filmScreen.organizerCan)).toBe(role !== 'organizer');
      expect(
        screen.root
          .findAllByType(Button)
          .map((one) => one.props.label)
          .filter((label) => label === ru.montage.filmScreen.retry),
      ).toHaveLength(role === 'organizer' ? 1 : 0);

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

      // The connection is back: the next beats ask after the same cursor and the journal moves on.
      failing = undefined;
      for (let beat = 0; beat < 3 && journal().entries.length === read.length; beat++)
        await screen.tick();
      expect(journal().standing).toBe('live');
      expect(journal().entries.length).toBeGreaterThan(read.length);
      await screen.unmount();
    },
  );
});
