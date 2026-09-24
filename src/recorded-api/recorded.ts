import { readFileSync } from 'node:fs';

import type { MontageJournal } from '@/api';

/**
 * The api's recorded answers to the journal routes (see `README.md` beside this file), and a stand-in
 * for the network that answers from them *by request*: who asked, which route, which cursor — never
 * by the order the calls happen to come in. What the app's own code then asks for is what is checked:
 * a request nobody recorded an answer to is reported in `unmatched` and fails the call, so a change
 * in how the app pages through the journal cannot pass by being answered anyway.
 */

export type Role = 'organizer' | 'contributor' | 'viewer' | 'stranger';

export type Step = {
  name: string;
  request: { as: Role | null; method: 'GET'; path: string; query: Record<string, number | string> };
  response: { status: number; body: unknown };
};

export type Scenario = 'director' | 'algorithm';

/** The fixed ids the recording is normalised to (api README, «Формат записанных ответов»). */
const uuid = (letter: string, n: number) =>
  `00000000-0000-4000-8000-${letter}${String(n).padStart(11, '0')}`;
export const MEMORY = uuid('a', 1);
/** The montage cut from the snapshot; `OLD` is a ready one cut before the journal, `QUEUED` waits. */
export const MONTAGE = uuid('b', 1);
export const OLD = uuid('b', 2);
export const QUEUED = uuid('b', 3);
export const PEOPLE = { organizer: uuid('c', 1), contributor: uuid('c', 2), viewer: uuid('c', 3), stranger: uuid('c', 4) };

export const journalPath = (montageId: string = MONTAGE) =>
  `/memories/${MEMORY}/montages/${montageId}/journal`;
export const listPath = `/memories/${MEMORY}/montages`;

export function load(scenario: Scenario): Step[] {
  const file = JSON.parse(
    readFileSync(new URL(`./responses_${scenario}.json`, import.meta.url), 'utf8'),
  ) as { format: number; scenario: string; steps: Step[] };
  // The one thing this loader knows about the file: which format it is. A new format is the api
  // saying the reading below has to be looked at again, not something to keep parsing.
  if (file.format !== 1 || file.scenario !== scenario) {
    throw new Error(`recorded api answers: unexpected format ${file.format} / ${file.scenario}`);
  }
  return file.steps;
}

export const step = (steps: readonly Step[], name: string): Step => {
  const found = steps.find((one) => one.name === name);
  if (!found) throw new Error(`no recorded step «${name}»`);
  return found;
};

export const bodyOf = (steps: readonly Step[], name: string) =>
  step(steps, name).response.body as MontageJournal;

/** The steps of one sitting in front of the screen, in the order they were recorded. */
export const liveSteps = (steps: readonly Step[]) =>
  steps.filter((one) => one.name.startsWith('live_') && one.request.as === 'organizer');

export const TOKEN: Record<Role, string> = {
  organizer: 'session-organizer',
  contributor: 'session-contributor',
  viewer: 'session-viewer',
  stranger: 'session-stranger',
};

/**
 * The api does not promise the order of `files`, so a reader must not lean on it. This is a fixed
 * reshuffle (reversed, then turned three places) applied to every answer that carries the list.
 */
const shuffled = <T>(list: T[]): T[] => {
  const reversed = [...list].reverse();
  const turn = reversed.length === 0 ? 0 : 3 % reversed.length;
  return [...reversed.slice(turn), ...reversed.slice(0, turn)];
};

export type Replay = {
  /** Every request that went out: the recorded step that answered it, or `?` when none did. */
  served: string[];
  unmatched: string[];
  fetch: typeof fetch;
};

type Options = {
  /** Only these steps are the api's answers for this run — what it would say at that moment. */
  only?: readonly string[];
  /** Files of every journal answer come back in another order. */
  shuffleFiles?: boolean;
  /**
   * The recording has no answer to `before=` (the poller never paged back) nor to `stage=` (the
   * screen of one stage narrows the journal on the server, and the poller never did). Such a request
   * is answered by cutting the recorded whole journal of the ready montage by the rule the api README
   * gives: the records of that stage, older than the cursor, newest first, `limit` of them,
   * `has_more` while some remain. Everything else in the answer is the recorded one's.
   */
  cutFrom?: string;
  /** Answers for routes the recording does not cover (`/memories`, `/members`) — plain data. */
  extra?: Record<string, unknown>;
  /** Answers instead of the recorded one, for a step named here — a mutation of real data. */
  patch?: Record<string, (body: unknown) => unknown>;
};

const ROLE_OF = new Map(Object.entries(TOKEN).map(([role, token]) => [token, role as Role]));

/** `after=0` is «from the start», which is what no `after` at all asks for on an empty journal. */
const askedOf = (search: URLSearchParams) =>
  [...search.entries()]
    .filter(([key, value]) => key !== 'limit' && !(key === 'after' && value === '0'))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');

const recordedAskedOf = (query: Step['request']['query']) =>
  askedOf(new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])));

export function replay(steps: readonly Step[], options: Options = {}): Replay {
  const pool = options.only ? steps.filter((one) => options.only?.includes(one.name)) : steps;
  const consumed = new Set<string>();
  const state: Replay = { served: [], unmatched: [], fetch: undefined as never };
  /** What the last journal answer said, for the page cut out of the whole journal. */
  let last: MontageJournal | undefined;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  state.fetch = (async (input: string, init?: { headers?: Record<string, string> }) => {
    const url = new URL(input);
    const token = init?.headers?.Authorization?.replace(/^Bearer /, '');
    const role = token ? (ROLE_OF.get(token) ?? null) : null;
    const asked = askedOf(url.searchParams);
    const label = `${role ?? 'nobody'} GET ${url.pathname}${asked ? `?${asked}` : ''}`;

    const extra = options.extra?.[url.pathname];
    if (extra !== undefined) {
      state.served.push(label);
      return json(extra);
    }

    if ((url.searchParams.has('before') || url.searchParams.has('stage')) && options.cutFrom) {
      const recorded = bodyOf(steps, options.cutFrom);
      const whole = (options.patch?.[options.cutFrom]?.(recorded) ?? recorded) as MontageJournal;
      const limit = Number(url.searchParams.get('limit') ?? 200);
      const before = Number(url.searchParams.get('before') ?? Infinity);
      const stage = url.searchParams.get('stage');
      const older = whole.entries.filter(
        (entry) => entry.id < before && (stage === null || entry.stage === stage),
      );
      const page = older.slice(0, limit);
      const met = new Set(page.map((entry) => entry.media_id));
      state.served.push(`${label} (cut from ${options.cutFrom})`);
      return json({
        ...(last ?? whole),
        entries: page,
        has_more: older.length > page.length,
        files: whole.files.filter((file) => met.has(file.id)),
      });
    }

    const same = pool.filter(
      (one) =>
        one.request.as === role &&
        one.request.path === url.pathname &&
        recordedAskedOf(one.request.query) === asked,
    );
    const next = same.find((one) => !consumed.has(one.name)) ?? same.at(-1);
    if (!next) {
      state.served.push('?');
      state.unmatched.push(label);
      throw new TypeError(`Network request failed: nothing recorded for ${label}`);
    }
    consumed.add(next.name);
    state.served.push(next.name);

    let body = options.patch?.[next.name]?.(next.response.body) ?? next.response.body;
    if (next.response.status === 200 && next.request.path.endsWith('/journal')) {
      const journal = body as MontageJournal;
      last = journal;
      if (options.shuffleFiles) body = { ...journal, files: shuffled(journal.files) };
    }
    return json(body, next.response.status);
  }) as typeof fetch;

  return state;
}
