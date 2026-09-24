import { afterEach, describe, expect, test, vi } from 'vitest';

// The same three stand-ins `montage-journal.test.ts` carries, for the same reason: the data layer
// reaches `@/api`, which asks the language, which stands on native expo modules.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import {
  ApiError,
  fetchJournal,
  listMontages,
  MONTAGE_STAGES,
  type JournalEntry,
  type JournalQuery,
  type MontageJournal,
} from '@/api';
import {
  currentStage,
  howMade,
  isFresh,
  madeInMinutes,
  marksOf,
  NO_JOURNAL,
  placeLine,
  pull,
  pullOlder,
  reasonWord,
  stageLine,
  stageStanding,
  type Journal,
} from '@/montage-journal';
import { en, ru } from '@/strings';

import {
  bodyOf,
  journalPath,
  listPath,
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
  type Role,
  type Scenario,
  type Step,
} from './recorded';

/**
 * The journal as the app reads it, over what the worker and the api really produced: the answers
 * recorded in `responses_*.json`, played back through the app's own client and its own paging. Only
 * the wire is stood in for (`replay`) — every number and every sentence below comes from the worker.
 */

afterEach(() => vi.unstubAllGlobals());

const SCENARIOS: Scenario[] = ['director', 'algorithm'];

const idsOf = (journal: Journal) => journal.entries.map((one) => one.id);
const asking = (role: Role, montageId: string = MONTAGE) => (query: JournalQuery) =>
  fetchJournal(TOKEN[role], MEMORY, montageId, query);

/** The records of these recorded answers, newest first and each once — the truth to compare to. */
const recordsOf = (steps: Step[]) => {
  const held = new Map<number, JournalEntry>();
  for (const one of steps) {
    for (const entry of (one.response.body as MontageJournal).entries) held.set(entry.id, entry);
  }
  return [...held.values()].sort((a, b) => b.id - a.id);
};

/** The screen open on the montage from the first read until the api says it is ready. */
async function sitThroughTheMaking(scenario: Scenario, shuffleFiles = false) {
  const steps = load(scenario);
  const sitting = [...liveSteps(steps), step(steps, 'journal_after_ready_nothing_new')];
  const api = replay(steps, { only: sitting.map((one) => one.name), shuffleFiles });
  vi.stubGlobal('fetch', api.fetch);

  const ask = asking('organizer');
  const polls: { held: Journal; answered: Step[] }[] = [];
  let held = NO_JOURNAL;
  while (held.status !== 'ready') {
    if (polls.length > sitting.length) throw new Error('the journal never got to ready');
    const from = api.served.length;
    held = await pull(held, ask);
    polls.push({
      held,
      answered: api.served.slice(from).map((name) => step(steps, name)),
    });
  }
  return { steps, sitting, api, polls, held };
}

describe.each(SCENARIOS)('%s — a screen open through the whole making', (scenario) => {
  test('asks exactly what was recorded, poll after poll, and keeps every record once and in order', async () => {
    const { sitting, api, polls } = await sitThroughTheMaking(scenario);

    // Every request the app made had a recorded answer — and they came in the recorded order: the
    // cursor it sent was each time the largest id of what it already held.
    expect(api.unmatched).toEqual([]);
    expect(api.served).toEqual(sitting.map((one) => one.name));

    const seen: Step[] = [];
    for (const { held, answered } of polls) {
      seen.push(...answered);
      const truth = recordsOf(seen);
      expect(idsOf(held)).toEqual(truth.map((one) => one.id));
      // Nothing lost in the middle, nothing twice: the ids are the run from the newest down to one.
      const top = truth[0]?.id ?? null;
      expect(idsOf(held)).toEqual(top === null ? [] : Array.from({ length: top }, (_, i) => top - i));
      expect(held.cursor).toBe(top);

      // A poll chases `has_more` at once and stops at the first page without it.
      const flags = answered.map((one) => (one.response.body as MontageJournal).has_more);
      expect(flags.slice(0, -1).every(Boolean) && flags.at(-1) === false).toBe(true);

      // Stages and viewers are the last answer's, whole — not what piled up over the answers.
      const last = answered.at(-1)?.response.body as MontageJournal;
      expect(held.stages).toEqual(last.stages);
      expect(held.viewers).toEqual(last.viewers);
      expect(held.status).toBe(last.montage.status);
    }
  });

  test('the state it ends on is the full reading of the ready montage', async () => {
    const { steps, held: live } = await sitThroughTheMaking(scenario);

    const api = replay(steps, { only: ['journal_of_ready_montage'] });
    vi.stubGlobal('fetch', api.fetch);
    const full = await pull(NO_JOURNAL, asking('organizer'));
    expect(api.unmatched).toEqual([]);

    expect(full.status).toBe('ready');
    expect(live.entries).toEqual(full.entries);
    expect(live.stages).toEqual(full.stages);
    expect(live.viewers).toEqual(full.viewers);
    expect([live.cursor, live.oldest, live.hasOlder]).toEqual([full.cursor, full.oldest, full.hasOlder]);
    // The same files — every frame a record is about — and the same thumbnails on them. Not their
    // places: the layout comes after the records the screen has read, and the plain poll never
    // hears of it. What brings it in is `journal-screens.test.tsx`, on the screen of one stage.
    expect(Object.keys(live.files).sort()).toEqual(Object.keys(full.files).sort());
    for (const [id, file] of Object.entries(full.files)) {
      expect({ ...live.files[id], places: null }).toEqual({ ...file, places: null });
    }
    // The five stages are the five the pipeline has, each done and each with what it came to.
    expect(full.stages.map((one) => one.stage)).toEqual([...MONTAGE_STAGES]);
    expect(full.stages.every((one) => one.state === 'done')).toBe(true);
  });

  test('the order of `files` in an answer means nothing: reshuffled, the app holds the same', async () => {
    const plain = await sitThroughTheMaking(scenario);
    const shuffled = await sitThroughTheMaking(scenario, true);
    expect(shuffled.polls.map((one) => one.held)).toEqual(plain.polls.map((one) => one.held));

    const steps = load(scenario);
    const read = async (shuffleFiles: boolean) => {
      vi.stubGlobal('fetch', replay(steps, { only: ['journal_of_ready_montage'], shuffleFiles }).fetch);
      return pull(NO_JOURNAL, asking('organizer'));
    };
    expect(await read(true)).toEqual(await read(false));
  });
});

describe.each(SCENARIOS)('%s — the worker’s words, in the app’s', (scenario) => {
  const steps = load(scenario);
  const journals = steps.filter((one) => one.response.status === 200 && one.request.path.endsWith('/journal'));
  const records = recordsOf(journals);
  const rows = journals.flatMap((one) => (one.response.body as MontageJournal).stages);
  const full = bodyOf(steps, 'journal_of_ready_montage');

  test('there are records to speak of, of every kind the screens draw', () => {
    // A guard on the recording itself: if the worker stopped writing one of these, the checks below
    // would pass over nothing.
    expect(new Set(records.map((one) => one.decision))).toEqual(new Set(['take', 'skip', null]));
    expect(new Set(records.map((one) => one.stage))).toEqual(
      new Set(['screening', 'understanding', 'directing']),
    );
    expect(new Set(rows.map((one) => one.stage))).toEqual(new Set(MONTAGE_STAGES));
  });

  test('every stage, decision and reason the worker wrote has a word — and not the catch-all one', () => {
    for (const record of records) {
      expect(MONTAGE_STAGES).toContain(record.stage);
      expect([null, 'take', 'skip']).toContain(record.decision);
    }
    for (const [lang, s] of [
      ['ru', ru],
      ['en', en],
    ] as const) {
      for (const code of MONTAGE_STAGES) expect(s.montage.stage[code], `${lang} ${code}`).toBeTruthy();

      const said = new Set<string>();
      for (const record of records) {
        const marks = marksOf(record, s);
        // A thought with nothing settled in it wears no pill; a decision always wears at least one.
        expect(marks.length > 0, `${lang} record ${record.id}`).toBe(record.decision !== null);
        for (const mark of marks) {
          expect(mark.trim()).not.toBe('');
          expect(mark).not.toMatch(/undefined|null|NaN|\[object/);
        }
        // Why it was passed over is said in the worker's own reason, and «not suitable» is only for a
        // reason the app has no word for — none of the recorded ones.
        if (record.decision === 'skip') {
          expect(record.reason, `record ${record.id} has no reason`).toBeTruthy();
          expect(marks[1], `${lang} ${record.reason}`).toBe(reasonWord(record.reason, s));
          expect(marks[1], `${lang} ${record.reason}`).not.toBe(s.montage.live.reason.other);
          said.add(`${record.reason}`);
        } else {
          // A take wears a reason only where the organizer asked for the frame (`included`) — beside
          // «Беру», in words — and never the catch-all.
          expect(marks).not.toContain(s.montage.live.reason.other);
          expect(marks.includes(s.montage.live.reason.included), `${lang} record ${record.id}`).toBe(
            record.reason === 'included',
          );
          if (record.reason === 'included') said.add(record.reason);
        }
      }
      expect(said.size).toBeGreaterThan(1);
      // The organizer's word is on both roads, and it is said.
      expect(said.has('included')).toBe(true);
    }
  });

  test('every row of every stage says something in words, and never a raw key', () => {
    for (const s of [ru, en]) {
      for (const row of rows) {
        expect(['pending', 'running', 'done', 'failed']).toContain(row.state);
        expect(['waiting', 'running', 'done', 'failed']).toContain(stageStanding(row));
        const line = stageLine(row, s, Date.parse(row.finished_at ?? row.updated_at));
        // A stage not reached (`pending`) has no line; every other one has, and it is words.
        if (row.state === 'pending') continue;
        expect(line, `${row.stage} ${row.state}`).toBeTruthy();
        expect(line).not.toMatch(/undefined|null|NaN|\[object/);
      }
    }
  });

  test('the rhythm says what it came to — the cuts to the music, or that there was none to fit to', () => {
    const rhythm = full.stages.find((one) => one.stage === 'rhythm')!;
    // One film of each: the director's was ordered with no music, the other to a track off the shelf.
    const music = scenario === 'algorithm';
    expect(rhythm.outcome.track).toHaveLength(music ? 1 : 0);
    for (const s of [ru, en]) {
      const line = stageLine(rhythm, s, Date.parse(rhythm.finished_at!));
      expect(line).toContain(music ? s.montage.live.cuts(rhythm.outcome.cuts!) : s.montage.live.noTrack);
      expect(line).not.toContain(s.montage.live.cuts(0));
    }
  });

  test('every frame laid out in the film says where, in seconds of the film, thought or no thought', () => {
    const file = (id: string | null) => full.files.find((one) => one.id === id);
    /** «1:12» — written here on its own, to the whole second, as the film's own length is. */
    const clock = (seconds: number) =>
      `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;

    const placed = full.entries.filter((one) => one.decision !== 'skip' && file(one.media_id)?.places.length);
    // Taken frames with nothing said about them are among these on both roads — the organizer's own
    // on either, and every one of them where there is no director at all.
    expect(placed.some((one) => one.decision === 'take' && one.thought === null)).toBe(true);
    for (const record of placed) {
      const [first] = file(record.media_id)!.places;
      const line = placeLine(record, file(record.media_id), ru);
      expect(line, `record ${record.id}`).toContain(
        `${clock(first.start_seconds)}–${clock(first.start_seconds + first.duration_seconds)}`,
      );
      if (record.story_part !== null) expect(line).toContain(`Часть ${record.story_part}`);
    }
    // A record that passed the frame over has no place to name, however the file is laid out — the
    // recording has one: a frame the screening passed over that the organizer then asked for.
    const passed = full.entries.filter((one) => one.decision === 'skip');
    expect(passed.some((one) => file(one.media_id)?.places.length)).toBe(true);
    for (const record of passed) expect(placeLine(record, file(record.media_id), ru)).toBeUndefined();
  });

  test('the three numbers of «Как собирался» are the worker’s own tallies', () => {
    const outcome = (code: string) => full.stages.find((one) => one.stage === code)!.outcome;
    const figures = howMade(full.stages, ru);
    expect(figures.map((one) => one.figure)).toEqual([
      outcome('screening').of,
      outcome('directing').frames,
      outcome('assembly').cuts,
    ]);
    // …and they agree with the records: what was looked at is every file, what was taken is the
    // records that say «take» in the last stage.
    expect(figures[0].figure).toBe(full.files.length);
    expect(figures[1].figure).toBe(full.entries.filter((one) => one.stage === 'directing' && one.decision === 'take').length);
    expect(currentStage(full.stages)?.stage).toBe('assembly');
    // «собран за N мин» is the stages’ own times added up, rounded up to a whole minute.
    const worked = full.stages.reduce((sum, one) => sum + Date.parse(one.finished_at!) - Date.parse(one.started_at!), 0);
    expect(madeInMinutes(full.stages)).toBe(Math.max(1, Math.ceil(worked / 60000)));
  });
});

describe.each(SCENARIOS)('%s — a montage with no journal', (scenario) => {
  test.each([
    ['cut before the journal existed', OLD, 'journal_of_old_ready_montage', 'ready'],
    ['still in the queue', QUEUED, 'journal_of_queued_montage', 'queued'],
  ] as const)('one %s is an empty journal, not an error', async (_, montageId, name, status) => {
    const steps = load(scenario);
    const api = replay(steps, { only: [name] });
    vi.stubGlobal('fetch', api.fetch);

    const held = await pull(NO_JOURNAL, asking('organizer', montageId));
    expect(api.unmatched).toEqual([]);
    expect(held).toMatchObject({ status, stages: [], entries: [], files: {}, cursor: null, offline: false });
    expect(currentStage(held.stages)).toBeNull();
    expect(howMade(held.stages, ru)).toEqual([]);
    expect(madeInMinutes(held.stages)).toBeNull();
  });

  test('a stranger is refused with the api’s own 404, and nothing is held', async () => {
    const steps = load(scenario);
    const api = replay(steps, { only: ['journal_of_stranger'] });
    vi.stubGlobal('fetch', api.fetch);

    const refused = await pull(NO_JOURNAL, asking('stranger')).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).toMatchObject({ status: 404, body: { error: 'not found' } });
    expect(api.unmatched).toEqual([]);
  });
});

describe.each(SCENARIOS)('%s — the list of montages', (scenario) => {
  const steps = load(scenario);

  test('while one is being made it carries five stages in pipeline order, the others none', async () => {
    vi.stubGlobal('fetch', replay(steps, { only: ['montage_list_while_building'] }).fetch);
    const list = await listMontages(TOKEN.organizer, MEMORY);

    expect(list.map((one) => [one.id, one.status])).toEqual([
      [QUEUED, 'queued'],
      [MONTAGE, 'processing'],
      [OLD, 'ready'],
    ]);
    const building = list.find((one) => one.id === MONTAGE)!;
    expect(building.stages?.map((one) => one.stage)).toEqual([...MONTAGE_STAGES]);
    expect(list.filter((one) => one.id !== MONTAGE).map((one) => one.stages)).toEqual([null, null]);
    expect(building.video_url).toBeNull();
    expect(list.find((one) => one.id === OLD)!.video_url).toBeTruthy();

    // The list and the journal are two routes over one making: at the moment the list was recorded
    // they name the same stage as the one at work, and the same ones as done.
    const before = bodyOf(steps, 'live_poll_4');
    const inTheJournal = MONTAGE_STAGES.map(
      (code) => before.stages.find((one) => one.stage === code)?.state ?? 'pending',
    );
    expect(building.stages!.map((one) => one.state)).toEqual(inTheJournal);
    expect(currentStage(before.stages)?.stage).toBe(building.stages!.find((one) => one.state === 'running')!.stage);
  });

  test('once it is ready none of them has stages left, and the ready one has its film', async () => {
    vi.stubGlobal('fetch', replay(steps, { only: ['montage_list_after_ready'] }).fetch);
    const list = await listMontages(TOKEN.organizer, MEMORY);

    expect(list.map((one) => [one.id, one.status])).toEqual([
      [QUEUED, 'queued'],
      [MONTAGE, 'ready'],
      [OLD, 'ready'],
    ]);
    expect(list.map((one) => one.stages)).toEqual([null, null, null]);
    expect(list.find((one) => one.id === MONTAGE)).toMatchObject({
      video_url: expect.any(String),
      duration_seconds: expect.any(Number),
    });
  });
});

describe.each(SCENARIOS)('%s — a viewer who opens it half way through', (scenario) => {
  const steps = load(scenario);
  const opening = bodyOf(steps, 'live_viewer_opens_mid_build');

  test('sees the freshest page, is told there is more behind it, and reads the rest back', async () => {
    const api = replay(steps, { only: ['live_viewer_opens_mid_build'], cutFrom: 'journal_of_ready_montage' });
    vi.stubGlobal('fetch', api.fetch);
    const ask = asking('viewer');

    const opened = await pull(NO_JOURNAL, ask);
    expect(api.served).toEqual(['live_viewer_opens_mid_build']);
    // One page, the newest — and the app does not go chasing the history as if it were news.
    expect(idsOf(opened)).toEqual(opening.entries.map((one) => one.id));
    expect(opening.has_more).toBe(true);
    expect(opened.hasOlder).toBe(true);
    expect(opened.status).toBe('processing');
    // Both watchers, the reader among them; everything already there stands finished, not typed.
    expect(opened.viewers.map((one) => one.username).sort()).toEqual(['anya', 'lena']);
    expect(opened.viewers.map((one) => one.id)).toContain(PEOPLE.viewer);
    expect(opened.entries.some((one) => isFresh(opened, one))).toBe(false);
    expect(opened.stages.some((one) => one.state === 'running')).toBe(true);

    const whole = await pullOlder(opened, ask);
    expect(api.unmatched).toEqual([]);
    const top = opened.cursor!;
    const truth = bodyOf(steps, 'journal_of_ready_montage').entries.filter((one) => one.id <= top);
    expect(whole.entries).toEqual(truth);
    expect(whole.oldest).toBe(1);
    expect(whole.hasOlder).toBe(false);
    // Reading backwards does not move what the next poll asks after, nor what the reader was shown.
    expect(whole.cursor).toBe(top);
    expect(whole.settled).toBe(top);
    // Every record about a frame has that frame with a picture, the older half included.
    for (const record of whole.entries.filter((one) => one.media_id)) {
      expect(whole.files[record.media_id!]?.thumbnail_url, `record ${record.id}`).toBeTruthy();
    }
  });
});

test('the journal path and the list path are the ones the api README names', () => {
  // The recording is what the app is being held to, so its own shape is pinned: a rename of the
  // routes on the api's side shows up here rather than as an app that asks for a route that is gone.
  expect(journalPath()).toBe(`/memories/${MEMORY}/montages/${MONTAGE}/journal`);
  expect(listPath).toBe(`/memories/${MEMORY}/montages`);
  for (const scenario of SCENARIOS) {
    const names = load(scenario).map((one) => one.name);
    for (const name of [
      'journal_of_old_ready_montage',
      'journal_of_queued_montage',
      'live_first_open_empty',
      'montage_list_while_building',
      'live_viewer_opens_mid_build',
      'journal_after_ready_nothing_new',
      'journal_of_ready_montage',
      'journal_of_one_file',
      'montage_list_after_ready',
      'journal_of_stranger',
    ]) {
      expect(names).toContain(name);
    }
    expect(names.filter((one) => one.startsWith('live_poll_')).length).toBeGreaterThan(3);
  }
});
