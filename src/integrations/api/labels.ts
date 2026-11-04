import type { Label } from '@/models';
import type { Page } from '@/types/api';
import type { LabelId, ProjectId, ProjectItemId } from '@/types/id';

import { query, request } from './client';
import { toLabel, toPage } from './map';
import type { LabelWire, OffsetPageWire } from './wire';

export type NewLabel = {
  name: string;
  colorHex: `#${string}`;
  shared: boolean;
  description?: string | null;
};

export type LabelPatch = {
  name?: string;
  colorHex?: `#${string}`;
  description?: string | null;
};

export function listLabels(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Label>> {
  return request<OffsetPageWire<LabelWire>>(`/v1/projects/${projectId}/labels${query(page)}`, {
    token,
  }).then((wire) => toPage(wire, toLabel));
}

export function createLabel(token: string, projectId: ProjectId, input: NewLabel): Promise<Label> {
  return request<LabelWire>(`/v1/projects/${projectId}/labels`, {
    method: 'POST',
    body: input,
    token,
  }).then(toLabel);
}

export function updateLabel(
  token: string,
  projectId: ProjectId,
  labelId: LabelId,
  patch: LabelPatch,
): Promise<Label> {
  return request<LabelWire>(`/v1/projects/${projectId}/labels/${labelId}`, {
    method: 'PATCH',
    body: patch,
    token,
  }).then(toLabel);
}

export function deleteLabel(
  token: string,
  projectId: ProjectId,
  labelId: LabelId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/labels/${labelId}`, {
    method: 'DELETE',
    token,
  });
}

export function attachLabelItems(
  token: string,
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
): Promise<{ attached: number }> {
  return request(`/v1/projects/${projectId}/labels/${labelId}/items`, {
    method: 'POST',
    body: { itemIds },
    token,
  });
}

export function detachLabelItems(
  token: string,
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
): Promise<{ detached: number }> {
  return request(`/v1/projects/${projectId}/labels/${labelId}/items`, {
    method: 'DELETE',
    body: { itemIds },
    token,
  });
}
