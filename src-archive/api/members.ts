import { request, say } from './call';
import type { Contact } from './contacts';
import type { ContributionStatus, MemberRole } from './memories';
export type Member = Contact & {
  role: MemberRole;
  contribution_status: ContributionStatus | null;
  media_count: number;
  removal_media_count?: number | null;
};
export const memberName = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.name ?? member?.username ?? say().memory.someone;
export const memberHandle = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.username && member.username !== memberName(member) ? `@${member.username}` : undefined;
export type InviteRole = Exclude<MemberRole, 'organizer'>;
export const mayContribute = (role: MemberRole | null) =>
  role === 'organizer' || role === 'contributor';
export const hasShared = (status: ContributionStatus | null) =>
  status === 'done' || status === 'nothing';
export type Invite = {
  token: string;
  role: InviteRole;
};
export function listMembers(token: string, memoryId: string): Promise<Member[]> {
  return request(`/memories/${memoryId}/members`, { token });
}
export function inviteByUsername(
  token: string,
  memoryId: string,
  username: string,
  role: InviteRole,
): Promise<Member> {
  return request(`/memories/${memoryId}/members`, {
    method: 'POST',
    body: { username, role },
    token,
  });
}
export function fetchInvite(token: string, memoryId: string): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { token });
}
export function rotateInvite(token: string, memoryId: string, role: InviteRole): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { method: 'POST', body: { role }, token });
}
export function removeMember(
  token: string,
  memoryId: string,
  userId: string,
): Promise<{
  ok: true;
}> {
  return request(`/memories/${memoryId}/members/${userId}`, { method: 'DELETE', token });
}
export function setContributionStatus(
  token: string,
  memoryId: string,
  status: 'more_coming' | 'done' | 'nothing',
): Promise<{
  status: ContributionStatus;
}> {
  return request(`/memories/${memoryId}/contribution-status`, {
    method: 'POST',
    body: { status },
    token,
  });
}
