import { request } from './call';
import type { Contact } from './contacts';
export type MusicTrackId =
  | 'bright'
  | 'warm'
  | 'calm'
  | 'night'
  | 'road'
  | 'merry'
  | 'tender'
  | 'dreamy'
  | 'mystery'
  | 'energetic';
export type MontageOrientation = 'landscape' | 'portrait';
export type MontageWishes = {
  target_seconds?: number;
  story_text?: string;
  include_media_ids?: string[];
  exclude_media_ids?: string[];
  music_tracks?: string[];
  music_director?: boolean;
  music_wishes?: Record<string, string>;
  orientation?: MontageOrientation;
};
export type Montage = {
  id: string;
  memory_id: string;
  ordered_by: Contact;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  name: string;
  template: MontageTemplateId | null;
  duration_seconds: number | null;
  size_bytes: string | null;
  params: MontageWishes & {
    music_track_id?: MusicTrackId;
    music_track_key?: string;
    music_note?: string;
  };
  error_text: string | null;
  created_at: string;
  video_url: string | null;
  poster_url: string | null;
  stages?: MontageStep[] | null;
  photos?: number | null;
  videos?: number | null;
  queue?: MontageQueue | null;
  watched_by?: Contact[];
};
export type MontageQueue = {
  ahead: number;
  starts_in_minutes: number;
  estimate_minutes: number | null;
};
export type MontageStep = {
  stage: MontageStageCode;
  state: MontageStage['state'];
};
export function listMontages(token: string, memoryId: string): Promise<Montage[]> {
  return request(`/memories/${memoryId}/montages`, { token });
}
export type MontageTemplateId =
  | 'for_myself'
  | 'quick'
  | 'report'
  | 'short_form'
  | 'parents'
  | 'dopamine';
export type MontageTemplate = {
  id: MontageTemplateId;
  story_text: string;
  target_seconds: number;
  orientation: MontageOrientation;
  music_tracks: string[];
  music_wishes: Record<string, string>;
};
export function listMontageTemplates(token: string, memoryId: string): Promise<MontageTemplate[]> {
  return request<
    (Omit<MontageTemplate, 'music_wishes'> & {
      music_wishes?: Record<string, string> | null;
    })[]
  >(`/memories/${memoryId}/montage-templates`, { token }).then((came) =>
    came.map((one) => ({ ...one, music_wishes: one.music_wishes ?? {} })),
  );
}
export type MontagePreview = {
  photos: number;
  videos: number;
  people: number;
  min_seconds: number;
  max_seconds: number;
  target_seconds: number;
  orientation: MontageOrientation;
  estimate_minutes: number;
};
export function previewMontage(
  token: string,
  memoryId: string,
  wishes: MontageWishes,
): Promise<MontagePreview> {
  return request(`/memories/${memoryId}/montages/preview`, {
    method: 'POST',
    body: wishes,
    token,
  });
}
export function orderMontage(
  token: string,
  memoryId: string,
  order: MontageWishes & {
    name?: string;
    template?: MontageTemplateId;
  },
): Promise<Montage> {
  return request(`/memories/${memoryId}/montages`, { method: 'POST', body: order, token });
}
export function renameMontage(
  token: string,
  memoryId: string,
  montageId: string,
  name: string,
): Promise<Montage> {
  return request(`/memories/${memoryId}/montages/${montageId}`, {
    method: 'PATCH',
    body: { name },
    token,
  });
}
export function markWatched(token: string, memoryId: string, montageId: string): Promise<void> {
  return request(`/memories/${memoryId}/montages/${montageId}/watched`, { method: 'POST', token });
}
export function deleteMontage(token: string, memoryId: string, montageId: string): Promise<void> {
  return request(`/memories/${memoryId}/montages/${montageId}`, { method: 'DELETE', token });
}
export function retryMontage(token: string, memoryId: string, montageId: string): Promise<Montage> {
  return request(`/memories/${memoryId}/montages/${montageId}/retry`, { method: 'POST', token });
}
export const MONTAGE_STAGES = ['prep', 'analysis', 'directing', 'music', 'assembly'] as const;
export type MontageStageCode = (typeof MONTAGE_STAGES)[number];
export type MontageStageOutcome = {
  photos?: number;
  videos?: number;
  photos_done?: number;
  videos_done?: number;
  video_seconds?: number;
  bytes?: number;
  senders?: Record<string, number>;
  described?: number;
  earlier?: number;
  people?: number;
  parts?: {
    title: string;
    from_seconds: number;
    to_seconds: number;
  }[];
  part_titles?: string[];
  frames?: number;
  track?: string[];
  tracks?: string[];
  bpm?: number;
  cut_seconds?: number[];
  cuts?: number;
  seconds?: number;
  steps?: {
    step: AssemblyStepCode;
    state: 'pending' | 'running' | 'done';
  }[];
  percent?: number;
  stopped?: 'no_material' | 'track_unreadable' | 'internal';
};
export const ASSEMBLY_STEPS = ['clips', 'sound', 'cover', 'file'] as const;
export type AssemblyStepCode = (typeof ASSEMBLY_STEPS)[number];
export type MontageStage = {
  stage: MontageStageCode;
  state: 'pending' | 'running' | 'done' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  eta_seconds: number | null;
  done_count: number;
  total_count: number | null;
  outcome: MontageStageOutcome;
  updated_at: string;
  taken_count: number;
  skipped_count: number;
  thought_count: number;
  skipped_by_reason?: Record<string, number>;
  taken_by_part?: Record<string, number>;
};
