import { currentLanguage } from '@/lib/language';
import { strings } from '@/strings';

/**
 * The one door out of the app: every call in this folder goes through `request`, and every failure
 * comes back as an `ApiError` carrying the status and the parsed body, so a screen can branch on
 * 401/409/501 rather than read a sentence. `request` is the folder's own and leaves it nowhere —
 * a screen asks the api by name, never by path.
 */
// The API base URL. Expo inlines EXPO_PUBLIC_* at build time, so it has to be
// read as a literal property access — destructuring or dynamic keys stay undefined.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * The words, read at the moment one is needed. Nothing in this file is a component, so there is no
 * `useStrings()` to hang it on — and a call, not a captured set, is what keeps a language switched
 * after this module was imported from being missed.
 */

/**
 * The words, read at the moment one is needed. Nothing in this file is a component, so there is no
 * `useStrings()` to hang it on — and a call, not a captured set, is what keeps a language switched
 * after this module was imported from being missed.
 */
export const say = () => strings[currentLanguage()];

const TIMEOUT_MS = 5000;

/** The account as the api returns it. `username` is null until it is claimed. Duplicated, same reason. */

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

/**
 * The api's own sentence for a failure, when it sent one. Handed out on its own as well as inside
 * the message, for the one place that has to keep a failure and word it later (`@/lib/upload/queue`).
 *
 * ponytail: it comes down the wire in whatever language the api writes — English today. The api is
 * now told which language the caller reads (TASK-91), but it spends that on what it writes
 * unprompted — the mails and the pushes — and not on its answer to a request. The two lines this
 * side words itself are already both.
 */

/**
 * The api's own sentence for a failure, when it sent one. Handed out on its own as well as inside
 * the message, for the one place that has to keep a failure and word it later (`@/lib/upload/queue`).
 *
 * ponytail: it comes down the wire in whatever language the api writes — English today. The api is
 * now told which language the caller reads (TASK-91), but it spends that on what it writes
 * unprompted — the mails and the pushes — and not on its answer to a request. The two lines this
 * side words itself are already both.
 */
export function apiReason(body: unknown): string | undefined {
  const reason =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: unknown }).error
      : undefined;
  return typeof reason === 'string' ? reason : undefined;
}

function describe(status: number, body: unknown): string {
  if (status === 429) return say().error.tooMany;
  return apiReason(body) ?? say().error.status(status);
}

/** The line a screen can show for a failed call: the api's own wording, or a network one. */

/** The line a screen can show for a failed call: the api's own wording, or a network one. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : say().error.offline;
}

const refusals = new Set<(token: string) => void>();

/**
 * Hear that the api has stopped honouring a session token — signed out on another phone, revoked,
 * past its thirty days. Only a request that carried a token can say that: the way-in routes carry
 * none, and their 401 is a refused code or identity token, which belongs to the screen that asked.
 * Heard before the caller gets its `ApiError`, so the session can be gone by the time a screen
 * would word the failure.
 */

/**
 * Hear that the api has stopped honouring a session token — signed out on another phone, revoked,
 * past its thirty days. Only a request that carried a token can say that: the way-in routes carry
 * none, and their 401 is a refused code or identity token, which belongs to the screen that asked.
 * Heard before the caller gets its `ApiError`, so the session can be gone by the time a screen
 * would word the failure.
 */
export function onSessionRefused(listener: (token: string) => void): () => void {
  refusals.add(listener);
  return () => {
    refusals.delete(listener);
  };
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  /** Longer than the default only where the api is waiting on something slower than itself. */
  timeout?: number;
};

export async function request<T>(
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
    if (response.status === 401 && token !== undefined) {
      for (const listener of refusals) listener(token);
    }
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask for the six digits that open the way in (TASK-138). The api answers 200 whether or not the
 * address is registered, so this says nothing about who is already here.
 *
 * The language rides along because at this point there is no session to hang it on — the address
 * is all the api knows about whoever asked, and the letter has to be written in the language of
 * the app that asked (TASK-85). Every later sync goes through `putLanguage` instead.
 *
 * `code` comes back only where the api has its development door open — an address on `test.test`,
 * off a production server — and it is the same digits the letter would have carried, handed
 * straight back. Anywhere that really posts the letter, the answer is the bare `ok`.
 */
