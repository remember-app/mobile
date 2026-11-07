import type { Contribution, Member, Role } from '@/models';
import type { Page } from '@/types/api';
import type { ProjectId, UserId } from '@/types/id';

import { query, request } from './client';
import { toMember, toPage } from './map';
import type { ContributionWire, MemberWire, OffsetPageWire } from './wire';

export function listMembers(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Member>> {
  return request<OffsetPageWire<MemberWire>>(`/v1/projects/${projectId}/members${query(page)}`, {
    token,
  }).then((wire) => toPage(wire, toMember));
}

export function addMember(
  token: string,
  projectId: ProjectId,
  input: { username: string; role: Role },
): Promise<Member> {
  return request<MemberWire>(`/v1/projects/${projectId}/members`, {
    method: 'POST',
    body: input,
    token,
  }).then(toMember);
}

export function removeMember(
  token: string,
  projectId: ProjectId,
  userId: UserId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/members/${userId}`, { method: 'DELETE', token });
}

export function setContribution(
  token: string,
  projectId: ProjectId,
  status: Contribution,
): Promise<Contribution> {
  return request<{ status: ContributionWire }>(`/v1/projects/${projectId}/contribution`, {
    method: 'POST',
    body: { status },
    token,
  }).then((wire) => wire.status);
}
