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
export const STAGE_COUNT = MONTAGE_STAGES.length;
export const stageNumber = (stage: MontageStageCode): number => MONTAGE_STAGES.indexOf(stage) + 1;
export function currentStage<Row extends MontageStep>(stages: readonly Row[]): Row | null {
  const inOrder = [...stages].sort((a, b) => stageNumber(a.stage) - stageNumber(b.stage));
  return (
    inOrder.find((stage) => stage.state === 'running') ??
    inOrder.find((stage) => stage.state === 'failed') ??
    inOrder.filter((stage) => stage.state !== 'pending').pop() ??
    null
  );
}
export const inHand = (entries: readonly JournalEntry[]): JournalEntry | null =>
  entries.find((entry) => entry.media_id !== null) ?? null;
const LAST = 2;
export const lastOfStage = (
  entries: readonly JournalEntry[],
  stage: MontageStageCode,
): JournalEntry[] => entries.filter((entry) => entry.stage === stage).slice(0, LAST);
export function minutesLeft(stages: readonly MontageStage[]): number | null {
  if (stages.some((stage) => stage.state === 'failed')) return null;
  const ahead = stages.filter((stage) => stage.state !== 'done');
  if (!ahead.some((stage) => stage.eta_seconds !== null)) return null;
  const seconds = ahead.reduce((sum, stage) => sum + (stage.eta_seconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}
export function stageMinutes(stage: MontageStage, now: number = Date.now()): number | null {
  if (stage.started_at === null) return null;
  const from = new Date(stage.started_at).getTime();
  const to = stage.finished_at === null ? now : new Date(stage.finished_at).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const minutes = Math.floor((to - from) / 60000);
  return minutes >= 1 ? minutes : null;
}
export function stageLine(
  stage: MontageStage,
  s: Strings,
  now: number = Date.now(),
): string | undefined {
  const { filmScreen, live } = s.montage;
  if (stage.state === 'pending') return filmScreen.notStarted;
  const minutes = stageMinutes(stage, now);
  const spent =
    minutes === null
      ? undefined
      : stage.state === 'running'
        ? live.running(minutes)
        : live.minutes(minutes);
  if (stage.state === 'failed') {
    return filmScreen.stoppedBecause(stoppedWord(stage, s));
  }
  const parts = [
    stage.state === 'running'
      ? (soFar(stage, s) ?? cameOf(stage, s))
      : (cameOf(stage, s) ?? soFar(stage, s)),
    spent,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}
export function stoppedWord(stage: MontageStage | undefined, s: Strings): string {
  const words = s.montage.live.stopped;
  const code = stage?.outcome.stopped;
  return code !== undefined && Object.hasOwn(words, code) ? words[code] : words.other;
}
function cameOf(stage: MontageStage, s: Strings): string | undefined {
  const { live } = s.montage;
  const came = stage.outcome;
  switch (stage.stage) {
    case 'prep': {
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
function soFar(stage: MontageStage, s: Strings): string | undefined {
  return stage.total_count === null || stage.done_count === 0
    ? undefined
    : s.montage.live.soFar(stage.done_count, stage.total_count, s.montage.progress[stage.stage]);
}
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
export function stageStanding(stage: MontageStage | undefined): FilmStageState {
  if (stage === undefined || stage.state === 'pending') return 'waiting';
  return stage.state;
}
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
export function howMade(
  stages: readonly MontageStage[],
  s: Strings,
): {
  figure: number;
  label: string;
}[] {
  const { live } = s.montage;
  const of = (code: MontageStageCode) => stages.find((one) => one.stage === code);
  const three = [
    { figure: of('prep')?.total_count ?? undefined, label: live.watched },
    { figure: of('directing')?.taken_count ?? undefined, label: live.tookIn },
    {
      figure: of('assembly')?.total_count ?? undefined,
      label: live.glued(of('assembly')?.total_count ?? 0),
    },
  ];
  return three.filter(
    (
      tile,
    ): tile is {
      figure: number;
      label: string;
    } => tile.figure !== undefined,
  );
}
export const recordsOf = (stage: MontageStage): number =>
  stage.taken_count + stage.skipped_count + stage.thought_count;
export type Sift = 'all' | 'thoughts' | 'take' | 'skip';
export function sifted(entries: readonly JournalEntry[], sift: Sift): JournalEntry[] {
  if (sift === 'all') return [...entries];
  if (sift === 'thoughts') return entries.filter((entry) => entry.decision === null);
  return entries.filter((entry) => entry.decision === sift);
}
export const takenBefore = (entry: JournalEntry, entries: readonly JournalEntry[]): number =>
  entry.decision !== 'take'
    ? 0
    : entries.filter(
        (one) => one.decision === 'take' && one.media_id === entry.media_id && one.id < entry.id,
      ).length;
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
