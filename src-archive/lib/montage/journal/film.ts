import type { Montage, MontageStage, MontageStageCode } from '@/api';
import { formatRuntime, formatTime } from '@/lib/dates';
import type { Strings } from '@/strings';
import { currentStage, minutesLeft, STAGE_COUNT, stageNumber } from './stages';
export type FilmState = 'queued' | 'building' | 'ready' | 'stopped' | 'offline' | 'gone';
export function filmState(
  montage: Montage | null,
  journal: {
    status: Montage['status'] | null;
    refused: boolean;
    offline: boolean;
  },
): FilmState {
  if (journal.refused) return 'gone';
  const status = journal.status ?? montage?.status ?? null;
  if (status === 'failed') return 'stopped';
  if (status === 'ready') return 'ready';
  if (status === 'queued') return 'queued';
  return journal.offline ? 'offline' : 'building';
}
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
  if (held === null) return null;
  const fell = held.state === 'failed';
  return {
    stage: held,
    code: held.stage,
    name: s.montage.stage[held.stage],
    stageOf: s.montage.live.stageOf(stageNumber(held.stage), STAGE_COUNT),
    minutes: fell ? null : minutesLeft(stages),
  };
}
export function orderedTo(
  montage: Montage,
  track: string | undefined,
  bpm: number | null,
  s: Strings,
): {
  frames: {
    figure: string;
    note: string;
  } | null;
  length: string | null;
  music: {
    figure: string;
    note: string | null;
  } | null;
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
export function minutesSince(
  entries: readonly {
    created_at: string;
  }[],
  now: number = Date.now(),
): number | null {
  const freshest = entries[0]?.created_at;
  if (freshest === undefined) return null;
  const then = new Date(freshest).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(1, Math.floor((now - then) / 60000));
}
export function makingTakes(stages: readonly MontageStage[]): number | null {
  if (!stages.some((stage) => stage.eta_seconds !== null)) return null;
  const seconds = stages.reduce((sum, stage) => sum + (stage.eta_seconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}
export const acceptedAt = (montage: Montage, s: Strings): string =>
  s.montage.filmScreen.acceptedAt(formatTime(montage.created_at));
