import {
  type JournalEntry,
  type JournalFile,
  MONTAGE_STAGES,
  type MontageStage,
  type MontageStageCode,
  type MontageStep,
} from '@/api';
import type { FilmStageState } from '@/kit';
import { formatRuntime } from '@/lib/dates';
import type { Strings } from '@/strings';

/**
 * What a screen works out of an answer: which stage is on, what is in the director's hands, how long
 * is left, where on a frame the eye is. Arithmetic over what the api sent, and nothing else.
 */
/* ── What the screens work out of it ──────────────────────────────────── */

/** How many stages there are in all — the «из 5». */
export const STAGE_COUNT = MONTAGE_STAGES.length;

/** «Этап 3 из 5»: the place of a stage in the pipeline, counted from one. */
export const stageNumber = (stage: MontageStageCode): number => MONTAGE_STAGES.indexOf(stage) + 1;

/**
 * The stage the video is on now: the one being worked on, or — when none is — the one that fell
 * over, and failing that the last one the worker has reached. A `pending` row is not reached: the
 * worker writes all five as it opens the job, so between two stages the answer is the one just
 * done and not the last row of the five. Null before anything is known, which is a montage still
 * standing in the queue as much as a journal not read yet.
 *
 * The one place «этап N из 5» is counted: the journal's five rows on the screen of the making, and
 * the list's five on the card in the strip that leads there, so the two cannot name different
 * stages for the same moment.
 */
export function currentStage<Row extends MontageStep>(stages: readonly Row[]): Row | null {
  const inOrder = [...stages].sort((a, b) => stageNumber(a.stage) - stageNumber(b.stage));
  return (
    inOrder.find((stage) => stage.state === 'running') ??
    inOrder.find((stage) => stage.state === 'failed') ??
    inOrder.filter((stage) => stage.state !== 'pending').pop() ??
    null
  );
}

/**
 * «В руках режиссёра» — the freshest record that is about a frame at all. The card at the top of
 * the live screen is a window onto one file, so a thought about the plan as a whole does not take
 * the frame out of its hands: it goes into the journal underneath and the card holds what it held.
 */
export const inHand = (entries: readonly JournalEntry[]): JournalEntry | null =>
  entries.find((entry) => entry.media_id !== null) ?? null;

/** How many of its last records an opened stage shows (spec 7.6). */
const LAST = 2;

/** The last records of one stage, freshest first — what its row shows opened out. */
export const lastOfStage = (
  entries: readonly JournalEntry[],
  stage: MontageStageCode,
): JournalEntry[] => entries.filter((entry) => entry.stage === stage).slice(0, LAST);

/**
 * «Осталось ≈ 8 мин»: the worker's estimates for the stages that are not behind us, added up —
 * rounded up, because a minute and a half left is «2 мин» and never «1», and never below one while
 * there is anything at all to wait for.
 *
 * The worker writes an estimate of each whole stage as it opens the job. Screening and assembly it
 * counts as they go, and at every step it reckons again what is left of them from how they are
 * really going; the other three keep the opening estimate of the whole stage until they are done. So
 * while understanding, directing or rhythm is at work, the sum is an upper bound, not what is left.
 *
 * Null when not a single stage has an estimate: no number is better than a made-up one, and the
 * screen simply does not draw the line. Null too once a stage has fallen over — the ones after it
 * still carry the worker's opening guesses, but nobody is waiting for them any more.
 */
export function minutesLeft(stages: readonly MontageStage[]): number | null {
  if (stages.some((stage) => stage.state === 'failed')) return null;
  const ahead = stages.filter((stage) => stage.state !== 'done');
  if (!ahead.some((stage) => stage.eta_seconds !== null)) return null;
  const seconds = ahead.reduce((sum, stage) => sum + (stage.eta_seconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Where the kit's square goes, for a gaze that arrives as fractions of the frame. The middle of
 * what the director is looking at becomes the middle of the square, and the square is then held
 * inside the frame — an eye on the very edge of a photograph must not hang half of the marker over
 * nothing. A frame smaller than the square itself simply gets it at the corner.
 *
 * `size` is `GAZE` on the card and `GAZE_SHEET` on the sheet's taller frame (`SheetLiveFile`): the
 * same eye, drawn at the size the picture under it is drawn at.
 */
export function gazeAt(
  focus: JournalEntry['focus'],
  frame: { width: number; height: number },
  size: number,
): { left: number; top: number } | undefined {
  if (!focus) return undefined;
  const inside = (middle: number, along: number) =>
    Math.max(0, Math.min(along - size, middle * along - size / 2));
  return {
    left: inside(focus.x + focus.w / 2, frame.width),
    top: inside(focus.y + focus.h / 2, frame.height),
  };
}

/**
 * How long a stage has been at it — what it has taken so far while it runs, and what it took once it
 * is behind. Whole minutes and nothing under one: a stage that started eight seconds ago is not
 * «0 мин», it is a stage with nothing to say about its own length yet.
 */
export function stageMinutes(stage: MontageStage, now: number = Date.now()): number | null {
  if (stage.started_at === null) return null;
  const from = new Date(stage.started_at).getTime();
  const to = stage.finished_at === null ? now : new Date(stage.finished_at).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const minutes = Math.floor((to - from) / 60000);
  return minutes >= 1 ? minutes : null;
}

/**
 * The line under a stage's name (spec detail 56) — «212 из 214 годятся · 1 мин». What came of it
 * where the worker has said, how far through it is where it has not, and its own time after either.
 *
 * Every stage's outcome is its own shape, so each is read for the one thing worth a clause out of
 * the keys the api names («Журнал монтажа»); a key that did not arrive is simply not drawn, and a
 * stage nobody has reached yet has no line at all rather than a line of nothing.
 */
export function stageLine(
  stage: MontageStage,
  s: Strings,
  now: number = Date.now(),
): string | undefined {
  const { filmScreen, live } = s.montage;
  // A stage nobody has come to says nothing about the making — and on the screen of a film that
  // stopped, the one behind the stopped stage says so in its own words rather than «неизвестно».
  if (stage.state === 'pending') return filmScreen.notStarted;

  const minutes = stageMinutes(stage, now);
  const spent =
    minutes === null
      ? undefined
      : stage.state === 'running'
        ? live.running(minutes)
        : live.minutes(minutes);
  // The stage that stopped says why, and says it in danger; its own time is not what anybody wants
  // to read here — the reason is.
  if (stage.state === 'failed') {
    return filmScreen.stoppedBecause(stoppedWord(stage, s));
  }
  // A stage that is still at it says how far it has got, not what it came to: its outcome is the
  // plan it has, and reading it as a result would report the work before it happened.
  const parts = [
    stage.state === 'running'
      ? (soFar(stage, s) ?? cameOf(stage, s))
      : (cameOf(stage, s) ?? soFar(stage, s)),
    spent,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * Why the making stopped, in the app's own words (api `docs/journal.md`, «Остановка»). A code out of
 * the dictionary is the general «сборка остановилась» rather than a code shown raw: the api says so
 * itself of a reason it cannot name, and a film cut before the codes were fixed lands here too.
 *
 * Own keys only: the code comes off the wire, and `in` would hand `__proto__` back as an object for
 * the screen to render.
 */
export function stoppedWord(stage: MontageStage | undefined, s: Strings): string {
  const words = s.montage.live.stopped;
  const code = stage?.outcome.stopped;
  return code !== undefined && Object.hasOwn(words, code) ? words[code] : words.other;
}

/** What the stage says it came to, in the one clause its own keys can fill. */
function cameOf(stage: MontageStage, s: Strings): string | undefined {
  const { live } = s.montage;
  const came = stage.outcome;
  switch (stage.stage) {
    case 'prep': {
      // «214 кадров: 168 фото, 46 видео на 23:40» — what the order brought, and the stage's own
      // total against what the counter says. A stage with nothing in its outcome says nothing.
      const frames = stage.total_count;
      if (frames === null || came.photos === undefined || came.videos === undefined) {
        return undefined;
      }
      return live.prepCame(
        frames,
        came.photos,
        came.videos,
        formatRuntime(came.video_seconds ?? null) ?? '',
      );
    }
    case 'analysis':
      return came.described === undefined
        ? undefined
        : live.analysisCame(came.described, came.earlier ?? 0);
    case 'directing': {
      const parts = came.parts?.length;
      return parts === undefined
        ? undefined
        : live.directingCame(parts, came.frames ?? stage.taken_count);
    }
    case 'music': {
      // A film with no music has nothing to lay out to: the stage still runs, and «0 склеек» would
      // be a count of what never could have happened.
      const tracks = came.tracks ?? came.track;
      if (tracks?.length === 0) return live.noTrack;
      const name = tracks?.[0];
      return name === undefined
        ? undefined
        : live.musicCame(name, came.bpm ?? null, stage.total_count);
    }
    case 'assembly':
      return came.seconds === undefined ? undefined : formatRuntime(came.seconds);
  }
}

/**
 * «61 из 212 разложено» — how far through it is, in the word of what the stage does, for a stage
 * that has not come to anything yet, and only once its counter has moved (spec detail 56). The
 * worker counts screening by the file and assembly by the piece; the other three stand at nothing
 * until they are done, and «0 из 13» there would say nothing has been done while the stage's records
 * pile up under it.
 */
function soFar(stage: MontageStage, s: Strings): string | undefined {
  return stage.total_count === null || stage.done_count === 0
    ? undefined
    : s.montage.live.soFar(stage.done_count, stage.total_count, s.montage.progress[stage.stage]);
}

/**
 * What the bar over a stage's own journal says after «Этап 3 из 5» (spec detail 56,
 * `MontageLiveStage`) — «4 мин · 61 разложено»: the stage's time, then what it came to or, while it
 * is still at it, how many it has done so far. The bar has no room for the total the row carries,
 * and the time there is the stage's own whichever way it stands, so it is said without «идёт».
 */
export function stageHeadLine(
  stage: MontageStage,
  s: Strings,
  now: number = Date.now(),
): string | undefined {
  const { live, progress } = s.montage;
  const minutes = stageMinutes(stage, now);
  const parts = [
    minutes === null ? undefined : live.minutes(minutes),
    cameOf(stage, s) ??
      (stage.done_count === 0 ? undefined : live.counted(stage.done_count, progress[stage.stage])),
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * Where one of the five stands, in the row's own words. A stage the worker has not reached has no
 * row of its own in the answer, which is the same thing as `pending`: it is ahead.
 *
 * Both screens of the film ask it — the one that is being made and the finished one — so it is
 * worked out here rather than written out twice as a chain of ternaries.
 */
export function stageStanding(stage: MontageStage | undefined): FilmStageState {
  if (stage === undefined || stage.state === 'pending') return 'waiting';
  return stage.state;
}

/**
 * «собран за 14 мин» — the whole making, added up out of the stages that have both ends (spec 7.6,
 * `FilmReady`). Their own times and not the span from the first to the last: what is worth
 * saying is how long the work took, and a montage that stood in a queue between two stages did not
 * spend that wait being made.
 *
 * Rounded up and never under a minute, the way «осталось ≈» is: a video cut in forty seconds was
 * still cut, and «собран за 0 мин» is the screen saying nothing happened. Null when not one stage
 * has finished — the line is then simply not drawn, rather than drawn around a made-up number.
 */
export function madeInMinutes(stages: readonly MontageStage[]): number | null {
  const spans = stages
    .map((stage) =>
      stage.started_at === null || stage.finished_at === null
        ? NaN
        : new Date(stage.finished_at).getTime() - new Date(stage.started_at).getTime(),
    )
    .filter((span) => !Number.isNaN(span) && span >= 0);
  if (spans.length === 0) return null;
  return Math.max(1, Math.ceil(spans.reduce((sum, span) => sum + span, 0) / 60000));
}

/**
 * «Как собирался» in three numbers (spec 7.6, detail 44): every frame the worker looked at, the ones
 * the director took into the film, and the cuts they came to. Each is one stage's own outcome under
 * the keys the api names, so a montage whose journal is missing one of them shows two tiles rather
 * than a tile with nothing in it — the same rule the line under a stage's name follows.
 *
 * The words belong to the screen and arrive with the dictionary, the way `stageLine`'s do: what is
 * worked out here is which number answers which of them.
 */
export function howMade(
  stages: readonly MontageStage[],
  s: Strings,
): { figure: number; label: string }[] {
  const { live } = s.montage;
  const of = (code: MontageStageCode) => stages.find((one) => one.stage === code);
  const three = [
    { figure: of('prep')?.total_count ?? undefined, label: live.watched },
    { figure: of('directing')?.taken_count ?? undefined, label: live.tookIn },
    {
      // The api counts the glued pieces on the assembly stage itself and writes no `cuts` key into
      // its outcome (`docs/journal.md`, «assembly»), so the third figure is that `total_count` —
      // «92 из 138 склеек» — and never a number worked out here.
      figure: of('assembly')?.total_count ?? undefined,
      label: live.glued(of('assembly')?.total_count ?? 0),
    },
  ];
  return three.filter(
    (tile): tile is { figure: number; label: string } => tile.figure !== undefined,
  );
}

/** Every record a stage holds, which is what the way into its journal is counted in. */
export const recordsOf = (stage: MontageStage): number =>
  stage.taken_count + stage.skipped_count + stage.thought_count;

/**
 * Which records the journal is showing — the four chips over it (spec 7.6, `MontageLiveStage`). The
 * three narrow ones are drawn against the api's own counts, so they are cut the way the api counts
 * them: by the decision on the record, and «мысли» is a record with no decision at all.
 */
export type Sift = 'all' | 'thoughts' | 'take' | 'skip';

export function sifted(entries: readonly JournalEntry[], sift: Sift): JournalEntry[] {
  if (sift === 'all') return [...entries];
  if (sift === 'thoughts') return entries.filter((entry) => entry.decision === null);
  return entries.filter((entry) => entry.decision === sift);
}

/**
 * Which of its file's places in the film is this record's own, counted from the first: how many
 * times the director took the same file before it. One clip can go into a video as several pieces,
 * each with its own «беру», and the api hands a file's places in the order they play — the same
 * order the worker writes those records in (api `docs/journal.md`, TASK-457). So the second «беру»
 * of a clip is its second place, not its first again. Anything but a «беру» is about the frame as a
 * whole and names the first.
 *
 * ponytail: counts only the records held, so a take whose earlier takes of the same file sit on a
 * page not yet paged back to counts short. A directing stage is a page for the memories this app is
 * used for; if one ever is not, ask the api for the file's records alone (`media_id`).
 */
export const takenBefore = (entry: JournalEntry, entries: readonly JournalEntry[]): number =>
  entry.decision !== 'take'
    ? 0
    : entries.filter(
        (one) => one.decision === 'take' && one.media_id === entry.media_id && one.id < entry.id,
      ).length;

/**
 * Where a frame lay in the film (spec 7.6, `SheetLiveFile`) — «Часть 2 «Клятвы» · 1:12–1:16 · и ещё
 * 1». A fact of the layout and not of the thought: the seconds are the file's own `places`, so the
 * line is there whether the director said anything about the frame or not — and on the road without
 * the director it never does. The part of the story is the record's, and so is the place: `nth` of
 * the file's places (`takenBefore`). The others the frame stands in are said by a count rather than
 * by a line each: the sheet is about the frame, not about the cutting list.
 *
 * A record that passed the frame over has none of this, however the file is laid out: its card is
 * about why it was passed over, and a frame the organizer then asked for is placed on the card of
 * the record that took it. Nor does a «беру» whose piece has no place of its own — cut off the tail
 * of a film that ran past its ceiling: the seconds of another piece are not where this one went.
 */
export function placeLine(
  entry: JournalEntry,
  file: JournalFile | undefined,
  nth: number,
  s: Strings,
): string | undefined {
  if (entry.decision === 'skip') return undefined;
  const { live } = s.montage;
  const places = file?.places ?? [];
  const place = places[nth];
  const parts = [
    entry.story_part === null
      ? undefined
      : live.partOf(entry.story_part, entry.story_part_title ?? undefined),
    place === undefined
      ? undefined
      : `${formatRuntime(place.start_seconds)}–${formatRuntime(place.start_seconds + place.duration_seconds)}`,
    place === undefined || places.length === 1 ? undefined : live.morePlaces(places.length - 1),
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}
