// The API base URL. Expo inlines EXPO_PUBLIC_* at build time, so it has to be
// read as a literal property access — destructuring or dynamic keys stay undefined.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TIMEOUT_MS = 5000;

/** The health payload the api service returns. Duplicated here on purpose: no shared types package. */
type Health = { status: string };

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

type Options = { method?: 'GET' | 'POST'; body?: unknown; token?: string };

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

/** true when the api answers GET /health with 200 {"status":"ok"}. */
export async function isApiHealthy(): Promise<boolean> {
  try {
    return (await request<Health>('/health')).status === 'ok';
  } catch {
    return false;
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
