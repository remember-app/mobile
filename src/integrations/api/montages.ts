import type { Montage, MontageTemplate } from '@/models';
import type { Page } from '@/types/api';
import type { MontageId, ProjectId } from '@/types/id';

import { query, request } from './client';
import type { MontageCreateRequest } from './contract';
import { toMontage, toMontageTemplate, toPage } from './map';
import type { MontageTemplateWire, MontageWire, OffsetPageWire } from './wire';

export function listMontages(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Montage>> {
  return request<OffsetPageWire<MontageWire>>(`/v1/projects/${projectId}/montages${query(page)}`, {
    token,
  }).then((wire) => toPage(wire, toMontage));
}

export function getMontage(
  token: string,
  projectId: ProjectId,
  montageId: MontageId,
): Promise<Montage> {
  return request<MontageWire>(`/v1/projects/${projectId}/montages/${montageId}`, {
    token,
  }).then(toMontage);
}

export function createMontage(
  token: string,
  projectId: ProjectId,
  input: MontageCreateRequest,
): Promise<Montage> {
  return request<MontageWire>(`/v1/projects/${projectId}/montages`, {
    method: 'POST',
    body: input,
    token,
  }).then(toMontage);
}

export function listMontageTemplates(
  token: string,
  projectId: ProjectId,
): Promise<MontageTemplate[]> {
  return request<MontageTemplateWire[]>(`/v1/projects/${projectId}/montage-templates`, {
    token,
  }).then((wire) => wire.map(toMontageTemplate));
}
