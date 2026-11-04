import { request } from './call';
import type { Contact } from './contacts';
import type { Label } from './labels';
export type FrameComment = {
  id: string;
  body: string;
  created_at: string;
  author: Contact;
  mine: boolean;
};
export type UploadPlan = {
  id: string;
  status: string;
  upload: {
    key: string;
    upload_id: string;
    part_size: number;
    parts: {
      part_number: number;
      url: string;
    }[];
    expires_at: string;
  };
};
export type UploadIntent = {
  kind: 'photo' | 'video';
  size_bytes: number;
  captured_at?: string | null;
  duration_seconds?: number | null;
  file_name?: string;
};
export function startUpload(
  token: string,
  memoryId: string,
  file: UploadIntent,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media`, { method: 'POST', body: file, token });
}
export function refreshUpload(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media/${mediaId}/upload`, { token });
}
export function finishUpload(
  token: string,
  memoryId: string,
  mediaId: string,
  parts: {
    part_number: number;
    etag: string;
  }[],
): Promise<{
  id: string;
  status: string;
  first_upload: boolean;
}> {
  return request(`/memories/${memoryId}/media/${mediaId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60000,
  });
}
export function reportUploadFailure(report: Record<string, string>): Promise<unknown> {
  return request(`/health?${new URLSearchParams(report)}`);
}
export type MediaItem = {
  id: string;
  kind: 'photo' | 'video';
  status: 'processing' | 'ready' | 'failed';
  uploaded_by: string;
  hidden: boolean;
  size_bytes: string;
  captured_at: string | null;
  width: number | null;
  height: number | null;
  orientation: 'landscape' | 'portrait' | 'square' | null;
  duration_seconds: number | null;
  created_at: string;
  label_ids: string[];
  thumbnail_url: string | null;
  preview_url: string | null;
  screening_rejected: boolean | null;
  screening_reason: string | null;
};
export async function listMedia(
  token: string,
  memoryId: string,
  {
    hidden = false,
  }: {
    hidden?: boolean;
  } = {},
): Promise<MediaItem[]> {
  const all = await request<MediaItem[]>(`/memories/${memoryId}/media`, { token });
  return hidden ? all : all.filter((item) => !item.hidden);
}
export function analyzeMemory(
  token: string,
  memoryId: string,
): Promise<{
  status: 'queued' | 'running';
}> {
  return request(`/memories/${memoryId}/analyze`, { method: 'POST', token });
}
export type MediaEdit = {
  hidden?: boolean;
  captured_at?: string;
} & (
  | {
      latitude?: undefined;
      longitude?: undefined;
    }
  | {
      latitude: number | null;
      longitude: number | null;
    }
);
export function editMedia(
  token: string,
  memoryId: string,
  mediaId: string,
  edit: MediaEdit,
): Promise<unknown> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { method: 'PATCH', body: edit, token });
}
export type FrameInfo = {
  id: string;
  file_name?: string;
  size_bytes: string;
  captured_at: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
  camera_model: string | null;
  focal_length_mm: number | null;
  aperture: number | null;
  iso: number | null;
  exposure_ev: number | null;
  shutter: string | null;
  latitude: number | null;
  longitude: number | null;
  uploaded_by: Contact & {
    media_count: number;
  };
  montages: {
    id: string;
    duration_seconds: number | null;
    start_seconds: number;
  }[];
  labels: Label[];
  comments?: FrameComment[];
};
export function fetchFrameInfo(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<FrameInfo> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { token });
}
export function addFrameComment(
  token: string,
  memoryId: string,
  mediaId: string,
  body: string,
): Promise<FrameComment> {
  return request(`/memories/${memoryId}/media/${mediaId}/comments`, {
    method: 'POST',
    body: { body },
    token,
  });
}
export function deleteFrameComment(
  token: string,
  memoryId: string,
  mediaId: string,
  commentId: string,
): Promise<{
  ok: true;
}> {
  return request(`/memories/${memoryId}/media/${mediaId}/comments/${commentId}`, {
    method: 'DELETE',
    token,
  });
}
export function downloadMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{
  url: string;
}> {
  return request(`/memories/${memoryId}/media/${mediaId}/download`, { token });
}
export type Original = {
  id: string;
  kind: MediaItem['kind'];
  url: string;
};
export function downloadAllMedia(token: string, memoryId: string): Promise<Original[]> {
  return request(`/memories/${memoryId}/media/download`, { token, timeout: 60000 });
}
export function deleteMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{
  ok: true;
}> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { method: 'DELETE', token });
}
