import type { Song, SongWithUrl } from '@/models';
import type { Page } from '@/types/api';
import type { MediaId, ProjectId, SongId } from '@/types/id';

import { query, request } from './client';
import { toPage, toSong, toSongWithUrl } from './map';
import type { OffsetPageWire, SongWire, SongWithUrlWire } from './wire';

export function listLibrarySongs(
  token: string,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Song>> {
  return request<OffsetPageWire<SongWire>>(`/v1/songs/library${query(page)}`, { token }).then(
    (wire) => toPage(wire, toSong),
  );
}

export function listProjectSongs(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Song>> {
  return request<OffsetPageWire<SongWire>>(`/v1/projects/${projectId}/songs${query(page)}`, {
    token,
  }).then((wire) => toPage(wire, toSong));
}

export function createSong(
  token: string,
  projectId: ProjectId,
  input: {
    name: string;
    author: string;
    mediaId: MediaId;
    coverId?: MediaId | null;
    description?: string | null;
  },
): Promise<Song> {
  return request<SongWire>(`/v1/projects/${projectId}/songs`, {
    method: 'POST',
    body: input,
    token,
  }).then(toSong);
}

export function getSong(token: string, songId: SongId): Promise<SongWithUrl> {
  return request<SongWithUrlWire>(`/v1/songs/${songId}`, { token }).then(toSongWithUrl);
}

export function deleteSong(
  token: string,
  projectId: ProjectId,
  songId: SongId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/songs/${songId}`, { method: 'DELETE', token });
}
