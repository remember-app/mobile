// The API base URL. Expo inlines EXPO_PUBLIC_* at build time, so it has to be
// read as a literal property access — destructuring or dynamic keys stay undefined.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TIMEOUT_MS = 5000;

/** The account as the api returns it. `username` is null until it is claimed. Duplicated, same reason. */
export type User = { id: string; username: string | null; name: string | null; email: string | null };

/** What every sign-in endpoint answers with: the session token plus the account it belongs to. */
export type Session = { token: string; user: User };

/** A non-2xx answer. Carries the status and parsed body so screens can branch on 401/409/501/… */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(describe(status, body));
    this.name = 'ApiError';
  }
}

function describe(status: number, body: unknown): string {
  if (status === 429) return 'Too many attempts — wait a minute and try again.';
  const reason =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: unknown }).error
      : undefined;
  return typeof reason === 'string' ? reason : `The API answered ${status}.`;
}

/** The line a screen can show for a failed call: the api's own wording, or a network one. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Cannot reach the API — check that it is running and try again.';
}

type Options = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; token?: string };

async function request<T>(path: string, { method = 'GET', body, token }: Options = {}): Promise<T> {
  const abort = new AbortController();
  // Without this an unreachable host hangs for a minute and the screen stays on "loading".
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // A body-less POST must not claim JSON — Fastify rejects an empty JSON body with 400.
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // A proxy or a crash can answer with something that is not JSON; keep it as the raw text.
      parsed = text;
    }
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Ask for a magic link. The api answers 200 whether or not the address is registered. */
export function startEmailSignIn(email: string): Promise<{ ok: true }> {
  return request('/auth/email/start', { method: 'POST', body: { email } });
}

/** Trade a link token for a session. 401 when it is spent or expired. */
export function verifyEmailToken(token: string): Promise<Session> {
  return request('/auth/email/verify', { method: 'POST', body: { token } });
}

/** Trade an Apple identity token for a session. 501 while the provider has no keys. */
export function signInWithApple(idToken: string): Promise<Session> {
  return request('/auth/apple', { method: 'POST', body: { idToken } });
}

/** Trade a Google identity token for a session. 501 while the provider has no keys. */
export function signInWithGoogle(idToken: string): Promise<Session> {
  return request('/auth/google', { method: 'POST', body: { idToken } });
}

/** The account behind a session token. 401 once the token stops being honoured. */
export function fetchMe(token: string): Promise<User> {
  return request('/me', { token });
}

/** Claim or change the username. 409 when taken, 400 when the format is wrong. */
export function putUsername(token: string, username: string): Promise<User> {
  return request('/me/username', { method: 'POST', body: { username }, token });
}

/** Where the caller stands in a memory. Duplicated from the api, same reason as `User`. */
export type MemberRole = 'organizer' | 'contributor' | 'viewer';

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
  montage_count: number;
  created_at: string;
  role: MemberRole;
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

/** A roster row: the three public fields the api hands out, plus where that person stands. */
export type Member = Omit<User, 'email'> & { role: MemberRole };

/** What may actually be granted. Never `organizer`: a memory has exactly one, its creator. */
export type InviteRole = Exclude<MemberRole, 'organizer'>;

/** The one live invite link of a memory: the raw token and the level following it grants. */
export type Invite = { token: string; role: InviteRole };

/** Everyone in a memory, in the order they joined. Any member may read it, a viewer included. */
export function listMembers(token: string, memoryId: string): Promise<Member[]> {
  return request(`/memories/${memoryId}/members`, { token });
}

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
export function fetchInvite(token: string, memoryId: string): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { token });
}

/** Revoke the live link and mint a fresh one; the old token stops opening anything. */
export function rotateInvite(token: string, memoryId: string, role: InviteRole): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { method: 'POST', body: { role }, token });
}

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
 * Tell the api where to push to. Idempotent: the same device token registered twice is one row,
 * so this can run on every launch without asking whether it already ran.
 */
export function registerPushToken(
  token: string,
  expoToken: string,
  platform: string,
): Promise<{ ok: true }> {
  return request('/me/push-tokens', {
    method: 'POST',
    body: { token: expoToken, platform },
    token,
  });
}

/**
 * Join by invite link. Answers with the memory as its new member sees it — the same shape
 * `/memories` hands out, so the screen it lands on has nothing extra to fetch. 404 once the
 * link has been rotated, and being a member already is a plain 200 that changes no role.
 */
export function acceptInvite(token: string, inviteToken: string): Promise<Memory> {
  return request('/invites/accept', { method: 'POST', body: { token: inviteToken }, token });
}

/** Drop the session server-side. Sends no body on purpose — see the note in `request`. */
export function endSession(token: string): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST', token });
}

/** What the api enforces; mirrored here only to say it inline before a round trip. */
export const USERNAME_HINT = '3–30 Latin letters, digits, . _ -, and not at the ends';

// 3–30 chars: an alphanumeric at each end with separators allowed only between them.
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;

/** A cheap client-side mirror of the server rule. The server stays the authority. */
export function isValidUsername(username: string): boolean {
  return USERNAME.test(username);
}
