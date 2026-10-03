import { describe, expect, test, vi } from 'vitest';

// `@/lib/montage/journal` reaches `@/api`, which asks `@/lib/language` which language to word a
// failure in, and that one stands on two native expo modules vitest has nothing to run — the same
// two lines `tests/api/api.test.ts` carries, for the same reason. `expo-router` is stood in for as
// well: the hook in that folder asks it whether its screen is in front, and the mock in
// `vitest.setup.ts` only answers for `useFocusEffect`.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import { entry, stage } from '@tests/helpers/journal';
import type { MontageStage } from '@/api';
import { GAZE_SHEET } from '@/kit';
import {
  currentStage,
  gazeAt,
  howMade,
  inHand,
  lastOfStage,
  madeInMinutes,
  minutesLeft,
  placeLine,
  recordsOf,
  sifted,
  stageHeadLine,
  stageLine,
  stageMinutes,
  stageNumber,
  stageStanding,
  stoppedWord,
  takenBefore,
} from '@/lib/montage/journal';
import { en, ru } from '@/strings';

/**
 * What a screen works out of one answer: which stage is on, how long is left, what is in the
 * director's hands, where on a frame the eye is, and the line written under each of the five.
 */

test('«этап 3 из 5» is a place in the pipeline and not the order the worker got to them', () => {
  expect(stageNumber('prep')).toBe(1);
  expect(stageNumber('directing')).toBe(3);
  expect(stageNumber('assembly')).toBe(5);
});

describe('currentStage', () => {
  const done = stage('prep', 'done');
  const running = stage('directing', 'running');

  test('is the one being worked on', () => {
    expect(currentStage([done, running, stage('music', 'pending')])?.stage).toBe('directing');
  });

  test('is the one that fell over, when none is running', () => {
    expect(currentStage([done, stage('music', 'failed')])?.stage).toBe('music');
  });

  test('is the last one reached once everything is behind', () => {
    expect(currentStage([done, stage('assembly', 'done')])?.stage).toBe('assembly');
  });

  test('is nothing at all for a montage still in the queue', () => {
    expect(currentStage([])).toBe(null);
  });

  // The worker writes all five rows `pending` as it opens the job (`journal.begin`), so the last
  // row is always «assembly» — «этап 5 из 5» before the first frame and between every two stages.
  test('a row still pending is not a stage reached', () => {
    const ahead = (['analysis', 'directing', 'music', 'assembly'] as const).map((code) =>
      stage(code, 'pending'),
    );
    expect(currentStage([stage('prep', 'pending'), ...ahead])).toBe(null);
    expect(currentStage([done, ...ahead])?.stage).toBe('prep');
  });

  // The recorded answers carry the five in the pipeline's order, so they cannot show whether the count
  // leans on it: the card and the screen must still agree if the rows come in another one.
  test('is the furthest one reached, wherever it stands among the rows', () => {
    const rows = [done, stage('analysis', 'done'), stage('directing', 'pending')];
    expect(currentStage([...rows].reverse())?.stage).toBe('analysis');
  });

  // The list of montages carries the same five with nothing but a state each, and the card in the
  // strip reads its stage off them through this very function (spec detail 38).
  test('reads the list’s bare five the same as the journal’s full ones', () => {
    const bare = (rows: MontageStage[]) =>
      rows.map(({ stage: code, state }) => ({ stage: code, state }));
    for (const rows of [
      [done, running, stage('music', 'pending')],
      [done, stage('analysis', 'failed'), stage('directing', 'pending')],
      [done, stage('analysis', 'pending')],
    ]) {
      expect(currentStage(bare(rows))?.stage).toBe(currentStage(rows)?.stage);
    }
  });
});

describe('minutesLeft', () => {
  test('adds up what is still ahead and rounds the minute up', () => {
    // 90 + 130 = 220 seconds, which is «≈ 4 мин» and never «3»: an estimate that runs out while
    // somebody is still waiting is worse than one that is generous.
    const stages = [
      stage('prep', 'done', 30),
      stage('directing', 'running', 90),
      stage('assembly', 'pending', 130),
    ];
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
    // Nor are the ones after it, though they still carry the worker's opening estimates.
    expect(
      minutesLeft([
        stage('directing', 'failed'),
        stage('music', 'pending', 120),
        stage('assembly', 'pending', 60),
      ]),
    ).toBe(null);
  });
});

describe('what is in the director’s hands', () => {
  // Newest first, the way the journal is held: a thought about the plan on top of a record about a
  // frame.
  const entries = [
    entry(4, { thought: 'План: три части' }),
    entry(3, { media_id: 'f3' }),
    entry(2, { media_id: 'f2', stage: 'music' }),
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
    expect(lastOfStage(entries, 'music').map((one) => one.id)).toEqual([2]);
    expect(lastOfStage(entries, 'assembly')).toEqual([]);
  });
});

describe('gazeAt', () => {
  // `SheetLiveFile` shows the frame at 220 with a 114 square on it (hairline included; the spec's
  // 110 is the CSS box inside it), and the sheet's own width inside its margins — the ruler the
  // screen hands over, and the only one there is now.
  const sheet = { width: 358, height: 220 };
  const on = (focus: Parameters<typeof gazeAt>[0]) => gazeAt(focus, sheet, GAZE_SHEET);

  test('puts the middle of the square where the director is looking', () => {
    // The middle of the fractions is 0.4 across and 0.5 down; the square is hung by its own middle,
    // so half of it comes off each — 57 of 114.
    expect(GAZE_SHEET).toBe(114);
    expect(on({ x: 0.3, y: 0.25, w: 0.2, h: 0.5 })).toEqual({
      left: 0.4 * 358 - 57,
      top: 0.5 * 220 - 57,
    });
  });

  test('holds the square inside the picture at either edge', () => {
    // An eye on the very edge of a photograph must not hang half of the marker over nothing.
    expect(on({ x: 0, y: 0, w: 0.05, h: 0.05 })).toEqual({ left: 0, top: 0 });
    expect(on({ x: 0.99, y: 0.99, w: 0.01, h: 0.01 })).toEqual({
      left: 358 - 114,
      top: 220 - 114,
    });
  });

  test('is nothing where the record carries no frame at all', () => {
    expect(on(null)).toBe(undefined);
  });
});

describe('the line under a stage', () => {
  // «2026-09-21T16:42:00Z» plus four minutes, so a running stage has a length to say.
  const began = '2026-09-21T16:38:00Z';
  const now = Date.parse('2026-09-21T16:42:00Z');

  test('says what came of the stage and how long it has been at it', () => {
    // «214 кадров: 168 фото, 46 видео на 23:40» — what the order brought, and the stage's own time
    // after it. The figure is the stage's own total, not a key of the outcome's.
    const prep: MontageStage = {
      ...stage('prep', 'done'),
      started_at: began,
      finished_at: '2026-09-21T16:39:00Z',
      total_count: 214,
      outcome: { photos: 168, videos: 46, video_seconds: 1420 },
    };
    expect(stageLine(prep, ru, now)).toBe('214 кадров: 168 фото, 46 видео на 23:40 · 1 мин');
    expect(stageLine(prep, en, now)).toBe('214 frames: 168 photos, 46 videos in 23:40 · 1 min');
  });

  test('a stage still running is counted rather than concluded, in the word of what it does', () => {
    const directing: MontageStage = {
      ...stage('directing', 'running'),
      started_at: began,
      done_count: 61,
      total_count: 212,
    };
    // «идёт» and not «за»: it is still happening, and the number is what has gone by so far. Spec
    // detail 56: «61 из 212 разложено · идёт 4 мин» — the stage's own word of progress after the
    // count, and the same word in each language's own dictionary (`progress`).
    expect(stageLine(directing, ru, now)).toBe('61 из 212 разложено · идёт 4 мин');
    expect(stageLine(directing, en, now)).toBe(
      `61 of 212 ${en.montage.progress.directing} · 4 min so far`,
    );
  });

  test('every stage counts in its own word, and a count that has not moved says neither', () => {
    // Spec detail 56, the table, one word per stage — what each of the five has done to a frame.
    for (const [code, word] of [
      ['prep', 'скачано'],
      ['analysis', 'описано'],
      ['directing', 'разложено'],
      ['music', 'подогнано'],
      ['assembly', 'склеено'],
    ] as const) {
      expect(ru.montage.progress[code]).toBe(word);
      const running = { ...stage(code, 'running'), done_count: 5, total_count: 9 };
      expect(stageLine(running, ru)).toBe(`5 из 9 ${word}`);
      expect(stageLine(running, en)).toBe(`5 of 9 ${en.montage.progress[code]}`);
      expect(stageHeadLine(running, ru)).toBe(`5 ${word}`);
    }
    const still = { ...stage('directing', 'running'), done_count: 0, total_count: 212 };
    expect(stageLine(still, ru)).toBe(undefined);
    expect(stageHeadLine(still, ru)).toBe(undefined);
  });

  test('over its own journal a stage says its time, then how far — or what it came to', () => {
    // «Этап 3 из 5 · 4 мин · 61 разложено» (spec detail 56). Done, the count gives way to the
    // outcome, as in the row.
    const directing: MontageStage = {
      ...stage('directing', 'running'),
      started_at: began,
      done_count: 61,
      total_count: 212,
    };
    expect(stageHeadLine(directing, ru, now)).toBe('4 мин · 61 разложено');
    expect(stageHeadLine(directing, en, now)).toBe(`4 min · 61 ${en.montage.progress.directing}`);
    const prep: MontageStage = {
      ...stage('prep', 'done'),
      started_at: began,
      finished_at: '2026-09-21T16:39:00Z',
      done_count: 214,
      total_count: 214,
      outcome: { photos: 168, videos: 46, video_seconds: 1420 },
    };
    expect(stageHeadLine(prep, ru, now)).toBe('1 мин · 214 кадров: 168 фото, 46 видео на 23:40');
  });

  test('a stage still at it says how far it has got, and a finished one says what it came to', () => {
    // The plan is written as soon as it is ready, before the last of the 212 frames is laid out —
    // reading it as a result would report the work before it happened.
    const directing: MontageStage = {
      ...stage('directing', 'running'),
      done_count: 61,
      total_count: 212,
      taken_count: 61,
      outcome: {
        parts: [
          { title: 'Сборы', from_seconds: 0, to_seconds: 24 },
          { title: 'Торт', from_seconds: 24, to_seconds: 90 },
          { title: 'Тосты', from_seconds: 90, to_seconds: 150 },
        ],
        frames: 61,
      },
    };
    expect(stageLine(directing, ru)).toBe('61 из 212 разложено');
    // Done, the count gives way to the outcome: three parts of the story and what the director took.
    const done = { ...directing, state: 'done' as const };
    expect(stageLine(done, ru)).toBe('3 части истории, взял 61 кадр');
    // Where the worker wrote no figure of its own, the api's own tally over the records stands in.
    expect(stageLine({ ...done, outcome: { parts: directing.outcome.parts } }, ru)).toBe(
      '3 части истории, взял 61 кадр',
    );
  });

  test('the music of a film with no music says there was nothing to fit to, not «0 склеек»', () => {
    // What the worker writes for it (api `docs/journal.md`, «music»): an empty list of tracks.
    const silent: MontageStage = { ...stage('music', 'done'), outcome: { tracks: [] } };
    expect(stageLine(silent, ru)).toBe('без музыки, подгонять не подо что');
    expect(stageLine(silent, en)).toBe('no music, nothing to fit to');
    // With music it names the track, its tempo when known, and the cuts fitted to it — the stage's
    // own total, which is where the api counts them.
    const scored: MontageStage = {
      ...stage('music', 'done'),
      total_count: 38,
      outcome: { bpm: 81, tracks: ['warm'] },
    };
    expect(stageLine(scored, ru)).toBe('«warm», 81 ударов, 38 склеек');
    // A tempo the worker never learned is left out, not shown as zero.
    expect(stageLine({ ...scored, outcome: { tracks: ['warm'] } }, ru)).toBe('«warm», 38 склеек');
  });

  test('a stage nobody has reached says so in the film screen’s own words', () => {
    expect(stageLine(stage('assembly', 'pending'), ru, now)).toBe(ru.montage.filmScreen.notStarted);
    expect(stageLine(stage('assembly', 'pending'), en, now)).toBe(en.montage.filmScreen.notStarted);
  });

  test('the stage that stopped says why, and not how long it was at it', () => {
    // The reason is the news; the stopped stage's own time is not what anybody wants to read here.
    const music: MontageStage = {
      ...stage('music', 'failed'),
      started_at: began,
      finished_at: '2026-09-21T16:39:00Z',
      outcome: { tracks: ['warm'], stopped: 'track_unreadable' },
    };
    expect(stageLine(music, ru, now)).toBe('остановился: трек не открылся');
    expect(stageLine(music, en, now)).toBe('stopped: the track would not open');
    // A reason the app has no word for reads as the general one and never as a code off the wire:
    // the type is the api's, and the api puts no check on what it sends.
    const stray = music as MontageStage;
    stray.outcome = { stopped: 'teapot' as MontageStage['outcome']['stopped'] };
    expect(stageLine(stray, ru)).toBe('остановился: сборка остановилась');
    // …and the dictionary is asked with `hasOwn`, so a code of `__proto__` is not an object.
    const proto = music as MontageStage;
    proto.outcome = { stopped: '__proto__' as MontageStage['outcome']['stopped'] };
    expect(stoppedWord(proto, ru)).toBe(ru.montage.live.stopped.other);
    expect(stoppedWord(stage('prep', 'done'), ru)).toBe(ru.montage.live.stopped.other);
  });

  test('under a minute is not a length worth printing', () => {
    const music: MontageStage = {
      ...stage('music', 'running'),
      started_at: '2026-09-21T16:41:50Z',
    };
    expect(stageMinutes(music, now)).toBe(null);
    expect(stageLine(music, ru, now)).toBe(undefined);
  });

  test('every one of the five has something to say out of its own keys', () => {
    const came: Record<string, MontageStage['outcome']> = {
      prep: { photos: 1, videos: 1 },
      analysis: { described: 37 },
      directing: { parts: [{ title: 'Торт', from_seconds: 0, to_seconds: 150 }] },
      music: { tracks: ['warm'] },
      assembly: { seconds: 150 },
    };
    for (const [code, outcome] of Object.entries(came)) {
      const row = {
        ...stage(code as MontageStage['stage'], 'done'),
        total_count: 214,
        outcome,
      };
      expect(stageLine(row, ru), code).toBeTruthy();
      expect(stageLine(row, en), code).toBeTruthy();
    }
    expect(stageLine({ ...stage('assembly', 'done'), outcome: { seconds: 150 } }, ru)).toBe('2:30');
  });

  test('the way into a stage’s journal is counted in every record it holds', () => {
    expect(
      recordsOf({
        ...stage('directing', 'running'),
        taken_count: 61,
        skipped_count: 87,
        thought_count: 4,
      }),
    ).toBe(152);
    expect(ru.montage.live.wholeStage(152)).toBe('Весь журнал этапа · 152 записи');
  });

  test('where a stage stands is the kit’s word for a step, and «ahead» is a row that is missing', () => {
    expect(stageStanding(undefined)).toBe('waiting');
    expect(stageStanding(stage('assembly', 'pending'))).toBe('waiting');
    expect(stageStanding(stage('directing', 'running'))).toBe('running');
    expect(stageStanding(stage('prep', 'done'))).toBe('done');
    expect(stageStanding(stage('music', 'failed'))).toBe('failed');
  });
});

/**
 * What the finished film's own screen says about how it was made. Both of these are read off the
 * journal a film keeps for ever, and both are worked out here rather than on the screen.
 */
describe('how the film was made', () => {
  const ran = (
    code: MontageStage['stage'],
    from: string,
    to: string | null,
    outcome: MontageStage['outcome'] = {},
  ): MontageStage => ({
    ...stage(code, to === null ? 'running' : 'done'),
    started_at: from,
    finished_at: to,
    outcome,
  });

  test('«собран за 14 мин» is every stage’s own time added up', () => {
    const stages = [
      ran('prep', '2026-09-21T16:00:00Z', '2026-09-21T16:01:00Z'),
      ran('analysis', '2026-09-21T16:01:00Z', '2026-09-21T16:04:00Z'),
      // The worker stood in a queue between these two: that wait is not what the making took.
      ran('directing', '2026-09-21T16:20:00Z', '2026-09-21T16:26:00Z'),
      ran('music', '2026-09-21T16:26:00Z', '2026-09-21T16:28:00Z'),
      ran('assembly', '2026-09-21T16:28:00Z', '2026-09-21T16:30:00Z'),
    ];
    expect(madeInMinutes(stages)).toBe(14);
    expect(ru.montage.live.madeIn(14)).toBe('собран за 14 мин');
  });

  test('a film cut in forty seconds was still cut', () => {
    expect(madeInMinutes([ran('assembly', '2026-09-21T16:00:00Z', '2026-09-21T16:00:40Z')])).toBe(
      1,
    );
  });

  test('a stage still running is not a length, and no stage at all is no line', () => {
    expect(madeInMinutes([ran('assembly', '2026-09-21T16:00:00Z', null)])).toBe(null);
    expect(madeInMinutes([])).toBe(null);
  });

  // The api counts the frames in `prep`'s own total, the takes in `directing`'s tally over its
  // records and the glued pieces in `assembly`'s own total — three different places, which is what
  // `howMade` is: which number answers which of the three words. The assembly stage counts the cuts
  // on its own row and writes no `cuts` key into its outcome (`docs/journal.md`, «assembly»), so
  // that third figure is its `total_count` and never anything worked out here.
  test('the three numbers are three stages’ own counts', () => {
    const stages = [
      { ...stage('prep', 'done'), total_count: 214 },
      { ...stage('analysis', 'done'), total_count: 214 },
      { ...stage('directing', 'done'), taken_count: 61, outcome: { frames: 61 } },
      { ...stage('assembly', 'done'), total_count: 138, outcome: { seconds: 150 } },
    ];
    expect(howMade(stages, ru)).toEqual([
      { figure: 214, label: 'просмотрел' },
      { figure: 61, label: 'взял в ролик' },
      { figure: 138, label: 'склеек' },
    ]);
    expect(howMade(stages, en).map((tile) => tile.label)).toEqual([
      'looked at',
      'taken in',
      'cuts',
    ]);
    // The analysis stage holds no tile of its own: it looked at nothing and took nothing.
    expect(howMade(stages.slice(0, 2), ru)).toEqual([{ figure: 214, label: 'просмотрел' }]);
  });

  test('«склеек» agrees with its number, the way every counted word does', () => {
    const cut = (cuts: number) => [{ ...stage('assembly', 'done'), total_count: cuts }];
    expect(howMade(cut(21), ru)).toEqual([{ figure: 21, label: 'склейка' }]);
    expect(howMade(cut(22), ru)).toEqual([{ figure: 22, label: 'склейки' }]);
    expect(howMade(cut(12), ru)).toEqual([{ figure: 12, label: 'склеек' }]);
    expect(howMade(cut(1), en)).toEqual([{ figure: 1, label: 'cut' }]);
  });

  test('a number the worker never wrote leaves its tile out rather than standing a dash in it', () => {
    expect(howMade([{ ...stage('assembly', 'done'), total_count: 138 }], ru)).toEqual([
      { figure: 138, label: 'склеек' },
    ]);
    // A film cut before the journal existed has no stages at all — and then there is no block.
    expect(howMade([], ru)).toEqual([]);
  });
});

describe('the four chips over the journal', () => {
  const entries = [
    entry(4, { decision: null, media_id: null }),
    entry(3, { decision: 'take', media_id: 'f3' }),
    entry(2, { decision: 'skip', media_id: 'f2' }),
    entry(1, { decision: 'take', media_id: 'f1' }),
  ];

  test('«всё» is every record, in the order they were already in', () => {
    expect(sifted(entries, 'all').map((one) => one.id)).toEqual([4, 3, 2, 1]);
  });

  test('the three narrow ones cut by the decision, the way the api counts them', () => {
    // `taken_count` / `skipped_count` / `thought_count` are counted by the api over `decision`
    // («Журнал монтажа»), so a chip drawn against one of those numbers has to cut the same way, or
    // «Взял 61» would show sixty other records.
    expect(sifted(entries, 'take').map((one) => one.id)).toEqual([3, 1]);
    expect(sifted(entries, 'skip').map((one) => one.id)).toEqual([2]);
    expect(sifted(entries, 'thoughts').map((one) => one.id)).toEqual([4]);
  });

  test('and the three of them add up to all of it', () => {
    const cut = (['take', 'skip', 'thoughts'] as const).flatMap((sift) => sifted(entries, sift));
    expect(cut).toHaveLength(entries.length);
  });
});

describe('where a frame ended up', () => {
  const file = {
    id: 'f1',
    kind: 'video' as const,
    uploaded_by: 'u1',
    file_name: 'VID_0412.MOV',
    captured_at: null,
    duration_seconds: 12.5,
    thumbnail_url: null,
    places: [{ start_seconds: 72, duration_seconds: 4 }],
  };

  test('is the part of the story and the seconds it plays for', () => {
    const took = entry(1, { decision: 'take', story_part: 2, story_part_title: 'Клятвы' });
    expect(placeLine(took, file, 0, ru)).toBe('Часть 2 «Клятвы» · 1:12–1:16');
    expect(placeLine(took, file, 0, en)).toBe('Part 2 «Клятвы» · 1:12–1:16');
  });

  test('is the layout’s and not the thought’s: a record with nothing said still has its place', () => {
    // The road without the director: «беру» and no thought, no part of any story.
    expect(placeLine(entry(1, { decision: 'take', thought: null }), file, 0, ru)).toBe('1:12–1:16');
    // And the part of the story it went into is the layout's as well: it is not left off with the thought.
    expect(
      placeLine(entry(1, { decision: 'take', thought: null, story_part: 2 }), file, 0, ru),
    ).toBe('Часть 2 · 1:12–1:16');
    // A record that settled nothing — what was seen on the frame — is about a frame laid out all the same.
    expect(placeLine(entry(1, { stage: 'analysis', media_id: 'f1' }), file, 0, ru)).toBe(
      '1:12–1:16',
    );
  });

  test('a frame that stands in the video twice says so by a count, not by a second line', () => {
    const twice = {
      ...file,
      places: [...file.places, { start_seconds: 150, duration_seconds: 3 }],
    };
    expect(placeLine(entry(1, { decision: 'take', story_part: 2 }), twice, 0, ru)).toBe(
      'Часть 2 · 1:12–1:16 · и ещё 1',
    );
  });

  // TASK-456: a clip cut into two pieces is two «беру» and two places, in the same order.
  describe('a clip taken twice', () => {
    const twice = {
      ...file,
      places: [...file.places, { start_seconds: 150, duration_seconds: 3 }],
    };
    const first = entry(3, { media_id: 'f1', decision: 'take', story_part: 2 });
    const second = entry(8, { media_id: 'f1', decision: 'take', story_part: 3 });
    // Newest first, as the journal is held, with other files and records between the two.
    const held = [
      second,
      entry(7, { media_id: 'f2', decision: 'take' }),
      entry(5, { media_id: 'f1', decision: 'skip', reason: 'no_room' }),
      entry(4, { media_id: 'f1' }),
      first,
      entry(2, { media_id: 'f2', decision: 'take' }),
    ];

    test('each «беру» names its own place, not the first one twice', () => {
      expect(takenBefore(first, held)).toBe(0);
      expect(takenBefore(second, held)).toBe(1);
      const lines = [first, second].map((one) => placeLine(one, twice, takenBefore(one, held), ru));
      expect(lines).toEqual(['Часть 2 · 1:12–1:16 · и ещё 1', 'Часть 3 · 2:30–2:33 · и ещё 1']);
    });

    test('a record that took nothing is about the frame, and names its first place', () => {
      expect(takenBefore(held[3], held)).toBe(0);
      expect(takenBefore(held[2], held)).toBe(0);
    });

    test('a «беру» whose piece has no place of its own names none — not another piece’s', () => {
      // The ten-minute ceiling cuts the film's tail: the second piece was taken and never laid.
      expect(placeLine(second, file, takenBefore(second, held), ru)).toBe('Часть 3');
    });
  });

  test('a record that passed the frame over has no place, however the file is laid out', () => {
    expect(placeLine(entry(1, { decision: 'skip', reason: 'blur' }), file, 0, ru)).toBe(undefined);
    expect(
      placeLine(entry(1, { decision: 'skip', reason: 'exposure', thought: null }), file, 0, ru),
    ).toBe(undefined);
  });

  test('a frame with no place yet says only which part it is going into', () => {
    expect(
      placeLine(entry(1, { decision: 'take', story_part: 1 }), { ...file, places: [] }, 0, ru),
    ).toBe('Часть 1');
    // And one the layout has not reached at all has nothing to say rather than an empty line.
    expect(placeLine(entry(1, { decision: 'take' }), undefined, 0, ru)).toBe(undefined);
    expect(placeLine(entry(1, { decision: 'take' }), { ...file, places: [] }, 0, ru)).toBe(
      undefined,
    );
  });
});
