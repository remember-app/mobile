import { request } from './call';
import type { Contact } from './contacts';
import type { MediaItem } from './media';
import type { Montage, MontageStage, MontageStageCode } from './montage';
export type JournalEntry = {
  id: number;
  stage: MontageStageCode;
  media_id: string | null;
  thought: string | null;
  decision: 'take' | 'skip' | null;
  reason: string | null;
  series_size: number | null;
  story_part: number | null;
  story_part_title: string | null;
  source_from_seconds: number | null;
  source_to_seconds: number | null;
  labels: string[] | null;
  details: JournalDetails | null;
  created_at: string;
};
export type JournalDetails = {
  earlier?: boolean;
  people?: number;
  place?: string;
  light?: string;
  mood?: string;
  shot?: string;
  camera?: string;
  speech?: string;
  moments?: {
    seconds: number;
    text: string;
  }[];
  text?: string;
  music?: number;
  live?: number;
};
export type JournalFile = {
  id: string;
  kind: MediaItem['kind'];
  uploaded_by: string;
  file_name: string | null;
  captured_at: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  places: {
    start_seconds: number;
    duration_seconds: number;
  }[];
};
export type Viewer = Pick<Contact, 'id' | 'username'>;
export type MontageJournal = {
  montage: {
    id: string;
    status: Montage['status'];
  };
  stages: MontageStage[];
  entries: JournalEntry[];
  has_more: boolean;
  files: JournalFile[];
  viewers: Viewer[];
};
export type JournalQuery = {
  after?: number;
  before?: number;
  stage?: MontageStageCode;
};
export function fetchJournal(
  token: string,
  memoryId: string,
  montageId: string,
  query: JournalQuery = {},
): Promise<MontageJournal> {
  const asked = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return request(`/memories/${memoryId}/montages/${montageId}/journal${asked ? `?${asked}` : ''}`, {
    token,
  });
}
