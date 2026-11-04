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
export type StageStanding = 'waiting' | 'running' | 'done' | 'failed';
export function standing(stage: MontageStage | undefined): StageStanding {
  if (stage === undefined || stage.state === 'pending') return 'waiting';
  return stage.state;
}
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
export function counted(
  stage: MontageStage | undefined,
  s: Strings,
): {
  figure: string;
  of: string;
  word: string;
  share: number;
} | null {
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
export function prepared(
  stage: MontageStage | undefined,
  kind: 'photos' | 'videos',
): {
  label: string;
  done: number;
  of: number;
  share: number;
} | null {
  const came = stage?.outcome;
  if (!came) return null;
  const of = came[kind];
  const done = kind === 'photos' ? came.photos_done : came.videos_done;
  if (of === undefined || done === undefined) return null;
  return { label: kind, done, of, share: of === 0 ? 0 : done / of };
}
export function weighed(bytes: number | undefined): {
  figure: string;
  unit: 'mb' | 'gb';
} | null {
  if (bytes === undefined || bytes < 1) return null;
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) {
    return { figure: mb < 10 ? mb.toFixed(2) : mb.toFixed(1), unit: 'mb' };
  }
  const gb = mb / 1024;
  return { figure: gb < 10 ? gb.toFixed(2) : gb.toFixed(1), unit: 'gb' };
}
export function senders(stage: MontageStage | undefined): {
  id: string;
  count: number;
  share: number;
}[] {
  const held = stage?.outcome.senders;
  if (!held) return [];
  const rows = Object.entries(held)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);
  const most = rows[0]?.[1] ?? 0;
  return rows.map(([id, count]) => ({ id, count, share: most === 0 ? 0 : count / most }));
}
export function parts(stage: MontageStage | undefined): {
  at: number;
  title: string;
  from: string;
  to: string;
  taken: number | null;
  empty: boolean;
}[] {
  const list = stage?.outcome.parts;
  if (!list) return [];
  const byPart = stage?.taken_by_part ?? {};
  return list.map((part, i) => {
    const from = formatRuntime(part.from_seconds) ?? '0:00';
    const to = formatRuntime(part.to_seconds) ?? from;
    const taken = byPart[String(i + 1)] ?? null;
    return { at: i + 1, title: part.title, from, to, taken, empty: taken === null };
  });
}
export function partLine(part: ReturnType<typeof parts>[number], s: Strings): string {
  const journal = s.montage.journal;
  return part.empty
    ? journal.partNotYet
    : `${journal.frames(part.taken ?? 0)} · ${part.from}–${part.to}`;
}
export function passes(
  stage: MontageStage | undefined,
  s: Strings,
): {
  total: number;
  reasons: {
    reason: string;
    label: string;
    count: number;
  }[];
} | null {
  if (!stage || stage.skipped_count === 0) return null;
  const byReason = stage.skipped_by_reason ?? {};
  return {
    total: stage.skipped_count,
    reasons: Object.entries(byReason)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({
        reason,
        label:
          s.montage.live.reason[reason as keyof typeof s.montage.live.reason] ??
          s.montage.live.reason.other,
        count,
      })),
  };
}
export function shares(entry: JournalEntry | undefined): {
  music: number | null;
  live: number | null;
} | null {
  const details = entry?.details;
  if (!details || (details.music === undefined && details.live === undefined)) return null;
  const one = (value: number | undefined) =>
    value === undefined ? null : Math.max(0, Math.min(1, value));
  return { music: one(details.music), live: one(details.live) };
}
export function cuts(
  stage: MontageStage | undefined,
  lengthSeconds: number | null,
):
  | {
      at: number;
      share: number;
    }[]
  | null {
  const list = stage?.outcome.cut_seconds;
  if (!list || lengthSeconds === null || lengthSeconds <= 0) return null;
  return list
    .filter((at) => at >= 0 && at <= lengthSeconds)
    .map((at) => ({ at, share: at / lengthSeconds }));
}
export function filmLength(
  assembly: MontageStage | undefined,
  target: number | null | undefined,
): number | null {
  return assembly?.outcome.seconds ?? target ?? null;
}
export function assemblyTiles(
  stage: MontageStage | undefined,
  s: Strings,
): {
  figure: string;
  label: string;
}[] {
  const journal = s.montage.journal;
  const tiles: {
    figure: string;
    label: string;
  }[] = [];
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
export function assemblyProgress(
  stage: MontageStage | undefined,
  s: Strings,
): {
  percent: number;
  step: string | undefined;
} | null {
  const percent = stage?.outcome.percent;
  if (percent === undefined) return null;
  const running = stage?.outcome.steps?.find((one) => one.state === 'running');
  return {
    percent: Math.max(0, Math.min(100, percent)),
    step: running ? s.montage.journal.steps[running.step] : undefined,
  };
}
export function assemblySteps(
  stage: MontageStage | undefined,
  s: Strings,
): {
  step: string;
  label: string;
  state: 'pending' | 'running' | 'done';
}[] {
  return (stage?.outcome.steps ?? []).map((one) => ({
    step: one.step,
    label: s.montage.journal.steps[one.step],
    state: one.state,
  }));
}
export const framed = (entries: readonly JournalEntry[]): JournalEntry[] =>
  entries.filter((entry) => entry.media_id !== null);
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
export function describedFields(
  entry: JournalEntry,
  s: Strings,
): {
  label: string;
  value: string;
}[] {
  const details = entry.details;
  if (!details) return [];
  return DESCRIBED.flatMap(([key, word]) => {
    const value = details[key];
    return typeof value === 'string' && value !== ''
      ? [{ label: String(s.montage.journal[word]), value }]
      : [];
  });
}
const PERSON = 'человек-';
const ANIMAL = 'животное-';
export function seen(
  entry: JournalEntry,
  s: Strings,
): {
  label: string;
  person: boolean;
}[] {
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
export const peopleCount = (entry: JournalEntry): number | null => entry.details?.people ?? null;
export function moments(entry: JournalEntry): {
  seconds: string;
  text: string;
}[] {
  return (entry.details?.moments ?? []).map((one) => ({
    seconds: formatRuntime(one.seconds) ?? '0:00',
    text: one.text,
  }));
}
export const toldInFull = (entry: JournalEntry): string | undefined =>
  entry.details?.text || undefined;
export function codeOf(raw: string | undefined): MontageStageCode {
  return raw === 'analysis' || raw === 'directing' || raw === 'music' || raw === 'assembly'
    ? raw
    : 'prep';
}
