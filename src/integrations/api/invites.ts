import type { AppInvite, JoinResult, ProjectInvite, Role } from '@/models';
import type { ProjectId } from '@/types/id';

import { request } from './client';
import { toAppInvite, toJoinResult, toProjectInvite } from './map';
import type { AppInviteWire, JoinResultWire, ProjectInviteWire } from './wire';

export function getProjectInvite(token: string, projectId: ProjectId): Promise<ProjectInvite> {
  return request<ProjectInviteWire>(`/v1/projects/${projectId}/invite`, { token }).then(
    toProjectInvite,
  );
}

export function rotateProjectInvite(
  token: string,
  projectId: ProjectId,
  input: { role?: Role; maxUses?: number | null } = {},
): Promise<ProjectInvite> {
  return request<ProjectInviteWire>(`/v1/projects/${projectId}/invite`, {
    method: 'POST',
    body: input,
    token,
  }).then(toProjectInvite);
}

export type NewAppInvite = {
  maxUses?: number | null;
  expiresAt?: string | null;
  senderReward?: { tokens?: number; storageBytes?: number };
  inviteeReward?: { tokens?: number; storageBytes?: number };
};

export function createAppInvite(token: string, input: NewAppInvite = {}): Promise<AppInvite> {
  return request<AppInviteWire>('/v1/invites/app', { method: 'POST', body: input, token }).then(
    toAppInvite,
  );
}

export function acceptInvite(token: string, inviteToken: string): Promise<JoinResult> {
  return request<JoinResultWire>('/v1/invites/accept', {
    method: 'POST',
    body: { token: inviteToken },
    token,
  }).then(toJoinResult);
}
