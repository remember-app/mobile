import type {
  JournalDetails,
  JournalEntry,
  JournalFile,
  MontageStage,
  MontageStageCode,
} from '@/api';
import { formatRuntime } from '@/lib/dates';
import type { Strings } from '@/strings';

import { stageMinutes } from './stages';

/**
 * What one stage's journal screen works out of the answer before it draws any of it: how far the
 * stage is, what its summary block says, and the facts of the one block that stands under it.
 *
 * Everything here is arithmetic over what the api sent. The counters the worker does not write
 * (`taken_count`, `skipped_count`, `thought_count`, `skipped_by_reason`, `taken_by_part`) arrive
 * ready and are read, never re-counted — a second count on the phone is a count that can disagree
 * with the api's own.
 */

/** How the one screen of a stage stands, from its own row. Four of them, and no more. */
export type StageStanding = 'waiting' | 'running' | 'done' | 'failed';

/**
 * Where this stage stands, out of its own row rather than out of the whole answer: the row the
 * worker writes is the authority, and a stage nobody has reached says so rather than going quiet.
 */
export function standing(stage: MontageStage | undefined): StageStanding {
  if (stage === undefined || stage.state === 'pending') return 'waiting';
  return stage.state;
}

/**
 * The line under the screen's own scale — «≈ 2 мин осталось» while it runs, «за 4 мин» once it is
 * behind. Right on the summary block, and the one place a stage's own time is said.
 *
 * A stage nobody has come to has no time of its own and says nothing: there is nothing to have
 * spent. The one that stopped says nothing either — nobody is waiting for a stage that is over, and
 * the reason under it says what actually matters.
 */
export function timeWord(
  stage: MontageStage | undefined,
  s: Strings,
  left: number | null,
  now: number = Date.now(),
): string | undefined {
  if (stage === undefined || stage.state === 'pending' || stage.state === 'failed')
    return undefined;
  const minutes = stageMinutes(stage, now);
  if (stage.state === 'running') {
    if (left !== null) return s.montage.journal.leftAbout(left);
    return minutes === null ? undefined : s.montage.live.running(minutes);
  }
  return minutes === null ? undefined : s.montage.live.minutes(minutes);
}

/**
 * «120 из 214» with the word for what is counted — the summary block's own line under the scale.
 *
 * Null where the stage has nothing to count against: `total_count` is empty until the worker has
 * counted anything, and «61 из ?» is not a number a person can read.
 */
export function counted(
  stage: MontageStage | undefined,
  s: Strings,
): { figure: string; of: string; word: string; share: number } | null {
  if (!stage || stage.total_count === null || stage.total_count === 0) return null;
  const journal = s.montage.journal;
  const word = journal.counts[stage.stage];
  return {
    figure: String(stage.done_count),
    of: String(stage.total_count),
    word,
    share: stage.done_count / stage.total_count,
  };
}

/**
 * One half of the preparation's two counters — «Фото 98 из 168». The api writes `photos_done`
 * against `photos` and `videos_done` against `videos`, and each pair stands or falls together: a
 * counter whose total is not there has nothing to be a share of, and the bar is simply not drawn.
 */
export function prepared(
  stage: MontageStage | undefined,
  kind: 'photos' | 'videos',
): { label: string; done: number; of: number; share: number } | null {
  const came = stage?.outcome;
  if (!came) return null;
  const of = came[kind];
  const done = kind === 'photos' ? came.photos_done : came.videos_done;
  if (of === undefined || done === undefined) return null;
  return { label: kind, done, of, share: of === 0 ? 0 : done / of };
}

/**
 * How much the order weighs, in the words the screen has for it: «3,1 ГБ». Null rather than a
 * figure worked out of nothing — a stage that recorded no `bytes` is not a small order.
 *
 * Bytes are the api's own integer; this only says how many of what unit to call it, and the
 * rounding is the reader's: two decimals below ten, one above, and megabytes below a gigabyte.
 */
export function weighed(bytes: number | undefined): { figure: string; unit: 'mb' | 'gb' } | null {
  if (bytes === undefined || bytes < 1) return null;
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) {
    return { figure: mb < 10 ? mb.toFixed(2) : mb.toFixed(1), unit: 'mb' };
  }
  const gb = mb / 1024;
  return { figure: gb < 10 ? gb.toFixed(2) : gb.toFixed(1), unit: 'gb' };
}

/**
 * Who brought how much of the order, biggest first — the preparation's «Кто прислал».
 *
 * The api's `senders` is by member id and knows nothing of names; the screen pairs it with the
 * roster, so this answers with the pairs alone and the words over them. One entry per person, and
 * the share each bar is drawn to is against the largest of them rather than against the total: the
 * point of the bar is who brought the most, and a scale that always ended short of full would say
 * nobody did.
 */
export function senders(
  stage: MontageStage | undefined,
): { id: string; count: number; share: number }[] {
  const held = stage?.outcome.senders;
  if (!held) return [];
  const rows = Object.entries(held)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);
  const most = rows[0]?.[1] ?? 0;
  return rows.map(([id, count]) => ({ id, count, share: most === 0 ? 0 : count / most }));
}

/**
 * The parts of the story, in the order they play, each with what is known about it: the seconds it
 * stands at, and how many frames the director has taken into it.
 *
 * Two numbers come from two places and are not to be confused — the seconds out of `outcome.parts`,
 * the count out of the api's own `taken_by_part` — so a part the worker has not counted yet is
 * drawn without a count rather than with a zero.
 */
export function parts(stage: MontageStage | undefined): {
  at: number;
  title: string;
  from: string;
  to: string;
  taken: number | null;
  /** The part has a plan and no records yet: «ещё не собрана». */
  empty: boolean;
}[] {
  const list = stage?.outcome.parts;
  if (!list) return [];
  const byPart = stage?.taken_by_part ?? {};
  return list.map((part, i) => {
    const from = formatRuntime(part.from_seconds) ?? '0:00';
    const to = formatRuntime(part.to_seconds) ?? from;
    const taken = byPart[String(i + 1)];
    return { at: i + 1, title: part.title, from, to, taken, empty: taken === undefined };
  });
}

/**
 * One part's own line — «14 кадров · 0:00–0:24», or «ещё не собрана» where the director has only
 * planned it. The seconds are the part's own, not worked out of anything.
 */
export function partLine(part: ReturnType<typeof parts>[number], s: Strings): string {
  const journal = s.montage.journal;
  return part.empty
    ? journal.partNotYet
    : `${journal.frames(part.taken ?? 0)} · ${part.from}–${part.to}`;
}

/**
 * «Не взял в историю» and the reasons under it — the chips, and what each of them counts.
 *
 * The three are the api's own tally by reason code (`skipped_by_reason`), never a count of the
 * records on screen: a page of records says how many arrived, not how many there are. The codes
 * come out of the worker's own vocabulary and are read by `reasonWord`, so a code this app has no
 * word for is never shown raw.
 */
export function passes(
  stage: MontageStage | undefined,
  s: Strings,
): { total: number; reasons: { reason: string; label: string; count: number }[] } | null {
  if (!stage || stage.skipped_count === 0) return null;
  const byReason = stage.skipped_by_reason ?? {};
  return {
    total: stage.skipped_count,
    reasons: Object.entries(byReason)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({
        reason,
        // The worker's own word for it, and the general one for a code out of the dictionary —
        // `reasonWord` is what decides, so the chips and a row's pill cannot name a reason
        // differently.
        label:
          s.montage.live.reason[reason as keyof typeof s.montage.live.reason] ??
          s.montage.live.reason.other,
        count,
      })),
  };
}

/**
 * Where one record's sound sits in a part of the story — the two shares the music screen draws as
 * two bars: how much of the music is heard there and how much of the frames' own sound.
 *
 * The worker averages both over the part and never sums them to one: loud music and a loud room
 * happen together, and a pair of bars that always added up would be drawing a rule that is not
 * there. Null where the record says neither — a part the worker had nothing to say about is drawn
 * without its bars, not with two empty ones.
 */
export function shares(
  entry: JournalEntry | undefined,
): { music: number | null; live: number | null } | null {
  const details = entry?.details;
  if (!details || (details.music === undefined && details.live === undefined)) return null;
  const one = (value: number | undefined) =>
    value === undefined ? null : Math.max(0, Math.min(1, value));
  return { music: one(details.music), live: one(details.live) };
}

/**
 * The music the worker laid the cuts to, and the cuts themselves — the full-width tape with the
 * white ticks on it.
 *
 * `cut_seconds` is where the cuts stand in the film, not how many there are, so the tape needs the
 * length of the film to draw them against: the assembly's own `seconds` once it is known, and the
 * length that was ordered before that. Either way null without a length, because a tick at a
 * fraction of nothing is not a tick.
 */
export function cuts(
  stage: MontageStage | undefined,
  lengthSeconds: number | null,
): { at: number; share: number }[] | null {
  const list = stage?.outcome.cut_seconds;
  if (!list || lengthSeconds === null || lengthSeconds <= 0) return null;
  return list
    .filter((at) => at >= 0 && at <= lengthSeconds)
    .map((at) => ({ at, share: at / lengthSeconds }));
}

/** The length of what came out, or the length that was asked for — the tape's scale. */
export function filmLength(
  assembly: MontageStage | undefined,
  target: number | null | undefined,
): number | null {
  return assembly?.outcome.seconds ?? target ?? null;
}

/**
 * What came of the assembly, in the two tiles it draws — how long the film is and how many pieces
 * are glued into it. Both out of `outcome`: the count is the assembly's own `total_count`, never a
 * second count of the pieces.
 */
export function assemblyTiles(
  stage: MontageStage | undefined,
  s: Strings,
): { figure: string; label: string }[] {
  const journal = s.montage.journal;
  const tiles: { figure: string; label: string }[] = [];
  const seconds = stage?.outcome.seconds;
  if (seconds !== undefined)
    tiles.push({ figure: formatRuntime(seconds) ?? '', label: journal.length });
  const frames = stage?.outcome.frames;
  if (frames !== undefined) tiles.push({ figure: String(frames), label: journal.frame });
  const cuts = stage?.total_count;
  if (cuts !== null && cuts !== undefined) {
    tiles.push({ figure: journal.of(stage?.done_count ?? 0, cuts), label: journal.cutsDone });
  }
  return tiles;
}

/**
 * The assembly's own progress — the big figure over the poster and the substep under it. Both out
 * of `outcome`, and the percent is the worker's own: it is roughly where the whole assembly is, and
 * the substeps under it are what it is roughly made of.
 */
export function assemblyProgress(
  stage: MontageStage | undefined,
  s: Strings,
): { percent: number; step: string | undefined } | null {
  const percent = stage?.outcome.percent;
  if (percent === undefined) return null;
  const running = stage?.outcome.steps?.find((one) => one.state === 'running');
  return {
    percent: Math.max(0, Math.min(100, percent)),
    step: running ? s.montage.journal.steps[running.step] : undefined,
  };
}

/** The substeps the assembly walks, with the words each is called by on screen. */
export function assemblySteps(
  stage: MontageStage | undefined,
  s: Strings,
): { step: string; label: string; state: 'pending' | 'running' | 'done' }[] {
  return (stage?.outcome.steps ?? []).map((one) => ({
    step: one.step,
    label: s.montage.journal.steps[one.step],
    state: one.state,
  }));
}

/**
 * The records of one stage that are about a frame, newest first — the analysis's «Последние» and
 * what a card opens onto. Records with no file are the director's thoughts about the plan or a
 * part, and the journal of a stage shows them in its own block rather than in a list of frames.
 */
export const framed = (entries: readonly JournalEntry[]): JournalEntry[] =>
  entries.filter((entry) => entry.media_id !== null);

/**
 * One frame's line under its description — «IMG_2041 · крупный · нежно · описан ранее». Every part
 * of it is a key the worker wrote: the name of the file, the shot, the mood, and whether the
 * description was taken ready-made out of a past film.
 *
 * A key that is not there is not drawn: a frame with no mood says its name and its shot, and one
 * with neither is not a sentence of dashes.
 */
export function frameLine(
  entry: JournalEntry,
  file: JournalFile | undefined,
  s: Strings,
): string[] {
  const details = entry.details;
  const journal = s.montage.journal;
  return [
    file?.file_name ?? undefined,
    details?.shot,
    details?.mood,
    details?.earlier === true ? journal.describedEarlier : undefined,
  ].filter((part): part is string => part !== undefined);
}

/**
 * The fields one frame was described in, each under its own word, in the order the card draws them.
 *
 * The order is the spec's rather than the worker's: `details` is free-form json and its keys stand
 * in whatever order the model wrote them, so a card whose fields moved about between two frames of
 * the same stage would be a card nobody could read twice. A key the worker left out is not drawn
 * at all — a photograph has no «Камера» and no «Речь», and a frame described in three words has
 * three fields.
 */
/**
 * The fields one frame was described in, each with the key of its own word — the order is the
 * card's, not the worker's (see {@link describedFields}).
 */
const DESCRIBED = [
  ['place', 'place'],
  ['light', 'light'],
  ['mood', 'mood'],
  ['shot', 'shot'],
  ['camera', 'camera'],
  ['speech', 'speech'],
] as const satisfies readonly (readonly [
  keyof JournalDetails,
  keyof Strings['montage']['journal'],
])[];

/**
 * The fields one frame was described in, each under its own word and in the order above. Anything
 * the worker wrote that is not one of them is not drawn: `details` is free-form and the app reads
 * the keys it has words for.
 */
export function describedFields(
  entry: JournalEntry,
  s: Strings,
): { label: string; value: string }[] {
  const details = entry.details;
  if (!details) return [];
  return DESCRIBED.flatMap(([key, word]) => {
    const value = details[key];
    return typeof value === 'string' && value !== ''
      ? [{ label: String(s.montage.journal[word]), value }]
      : [];
  });
}

/**
 * The worker's own marks on a frame, as codes (`labels` off the record): `человек-1` and
 * `животное-1` are its words and not ours, so they are read here and only the names are ours.
 *
 * A mark this app cannot read is drawn as an animal rather than dropped: the worker names a person
 * and an animal and nothing else, so an unrecognised one is a person or an animal it has not
 * numbered the way this version does — and a chip of the wrong head is a smaller lie than a chip
 * that is not there at all.
 */
const PERSON = 'человек-';
const ANIMAL = 'животное-';

/**
 * Who the worker saw in a frame, as the chips under «Кто в кадре»: what it is called, and whether
 * it is a person — the chip's sign says which, and a person and an animal are not the same thing.
 */
export function seen(entry: JournalEntry, s: Strings): { label: string; person: boolean }[] {
  const journal = s.montage.journal;
  return (entry.labels ?? []).map((mark) => {
    const person = mark.startsWith(PERSON);
    const nth = Number(mark.slice(person ? PERSON.length : ANIMAL.length)) || 1;
    return {
      label: person ? journal.personLabel(nth) : journal.animalLabel(nth),
      person,
    };
  });
}

/** How many people the worker found in a frame, said as the card says it. */
export const peopleCount = (entry: JournalEntry): number | null => entry.details?.people ?? null;

/** The best moments of a clip, in the order it plays. */
export function moments(entry: JournalEntry): { seconds: string; text: string }[] {
  return (entry.details?.moments ?? []).map((one) => ({
    seconds: formatRuntime(one.seconds) ?? '0:00',
    text: one.text,
  }));
}

/** The long description, where the worker wrote one. */
export const toldInFull = (entry: JournalEntry): string | undefined =>
  entry.details?.text || undefined;

/**
 * The stage this journal is about, out of the route's own parameter. A stage this app has no word
 * for is not a stage: the codes are the api's five, and anything else is read as the first of them
 * rather than drawn as a blank screen.
 */
export function codeOf(raw: string | undefined): MontageStageCode {
  return raw === 'analysis' || raw === 'directing' || raw === 'music' || raw === 'assembly'
    ? raw
    : 'prep';
}
