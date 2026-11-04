import type { DownloadLink, Item, Media } from '@/models';
import type { CursorPage } from '@/types/api';
import type { MediaId, ProjectId, ProjectItemId } from '@/types/id';

import { query, request } from './client';
import { toCursorPage, toItem, toMedia } from './map';
import type { CursorPageWire, DownloadLinksWire, ItemWire, MediaWire } from './wire';

export function listGallery(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; cursor?: string } = {},
): Promise<CursorPage<Item>> {
  return request<CursorPageWire<ItemWire>>(`/v1/projects/${projectId}/gallery${query(page)}`, {
    token,
  }).then((wire) => toCursorPage(wire, toItem));
}

export function getItem(token: string, projectId: ProjectId, itemId: ProjectItemId): Promise<Item> {
  return request<ItemWire>(`/v1/projects/${projectId}/items/${itemId}`, { token }).then(toItem);
}

export function downloadLinks(
  token: string,
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<DownloadLink[]> {
  return request<DownloadLinksWire>(`/v1/projects/${projectId}/download-links`, {
    method: 'POST',
    body: { itemIds },
    token,
  }).then((wire) => wire.items);
}

export type MediaPatch =
  | { capturedAt?: string | null }
  | { capturedAt?: string | null; latitude: number | null; longitude: number | null };

export function updateMedia(
  token: string,
  projectId: ProjectId,
  mediaId: MediaId,
  patch: MediaPatch,
): Promise<Media> {
  return request<MediaWire>(`/v1/projects/${projectId}/media/${mediaId}`, {
    method: 'PATCH',
    body: patch,
    token,
  }).then(toMedia);
}

export function deleteMedia(
  token: string,
  projectId: ProjectId,
  mediaId: MediaId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/media/${mediaId}`, { method: 'DELETE', token });
}

export function updateItemDescription(
  token: string,
  projectId: ProjectId,
  itemId: ProjectItemId,
  description: string | null,
): Promise<Item> {
  return request<ItemWire>(`/v1/projects/${projectId}/items/${itemId}`, {
    method: 'PATCH',
    body: { description },
    token,
  }).then(toItem);
}
