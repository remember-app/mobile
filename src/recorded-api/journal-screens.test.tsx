import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: session.token, user: { id: 'me' } }) }));
// The router is what the screens are handed and not what these tests are about: focus is «now, once»,
// the route's own parameters are whatever the test names, and what a screen asks the router to do is
// kept to be read.
const { session, route, router } = vi.hoisted(() => ({
  session: { token: '' },
  route: { params: {} as Record<string, string> },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => true, setParams: vi.fn() },
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
// The player of the finished film is a window over the page and is not what these tests read.
vi.mock('@/orientation', () => ({ lockPortrait: () => {}, useTurnsWithPhone: () => {} }));
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
vi.mock('@/downloads', () => ({
  maySaveToPhone: () => false,
  saveToPhone: async () => {},
  saveAndShare: async () => {},
  shareFile: async () => {},
}));

import { Unlink, WifiOff } from 'lucide-react-native';
import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import type { JournalEntry, JournalFile, Montage, MontageJournal, MontageStage, MontageStep } from '@/api';
import MontageDoneScreen from '@/app/memory/[id]/montage/[montageId]/done';
import MontageLiveScreen from '@/app/memory/[id]/montage/[montageId]/index';
import MontageLiveStageScreen from '@/app/memory/[id]/montage/[montageId]/stage/[stage]';
import {
  ActionBar,
  AppBar,
  BadgeDecision,
  Banner,
  Button,
  CardMontage,
  CardNow,
  Chip,
  Icon,
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
import { Films } from '@/memory/films';
import { SheetLiveFile } from '@/memory/live-file';
import { marksOf, useMontageJournal, WHILE_LIVE_MS } from '@/montage-journal';
import { MONTAGE_STAGES } from '@/api';
import { ru } from '@/strings';
import { mounted, mountsTrees } from '@/test-renderer';

import { act, BEAT_BY_BEAT, drives, settle } from '@/test-drive';
import {
  bodyOf,
  liveSteps,
  load,
  MEMORY,
  MONTAGE,
  OLD,
  PEOPLE,
  QUEUED,
  replay,
  step,
  TOKEN,
  type Replay,
  type Role,
  type Scenario,
  type Step,
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
  { id: PEOPLE.organizer, name: 'Аня Петрова', username: 'anya', role: 'organizer', contribution_status: 'done', media_count: 7 },
  { id: PEOPLE.contributor, name: 'Марк', username: 'marko', role: 'contributor', contribution_status: 'done', media_count: 6 },
  { id: PEOPLE.viewer, name: null, username: 'lena', role: 'viewer', contribution_status: null, media_count: 0 },
];
const nameOf = (id: string) => ROSTER.find((one) => one.id === id)!.name ?? 'lena';
const MEMBERS = `/memories/${MEMORY}/members`;
const extra = {
  '/memories': [{ id: MEMORY, title: 'День рождения', role: 'organizer', recent_thumbnail_urls: [] }],
  [MEMBERS]: ROSTER,
};

/** Seconds after 2026-01-01T00:00:00Z: the recording's own clock, so no stage has run «for minutes». */
const NOW = Date.parse('2026-01-01T00:00:20Z');

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(router)) if (typeof mock === 'function' && 'mockClear' in mock) mock.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
drives();

/* ── driving the tree ──────────────────────────────────────────────────── */

async function mount(element: React.ReactElement, api: Replay, as: keyof typeof TOKEN = 'organizer') {
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

  test('at every beat it draws what the api last said: the frame in hand, the stage, the five rows', BEAT_BY_BEAT, async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageLiveScreen />, api);

    let beats = 0;
    while (router.replace.mock.calls.length === 0) {
      if (beats++ > sitting(steps).length + 2) throw new Error('the screen never left the making');
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
          expect(now.card.standing).toBe(held.decision === null ? ru.montage.live.thinking : ru.montage.live.decided);
          if (held.decision === null) expect(now.card.decision).toBeUndefined();
          else {
            expect(nodeProps(now.card.decision).label).toBe(marksOf(held, ru)[0]);
            expect(nodeProps(now.card.decision).kind).toBe(held.decision === 'take' ? 'take' : 'pass');
          }
          expect(now.card.gaze !== undefined).toBe(held.focus !== null);
          expect(now.card.waiting).toBeUndefined();
        } else {
          // Nothing in hand yet, and the montage is being made: not «в очереди», and no frame.
          expect(now.card.waiting).toBe(ru.montage.status.processing);
        }

        // «Этап N из 5»: the place of the stage at work in the pipeline.
        const at = atWork(truth.last.stages);
        if (at) {
          expect(now.text).toContain(ru.montage.live.stageOf(MONTAGE_STAGES.indexOf(at.stage) + 1, 5));
        }

        // Five rows, always, named and standing as the api's five stages say — one not yet reached
        // is `waiting`, which is a row the api has not written.
        expect(now.rows.map((one) => one.props.title)).toEqual(MONTAGE_STAGES.map((code) => ru.montage.stage[code]));
        MONTAGE_STAGES.forEach((code, at) => {
          const row = truth.last.stages.find((one) => one.stage === code);
          expect(now.rows[at].props.state).toBe(row ? (row.state === 'pending' ? 'waiting' : row.state) : 'waiting');
          if (row?.state === 'done' && code === 'screening') {
            expect(now.rows[at].props.meta).toContain(ru.montage.live.kept(row.outcome.kept!, row.outcome.of!));
          }
        });

        // The stage at work is the one opened out, with its last two records — freshest first.
        const open = now.rows.filter((one) => one.props.open);
        expect(open.length).toBeLessThanOrEqual(1);
        if (open.length === 1) {
          const opened = MONTAGE_STAGES[now.rows.indexOf(open[0])];
          expect(opened).toBe(at?.stage);
          const last = truth.entries.filter((one) => one.stage === opened).slice(0, 2);
          expect(now.notes.map((one) => one.props.text)).toEqual(last.map((one) => one.thought ?? ''));
        }

        // Who is watching: nobody is no pill, and somebody is everybody the api named.
        expect(now.watching?.names).toEqual(truth.last.viewers.length ? truth.last.viewers.map((one) => one.username) : undefined);
        expect(now.watching?.label).toBe(truth.last.viewers.length ? ru.montage.live.watching(truth.last.viewers.length) : undefined);
        expect(now.text).not.toContain(ru.montage.live.lost);
      }
      await screen.tick();
    }

    // The whole making was sat through, beat by beat — not a first look and out.
    // A poll is one read and then every page `has_more` promised, so it takes fewer beats than there
    // are recorded answers — by exactly the answers that were followed at once.
    const names = sitting(steps);
    const polls = names.filter((_, at) => at === 0 || !bodyOf(steps, names[at - 1]).has_more).length;
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
  });

  test('a montage still in the queue is «ждём очереди» over five rows not yet reached, not an error', async () => {
    const api = replay(steps, { only: ['journal_of_queued_montage'], extra });
    route.params = { id: MEMORY, montageId: QUEUED };
    const screen = await mount(<MontageLiveScreen />, api);
    const now = shown(screen);

    expect(now.card.waiting).toBe(ru.montage.live.inQueue);
    expect(now.rows.map((one) => one.props.state)).toEqual(Array(5).fill('waiting'));
    expect(now.notes).toEqual([]);
    expect(now.text).not.toContain(ru.montage.live.lost);
    expect(now.text).not.toContain('Этап');
    // The api named one person looking — the organizer, on the screen themselves.
    expect(now.watching?.names).toEqual(['anya']);
    expect(router.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });
});

describe.each(SCENARIOS)('%s — the journal of one stage and the card of a file', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');

  async function open(stage: string) {
    const api = replay(steps, { only: ['journal_of_ready_montage'], cutFrom: 'journal_of_ready_montage', extra });
    route.params = { id: MEMORY, montageId: MONTAGE, stage };
    return { api, screen: await mount(<MontageLiveStageScreen />, api) };
  }
  const recordsOn = (stage: string) => whole.entries.filter((one) => one.stage === stage);
  const inList = (screen: Screen) => screen.root.findAllByType(LogEntry);
  const thoughtOf = (log: ReactTestInstance) => {
    const plate = log.findAllByType(NoteThought)[0];
    return plate ? `${plate.props.text}${plate.props.unsaid ?? ''}` : `${log.props.text}${log.props.unsaid ?? ''}`;
  };

  test('«directing» is that stage’s records, freshest first, under the counts the api keeps', async () => {
    const { api, screen } = await open('directing');
    const row = whole.stages.find((one) => one.stage === 'directing')!;
    const bar = screen.root.findByType(AppBar).props;

    expect(bar.title).toBe(ru.montage.stage.directing);
    expect(bar.subtitle).toContain(ru.montage.live.stageOf(3, 5));
    // Narrowed on the server: the request said which stage, and only that stage’s records came.
    expect(api.served.some((one) => one.includes('stage=directing'))).toBe(true);

    const chips = Object.fromEntries(screen.root.findAllByType(Chip).map((one) => [one.props.label, one.props.count]));
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
    expect(drawn.map(thoughtOf)).toEqual(expected.slice(0, drawn.length).map((one) => one.thought ?? ''));
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
      expect(pillsOf(log)).toEqual([ru.montage.live.skip, ru.montage.live.reason[record.reason as 'blur']]);
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
    for (const log of logs) expect(pillsOf(log)).toEqual([ru.montage.live.skip, ru.montage.live.reason.other]);
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
      expect(sheet.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label])).toEqual([
        ['take', marksOf(record, ru)[0]],
        ['part', ru.montage.live.reason.included],
      ]);
      await act(async () => sheet.props.onCancel());
    }

    // Every other frame taken is taken with no reason pill: the organizer's word is theirs alone.
    for (const record of first.filter((one) => one.decision === 'take' && one.reason !== 'included')) {
      expect(pillsOf(inList(screen)[first.indexOf(record)])).not.toContain(ru.montage.live.reason.included);
    }
    await screen.unmount();
  });

  test('the three narrow chips cut by the decision, as the api counts them', async () => {
    const { screen } = await open('directing');
    const row = whole.stages.find((one) => one.stage === 'directing')!;
    const chip = (label: string) => screen.root.findAllByType(Chip).find((one) => one.props.label === label)!;

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
    const placed = first.filter((one) => one.decision === 'take' && files.get(one.media_id!)?.places.length);
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
    expect(sheet.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label])).toEqual([
      ['take', marksOf(target, ru)[0]],
      ...(target.reason === 'included' ? [['part', ru.montage.live.reason.included]] : []),
    ]);
    // The thought, where there is one, and where the frame went: the part of the story, and the
    // seconds of the film it plays for.
    expect(sheet.findAllByType(NoteThought).map((one) => one.props.text)).toEqual(target.thought ? [target.thought] : []);
    const [place] = file.places;
    expect(words(sheet)).toContain(`${clock(place.start_seconds)}–${clock(place.start_seconds + place.duration_seconds)}`);
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
      (one) => one.decision !== 'skip' && one.thought === null && files.get(one.media_id!)?.places.length,
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

  test('the rhythm is the fourth of five with music or without, and says under its name what it came to', async () => {
    const { screen } = await open('rhythm');
    const { track, cuts } = whole.stages.find((one) => one.stage === 'rhythm')!.outcome;
    const bar = screen.root.findByType(AppBar).props;
    expect(bar.subtitle).toContain(ru.montage.live.stageOf(4, 5));
    expect(bar.subtitle).toContain(track!.length === 0 ? ru.montage.live.noTrack : ru.montage.live.cuts(cuts!));
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

  // Ready under the journal of one stage that was read while the film was being made. The files it
  // holds were sent with their records, before the film was laid out, so they have no places; the
  // ready montage has them. What is asked of the screen: at «готов» the frames' cards know where the
  // frames went, for the price of one more read — and the screen of the making itself, which leaves
  // for the film's page and reads there, does not read again (see «Монтаж идёт» above). The narrowed
  // answers here are cut moment by moment from the recording (`moments` in `recorded.ts`), not words
  // of the api.
  test('read through the making, it learns where the frames went with one more read at «готов»', BEAT_BY_BEAT, async () => {
    const names = sitting(steps);
    const api = replay(steps, { only: [], moments: names, cutFrom: 'journal_of_ready_montage', extra });
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
    expect(shown.some((one) => placed(one.media_id) > 0), 'some of these frames are in the film').toBe(true);
    for (const [at, record] of shown.entries()) {
      if (record.media_id === null) continue;
      expect(await cardOf(inList(screen)[at]), `record ${record.id}`).toEqual(files.get(record.media_id));
    }

    // And that was the last: a ready montage is not asked about again.
    await screen.tick();
    await screen.tick();
    expect(reads() - from).toBe(2);
    await screen.unmount();
  });
});

describe.each(SCENARIOS)('%s — «Ролик готов» and «Как собирался»', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  const only = ['journal_of_ready_montage', 'journal_of_old_ready_montage', 'montage_list_after_ready'];

  test('the film’s page says how long it took, in three figures and five rows, all done', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageDoneScreen />, api);
    const outcome = (code: string) => whole.stages.find((one) => one.stage === code)!.outcome;
    const text = words(screen.root);

    expect(screen.root.findByType(AppBar).props.title).toBe(ru.montage.live.doneTitle);
    const worked = whole.stages.reduce((sum, one) => sum + Date.parse(one.finished_at!) - Date.parse(one.started_at!), 0);
    expect(screen.root.findByType(AppBar).props.subtitle).toContain(ru.montage.live.madeIn(Math.max(1, Math.ceil(worked / 60000))));
    const film = step(steps, 'montage_list_after_ready').response.body as { id: string; poster_url: string; duration_seconds: number }[];
    const ready = film.find((one) => one.id === MONTAGE)!;
    expect(screen.root.findByType(CardMontage).props.poster).toBe(ready.poster_url);
    expect(screen.root.findByType(CardMontage).props.meta).toContain(clock(ready.duration_seconds));

    expect(text).toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(TileNumber).map((one) => [one.props.figure, one.props.label])).toEqual([
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
    expect(rhythm).toContain(track!.length === 0 ? ru.montage.live.noTrack : ru.montage.live.cuts(cuts!));
    expect(rhythm).not.toContain(ru.montage.live.cuts(0));
    // The two last records of each stage that has any, freshest first — every stage is opened out.
    const drawn = rows.map((row) => row.findAllByType(StepNote).map((one) => one.props.text));
    MONTAGE_STAGES.forEach((code, at) => {
      const last = whole.entries.filter((one) => one.stage === code).slice(0, 2);
      expect(drawn[at]).toEqual(last.map((one) => one.thought ?? ''));
    });
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  test('a record about a frame opens that frame’s card', async () => {
    const api = replay(steps, { only, extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageDoneScreen />, api);
    const files = new Map(whole.files.map((one) => [one.id, one]));

    const notes = screen.root.findAllByType(StepNote);
    const pressable = notes.filter((one) => one.props.onPress);
    expect(pressable.length).toBeGreaterThan(0);
    // Only a record about a frame can be pressed — a thought about the plan has none to open.
    expect(notes.every((one) => (one.props.onPress !== undefined) === (one.props.uri !== undefined))).toBe(true);

    await screen.press(pressable[0]);
    const sheet = screen.root.findByType(SheetLiveFile);
    const entry: JournalEntry = sheet.props.entry;
    const file = files.get(entry.media_id!)!;
    expect(sheet.props.file).toEqual(file);
    expect(sheet.props.author).toBe(nameOf(file.uploaded_by));
    expect(sheet.findByType(ShotGaze).props.uri).toBe(file.thumbnail_url);
    await screen.unmount();
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
      Array<JournalEntry[]>(TIMES).fill(oldestFirst.filter((one) => one.stage === code)).flat(),
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
  async function openHundreds(refuse?: (query: URLSearchParams) => number | undefined) {
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

  test('a journal of hundreds still shows every stage’s own last two, for one small read a stage the first page left short', async () => {
    expect(hundreds.entries.slice(0, 200).every((one) => one.stage === 'directing')).toBe(true);
    const { api, reads, screen } = await openHundreds();

    const files = new Map(hundreds.files.map((one) => [one.id, one]));
    const rows = screen.root.findAllByType(RowStep);
    MONTAGE_STAGES.forEach((code, at) => {
      const own = hundreds.entries.filter((one) => one.stage === code);
      expect(
        rows[at].findAllByType(StepNote).map((one) => [one.props.text, one.props.uri]),
        code,
      ).toEqual(
        own.slice(0, 2).map((one) => [one.thought ?? '', files.get(one.media_id!)?.thumbnail_url ?? undefined]),
      );
      // How many records a stage holds is the api's count, not what this page has read of it.
      expect(rows[at].findAllByType(StepLink).map((one) => one.props.label), code).toEqual(
        own.length === 0 ? [] : [ru.montage.live.wholeStage(own.length)],
      );
    });

    // The whole journal's newest page, then one read of two for each stage it held too few of — and
    // nothing more: the film is finished and its journal does not move.
    const shortOf = [
      { stage: 'screening', limit: '2' },
      { stage: 'understanding', limit: '2' },
    ];
    expect(reads).toEqual([{}, ...shortOf]);
    await screen.tick();
    await screen.tick();
    expect(reads).toEqual([{}, ...shortOf]);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });

  test('a stage’s read that fails leaves «Как собирался» out, and the film is still there', async () => {
    const { screen } = await openHundreds((query) => (query.get('stage') === 'understanding' ? 500 : undefined));

    expect(words(screen.root)).not.toContain(ru.montage.live.howMade);
    expect(screen.root.findAllByType(RowStep)).toEqual([]);
    const film = step(steps, 'montage_list_after_ready').response.body as { id: string; poster_url: string }[];
    expect(screen.root.findByType(CardMontage).props.poster).toBe(film.find((one) => one.id === MONTAGE)!.poster_url);
    await screen.unmount();
  });

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

  test('the film being cut shows how far along it is; once it is ready the strip shows none', BEAT_BY_BEAT, async () => {
    const api = replay(steps, { only: ['montage_list_while_building', 'montage_list_after_ready'], extra });
    route.params = { id: MEMORY };
    const screen = await mount(<Films id={MEMORY} memory={memory} />, api);

    const cards = () => screen.root.findAllByType(CardMontage);
    // Newest first: the one in the queue, the one being cut, the old ready one.
    expect(cards().map((one) => one.props.state)).toEqual(['pending', 'pending', 'ready']);
    // The one being cut says «2 из 5» over two lit bars of five — one stage done, the second at work,
    // and it is the one at work that is counted — straight off the list; the one waiting has no
    // stages yet and no scale, and a finished one has none left.
    expect(cards().map((one) => one.props.step)).toEqual([undefined, { at: 2, of: 5, count: ru.montage.live.doneOf(2, 5) }, undefined]);
    const building = cards()[1];
    await screen.press(building);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/memory/[id]/montage/[montageId]', params: { id: MEMORY, montageId: MONTAGE } });

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
  });

  // The list and the journal are two answers about one making. At the moment the list was recorded,
  // the card in the strip and the screen it opens must name the same stage (spec 7.6, detail 38):
  // the screen reads the sitting beat by beat until its journal has reached what the list says.
  test('the card and the screen it opens name the same stage at the same moment', BEAT_BY_BEAT, async () => {
    const reached = (stages: readonly MontageStep[]) =>
      stages.filter((one) => one.state !== 'pending').map((one) => `${one.stage}:${one.state}`).join(' ');
    const list = step(steps, 'montage_list_while_building').response.body as Montage[];
    const moment = reached(list.find((one) => one.id === MONTAGE)!.stages!);

    route.params = { id: MEMORY };
    const strip = await mount(<Films id={MEMORY} memory={memory} />, replay(steps, { only: ['montage_list_while_building'], extra }));
    const card = strip.root.findAllByType(CardMontage)[1].props.step;
    await strip.unmount();

    const api = replay(steps, { only: [...sitting(steps), 'montage_list_while_building'], extra });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageLiveScreen />, api);
    for (let beat = 0; reached(truthOf(steps, api.served).last?.stages ?? []) !== moment; beat++) {
      if (beat > sitting(steps).length) throw new Error('the journal never reached the moment of the list');
      await screen.tick();
    }

    // One stage done and the second at work: both say the second, and neither says «1».
    expect(card).toEqual({ at: 2, of: 5, count: ru.montage.live.doneOf(2, 5) });
    expect(words(screen.root)).toContain(ru.montage.live.stageOf(card.at, 5));
    // A making on air has nothing to carry at the bottom, so there is no bottom layer to see.
    expect(screen.root.findAllByType(ActionBar)).toEqual([]);
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });
});

/** What the worker said about why it broke — the list's `error_text`. */
const BROKE = 'Режиссёр не ответил';

/**
 * NOT WORDS OF THE API — the recording has no montage that fell over, so these two answers about one
 * are cut out of recorded ones: the list taken while `understanding` was at work, with that stage
 * fallen over and the worker's line beside it, and the ready montage's own journal cut back to the
 * same moment — the two stages it reached, their records, and the files those name without a
 * layout. Any member reads both (api README, «Журнал монтажа»), so they are served to `as`.
 */
function fellOver(steps: readonly Step[], as: Role): Step[] {
  const list = step(steps, 'montage_list_while_building');
  const journal = step(steps, 'journal_of_ready_montage');
  const whole = journal.response.body as MontageJournal;
  const at = MONTAGE_STAGES.indexOf('understanding');
  const fell = <Row extends MontageStep>(row: Row, i: number) => ({
    ...row,
    state: i < at ? 'done' : i === at ? 'failed' : 'pending',
  });
  const entries = whole.entries.filter((one) => MONTAGE_STAGES.indexOf(one.stage) <= at);
  const met = new Set(entries.map((one) => one.media_id));
  const answer = (recorded: Step, body: unknown): Step => ({
    ...recorded,
    request: { ...recorded.request, as },
    response: { status: 200, body },
  });
  return [
    answer(
      list,
      (list.response.body as Montage[]).map((one) =>
        one.id === MONTAGE ? { ...one, status: 'failed', error_text: BROKE, stages: one.stages!.map(fell) } : one,
      ),
    ),
    answer(journal, {
      ...whole,
      montage: { ...whole.montage, status: 'failed' },
      stages: whole.stages.slice(0, at + 1).map(fell),
      entries,
      files: whole.files.filter((one) => met.has(one.id)).map((one) => ({ ...one, places: [] })),
    }),
  ];
}

describe.each(SCENARIOS)('%s — a montage that fell over', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  const journalReads = (api: Replay) => api.served.filter((one) => one === 'journal_of_ready_montage').length;

  test.each(['organizer', 'contributor', 'viewer'] as const)('its card opens the journal of the attempt that broke, for the %s', BEAT_BY_BEAT, async (role) => {
    route.params = { id: MEMORY };
    const strip = await mount(<Films id={MEMORY} memory={{ id: MEMORY, role } as never} />, replay(fellOver(steps, role), { extra }), role);
    const card = strip.root.findAllByType(CardMontage)[1];
    expect(card.props.state).toBe('failed');
    // The stage it broke on, counted the way the screen it opens counts it, and painted apart.
    expect(card.props.step).toEqual({ at: 2, of: 5, count: ru.montage.live.doneOf(2, 5), failed: true });
    // The card's own «Повторить» stays where it was: the organizer's, and nobody else's.
    expect(card.findAllByType(Button).map((one) => one.props.label)).toEqual(role === 'organizer' ? [ru.action.retry] : []);
    await strip.press(card);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/memory/[id]/montage/[montageId]', params: { id: MEMORY, montageId: MONTAGE } });
    await strip.unmount();

    // Opened cold, nobody having watched it break: the screen stopped at `failed`.
    const api = replay(fellOver(steps, role), { extra: { ...extra, '/memories': [{ ...extra['/memories'][0], role }] } });
    route.params = { id: MEMORY, montageId: MONTAGE };
    const screen = await mount(<MontageLiveScreen />, api, role);
    const rows = screen.root.findAllByType(RowStep);
    const text = words(screen.root);
    expect(screen.root.findByType(AppBar).props.title).toBe(ru.montage.status.failed);
    expect(rows.map((one) => one.props.state)).toEqual(['done', 'failed', 'waiting', 'waiting', 'waiting']);
    // The stage that broke is the one opened out, with its last two records.
    expect(rows.filter((one) => one.props.open)).toEqual([rows[1]]);
    expect(rows[1].findAllByType(StepNote).map((one) => one.props.text)).toEqual(
      whole.entries.filter((one) => one.stage === 'understanding').slice(0, 2).map((one) => one.thought ?? ''),
    );
    expect(text).toContain(ru.montage.live.stageOf(2, 5));
    expect(text).toContain(BROKE);
    expect(text).not.toContain(ru.montage.live.lost);
    // «Повторить монтаж» under it for the organizer, and for nobody else — in the kit's ordinary
    // bottom layer, which a screen with nothing to carry there does not draw.
    const again = screen.root.findAllByType(Button).filter((one) => one.props.label === ru.montage.live.retry);
    expect(again).toHaveLength(role === 'organizer' ? 1 : 0);
    const layers = screen.root.findAllByType(ActionBar);
    expect(layers.map((one) => one.props.footer)).toEqual(role === 'organizer' ? [undefined] : []);
    if (role === 'organizer') expect(layers[0].findByType(Button)).toBe(again[0]);

    // And it stays there: read once, not polled, and nothing moves anybody off it.
    await screen.tick();
    await screen.tick();
    expect(journalReads(api)).toBe(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(api.unmatched).toEqual([]);
    await screen.unmount();
  });
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

  test('the journal of one stage says the same, and stops asking the same', BEAT_BY_BEAT, async () => {
    const api = replay(load('director'), { only: ['journal_of_stranger'], cutFrom: 'journal_of_stranger', extra, refuse: () => 404 });
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
    const screen = await mount(<MontageLiveStageScreen />, api, 'stranger');
    for (let beat = 0; beat < 3; beat++) await screen.tick();

    expect(api.served.filter((one) => one.includes('/journal'))).toHaveLength(1);
    expect(words(screen.root)).toContain(ru.memory.gone);
    expect(words(screen.root)).not.toContain(ru.montage.live.lost);
    expect(glyphs(screen)).toEqual([Unlink]);
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

  function Probe({ montageId, into }: { montageId: string; into: { now?: ReturnType<typeof useMontageJournal> } }) {
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

  test('a 404 on the page further back stops the asking, keeps what was read, and is not a lost connection', BEAT_BY_BEAT, async () => {
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
  });

  test('a 500 on the page further back is «нет связи»: what was read stays, the asking goes on, and it comes back', BEAT_BY_BEAT, async () => {
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
  });

  test.each([500, 'offline'] as const)('%s on the live poll is «нет связи»: what was read stays, the asking goes on, and it comes back', BEAT_BY_BEAT, async (kind) => {
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
  });
});
