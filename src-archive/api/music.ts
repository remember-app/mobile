import { request } from './call';
import type { UploadPlan } from './media';
import type { MusicTrackId } from './montage';
export function startMusicUpload(
  token: string,
  memoryId: string,
  sizeBytes: number,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/music`, {
    method: 'POST',
    body: { size_bytes: sizeBytes },
    token,
  });
}
export function finishMusicUpload(
  token: string,
  memoryId: string,
  trackId: string,
  parts: {
    part_number: number;
    etag: string;
  }[],
): Promise<{
  id: string;
  status: string;
  key: string;
}> {
  return request(`/memories/${memoryId}/music/${trackId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60000,
  });
}
export function previewMusicTrack(
  token: string,
  trackId: MusicTrackId,
): Promise<{
  url: string;
}> {
  return request(`/music/tracks/${trackId}`, { token });
}
