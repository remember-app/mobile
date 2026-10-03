import { describe, expect, test, vi } from 'vitest';

// The same three stand-ins `journal-data.test.ts` carries, for the same reason: this layer reaches
// `@/api`, which asks the language, which stands on native expo modules.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import type { JournalEntry, MontageStage } from '@/api';
import {
  assemblyProgress,
  assemblySteps,
  assemblyTiles,
  codeOf,
  counted,
  cuts,
  describedFields,
  filmLength,
  framed,
  frameLine,
  inHand,
  minutesLeft,
  partLine,
  parts,
  passes,
  peopleCount,
  prepared,
  STAGE_COUNT,
  seen,
  senders,
  shares,
  stageNumber,
  standing,
  timeWord,
  weighed,
} from '@/lib/montage/journal';
import { en, ru } from '@/strings';

/**
 * What the journal of one stage works out of an answer, off answers written out by hand to the shape
 * the api publishes. Nothing here touches a network or the live stand — these are the sums and the
 * readings, and what matters about them is that a key the api did not send leaves the figure out
 * rather than standing a zero in its place.
 */

const stage = (over: Partial<MontageStage> = {}): MontageStage => ({
  stage: 'prep',
  state: 'done',
  started_at: '2026-09-21T16:40:00Z',
  finished_at: '2026-09-21T16:44:00Z',
  eta_seconds: null,
  done_count: 0,
  total_count: null,
  outcome: {},
  updated_at: '2026-09-21T16:44:00Z',
  taken_count: 0,
  skipped_count: 0,
  thought_count: 0,
  ...over,
});

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 1,
  stage: 'analysis',
  media_id: 'f1',
  thought: null,
  decision: null,
  reason: null,
  series_size: null,
  story_part: null,
  story_part_title: null,
  source_from_seconds: null,
  source_to_seconds: null,
  labels: null,
  focus: null,
  details: null,
  created_at: '2026-09-21T16:42:00Z',
  ...over,
});

const NOW = Date.parse('2026-09-21T16:49:00Z');

/* ── where the stage stands ───────────────────────────────────────────── */

describe('which of the four states a stage is drawn in', () => {
  test('its own row decides, and a stage nobody has reached is one that waits', () => {
    expect(standing(stage({ state: 'done' }))).toBe('done');
    expect(standing(stage({ state: 'running' }))).toBe('running');
    expect(standing(stage({ state: 'failed' }))).toBe('failed');
    expect(standing(stage({ state: 'pending' }))).toBe('waiting');
    // No row at all — a film the worker has not opened — is the same as one still to come.
    expect(standing(undefined)).toBe('waiting');
  });

  test('the time on the right is the estimate while it runs and the time it took once it is behind', () => {
    const left = minutesLeft([stage({ state: 'running', eta_seconds: 300, finished_at: null })]);
    expect(left).toBe(5);
    expect(
      timeWord(stage({ state: 'running', eta_seconds: 300, finished_at: null }), ru, left, NOW),
    ).toBe('≈ 5 мин осталось');
    // Whole minutes and nothing under one: a stage that started five seconds ago has no time to say.
    expect(
      timeWord(
        stage({ state: 'running', eta_seconds: null, started_at: null, finished_at: null }),
        ru,
        null,
        NOW,
      ),
    ).toBeUndefined();
    expect(timeWord(stage({ state: 'done' }), ru, null, NOW)).toBe('4 мин');
    // A stage nobody came to, and one that stopped, say no time: there is none of either to say.
    expect(timeWord(stage({ state: 'pending' }), ru, null, NOW)).toBeUndefined();
    expect(timeWord(stage({ state: 'failed' }), ru, null, NOW)).toBeUndefined();
    expect(timeWord(undefined, ru, null, NOW)).toBeUndefined();
  });
});

/* ── the count under the head ─────────────────────────────────────────── */

describe('what a stage counts', () => {
  test('its own figure of its own total, in the word of what that stage does', () => {
    expect(counted(stage({ stage: 'analysis', done_count: 64, total_count: 120 }), ru)).toEqual({
      figure: '64',
      of: '120',
      word: 'описано',
      share: 64 / 120,
    });
    expect(counted(stage({ stage: 'assembly', done_count: 92, total_count: 138 }), en)?.word).toBe(
      'cuts',
    );
  });

  test('nothing counted against means no line at all, and never «61 из 0»', () => {
    expect(counted(stage({ total_count: null }), ru)).toBeNull();
    expect(counted(stage({ done_count: 0, total_count: 0 }), ru)).toBeNull();
    expect(counted(undefined, ru)).toBeNull();
  });
});

/* ── preparation ──────────────────────────────────────────────────────── */

describe('the counters of the preparation', () => {
  const prep = stage({
    stage: 'prep',
    outcome: {
      photos: 168,
      photos_done: 98,
      videos: 46,
      videos_done: 22,
      video_seconds: 1420,
      bytes: 3328599654,
      senders: { a: 82, b: 61, c: 47 },
    },
  });

  test('each half of the order is counted out of the order’s own total', () => {
    expect(prepared(prep, 'photos')).toEqual({
      label: 'photos',
      done: 98,
      of: 168,
      share: 98 / 168,
    });
    expect(prepared(prep, 'videos')).toEqual({ label: 'videos', done: 22, of: 46, share: 22 / 46 });
    // A counter whose total is not there has nothing to be a share of.
    expect(prepared(stage({ outcome: { photos: 10 } }), 'photos')).toBeNull();
    expect(prepared(stage(), 'videos')).toBeNull();
  });

  test('the weight is said in the unit it falls in, and not at all where there is none', () => {
    expect(weighed(3328599654)).toEqual({ figure: '3.10', unit: 'gb' });
    expect(weighed(3 * 1024 * 1024)).toEqual({ figure: '3.00', unit: 'mb' });
    expect(weighed(512 * 1024)).toEqual({ figure: '0.50', unit: 'mb' });
    expect(weighed(undefined)).toBeNull();
    expect(weighed(0)).toBeNull();
  });

  test('the bringers stand against whoever brought the most, not against the whole order', () => {
    expect(senders(prep)).toEqual([
      { id: 'a', count: 82, share: 1 },
      { id: 'b', count: 61, share: 61 / 82 },
      { id: 'c', count: 47, share: 47 / 82 },
    ]);
    expect(senders(stage())).toEqual([]);
    // Somebody who brought nothing is not a row.
    expect(senders(stage({ outcome: { senders: { a: 0, b: 3 } } }))).toEqual([
      { id: 'b', count: 3, share: 1 },
    ]);
  });
});

/* ── directing ────────────────────────────────────────────────────────── */

describe('the parts of the story', () => {
  const directing = stage({
    stage: 'directing',
    outcome: {
      parts: [
        { title: 'Сборы', from_seconds: 0, to_seconds: 24 },
        { title: 'Церемония', from_seconds: 24, to_seconds: 58 },
      ],
    },
    taken_by_part: { '1': 14, '2': 9 },
  });

  test('each part carries its own seconds and the api’s own count of what went into it', () => {
    const plan = parts(directing);
    expect(plan).toEqual([
      { at: 1, title: 'Сборы', from: '0:00', to: '0:24', taken: 14, empty: false },
      { at: 2, title: 'Церемония', from: '0:24', to: '0:58', taken: 9, empty: false },
    ]);
    expect(partLine(plan[0], ru)).toBe('14 кадров · 0:00–0:24');
    expect(partLine(plan[0], en)).toBe('14 frames · 0:00–0:24');
  });

  test('a part the worker has planned but not filled is not a zero', () => {
    const plan = parts(stage({ stage: 'directing', outcome: { parts: directing.outcome.parts! } }));
    expect(plan.every((one) => one.empty && one.taken === null)).toBe(true);
    expect(partLine(plan[0], ru)).toBe('ещё не собрана');
    // A film cut without the director has no parts and the key is not there at all.
    expect(parts(stage({ stage: 'directing' }))).toEqual([]);
  });

  test('«не взял» and its reasons are the api’s tally, and a code it has no word for is never shown raw', () => {
    const skipped = passes(
      stage({
        stage: 'directing',
        skipped_count: 153,
        skipped_by_reason: { duplicate: 98, left_out: 55 },
      }),
      ru,
    );
    expect(skipped).toEqual({
      total: 153,
      reasons: [
        { reason: 'duplicate', label: ru.montage.live.reason.duplicate, count: 98 },
        { reason: 'left_out', label: ru.montage.live.reason.left_out, count: 55 },
      ],
    });
    // A «мимо» carrying no reason is in neither, and the screen says nothing about one.
    expect(passes(stage({ stage: 'directing', skipped_count: 2 }), ru)).toEqual({
      total: 2,
      reasons: [],
    });
    expect(passes(stage({ stage: 'directing', skipped_count: 0 }), ru)).toBeNull();
    expect(passes(undefined, ru)).toBeNull();
  });
});

/* ── music ────────────────────────────────────────────────────────────── */

describe('the music', () => {
  test('the tape of cuts stands against the length of the film, and not against nothing', () => {
    const music = stage({ stage: 'music', outcome: { cut_seconds: [2.5, 6, 8] } });
    expect(cuts(music, 15)).toEqual([
      { at: 2.5, share: 2.5 / 15 },
      { at: 6, share: 6 / 15 },
      { at: 8, share: 8 / 15 },
    ]);
    // A tick at a fraction of nothing is not a tick.
    expect(cuts(music, null)).toBeNull();
    expect(cuts(music, 0)).toBeNull();
    expect(cuts(stage({ stage: 'music' }), 15)).toBeNull();
    // A cut past the end of the film is not drawn off the tape.
    expect(cuts(stage({ stage: 'music', outcome: { cut_seconds: [20] } }), 15)).toEqual([]);
  });

  test('the length is what came out, and the length that was asked for before it', () => {
    const assembly = stage({ stage: 'assembly', outcome: { seconds: 15 } });
    expect(filmLength(assembly, 30)).toBe(15);
    expect(filmLength(undefined, 30)).toBe(30);
    expect(filmLength(undefined, undefined)).toBeNull();
  });

  test('the two shares of a part never add up to one and never leave the unit', () => {
    expect(shares(entry({ details: { music: 0.8, live: 0.9 } }))).toEqual({
      music: 0.8,
      live: 0.9,
    });
    expect(shares(entry({ details: { music: 1.4, live: -0.2 } }))).toEqual({
      music: 1,
      live: 0,
    });
    expect(shares(entry({ details: { music: 0 } }))).toEqual({ music: 0, live: null });
    // A part the worker said nothing about has no bars rather than two empty ones.
    expect(shares(entry())).toBeNull();
    expect(shares(entry({ details: {} }))).toBeNull();
    expect(shares(undefined)).toBeNull();
  });
});

/* ── assembly ─────────────────────────────────────────────────────────── */

describe('the assembly', () => {
  const assembly = stage({
    stage: 'assembly',
    done_count: 92,
    total_count: 138,
    outcome: {
      percent: 66,
      seconds: 150,
      frames: 61,
      steps: [
        { step: 'clips', state: 'done' },
        { step: 'sound', state: 'running' },
        { step: 'cover', state: 'pending' },
        { step: 'file', state: 'pending' },
      ],
    },
  });

  test('the percent and the substep under it are the worker’s own', () => {
    expect(assemblyProgress(assembly, ru)).toEqual({ percent: 66, step: 'Звук сведён по частям' });
    expect(assemblyProgress(stage({ stage: 'assembly' }), ru)).toBeNull();
    // A percent off the scale is the worker's own to fix, and the screen holds it to the scale.
    expect(
      assemblyProgress(stage({ stage: 'assembly', outcome: { percent: 140 } }), ru)?.percent,
    ).toBe(100);
  });

  test('the substeps stand in the order the worker walks them', () => {
    expect(assemblySteps(assembly, ru)).toEqual([
      { step: 'clips', label: 'Склеиваем куски', state: 'done' },
      { step: 'sound', label: 'Звук сведён по частям', state: 'running' },
      { step: 'cover', label: 'Обложка выбрана', state: 'pending' },
      { step: 'file', label: 'Финальный файл ролика', state: 'pending' },
    ]);
    expect(assemblySteps(stage({ stage: 'assembly' }), ru)).toEqual([]);
  });

  test('the three figures come out of the outcome, and a key that is not there leaves its tile out', () => {
    expect(assemblyTiles(assembly, ru)).toEqual([
      { figure: '2:30', label: 'длина' },
      { figure: '61', label: 'кадр' },
      { figure: '92/138', label: 'склеек' },
    ]);
    expect(assemblyTiles(stage({ stage: 'assembly', total_count: null }), ru)).toEqual([]);
  });
});

/* ── analysis ─────────────────────────────────────────────────────────── */

describe('one frame of the analysis', () => {
  const file = {
    id: 'f1',
    kind: 'photo' as const,
    uploaded_by: 'u1',
    file_name: 'IMG_2041.JPG',
    captured_at: null,
    duration_seconds: null,
    thumbnail_url: null,
    places: [],
  };

  test('the line under it is the name, the shot, the mood and whether it was described earlier', () => {
    const said = entry({ details: { shot: 'Общий', mood: 'Весело', earlier: true } });
    expect(frameLine(said, file, ru)).toEqual(['IMG_2041.JPG', 'Общий', 'Весело', 'описан ранее']);
    expect(frameLine(entry({ details: {} }), file, ru)).toEqual(['IMG_2041.JPG']);
    // A file that is gone from the memory takes its name with it, and the line is not a row of dashes.
    expect(frameLine(entry(), undefined, ru)).toEqual([]);
  });

  test('the card draws the fields in its own order, under the app’s own words', () => {
    const described = entry({
      details: {
        place: 'Гостиная',
        light: 'Вечер',
        mood: 'Весело',
        shot: 'Общий',
        camera: 'обходит',
        speech: 'почти нет',
        people: 2,
        moments: [{ seconds: 7, text: 'поднимают' }],
        text: 'долго',
        earlier: true,
      },
    });
    expect(describedFields(described, ru)).toEqual([
      { label: 'Место', value: 'Гостиная' },
      { label: 'Время и свет', value: 'Вечер' },
      { label: 'Настроение', value: 'Весело' },
      { label: 'План', value: 'Общий' },
      { label: 'Камера', value: 'обходит' },
      { label: 'Речь', value: 'почти нет' },
    ]);
    // The keys that are not fields of the card — the count, the moments, the long text, the mark of
    // a past film — have their own blocks and are not fields here.
    expect(
      describedFields(entry({ details: { people: 1, text: 'x', earlier: true } }), ru),
    ).toEqual([]);
    expect(describedFields(entry(), ru)).toEqual([]);
    expect(peopleCount(entry({ details: { people: 2 } }))).toBe(2);
    expect(peopleCount(entry())).toBeNull();
  });

  test('who was seen is the worker’s own marks, told apart by their sign', () => {
    expect(seen(entry({ labels: ['человек-1', 'животное-2'] }), ru)).toEqual([
      { label: 'Человек 1', person: true },
      { label: 'Животное 2', person: false },
    ]);
    expect(seen(entry(), ru)).toEqual([]);
    // A mark this app cannot read is still a chip and still says it is an animal: dropping it would
    // hide somebody the worker did see, and the app has no way of telling which of the two it was.
    expect(seen(entry({ labels: ['person-3'] }), ru)).toEqual([
      { label: ru.montage.journal.animalLabel(1), person: false },
    ]);
  });
});

/* ── the records, and the route ───────────────────────────────────────── */

describe('the records of a stage', () => {
  test('only the ones about a frame go into the list of frames', () => {
    const thought = entry({ id: 2, media_id: null, decision: null });
    const aboutAFrame = entry({ id: 1 });
    expect(framed([thought, aboutAFrame])).toEqual([aboutAFrame]);
    // The card «Сейчас» is a window onto one file, so a thought about the plan does not take it.
    expect(inHand([thought, aboutAFrame])).toEqual(aboutAFrame);
    expect(inHand([thought])).toBeNull();
  });

  test('a route that names no stage is read as the first of the five rather than as nothing', () => {
    expect(codeOf('music')).toBe('music');
    expect(codeOf('assembly')).toBe('assembly');
    expect(codeOf(undefined)).toBe('prep');
    expect(codeOf('screening')).toBe('prep');
    // The number on the bar is its place among the five, counted from one.
    expect(STAGE_COUNT).toBe(5);
    expect(stageNumber('prep')).toBe(1);
    expect(stageNumber('assembly')).toBe(5);
  });
});
