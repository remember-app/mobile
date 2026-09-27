import { request } from './call';

/** The memories themselves: the list of one's own, and the life of one. */
/** Where the caller stands in a memory. Duplicated from the api, same reason as `User`. */
export type MemberRole = 'organizer' | 'contributor' | 'viewer';

/**
 * How much material is still owed (doc-06). The first two are the api's own to write — an invite
 * leaves `not_started` behind and the first upload that lands moves it to `more_coming` — and the
 * last two are the member's own word. It grants and denies nothing: «статус не режет права».
 */
export type ContributionStatus = 'not_started' | 'more_coming' | 'done' | 'nothing';

/**
 * A memory as both /memories routes return it: the row plus the caller's own role.
 * Timestamps arrive as RFC 3339 strings (JSON has no date), and `storage_bytes` as a
 * string because it is a bigint server-side. Duplicated here on purpose: no shared types package.
 */
export type Memory = {
  id: string;
  organizer_id: string;
  title: string;
  event_start: string;
  event_end: string | null;
  storage_bytes: string;
  media_count: number;
  /**
   * How many frames deleting it would actually take — the hidden ones too, which `media_count`
   * leaves out. Sent to the organizer alone, since nobody else can delete it; missing for everybody
   * else.
   */
  removal_media_count?: number;
  /**
   * Up to four signed thumbnail urls, most recently captured first — the frames the card draws.
   * Only ready media has one, so this is a tail of `media_count` and never all of it; empty
   * while nothing is processed yet, or when the api has no bucket configured.
   */
  recent_thumbnail_urls: string[];
  /**
   * The frame the organizer chose as this memory's face (spec 10.8.3), and the signed link to its
   * preview — signed and living exactly as long as the ones in the tail above. Both are `null`
   * until somebody picks one, and then the card draws what it drew before the cover existed. The
   * tail does not depend on it either way; which of the two a card draws is the client's own call.
   */
  cover_media_id: string | null;
  cover_thumbnail_url: string | null;
  montage_count: number;
  created_at: string;
  role: MemberRole;
  /** How many people are in it, the organizer included. */
  member_count: number;
  /**
   * How many of them have already brought their material — the two terminal standings, «всё
   * загрузил» and «ждать нечего» (doc-06, `hasShared` below). This is «7 из 9 уже скинули свои
   * кадры» on the card, counted by the listing itself so the main screen makes no request per card.
   */
  contributed_member_count: number;
};

/** Every memory the caller organizes or belongs to, newest event first. 401 once the token dies. */
export function listMemories(token: string): Promise<Memory[]> {
  return request('/memories', { token });
}

/**
 * Create one, as its organizer. Both dates must be RFC 3339 *with an offset* — a bare
 * `2026-09-02` is a 400, as is a blank title or an end before the start.
 */
export function createMemory(
  token: string,
  memory: { title: string; event_start: string; event_end?: string },
): Promise<Memory> {
  return request('/memories', { method: 'POST', body: memory, token });
}

/**
 * Edit one — the organizer's alone (403 for anybody else), and the one route behind the pencil on
 * the settings screen: the name, the days and the cover are three things changed in one press
 * (spec 10.8.3). Only what was touched goes up; an empty body is a 400, because answering 200 to
 * «change nothing» would claim something changed. The dates keep the same rules creating one has —
 * RFC 3339 with an offset, and a window checked as the row will stand, not as it was sent.
 *
 * `cover_media_id` is a ready frame of this same memory, and `null` takes the cover off. A frame of
 * another memory, one the worker has not finished, and an id behind which there is nothing are one
 * 404 between them.
 *
 * Answers with the whole card — counters, tail of frames and cover — so the screen replaces what it
 * holds instead of reading the listing a second time.
 */
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

/**
 * Delete one, whole. The organizer's alone — everybody else is a 403, and a stranger the usual 404
 * — and there is no undoing it: the frames, the movies, their journals, the labels and the files in
 * storage go with it, and everybody else's copy of it leaves their main screen (doc-01).
 */
export function deleteMemory(token: string, memoryId: string): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}`, { method: 'DELETE', token });
}

/** A roster row: the three public fields the api hands out, plus where that person stands. */

/**
 * Join by invite link. Answers with the memory as its new member sees it — the same shape
 * `/memories` hands out, so the screen it lands on has nothing extra to fetch. 404 once the
 * link has been rotated, and being a member already is a plain 200 that changes no role.
 */
export function acceptInvite(token: string, inviteToken: string): Promise<Memory> {
  return request('/invites/accept', { method: 'POST', body: { token: inviteToken }, token });
}
