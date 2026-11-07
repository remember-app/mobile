import type { Consumable } from '@/models';
import type { ProjectId } from '@/types/id';

import { request } from './client';
import { toConsumable } from './map';
import type { DonateConsumablesWire } from './wire';

export type ConsumableShare = {
  tokens?: number;
  storageBytes?: number;
};

export function shareConsumables(
  token: string,
  projectId: ProjectId,
  share: ConsumableShare,
): Promise<{ project: Consumable; member: Consumable }> {
  return request<DonateConsumablesWire>(`/v1/projects/${projectId}/consumables`, {
    method: 'POST',
    body: share,
    token,
  }).then((wire) => ({
    project: toConsumable(wire.project),
    member: toConsumable(wire.member),
  }));
}
