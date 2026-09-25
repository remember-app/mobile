import { vi } from 'vitest';

import type { Contact, MediaItem, Member, Memory } from '@/api';

/**
 * The api, stood in for by a `fetch` that answers what the test tells it to — shared by the tests
 * that mount a whole screen with `react-test-renderer` (`src/test-renderer.ts`), so each of them
 * states only the routes it is about. The real client sits in front of it: what a test sees is what
 * went over the wire, in the order it went. Imported by `*.test.*` only.
 */

/** One request as it reached the stand-in: the path is what follows the host. */
export type Asked = { method: string; path: string; body: unknown };

/**
 * What a route answers. A plain value is a 200 with that body; a `Response` (see `refused`) is
 * whatever the test built; `'offline'` is a connection that never came; `undefined` is a route the
 * test did not think the screen would ask for, which is a 404 that says so in the log. A promise of
 * any of these is an answer that comes when the test lets it — the way to make a read late.
 */
export type Answer = unknown;

/** A promise the test settles by hand, for an answer that must arrive after something else. */
export function later<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (settle = resolve));
  return { promise, settle };
}

/** A refusal in the api's own shape, with the status the screen branches on. */
export const refused = (status: number, error = 'refused') =>
  new Response(JSON.stringify({ error }), { status });

/**
 * Puts the stand-in in place of `fetch` and hands back the log of what was asked. Undone by
 * `vi.unstubAllGlobals()` — call it in `afterEach`.
 */
export function serve(route: (asked: Asked) => Answer): Asked[] {
  const log: Asked[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    // Fastify's own two refusals, ahead of any route: a JSON header over nothing (the api's docs
    // spell it out), and a body that does not say it is JSON. A client that slips into either would
    // find every call on that route refused for real, and every test of it green here otherwise.
    const claimsJson =
      (init.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/json';
    if (claimsJson && init.body === undefined)
      return new Response(
        JSON.stringify({ code: 'FST_ERR_CTP_EMPTY_JSON_BODY', statusCode: 400 }),
        { status: 400 },
      );
    if (!claimsJson && init.body !== undefined)
      return new Response(
        JSON.stringify({ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', statusCode: 415 }),
        { status: 415 },
      );
    const asked: Asked = {
      method: init.method ?? 'GET',
      path: String(url).replace(/^https?:\/\/[^/]+/, ''),
      body: init.body ? JSON.parse(String(init.body)) : null,
    };
    log.push(asked);
    const answer = await route(asked);
    if (answer === 'offline') throw new TypeError('Network request failed');
    if (answer instanceof Response) return answer;
    if (answer === undefined) return refused(404, `no route for ${asked.method} ${asked.path}`);
    return new Response(JSON.stringify(answer), { status: 200 });
  });
  return log;
}

/** A finished photograph that has come down from the worker, brought by `by`, shot on `at`. */
export const photo = (
  id: string,
  by: string,
  at: string,
  over: Partial<MediaItem> = {},
): MediaItem => ({
  id,
  kind: 'photo',
  status: 'ready',
  uploaded_by: by,
  size_bytes: '1000000',
  captured_at: at,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: at,
  label_ids: [],
  thumbnail_url: `https://r2.example/${id}`,
  preview_url: null,
  screening_rejected: null,
  screening_reason: null,
  ...over,
});

/** The same, still being developed: the record is there and nothing of it is yet. */
export const developing = (id: string, by: string, at: string): MediaItem =>
  photo(id, by, at, { status: 'processing', thumbnail_url: null });

/** A roster row. The brought count is what the api counted, and a viewer has no standing at all. */
export const member = (id: string, role: Member['role'], over: Partial<Member> = {}): Member => ({
  id,
  username: id,
  name: null,
  role,
  contribution_status: role === 'viewer' ? null : 'not_started',
  media_count: 0,
  ...over,
});

/** The memory as the listing hands it out — a two-day one in September. */
export const memory = (over: Partial<Memory> = {}): Memory => ({
  id: 'm1',
  organizer_id: 'me',
  title: 'Свадьба Лизы и Марка',
  event_start: new Date(2026, 8, 12).toISOString(),
  event_end: new Date(2026, 8, 13, 23, 59, 59, 999).toISOString(),
  storage_bytes: '0',
  media_count: 0,
  recent_thumbnail_urls: [],
  cover_media_id: null,
  cover_thumbnail_url: null,
  montage_count: 0,
  created_at: new Date(2026, 8, 1).toISOString(),
  role: 'organizer',
  member_count: 1,
  contributed_member_count: 0,
  ...over,
});

/** Somebody's public face, for the places that carry one. */
export const contact = (id: string, name: string | null = null): Contact => ({
  id,
  username: id,
  name,
});
