import { describe, expect, test, vi } from 'vitest';

// `@/montage-journal` reaches `@/api`, which asks `@/language` which language to word a failure in,
// and that one stands on two native expo modules vitest has nothing to run — the same two lines
// `api.test.ts` carries, for the same reason. `expo-router` is stood in for as well: the hook in
// that module asks it whether its screen is in front, and the mock in `vitest.setup.ts` only
// answers for `useFocusEffect`.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import type { JournalEntry, JournalQuery, MontageJournal, MontageStage } from '@/api';
import {
  currentStage,
  gazeAt,
  inHand,
  isFresh,
  lastOfStage,
  marksOf,
  minutesLeft,
  NO_JOURNAL,
  pull,
  pullOlder,
  reasonWord,
  stageNumber,
  type Journal,
} from '@/montage-journal';
import { en, ru } from '@/strings';

/**
 * The api's answers, written out by hand to the shape its README publishes («Журнал монтажа»).
 * Nothing here touches a network or the live stand: what is being checked is the reading — the
 * cursor, the chasing of `has_more`, and what a page does to what is already held.
 */

const entry = (id: number, over: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  stage: 'directing',
  media_id: null,
  thought: `мысль ${id}`,
  decision: null,
  reason: null,
  series_size: null,
  story_part: null,
  story_part_title: null,
  source_from_seconds: null,
  source_to_seconds: null,
  labels: null,
  focus: null,
  created_at: '2026-09-21T16:42:00Z',
  ...over,
});

/** A page of the journal. Records go out newest first, whichever way the cursor was going. */
const page = (
  ids: number[],
  over: Partial<MontageJournal> = {},
): MontageJournal => ({
  montage: { id: 'm', status: 'processing' },
  stages: [],
  entries: ids.map((id) => entry(id)).sort((a, b) => b.id - a.id),
  has_more: false,
  files: [],
  viewers: [],
  ...over,
});

/** A row of ids, oldest to newest — the batch an «understanding» stage writes in one go. */
const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** An api that hands back the pages it was given, one per ask, and records what it was asked. */
function serving(pages: MontageJournal[]) {
  const asked: JournalQuery[] = [];
  let at = 0;
  return {
    asked,
    ask: async (query: JournalQuery) => {
      asked.push(query);
      return pages[at++] ?? page([]);
    },
  };
}

const idsOf = (journal: Journal) => journal.entries.map((one) => one.id);

describe('pull — the first read', () => {
  test('takes the newest page, and does not chase the history behind it', async () => {
    // `has_more` on a read with no cursor is about the journal *behind* the page — older records,
    // not news. Chasing it with `after` would ask for what is already held and get nothing back.
    const api = serving([page([7, 8, 9], { has_more: true })]);
    const journal = await pull(NO_JOURNAL, api.ask);

    expect(api.asked).toEqual([{}]);
    expect(idsOf(journal)).toEqual([9, 8, 7]);
    expect(journal.cursor).toBe(9);
    expect(journal.oldest).toBe(7);
    // That `has_more` is what the stage screen's «scroll further back» is offered on.
    expect(journal.hasOlder).toBe(true);
    expect(journal.status).toBe('processing');
  });

  test('draws the line under everything that was already there', async () => {
    const api = serving([page([7, 8, 9]), page([10], { has_more: false })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    // Everything in the first answer stands finished; what lands afterwards is said out loud.
    expect(isFresh(opened, entry(9))).toBe(false);
    const later = await pull(opened, api.ask);
    expect(isFresh(later, entry(10))).toBe(true);
    expect(later.settled).toBe(9);
  });

  test('an empty journal leaves every record that ever lands counted as new', async () => {
    // A montage still in the queue answers with nothing at all — and it is not an error.
    const api = serving([page([]), page([1])]);
    const opened = await pull(NO_JOURNAL, api.ask);
    expect(opened.settled).toBe(null);
    expect(opened.entries).toEqual([]);

    const later = await pull(opened, api.ask);
    expect(isFresh(later, entry(1))).toBe(true);
    // Still no cursor to ask after, so the second read is a first read again — and must not move
    // the line it drew: the screen has been open the whole time.
    expect(api.asked).toEqual([{}, {}]);
    expect(later.settled).toBe(null);
  });
});

describe('pull — reading it live', () => {
  test('a batch bigger than one page arrives whole, in one poll and without a hole', async () => {
    // The case the api's own rule is written for: between two polls the «разбор кадров» stage
    // writes a record per file — six hundred of them — and a page holds two hundred. Taking the
    // freshest two hundred would move the cursor past the four hundred in the middle for good.
    const api = serving([
      page(run(1, 200), { has_more: true }),
      page(run(201, 400), { has_more: true }),
      page(run(401, 600), { has_more: false }),
    ]);
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 0, settled: 0 };
    const journal = await pull(opened, api.ask);

    expect(api.asked).toEqual([{ after: 0 }, { after: 200 }, { after: 400 }]);
    expect(journal.entries).toHaveLength(600);
    // Newest first, every id exactly once, nothing missing in the middle.
    expect(idsOf(journal)).toEqual(run(1, 600).reverse());
    expect(journal.cursor).toBe(600);
  });

  test('the same records arriving twice are held once', async () => {
    const api = serving([page([1, 2, 3]), page([2, 3, 4])]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pull(opened, api.ask);

    expect(idsOf(journal)).toEqual([4, 3, 2, 1]);
  });

  test('a page that moves nothing ends the poll rather than asking forever', async () => {
    // A route that answers `has_more` while handing back nothing new would otherwise be asked
    // again and again inside the one poll.
    const api = serving([page([1, 2]), page([], { has_more: true }), page([], { has_more: true })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pull(opened, api.ask);

    expect(api.asked).toHaveLength(2);
    expect(journal.cursor).toBe(2);
  });

  test('a read that breaks halfway keeps the cursor where it was', async () => {
    // All or nothing per poll: the pages that did arrive are dropped with the one that did not, so
    // the next poll asks from the same place and the hole never opens.
    const pages = [page([1, 2], { has_more: true })];
    let at = 0;
    const ask = async () => {
      const answer = pages[at++];
      if (!answer) throw new Error('offline');
      return answer;
    };
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 0, settled: 0 };

    await expect(pull(opened, ask)).rejects.toThrow('offline');
    // What the screen is holding is untouched — the hook is what puts the «связь пропала» word on
    // it, and it puts nothing else there.
    expect(opened.cursor).toBe(0);
    expect(opened.entries).toEqual([]);
  });

  test('the narrowing rides along on every page of the poll', async () => {
    const api = serving([page([5], { has_more: true }), page([6])]);
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 4, settled: 4 };
    await pull(opened, api.ask, { stage: 'directing' });

    expect(api.asked).toEqual([
      { stage: 'directing', after: 4 },
      { stage: 'directing', after: 5 },
    ]);
  });

  test('files and watchers come off the answer: the files pile up, the watchers are replaced', async () => {
    const file = {
      id: 'f1',
      kind: 'video' as const,
      uploaded_by: 'u1',
      captured_at: null,
      duration_seconds: 12.5,
      thumbnail_url: null,
      places: [
        { start_seconds: 0, duration_seconds: 2.25 },
        { start_seconds: 12.5, duration_seconds: 3 },
      ],
    };
    const api = serving([
      page([1], { files: [file], viewers: [{ id: 'u1', username: 'anya' }] }),
      page([2], {
        files: [{ ...file, id: 'f2', places: [] }],
        viewers: [{ id: 'u2', username: 'mark' }],
      }),
    ]);
    const journal = await pull(await pull(NO_JOURNAL, api.ask), api.ask);

    // A file met three hundred records ago is still the one a record points at, so files are kept;
    // who is watching is only ever true of this moment, so watchers are not.
    expect(Object.keys(journal.files).sort()).toEqual(['f1', 'f2']);
    expect(journal.files.f1.places).toHaveLength(2);
    expect(journal.viewers).toEqual([{ id: 'u2', username: 'mark' }]);
  });
});

describe('pullOlder', () => {
  test('asks from the oldest record held and keeps what came before it', async () => {
    const api = serving([page([8, 9]), page([5, 6, 7], { has_more: true })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pullOlder(opened, api.ask);

    expect(api.asked[1]).toEqual({ before: 8 });
    expect(idsOf(journal)).toEqual([9, 8, 7, 6, 5]);
    // The cursor does not follow the reader backwards — the next poll still asks for news.
    expect(journal.cursor).toBe(9);
    expect(journal.oldest).toBe(5);
    expect(journal.hasOlder).toBe(true);
  });

  test('has nothing to page back from until something has been read', async () => {
    const api = serving([]);
    expect(await pullOlder(NO_JOURNAL, api.ask)).toBe(NO_JOURNAL);
    expect(api.asked).toEqual([]);
  });
});

/* ── What a screen works out of the answer ────────────────────────────── */

const stage = (
  code: MontageStage['stage'],
  state: MontageStage['state'],
  eta: number | null = null,
): MontageStage => ({
  stage: code,
  state,
  started_at: null,
  finished_at: null,
  eta_seconds: eta,
  done_count: 0,
  total_count: null,
  outcome: {},
  updated_at: '2026-09-21T16:42:00Z',
  taken_count: 0,
  skipped_count: 0,
  thought_count: 0,
});

test('«этап 3 из 5» is a place in the pipeline and not the order the worker got to them', () => {
  expect(stageNumber('screening')).toBe(1);
  expect(stageNumber('directing')).toBe(3);
  expect(stageNumber('assembly')).toBe(5);
});

describe('currentStage', () => {
  const done = stage('screening', 'done');
  const running = stage('directing', 'running');

  test('is the one being worked on', () => {
    expect(currentStage([done, running, stage('rhythm', 'pending')])?.stage).toBe('directing');
  });

  test('is the one that fell over, when none is running', () => {
    expect(currentStage([done, stage('rhythm', 'failed')])?.stage).toBe('rhythm');
  });

  test('is the last one reached once everything is behind', () => {
    expect(currentStage([done, stage('assembly', 'done')])?.stage).toBe('assembly');
  });

  test('is nothing at all for a montage still in the queue', () => {
    expect(currentStage([])).toBe(null);
  });
});

describe('minutesLeft', () => {
  test('adds up what is still ahead and rounds the minute up', () => {
    // 90 + 130 = 220 seconds, which is «≈ 4 мин» and never «3»: an estimate that runs out while
    // somebody is still waiting is worse than one that is generous.
    const stages = [stage('screening', 'done', 30), stage('directing', 'running', 90), stage('assembly', 'pending', 130)];
    expect(minutesLeft(stages)).toBe(4);
  });

  test('never says «0 мин» while there is anything left to wait for', () => {
    expect(minutesLeft([stage('assembly', 'running', 4)])).toBe(1);
  });

  test('says nothing rather than a guess when the worker gave no estimate', () => {
    expect(minutesLeft([stage('directing', 'running'), stage('assembly', 'pending')])).toBe(null);
    expect(minutesLeft([])).toBe(null);
  });

  test('a stage that fell over is not something anybody is still waiting for', () => {
    expect(minutesLeft([stage('directing', 'failed', 500)])).toBe(null);
  });
});

describe('what is in the director’s hands', () => {
  // Newest first, the way the journal is held: a thought about the plan on top of a record about a
  // frame.
  const entries = [
    entry(4, { thought: 'План: три части' }),
    entry(3, { media_id: 'f3' }),
    entry(2, { media_id: 'f2', stage: 'rhythm' }),
    entry(1, { media_id: 'f1' }),
  ];

  test('is the freshest record that is about a frame at all', () => {
    expect(inHand(entries)?.id).toBe(3);
  });

  test('is nothing while every record so far is a thought about the plan', () => {
    expect(inHand([entry(4)])).toBe(null);
  });

  test('the two last records of a stage are that stage’s own, freshest first', () => {
    expect(lastOfStage(entries, 'directing').map((one) => one.id)).toEqual([4, 3]);
    expect(lastOfStage(entries, 'rhythm').map((one) => one.id)).toEqual([2]);
    expect(lastOfStage(entries, 'assembly')).toEqual([]);
  });
});

describe('gazeAt', () => {
  const frame = { width: 300, height: 150 };

  test('puts the middle of the 96 square where the director is looking', () => {
    // The middle of the fractions is 0.4 of 300 = 120 across, 0.5 of 150 = 75 down; the square is
    // hung by its own middle, so 48 comes off each.
    expect(gazeAt({ x: 0.3, y: 0.25, w: 0.2, h: 0.5 }, frame)).toEqual({ left: 72, top: 27 });
  });

  test('holds the square inside the frame at either edge', () => {
    expect(gazeAt({ x: 0, y: 0, w: 0.05, h: 0.05 }, frame)).toEqual({ left: 0, top: 0 });
    expect(gazeAt({ x: 0.95, y: 0.95, w: 0.05, h: 0.05 }, frame)).toEqual({ left: 204, top: 54 });
  });

  test('is nothing where the record carries no frame at all', () => {
    expect(gazeAt(null, frame)).toBe(undefined);
  });
});

describe('the record in words', () => {
  test('a decision on a piece of a video names the seconds taken', () => {
    const took = entry(1, {
      decision: 'take',
      source_from_seconds: 4,
      source_to_seconds: 7,
      story_part: 2,
    });
    expect(marksOf(took, ru)).toEqual(['Беру 0:04–0:07', 'часть 2']);
    expect(marksOf(took, en)).toEqual(['Taking 0:04–0:07', 'part 2']);
  });

  test('one out of a burst says how big the burst was', () => {
    expect(marksOf(entry(1, { decision: 'take', series_size: 4 }), ru)).toEqual(['Взял 1 из 4']);
    // A «series» of one is one frame, and saying «взял 1 из 1» about it would be noise.
    expect(marksOf(entry(1, { decision: 'take', series_size: 1 }), ru)).toEqual(['Беру']);
  });

  test('a frame passed over carries why', () => {
    expect(marksOf(entry(1, { decision: 'skip', reason: 'duplicate' }), ru)).toEqual([
      'Мимо',
      'Дубль',
    ]);
    expect(marksOf(entry(1, { decision: 'skip', reason: 'no_room' }), en)).toEqual([
      'Passing',
      'No room left',
    ]);
  });

  test('a thought with nothing settled in it wears no pill', () => {
    expect(marksOf(entry(1), ru)).toEqual([]);
  });

  /**
   * The worker's vocabulary is open — the api puts no check on that column — so the day it learns a
   * new word for «this one is no good», the app has to keep drawing the record rather than a blank
   * or a raw code.
   */
  test('a reason this app has never heard of is still said in words', () => {
    expect(reasonWord('shaky_pan', ru)).toBe(ru.montage.live.reason.other);
    expect(reasonWord('shaky_pan', en)).toBe(en.montage.live.reason.other);
    expect(reasonWord(null, ru)).toBe(undefined);
  });

  test('every reason the api names has a word in both languages', () => {
    for (const code of ['blur', 'exposure', 'unreadable', 'duplicate', 'excluded', 'no_room']) {
      expect(reasonWord(code, ru)).not.toBe(ru.montage.live.reason.other);
      expect(reasonWord(code, en)).not.toBe(en.montage.live.reason.other);
    }
  });

  test('the five stages of the journal are named in both languages', () => {
    for (const code of ['screening', 'understanding', 'directing', 'rhythm', 'assembly'] as const) {
      expect(ru.montage.stage[code]).toBeTruthy();
      expect(en.montage.stage[code]).toBeTruthy();
    }
    expect(ru.montage.live.stageOf(3, 5)).toBe('Этап 3 из 5');
    expect(ru.montage.live.leftAbout(8)).toBe('осталось ≈ 8 мин');
    expect(ru.montage.live.minutes(4)).toBe('4 мин');
  });
});
