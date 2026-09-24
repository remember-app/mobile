import { request, say } from './call';
import type { Contact } from './contacts';
import type { ContributionStatus, MemberRole } from './memories';

/** Who is in a memory, on what footing, and how they got there. */
/** A roster row: the three public fields the api hands out, plus where that person stands. */
export type Member = Contact & {
  role: MemberRole;
  /**
   * `null` for a `viewer` and for nobody else: they were never asked to bring anything, so «ничего
   * не загрузил» over their name would be a reproach for work they were not given. A null, not a
   * missing key — one shape of row for everybody.
   */
  contribution_status: ContributionStatus | null;
  /**
   * How many frames that person brought *to this memory*. Counted by the api off the same records
   * the gallery lists (TASK-190), so the figure on the roster and the one in the gallery agree —
   * this screen used to read the whole gallery to count it itself.
   */
  media_count: number;
};

/**
 * What a person is called on screen: the name they gave, else the username they claimed, else the
 * word for a stranger. One copy, for the reason `mayContribute` has one — the roster names people
 * and so does every open frame, and the two must say the same thing about the same person. `null`
 * is «not on the roster», which a frame from somebody who has since left the memory hits.
 */

/**
 * What a person is called on screen: the name they gave, else the username they claimed, else the
 * word for a stranger. One copy, for the reason `mayContribute` has one — the roster names people
 * and so does every open frame, and the two must say the same thing about the same person. `null`
 * is «not on the roster», which a frame from somebody who has since left the memory hits.
 */
export const memberName = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.name ?? member?.username ?? say().memory.someone;

/**
 * The `@username` written under that name — and nothing at all when the username is already the
 * name above it, because everybody who signed in by email is called by their username and printing
 * it twice spends a line saying nothing. The other half of `memberName`, and here beside it for the
 * same reason: the roster row and the profile head both draw this pair, and the day the rule
 * changes it has to change once.
 */

/**
 * The `@username` written under that name — and nothing at all when the username is already the
 * name above it, because everybody who signed in by email is called by their username and printing
 * it twice spends a line saying nothing. The other half of `memberName`, and here beside it for the
 * same reason: the roster row and the profile head both draw this pair, and the day the rule
 * changes it has to change once.
 */
export const memberHandle = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.username && member.username !== memberName(member) ? `@${member.username}` : undefined;

/** What may actually be granted. Never `organizer`: a memory has exactly one, its creator. */

/** What may actually be granted. Never `organizer`: a memory has exactly one, its creator. */
export type InviteRole = Exclude<MemberRole, 'organizer'>;

/**
 * «Добавление» and up — the matrix row that governs both bringing material and bringing people
 * (architecture.md, «Проверка прав»). One copy, because two screens gate buttons on it and the
 * one that drifted would be the one nobody noticed. The api is the authority either way; this
 * only decides whether a button is drawn.
 */

/**
 * «Добавление» and up — the matrix row that governs both bringing material and bringing people
 * (architecture.md, «Проверка прав»). One copy, because two screens gate buttons on it and the
 * one that drifted would be the one nobody noticed. The api is the authority either way; this
 * only decides whether a button is drawn.
 */
export const mayContribute = (role: MemberRole | null) =>
  role === 'organizer' || role === 'contributor';

/**
 * Whether that person is somebody the memory is still waiting on (doc-06). Both terminal standings
 * count as brought — «всё загрузил» and «ждать нечего» are two different answers to the same
 * question and either one ends it — while the two before them, never started and still adding, are
 * both material still owed. One copy for the reason `mayContribute` has one: the roster's «7 из 9
 * скинули» and the card's line on the main screen are one rule, and the api counts its own tally
 * (`contributed_member_count`) by the very same one.
 */

/**
 * Whether that person is somebody the memory is still waiting on (doc-06). Both terminal standings
 * count as brought — «всё загрузил» and «ждать нечего» are two different answers to the same
 * question and either one ends it — while the two before them, never started and still adding, are
 * both material still owed. One copy for the reason `mayContribute` has one: the roster's «7 из 9
 * скинули» and the card's line on the main screen are one rule, and the api counts its own tally
 * (`contributed_member_count`) by the very same one.
 */
export const hasShared = (status: ContributionStatus | null) =>
  status === 'done' || status === 'nothing';

/** The one live invite link of a memory: the raw token and the level following it grants. */

/** The one live invite link of a memory: the raw token and the level following it grants. */
export type Invite = { token: string; role: InviteRole };

/** Everyone in a memory, in the order they joined. Any member may read it, a viewer included. */

/** Everyone in a memory, in the order they joined. Any member may read it, a viewer included. */
export function listMembers(token: string, memoryId: string): Promise<Member[]> {
  return request(`/memories/${memoryId}/members`, { token });
}

/**
 * Add somebody by their exact username. 404 when nobody holds it, 403 when the caller is a
 * viewer. Re-adding an existing member is a plain 200 that answers with the role they already
 * had — so «added» and «was already in» can only be told apart against the roster on screen.
 */

/**
 * Add somebody by their exact username. 404 when nobody holds it, 403 when the caller is a
 * viewer. Re-adding an existing member is a plain 200 that answers with the role they already
 * had — so «added» and «was already in» can only be told apart against the roster on screen.
 */
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

/** The memory's live link, minted on the first ask rather than at creation. 403 for a viewer. */

/** The memory's live link, minted on the first ask rather than at creation. 403 for a viewer. */
export function fetchInvite(token: string, memoryId: string): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { token });
}

/** Revoke the live link and mint a fresh one; the old token stops opening anything. */

/** Revoke the live link and mint a fresh one; the old token stops opening anything. */
export function rotateInvite(token: string, memoryId: string, role: InviteRole): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { method: 'POST', body: { role }, token });
}

/**
 * Drop a membership: the organizer showing anyone else out, or anybody walking out on their
 * own id. 409 when the organizer aims at themselves — the role is never handed over in MVP.
 */

/**
 * Drop a membership: the organizer showing anyone else out, or anybody walking out on their
 * own id. 409 when the organizer aims at themselves — the role is never handed over in MVP.
 */
export function removeMember(
  token: string,
  memoryId: string,
  userId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/members/${userId}`, { method: 'DELETE', token });
}

/**
 * The caller's own word about their material: «ещё будет», «это всё» or «ждать нечего». Three of the
 * four, in any order and as often as they like — `not_started` is the only one the api keeps to
 * itself, since it is what an invite leaves behind and asking for it back says nothing. So «всё
 * загрузил» is never a door that shuts (doc-06). `viewer` is the one role refused (403), and nobody
 * is waiting on them anyway: they were never asked to bring anything and are counted in nothing.
 * There is no `:userId` in the route because a status is never set on somebody else.
 */

/**
 * The caller's own word about their material: «ещё будет», «это всё» or «ждать нечего». Three of the
 * four, in any order and as often as they like — `not_started` is the only one the api keeps to
 * itself, since it is what an invite leaves behind and asking for it back says nothing. So «всё
 * загрузил» is never a door that shuts (doc-06). `viewer` is the one role refused (403), and nobody
 * is waiting on them anyway: they were never asked to bring anything and are counted in nothing.
 * There is no `:userId` in the route because a status is never set on somebody else.
 */
export function setContributionStatus(
  token: string,
  memoryId: string,
  status: 'more_coming' | 'done' | 'nothing',
): Promise<{ status: ContributionStatus }> {
  return request(`/memories/${memoryId}/contribution-status`, {
    method: 'POST',
    body: { status },
    token,
  });
}

/**
 * How a file gets into R2 without the bytes passing through the api: the row it minted, and a
 * signed `PUT` for every slice of the file, cut at `part_size`. The links die at `expires_at`
 * (about an hour), and asking for them again re-issues them against the *same* multipart upload —
 * which is what lets an interrupted upload carry on instead of starting over.
 */
