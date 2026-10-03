import type { Montage, MontageStage, MontageStageCode } from '@/api';
import { formatRuntime, formatTime } from '@/lib/dates';
import type { Strings } from '@/strings';

import { currentStage, minutesLeft, STAGE_COUNT, stageNumber } from './stages';

/**
 * What the screen of a movie works out of an answer before it draws any of it: where the making
 * stands, what to say about the stage in hand, and what the film is called and what it was made of.
 *
 * All of it arithmetic over what the api sent — never a second count of the worker's own. The
 * counters the worker does not write (`taken_count`, `skipped_count`, `thought_count`,
 * `skipped_by_reason`, `taken_by_part`) are the api's and arrive ready; nothing here re-counts them.
 */

/** Which of a film's five states the screen is drawing. */
export type FilmState = 'queued' | 'building' | 'ready' | 'stopped' | 'offline' | 'gone';

/**
 * Which state this is, from what the list said and what the journal says. The list is the authority
 * on the status — it is what the api last answered — and the journal only decides between the two
 * that are the same row: a film being cut with the connection gone is still being cut, only offline.
 *
 * `refused` is the one that is not a state of a film at all: the api is saying this reader is not in
 * the memory, and there is nothing of the film left to draw.
 */
export function filmState(
  montage: Montage | null,
  journal: { status: Montage['status'] | null; refused: boolean; offline: boolean },
): FilmState {
  if (journal.refused) return 'gone';
  const status = journal.status ?? montage?.status ?? null;
  if (status === 'failed') return 'stopped';
  if (status === 'ready') return 'ready';
  if (status === 'queued') return 'queued';
  return journal.offline ? 'offline' : 'building';
}

/**
 * The stage the screen's own line stands on, and everything that line says — the stage's name, its
 * place among the five, and what is left of it.
 *
 * Null where there is no stage to name: a film nobody has started yet has none, and that is not a
 * gap to fill in. It is also null once a stage has fallen over, because nobody is waiting for the
 * stages behind it any more — their estimates are the worker's guesses from the start of the job.
 */
export function stageInHand(
  stages: readonly MontageStage[],
  s: Strings,
): {
  stage: MontageStage;
  code: MontageStageCode;
  name: string;
  stageOf: string;
  minutes: number | null;
} | null {
  const held = currentStage(stages);
  if (held === null || held.state === 'failed') return null;
  return {
    stage: held,
    code: held.stage,
    name: s.montage.stage[held.stage],
    stageOf: s.montage.live.stageOf(stageNumber(held.stage), STAGE_COUNT),
    minutes: minutesLeft(stages),
  };
}

/**
 * The four tiles of what was ordered (`FilmQueued`), as the facts the list handed over and no more.
 *
 * The api counts the frames once, at the order, and never again — so a film ordered before those
 * columns existed has nothing to say its shape in, and its tiles are simply not drawn rather than
 * standing a zero in the middle of the queue. Same for the tempo: a track of the organizer's own may
 * have none, and that is a missing second line rather than «0 ударов».
 */
export function orderedTo(
  montage: Montage,
  track: string | undefined,
  bpm: number | null,
  s: Strings,
): {
  frames: { figure: string; note: string } | null;
  length: string | null;
  music: { figure: string; note: string | null } | null;
} {
  const { filmScreen } = s.montage;
  const photos = montage.photos ?? null;
  const videos = montage.videos ?? null;

  return {
    frames:
      photos === null || videos === null
        ? null
        : { figure: String(photos + videos), note: filmScreen.framesNote(photos, videos) },
    length: formatRuntime(montage.params.target_seconds ?? null) ?? null,
    music:
      track === undefined
        ? null
        : { figure: track, note: bpm === null ? null : filmScreen.bpm(bpm) },
  };
}

/**
 * How many minutes ago the freshest record on the card landed — «обновлено 2 мин назад» over the
 * card «Сейчас» while the connection is gone.
 *
 * The age of what is actually shown, not the age of the last read: a screen that said «just now»
 * over a record that landed an hour ago would be the one thing a person watching in a lift cannot
 * forgive. Null where there is nothing on the card to be old, and never under one — a record that
 * landed forty seconds ago is a minute old as far as the words are concerned.
 */
export function minutesSince(
  entries: readonly { created_at: string }[],
  now: number = Date.now(),
): number | null {
  const freshest = entries[0]?.created_at;
  if (freshest === undefined) return null;
  const then = new Date(freshest).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(1, Math.floor((now - then) / 60000));
}

/**
 * How long the whole making takes, in minutes — the worker's own estimate of each of the five stages
 * added up. This is what a second attempt would cost: the stages do not get longer by having run
 * once, and the api sends no separate figure for a re-run.
 *
 * Null when not one stage carries an estimate, so the screen says nothing rather than something
 * rounded up from nothing. The stages of a film that failed still hold their opening estimates, so
 * this is what stands under «Повторить».
 */
export function makingTakes(stages: readonly MontageStage[]): number | null {
  if (!stages.some((stage) => stage.eta_seconds !== null)) return null;
  const seconds = stages.reduce((sum, stage) => sum + (stage.eta_seconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

/** When the film was put in the queue, in the reader's own clock. */
export const acceptedAt = (montage: Montage, s: Strings): string =>
  s.montage.filmScreen.acceptedAt(formatTime(montage.created_at));
