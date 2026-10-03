import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: session.token, user: { id: 'me' } }) }));
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

import { act, drives, settle } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import type { MontageJournal, MontageStageCode } from '@/api';
import JournalStageScreen from '@/app/memory/[id]/montage/[montageId]/stage/[stage]';
import {
  Button,
  CardFrame,
  CountPair,
  PartJournal,
  PartSound,
  RowFrame,
  RowShare,
  RowStep,
  StageHead,
  StageNotice,
  StagePager,
  SummaryJournal,
  TapeCuts,
} from '@/kit';
import { formatRuntime } from '@/lib/dates';
import { ru } from '@/strings';

import {
  bodyOf,
  fellOver,
  listPath,
  liveSteps,
  load,
  MEMORY,
  MONTAGE,
  PEOPLE,
  type Replay,
  replay,
  type Scenario,
  TOKEN,
} from './recorded';

/**
 * The journal of one stage (spec 8, `Journal*`), read off the recorded answers: the real screen, the
 * real api client and the real hook, with the network answered from `responses_*.json` by request.
 *
 * What is checked is what the screen was handed and drew, read against the numbers and sentences in
 * the recording — not against a second copy of the code that made them. And the counters are checked
 * against the api's own tally rather than against the records on the page: those two differ in the
 * recording, so a screen that counted the page for itself would fail here.
 */

mountsTrees();

const SCENARIOS: Scenario[] = ['director', 'algorithm'];
/** Not part of the recording: who the memory's people are called, which the journal names by id. */
const MEMBERS = `/memories/${MEMORY}/members`;
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
];
const extra = {
  '/memories': [
    { id: MEMORY, title: 'День рождения', role: 'organizer', recent_thumbnail_urls: [] },
  ],
  [MEMBERS]: ROSTER,
  [listPath]: [{ id: MONTAGE, status: 'ready', params: { target_seconds: 15 } }],
};

/** Seconds after 2026-01-01T00:00:00Z: the recording's own clock, so no stage has run «for minutes». */
const NOW = Date.parse('2026-01-01T00:00:20Z');

beforeEach(() => {
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

async function mount(element: React.ReactElement, api: Replay) {
  session.token = TOKEN.organizer;
  vi.stubGlobal('fetch', api.fetch);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(element));
  });
  await settle();
  return tree.root;
}
type Screen = ReactTestInstance;

/** Every string the tree draws, in order. */
function words(root: Screen): string {
  const out: string[] = [];
  const walk = (node: Screen | string) => {
    if (typeof node === 'string') out.push(node);
    else node.children.forEach(walk);
  };
  walk(root);
  return out.join('\n');
}

const head = (root: Screen) => root.findAllByType(StageHead)[0]?.props;
const summary = (root: Screen) => root.findAllByType(SummaryJournal)[0]?.props;
const notice = (root: Screen) => root.findAllByType(StageNotice)[0]?.props;
const pager = (root: Screen) => root.findAllByType(StagePager)[0]?.props;
/** The recorded answer of the finished film — the one every stage of it has been reached by. */
const READY = 'journal_of_ready_montage';
const stageOf = (scenario: Scenario, code: MontageStageCode) =>
  bodyOf(load(scenario), 'journal_of_ready_montage').stages.find((one) => one.stage === code)!;

/**
 * The journal of one stage of the finished film — the state every one of the five has reached. Only
 * that answer is the api's for this run, so the screen is not walked through the whole making first
 * (which is what the screen of a film being made is for).
 */
async function readyJournal(scenario: Scenario, code: MontageStageCode): Promise<Screen> {
  route.params = { id: MEMORY, montageId: MONTAGE, stage: code };
  return mount(
    <JournalStageScreen />,
    replay(load(scenario), { only: [READY], cutFrom: READY, extra }),
  );
}

/* ── 1. One screen, common parts, a top that changes with the stage ──── */

describe.each(SCENARIOS)('the journal of one stage (%s)', (scenario) => {
  test('the head names the stage and its place among the five, on every one of them', async () => {
    for (const code of ['prep', 'analysis', 'directing', 'music', 'assembly'] as const) {
      const root = await readyJournal(scenario, code);
      expect(head(root), code).toMatchObject({
        name: ru.montage.stage[code],
        stageOf: ru.montage.live.stageOf(
          ['prep', 'analysis', 'directing', 'music', 'assembly'].indexOf(code) + 1,
          5,
        ),
      });
    }
  });

  test('the summary says what the stage came to, with the api’s own count and its own word', async () => {
    for (const code of ['prep', 'analysis', 'directing', 'music', 'assembly'] as const) {
      const row = stageOf(scenario, code);
      const root = await readyJournal(scenario, code);
      // A finished stage says what it came to, never what it is doing.
      expect(summary(root)?.what, code).toBe(ru.montage.journal.came[code]);
      // The count is the stage's own `done_count` of its own `total_count`, in its own word — not
      // the number of records on the page, which is a different number entirely. A stage with
      // nothing counted against has no line at all: «61 из ?» is not a number a person can read.
      expect(summary(root)?.count, code).toEqual(
        row.total_count === null || row.total_count === 0
          ? null
          : {
              figure: String(row.done_count),
              of: String(row.total_count),
              word: ru.montage.journal.counts[code],
              share: row.done_count / row.total_count,
            },
      );
    }
  });

  test('the two buttons at the foot lead to the stages beside this one', async () => {
    const root = await readyJournal(scenario, 'directing');
    expect(pager(root)).toMatchObject({
      before: ru.montage.stage.analysis,
      after: ru.montage.stage.music,
    });
    // The first has no stage before it, and the last has no stage after — the way back to the film
    // takes the empty one's place rather than the row standing half a button wide.
    expect(pager(await readyJournal(scenario, 'prep'))?.before).toBeUndefined();
    expect(pager(await readyJournal(scenario, 'assembly'))?.after).toBeUndefined();
    expect(pager(await readyJournal(scenario, 'assembly'))?.toFilm).toBe(ru.montage.journal.toFilm);
  });
});

/* ── 2. What each stage puts in its body ───────────────────────────────── */

describe.each(SCENARIOS)('the body of a stage (%s)', (scenario) => {
  test('preparation counts: the two halves of the order, its shape, and who brought it', async () => {
    const row = stageOf(scenario, 'prep');
    const root = await readyJournal(scenario, 'prep');
    const pairs = root.findAllByType(CountPair).map((one) => one.props);
    expect(pairs).toEqual([
      {
        label: ru.montage.journal.photos,
        done: row.outcome.photos_done,
        of: row.outcome.photos,
        share: expect.any(Number),
      },
      {
        label: ru.montage.journal.videos,
        done: row.outcome.videos_done,
        of: row.outcome.videos,
        share: expect.any(Number),
      },
    ]);
    // The order's own shape — three of the four figures are the keys the worker writes.
    expect(words(root)).toContain(String(row.outcome.photos));
    expect(words(root)).toContain(ru.montage.journal.inOrder);
    // «Кто прислал» — one row per sender the api counted, and the names are the app's, off the roster.
    const bringers = root.findAllByType(RowShare).map((one) => one.props);
    const sent = Object.entries(row.outcome.senders ?? {}).sort(([, a], [, b]) => b - a);
    expect(bringers).toHaveLength(sent.length);
    // Each row is one sender under the roster's own name and the api's own count, the bar against
    // whoever brought the most rather than against the total.
    for (const [at, one] of bringers.entries()) {
      expect(one.count, `sender ${at}`).toBe(sent[at][1]);
      expect(one.name).toBe(
        ROSTER.find((member) => member.id === sent[at][0])?.name ?? ru.memory.someone,
      );
    }
    expect(bringers[0].share).toBe(1);
  });

  test('analysis: described earlier stands quieter, and the three figures of a finished stage', async () => {
    const row = stageOf(scenario, 'analysis');
    const root = await readyJournal(scenario, 'analysis');
    const text = words(root);
    // The three tiles, in the recording's own words: how many described now, how many taken from
    // past films, how many different people turned up in all of it.
    expect(text).toContain(ru.montage.journal.ofEarlier);
    expect(text).toContain(ru.montage.journal.peopleFound);
    expect(text).toContain(String(row.outcome.people));
    expect(text).toContain(ru.montage.journal.earlierNote(row.outcome.earlier!));
    // A frame the worker took ready-made out of a past film stands at half the others, and says so.
    const frames = root.findAllByType(RowFrame);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some((one) => one.props.dim === true)).toBe(
      text.includes(ru.montage.journal.describedEarlier),
    );
  });

  test('the analysis card opens on a frame: its fields, who is in it, and the empty comments', async () => {
    const before = await readyJournal(scenario, 'analysis');
    expect(before.findAllByType(CardFrame)).toHaveLength(0);
    await act(async () => before.findAllByType(RowFrame)[0].props.onPress());
    await settle();
    // The whole of `JournalAnalysisCardOpen` — and the comments stand empty, because the product has
    // no comments yet (m-32) and the card's shape must not change with the day.
    const card = before.findAllByType(CardFrame)[0].props;
    expect(card.comments).toBe(ru.montage.journal.noCommentsYet);
    expect(card.words).toMatchObject({
      what: ru.montage.journal.whatHappens,
      who: ru.montage.journal.whoInFrame,
      comments: ru.montage.journal.comments,
    });
    // Every field the card draws is one the worker wrote, under the app's own word for it.
    expect(card.fields.length).toBeGreaterThan(0);
    for (const one of card.fields) expect(Object.values(ru.montage.journal)).toContain(one.label);
    // A field the worker did not write is not drawn: the card holds only what the recording's own
    // `details` names, and the eye and the animal are told apart by the sign on the chip.
    const said = card.fields.map((one: { value: string }) => one.value);
    expect(new Set(said).size).toBe(said.length);
    for (const one of card.marks) expect(typeof one.person).toBe('boolean');
  });

  test('directing: the parts, and «не взял» by the api’s own reasons', async () => {
    const row = stageOf(scenario, 'directing');
    const root = await readyJournal(scenario, 'directing');
    // One block per part the worker planned, in the order they play.
    const parts = root.findAllByType(PartJournal).map((one) => one.props);
    // Without a director there are no parts and none are drawn — the worker plans them, and a film
    // cut without one has no story to plan.
    const planned = row.outcome.parts ?? [];
    expect(parts.map((one) => one.title)).toEqual(planned.map((one) => one.title));
    expect(parts.map((one) => one.label)).toEqual(
      planned.map((_, i) => ru.montage.journal.partLabel(i + 1)),
    );
    // «Не взял» and its reasons are the api's tally by code, not a count of the page: the two differ
    // in the recording, so a screen counting the records for itself cannot pass this.
    const text = words(root);
    expect(text).toContain(ru.montage.journal.notTakenNote(row.skipped_count!));
    for (const [reason, count] of Object.entries(row.skipped_by_reason ?? {})) {
      expect(text, reason).toContain(`${ru.montage.live.reason[reason as 'duplicate']} ${count}`);
    }
    // The frames themselves are folded away until they are asked for: a hundred and fifty rows are
    // not what somebody came to this block to read, and the press is what brings them out.
    expect(row.skipped_count).not.toBe(0);
    const folded = root.findAllByType(RowFrame).length;
    const ask = root
      .findAllByType(Button)
      .find((one) => one.props.label === ru.montage.journal.seeAll);
    expect(ask, 'the block offers the frames it is holding').toBeDefined();
    await act(async () => ask!.props.onPress());
    await settle();
    expect(root.findAllByType(RowFrame).length).toBeGreaterThan(folded);
  });

  test('music: the tape of cuts, and the two shares of sound under each part', async () => {
    const row = stageOf(scenario, 'music');
    const assembly = stageOf(scenario, 'assembly');
    const root = await readyJournal(scenario, 'music');
    // The tape is drawn out of `cut_seconds` against the length the film came out at.
    const tape = root.findAllByType(TapeCuts)[0].props;
    expect(tape.cuts).toHaveLength(row.outcome.cut_seconds?.length ?? 0);
    expect(tape.cuts[0].share).toBeCloseTo(row.outcome.cut_seconds![0] / assembly.outcome.seconds!);
    expect(words(root)).toContain(ru.montage.journal.ticksAreCuts);
    // One block per part, and the two shares come out of the record's own `details`.
    // One block per part of the story — the director's parts, which the music stage only filled in.
    const planned =
      bodyOf(load(scenario), READY).stages.find((one) => one.stage === 'directing')!.outcome
        .parts ?? [];
    const parts = root.findAllByType(PartSound).map((one) => one.props);
    expect(parts.map((one) => one.title)).toEqual(planned.map((one) => one.title));
    for (const one of parts) {
      for (const share of one.shares ?? []) {
        expect(Object.values(ru.montage.journal)).toContain(share.label);
        expect(share.share).toBeGreaterThanOrEqual(0);
        expect(share.share).toBeLessThanOrEqual(1);
      }
    }
  });

  test('a film with no music still cuts: the head says so, and the parts carry no bars', async () => {
    const row = stageOf(scenario, 'music');
    if ((row.outcome.tracks ?? []).length > 0) return;
    const root = await readyJournal(scenario, 'music');
    const text = words(root);
    expect(text).toContain(ru.montage.journal.noMusicTitle);
    expect(text).toContain(ru.montage.journal.noMusicNote);
    expect(text).toContain(ru.montage.journal.cutsBySense);
    for (const one of root.findAllByType(PartSound).map((node) => node.props)) {
      expect(one.shares).toBeUndefined();
    }
  });

  test('assembly: the percent, the substeps and the figures of what came out', async () => {
    const row = stageOf(scenario, 'assembly');
    const root = await readyJournal(scenario, 'assembly');
    const text = words(root);
    expect(text).toContain(`${row.outcome.percent}%`);
    expect(text).toContain(formatRuntime(row.outcome.seconds ?? null));
    expect(text).toContain(ru.montage.journal.length);
    // A film that is put together says so over its own figure, and the notice and the way to watch
    // it stand under the substeps.
    expect(text).toContain(ru.montage.journal.ready);
    expect(text).toContain(ru.montage.journal.noticeSent);
    expect(
      root.findAllByType(Button).find((one) => one.props.label === ru.montage.journal.watchMovie),
    ).toBeDefined();

    // The substeps, in the order the worker walks them, each under its own word.
    const steps = root.findAllByType(RowStep).map((one) => one.props);
    expect(steps).toHaveLength(row.outcome.steps?.length ?? 0);
    expect(steps.map((one) => one.label)).toEqual(
      (row.outcome.steps ?? []).map(
        (one: { step: keyof typeof ru.montage.journal.steps }) =>
          ru.montage.journal.steps[one.step],
      ),
    );
  });
});

/* ── 3. The two ends of the pipeline ──────────────────────────────────── */

describe.each(SCENARIOS)('a stage that has not begun, and one that stopped (%s)', (scenario) => {
  test('a stage ahead of the making says so, and offers the one being worked on now', async () => {
    const steps = load(scenario);
    const polls = steps.filter((one) => one.name.startsWith('live_poll_'));
    // While `music` is still pending, its own journal says it has not begun and points at whatever
    // the worker is actually at — the block has no body behind it and nothing else is drawn.
    const building = polls.find((one) =>
      (one.response.body as MontageJournal).stages.some(
        (stage) => stage.stage === 'music' && stage.state === 'pending',
      ),
    );
    if (!building) return;
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'music' };
    // A narrowed read of a journal that is still being written is answered from the moment the api
    // had got to, so the sitting is walked by hand rather than out of the finished film.
    const root = await mount(
      <JournalStageScreen />,
      replay(steps, { moments: liveSteps(steps).map((one) => one.name), extra }),
    );
    expect(notice(root)?.title).toBe(ru.montage.journal.notStartedTitle);
    const text = words(root);
    expect(text).toContain(ru.montage.journal.notStartedTitle);
    // Nothing of the stage itself: no count, no blocks — there is nothing yet to say.
    expect(root.findAllByType(SummaryJournal)).toHaveLength(0);
    expect(root.findAllByType(RowFrame)).toHaveLength(0);
  });

  test('a stage that stopped says why in its own words, and keeps what it got through', async () => {
    const steps = fellOver(load(scenario), 'organizer');
    const fell = steps.find((one) => one.name === READY)!.response.body as MontageJournal;
    const row = fell.stages.find((one) => one.state === 'failed')!;
    route.params = { id: MEMORY, montageId: MONTAGE, stage: row.stage };

    /**
     * NOT WORDS OF THE API — the reason put into the stage the recording left without one, so the
     * dictionary is read rather than the general phrase alone.
     */
    const named = (why: 'no_material' | 'track_unreadable' | 'internal' | undefined) =>
      steps.map((one) =>
        one.name === READY
          ? {
              ...one,
              response: {
                ...one.response,
                body: {
                  ...fell,
                  stages: fell.stages.map((stage) =>
                    stage.stage === row.stage
                      ? { ...stage, outcome: { ...stage.outcome, stopped: why } }
                      : stage,
                  ),
                },
              },
            }
          : one,
      );

    for (const why of ['no_material', 'track_unreadable', 'internal'] as const) {
      const root = await mount(
        <JournalStageScreen />,
        replay(named(why), { cutFrom: READY, extra }),
      );
      expect(notice(root)).toMatchObject({
        title: ru.montage.journal.stoppedTitle,
        stopped: true,
      });
      // The reason is the app's own phrase for the code, and the code itself is never on the screen.
      const said = words(root);
      expect(said, why).toContain(ru.montage.live.stopped[why]);
      expect(said, why).not.toContain(why);
      expect(said).toContain(ru.montage.journal.stoppedNote);
    }

    // A reason the dictionary has no word for is the general phrase rather than a code shown raw —
    // which is what a stage without one on it gets.
    const bare = await mount(
      <JournalStageScreen />,
      replay(named(undefined), { cutFrom: READY, extra }),
    );
    expect(words(bare)).toContain(ru.montage.live.stopped.other);
  });
});

/* ── A fact that is not there is not drawn ─────────────────────────────── */

test('a figure the api did not send leaves its tile out rather than standing a zero', async () => {
  const steps = load('director');
  const ready = steps.find((one) => one.name === READY)!;
  const body = ready.response.body as MontageJournal;

  /**
   * NOT WORDS OF THE API — an assembly that recorded none of its own figures: no running time, no
   * percent, no count of the cuts. The block then says less rather than the same three tiles
   * standing zeroes.
   */
  const bare = steps.map((one) =>
    one.name === READY
      ? {
          ...one,
          response: {
            ...one.response,
            body: {
              ...body,
              stages: body.stages.map((stage) =>
                stage.stage === 'assembly'
                  ? {
                      ...stage,
                      done_count: 0,
                      total_count: null,
                      outcome: { percent: undefined, seconds: undefined, steps: undefined },
                    }
                  : stage,
              ),
            },
          },
        }
      : one,
  );
  route.params = { id: MEMORY, montageId: MONTAGE, stage: 'assembly' };
  const root = await mount(<JournalStageScreen />, replay(bare, { cutFrom: READY, extra }));
  const said = words(root);
  // Not one of the three, and not a zero standing where any of them would be.
  expect(said).not.toContain(ru.montage.journal.length);
  expect(said).not.toContain(ru.montage.journal.cutsDone);
  expect(said).not.toContain(ru.montage.journal.doneAlready);
  expect(said).not.toContain('0/0');
  // The head of the block is still there — the stage ran, it just has nothing to say of itself.
  expect(said).toContain(ru.montage.journal.came.assembly);
});

test('a key the api did not send leaves the block out rather than standing a zero', async () => {
  // The recording's music stage has no tempo and its order carries no bytes of its own: the screen
  // then says neither, and the preparation draws the figures it has.
  const steps = load('director');
  const music = steps.find((one) => one.name === READY)!;
  expect(
    (music.response.body as MontageJournal).stages.find((one) => one.stage === 'music')!.outcome,
  ).not.toHaveProperty('bpm');

  route.params = { id: MEMORY, montageId: MONTAGE, stage: 'music' };
  const root = await mount(
    <JournalStageScreen />,
    replay(steps, { only: [READY], cutFrom: READY, extra }),
  );
  expect(words(root)).not.toContain(ru.montage.filmScreen.bpm(0));
});

/* ── Not in the memory any more ────────────────────────────────────────── */

test('a reader the api will not answer 404 about gets the one screen that says so, and no body', async () => {
  const steps = load('director');
  route.params = { id: MEMORY, montageId: MONTAGE, stage: 'prep' };
  const root = await mount(
    <JournalStageScreen />,
    replay(steps, { only: ['journal_of_stranger'], cutFrom: READY, extra, refuse: () => 404 }),
  );
  expect(words(root)).toContain(ru.memory.gone);
  expect(root.findAllByType(SummaryJournal)).toHaveLength(0);
});
