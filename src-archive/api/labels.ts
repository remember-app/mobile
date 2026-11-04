import { request } from './call';
export type Label = {
  id: string;
  title: string;
  color: number;
  shared: boolean;
  mine: boolean;
  can_edit: boolean;
  can_add_media: boolean;
  media_count: number;
};
export function listLabels(token: string, memoryId: string): Promise<Label[]> {
  return request(`/memories/${memoryId}/labels`, { token });
}
export function createLabel(
  token: string,
  memoryId: string,
  label: {
    title: string;
    color: number;
    shared: boolean;
    media_ids?: string[];
  },
): Promise<Label> {
  return request(`/memories/${memoryId}/labels`, { method: 'POST', body: label, token });
}
export function updateLabel(
  token: string,
  memoryId: string,
  labelId: string,
  patch: {
    title?: string;
    color?: number;
  },
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}`, {
    method: 'PATCH',
    body: patch,
    token,
  });
}
export function deleteLabel(
  token: string,
  memoryId: string,
  labelId: string,
): Promise<{
  ok: true;
}> {
  return request(`/memories/${memoryId}/labels/${labelId}`, { method: 'DELETE', token });
}
export function addLabelMedia(
  token: string,
  memoryId: string,
  labelId: string,
  mediaIds: string[],
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}/media`, {
    method: 'POST',
    body: { media_ids: mediaIds },
    token,
  });
}
export function removeLabelMedia(
  token: string,
  memoryId: string,
  labelId: string,
  mediaIds: string[],
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}/media`, {
    method: 'DELETE',
    body: { media_ids: mediaIds },
    token,
  });
}
