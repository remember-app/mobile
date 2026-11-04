import { request } from './call';
export type MemberRole = 'organizer' | 'contributor' | 'viewer';
export type ContributionStatus = 'not_started' | 'more_coming' | 'done' | 'nothing';
export type Memory = {
  id: string;
  organizer_id: string;
  title: string;
  event_start: string;
  event_end: string | null;
  storage_bytes: string;
  media_count: number;
  removal_media_count?: number | null;
  recent_thumbnail_urls: string[];
  card_thumbnail_urls?: string[];
  cover_media_id: string | null;
  cover_thumbnail_url: string | null;
  montage_count: number;
  created_at: string;
  role: MemberRole;
  member_count: number;
  contributed_member_count: number;
};
export function listMemories(token: string): Promise<Memory[]> {
  return request('/memories', { token });
}
export function createMemory(
  token: string,
  memory: {
    title: string;
    event_start: string;
    event_end?: string;
  },
): Promise<Memory> {
  return request('/memories', { method: 'POST', body: memory, token });
}
export function updateMemory(
  token: string,
  memoryId: string,
  patch: {
    title?: string;
    event_start?: string;
    event_end?: string | null;
    cover_media_id?: string | null;
  },
): Promise<Memory> {
  return request(`/memories/${memoryId}`, { method: 'PATCH', body: patch, token });
}
export function deleteMemory(
  token: string,
  memoryId: string,
): Promise<{
  ok: true;
}> {
  return request(`/memories/${memoryId}`, { method: 'DELETE', token });
}
export function acceptInvite(token: string, inviteToken: string): Promise<Memory> {
  return request('/invites/accept', { method: 'POST', body: { token: inviteToken }, token });
}
