import { readFileSync } from 'node:fs';

import { MONTAGE_STAGES, type Montage, type MontageJournal, type MontageStep } from '@/api';

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

/** What the worker said about why it broke — the list's `error_text` on `fellOver`'s montage. */
export const BROKE = 'Режиссёр не ответил';

/**
 * NOT WORDS OF THE API — the recording has no montage that fell over, so these two answers about one
 * are cut out of recorded ones: the list taken while `understanding` was at work, with that stage
 * fallen over and `why` beside it — the worker's line, or none at all — and the ready montage's own
 * journal cut back to the same moment: the two stages it reached, their records, and the files those
 * name without a layout. Any member reads both (api README, «Журнал монтажа»), so they are served to
 * `as`.
 */
export function fellOver(steps: readonly Step[], as: Role, why: string | null = BROKE): Step[] {
  const list = step(steps, 'montage_list_while_building');
  const journal = step(steps, 'journal_of_ready_montage');
  const whole = journal.response.body as MontageJournal;
  const at = MONTAGE_STAGES.indexOf('understanding');
  const fell = <Row extends MontageStep>(row: Row, i: number) => ({
    ...row,
    state: i < at ? 'done' : i === at ? 'failed' : 'pending',
  });
  const entries = whole.entries.filter((one) => MONTAGE_STAGES.indexOf(one.stage) <= at);
  const met = new Set(entries.map((one) => one.media_id));
  const answer = (recorded: Step, body: unknown): Step => ({
    ...recorded,
    request: { ...recorded.request, as },
    response: { status: 200, body },
  });
  return [
    answer(
      list,
      (list.response.body as Montage[]).map((one) =>
        one.id === MONTAGE ? { ...one, status: 'failed', error_text: why, stages: one.stages!.map(fell) } : one,
      ),
    ),
    answer(journal, {
      ...whole,
      montage: { ...whole.montage, status: 'failed' },
      stages: whole.stages.slice(0, at + 1).map(fell),
      entries,
      files: whole.files.filter((one) => met.has(one.id)).map((one) => ({ ...one, places: [] })),
    }),
  ];
}

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
  /** Every request, answered or refused. */
  calls: number;
  /** Which of `moments` the api is at: what a narrowed read is answered from. Moved by the test. */
  moment: number;
  fetch: typeof fetch;
};

type Options = {
  /** Only these steps are the api's answers for this run — what it would say at that moment. */
  only?: readonly string[];
  /** Files of every journal answer come back in another order. */
  shuffleFiles?: boolean;
  /**
   * NOT WORDS OF THE API — a cut. The recording has no answer to `before=` (the poller never paged
   * back) nor to `stage=` (the screen of one stage narrows the journal on the server, and the poller
   * never did). Such a request is answered by cutting the recorded whole journal of the ready
   * montage by the rule the api README gives: the records of that stage; with `after` the ones next
   * to the cursor upwards, with `before` the newest of the older ones, otherwise the newest; `limit`
   * of them, newest first, `has_more` while some remain. The rest of the answer is the recorded one's.
   */
  cutFrom?: string;
  /**
   * NOT WORDS OF THE API — a journal bigger than any recorded one, which is a single page. Every read
   * of a journal, the first unnarrowed one too, is a page cut out of `cutFrom` by the same rule.
   */
  cutEvery?: boolean;
  /**
   * NOT WORDS OF THE API — a cut, made moment by moment. The journal steps of one sitting, in time:
   * a narrowed read is answered from what the api had said by `replay.moment` — the records of those
   * steps, their stages and viewers, and the files as the pages carried them (no layout yet). At the
   * moment the montage is `ready` the files are the ready montage's own (`cutFrom`), places and all:
   * the api signs and lays out a file when it sends it.
   */
  moments?: readonly string[];
  /** A request the api refuses or the network drops, before any recorded answer is looked for. */
  refuse?: (query: URLSearchParams) => number | 'offline' | undefined;
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

/** The page of `whole` a narrowed or paged-back request asks for — the README's rule, see `cutFrom`. */
function cutPage(whole: MontageJournal, search: URLSearchParams) {
  const limit = Number(search.get('limit') ?? 200);
  const stage = search.get('stage');
  const after = search.get('after');
  const inStage = whole.entries.filter((entry) => stage === null || entry.stage === stage);
  if (after !== null) {
    const newer = inStage.filter((entry) => entry.id > Number(after)).reverse();
    const page = newer.slice(0, limit);
    return { entries: page.reverse(), has_more: newer.length > page.length };
  }
  const older = inStage.filter((entry) => entry.id < Number(search.get('before') ?? Infinity));
  const page = older.slice(0, limit);
  return { entries: page, has_more: older.length > page.length };
}

export function replay(steps: readonly Step[], options: Options = {}): Replay {
  const pool = options.only ? steps.filter((one) => options.only?.includes(one.name)) : steps;
  const consumed = new Set<string>();
  const state: Replay = { served: [], unmatched: [], calls: 0, moment: 0, fetch: undefined as never };
  /** What the last journal answer said, for the page cut out of the whole journal. */
  let last: MontageJournal | undefined;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const patched = (name: string) => {
    const recorded = bodyOf(steps, name);
    return (options.patch?.[name]?.(recorded) ?? recorded) as MontageJournal;
  };

  /** What the journal was at `moment`, as one whole: everything the sitting's answers said by then. */
  const atMoment = (): MontageJournal => {
    const seen = options.moments!.slice(0, state.moment + 1).map(patched);
    const now = seen.at(-1)!;
    const entries = new Map(seen.flatMap((page) => page.entries.map((one) => [one.id, one] as const)));
    const files = new Map(seen.flatMap((page) => page.files.map((one) => [one.id, one] as const)));
    const laidOut = now.montage.status === 'ready' && options.cutFrom ? patched(options.cutFrom).files : [];
    for (const file of laidOut) files.set(file.id, file);
    return {
      ...now,
      entries: [...entries.values()].sort((a, b) => b.id - a.id),
      files: [...files.values()],
    };
  };

  state.fetch = (async (input: string, init?: { headers?: Record<string, string> }) => {
    state.calls += 1;
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

    const refused = url.pathname.endsWith('/journal') ? options.refuse?.(url.searchParams) : undefined;
    if (refused !== undefined) {
      state.served.push(`${label} (refused)`);
      if (refused === 'offline') throw new TypeError('Network request failed');
      return json({ error: 'refused by the test' }, refused);
    }

    const narrowed = options.cutEvery
      ? url.pathname.endsWith('/journal')
      : url.searchParams.has('before') || url.searchParams.has('stage');
    if (narrowed && (options.cutFrom || options.moments)) {
      const whole = options.moments ? atMoment() : patched(options.cutFrom!);
      const { entries, has_more } = cutPage(whole, url.searchParams);
      const met = new Set(entries.map((entry) => entry.media_id));
      state.served.push(`${label} (cut)`);
      return json({
        ...(options.moments ? whole : (last ?? whole)),
        entries,
        has_more,
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
