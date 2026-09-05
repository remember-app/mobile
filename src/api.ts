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

type Options = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string;
  /** Longer than the default only where the api is waiting on something slower than itself. */
  timeout?: number;
};

async function request<T>(
  path: string,
  { method = 'GET', body, token, timeout = TIMEOUT_MS }: Options = {},
): Promise<T> {
  const abort = new AbortController();
  // Without this an unreachable host hangs for a minute and the screen stays on "loading".
  const timer = setTimeout(() => abort.abort(), timeout);
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

/**
 * The question `putUsername` answers by trying, asked without trying — so the field can say «free»
 * while it is still being typed. The caller's own current username is free (re-sending it claims
 * nothing), and a malformed one is a 400 rather than a `true` the submit would then refuse. Only an
 * answer about the name still in the field is worth anything: the claim is what the 409 guards.
 */
export function checkUsername(token: string, username: string): Promise<{ available: boolean }> {
  return request(`/me/username/available?username=${encodeURIComponent(username)}`, { token });
}

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
   * Up to two signed thumbnail urls, most recently captured first — the frames the card draws.
   * Only ready media has one, so this is a tail of `media_count` and never all of it; empty
   * while nothing is processed yet, or when the api has no bucket configured.
   */
  recent_thumbnail_urls: string[];
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
export type Member = Omit<User, 'email'> & {
  role: MemberRole;
  contribution_status: ContributionStatus;
};

/** What may actually be granted. Never `organizer`: a memory has exactly one, its creator. */
export type InviteRole = Exclude<MemberRole, 'organizer'>;

/**
 * «Добавление» and up — the matrix row that governs both bringing material and bringing people
 * (architecture.md, «Проверка прав»). One copy, because two screens gate buttons on it and the
 * one that drifted would be the one nobody noticed. The api is the authority either way; this
 * only decides whether a button is drawn.
 */
export const mayContribute = (role: MemberRole | null) =>
  role === 'organizer' || role === 'contributor';

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
 * The caller's own word about their material: «это всё» or «ждать нечего». Only the two terminal
 * answers — the other two statuses are the api's to write. No role gate at all, a viewer included:
 * saying «у меня ничего нет» grants nothing, and refusing it would only leave the organizer waiting.
 * There is no `:userId` in the route because a status is never set on somebody else.
 */
export function setContributionStatus(
  token: string,
  memoryId: string,
  status: 'done' | 'nothing',
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
export type UploadPlan = {
  id: string;
  status: string;
  upload: {
    key: string;
    upload_id: string;
    part_size: number;
    parts: { part_number: number; url: string }[];
    expires_at: string;
  };
};

/** The file as the api wants it declared, before a single byte is sent. */
export type UploadIntent = {
  kind: 'photo' | 'video';
  size_bytes: number;
  /** RFC 3339 with an offset, or null when the file carries no capture date at all. */
  captured_at?: string | null;
  /** Required for a video and ignored for a photo — the api answers 400 without it. */
  duration_seconds?: number | null;
};

/**
 * Announce a file and get the links to send it with. 403 for a viewer, 413 when the file is over
 * a limit, 409 when the memory is full or out of space.
 */
export function startUpload(
  token: string,
  memoryId: string,
  file: UploadIntent,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media`, { method: 'POST', body: file, token });
}

/**
 * Fresh links for the same upload — the answer to one that expired mid-file, and the way a resume
 * gets its links back at all. 409 once there is nothing left to send, and the body then carries
 * the status the row has moved on to.
 */
export function refreshUpload(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media/${mediaId}/upload`, { token });
}

/**
 * «Загружено»: seals the parts into one object and starts the preview. Idempotent — a repeat only
 * reports where the row stands. Given a longer leash than the rest: the api is waiting on R2
 * assembling the object, which for a big video is not a five-second job.
 *
 * `first_upload` is true exactly once per person per memory — on the completion that moved them
 * off `not_started` — and is the api telling the app to ask the doc-06 question. A repeat of the
 * same call, or anybody's second file, answers false.
 */
export function finishUpload(
  token: string,
  memoryId: string,
  mediaId: string,
  parts: { part_number: number; etag: string }[],
): Promise<{ id: string; status: string; first_upload: boolean }> {
  return request(`/memories/${memoryId}/media/${mediaId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60_000,
  });
}

/**
 * One record in a memory's gallery. `pending_upload` never appears — those are uploads still in
 * flight, with no bytes in the store to show — so the three statuses here are the whole set.
 *
 * The two urls are the derivatives, signed and short-lived (~15 minutes, architecture.md); the
 * original is deliberately not linked from here. Both are null until the worker has made them,
 * which is what `processing` and `failed` look like on screen.
 */
export type MediaItem = {
  id: string;
  kind: 'photo' | 'video';
  status: 'processing' | 'ready' | 'failed';
  uploaded_by: string;
  size_bytes: string;
  captured_at: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  /** A photo's thumbnail, a video's poster frame. */
  thumbnail_url: string | null;
  /** The 720p H.264 the gallery plays progressively. A photo has none. */
  preview_url: string | null;
};

/**
 * Everything in a memory, oldest shot first — the order the montage would play it in. Any member
 * reads it, a viewer included. 503 while the api has no bucket configured.
 */
export function listMedia(token: string, memoryId: string): Promise<MediaItem[]> {
  return request(`/memories/${memoryId}/media`, { token });
}

/**
 * A signed link to the *original* — the file as it was sent, not the derivative the gallery draws.
 * Any member may ask, a viewer included. 404 for a record that is still uploading (there are no
 * bytes to sign yet) and for one of another memory; 503 while the api has no bucket. The link is
 * as short-lived as the gallery's own (~15 minutes), so it is fetched at the moment of saving.
 */
export function downloadMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{ url: string }> {
  return request(`/memories/${memoryId}/media/${mediaId}/download`, { token });
}

/**
 * Every original in one answer, in the gallery's own order — «скачать всю галерею» without a round
 * trip per file. Same set as `listMedia`, cut down to what the saving needs: the extension comes
 * from `kind`, since neither this nor the record carries the name the file had.
 */
export function downloadAllMedia(
  token: string,
  memoryId: string,
): Promise<{ id: string; kind: MediaItem['kind']; url: string }[]> {
  return request(`/memories/${memoryId}/media/download`, { token });
}

/**
 * Take one record out for good, bytes and all. Whoever uploaded it may, and so may the organizer;
 * 403 for anybody else, 404 once it is already gone.
 */
export function deleteMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { method: 'DELETE', token });
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
