import type {
  JournalEntry,
  JournalFile,
  JournalQuery,
  Montage,
  MontageJournal,
  MontageStage,
  Viewer,
} from '@/api';
import { LAST, lastOfStage, recordsOf } from './stages';

/**
 * The journal as the app holds it, and the reading of it: a page at a time, a cursor at each end,
 * and what a broken connection does to what is already on screen — which is nothing (spec 7.6).
 */
/**
 * How often the journal is read while the video is being made. The api asks for one to two seconds
 * and sizes its own page for that (README, «Журнал монтажа»); this is a screen somebody is sitting
 * in front of watching a machine work, so the slow end of that would already read as a stutter.
 */
export const WHILE_LIVE_MS = 1500;

/**
 * How many pages one poll will chase before it hands the phone back. `has_more` is followed at once
 * rather than on the next tick — that is the api's own rule — and the ceiling is only a stop against
 * a route that answers `has_more` forever: five thousand records is more than any one gap can hold.
 */
const PAGES = 25;

/** Everything the app holds about one video's journal. */
export type Journal = {
  /** Where the video stands, off the journal's own answer. Null until the first one lands. */
  status: Montage['status'] | null;
  /** All five, in pipeline order, as far as the worker has got to them. */
  stages: MontageStage[];
  /** Newest first and never twice, however the pages arrived. */
  entries: JournalEntry[];
  /**
   * The files met in those records, by id — `places` and the thumbnail hang off these.
   *
   * ponytail: they pile up and are only replaced when the api meets them again, and a signed
   * thumbnail lives about a quarter of an hour — so a journal left open for an afternoon can hold a
   * link that has since died, and the frame beside that record comes up empty. Nothing is lost and
   * nothing is wrong on screen; if it ever matters, the answer is to re-ask for the page the record
   * is on rather than to keep a clock per file here.
   */
  files: Record<string, JournalFile>;
  viewers: Viewer[];
  /** The largest id held: what the next poll asks after. */
  cursor: number | null;
  /** The smallest one: where paging back carries on from. */
  oldest: number | null;
  /** Is there journal behind the oldest record held — what `loadOlder` is offered for. */
  hasOlder: boolean;
  /**
   * Everything at or below this id was already there when the screen opened; anything above it
   * arrived while somebody was watching, which is the whole of `isFresh` and of the typing.
   */
  settled: number | null;
  /** The last read never came back. What is above stays exactly as it was. */
  offline: boolean;
  /**
   * The api will not give this journal to whoever is reading it: 404, its one answer to somebody
   * not in the memory — never in it, or taken out of it while the screen was open. It will answer
   * the same the next time, so nothing is asked again until the screen comes back in front.
   */
  refused: boolean;
};

/** Nothing read yet. */
export const NO_JOURNAL: Journal = {
  status: null,
  stages: [],
  entries: [],
  files: {},
  viewers: [],
  cursor: null,
  oldest: null,
  hasOlder: false,
  settled: null,
  offline: false,
  refused: false,
};

/** One word for the whole thing, for a screen that has one line to say it in. */
export type Standing = 'opening' | 'live' | 'ready' | 'failed' | 'offline' | 'refused';

/** Which narrowing the journal is being read under — one stage, or the whole of it. */
export type Narrow = Pick<JournalQuery, 'stage'>;

/** Asking the api for one page. A parameter so the reading can be run without a network. */
export type Ask = (query: JournalQuery) => Promise<MontageJournal>;

/**
 * The records and files of one page added to what is held. The records are kept by id, so a page
 * that overlaps what is here — a retried poll, a page asked for twice — costs nothing and loses
 * nothing.
 */
function withPage(state: Journal, page: MontageJournal): Pick<Journal, 'entries' | 'files'> {
  const held = new Map(state.entries.map((entry) => [entry.id, entry] as const));
  for (const entry of page.entries) held.set(entry.id, entry);
  return {
    entries: [...held.values()].sort((a, b) => b.id - a.id),
    files: { ...state.files, ...Object.fromEntries(page.files.map((file) => [file.id, file])) },
  };
}

/** One page folded into what is already held, and where the reading goes from there. */
function fold(state: Journal, page: MontageJournal, mode: 'first' | 'forward' | 'back'): Journal {
  const ids = page.entries.map((entry) => entry.id);
  const top = ids.length > 0 ? Math.max(...ids) : null;
  const bottom = ids.length > 0 ? Math.min(...ids) : null;

  return {
    status: page.montage.status,
    // Whole every time, both of them: five rows and a handful of watchers are the cheap part of the
    // answer, and the api is the authority on who is still looking.
    stages: page.stages,
    viewers: page.viewers,
    ...withPage(state, page),
    cursor: top === null ? state.cursor : Math.max(state.cursor ?? top, top),
    oldest: bottom === null ? state.oldest : Math.min(state.oldest ?? bottom, bottom),
    // Going forward says nothing about the history behind the screen: `has_more` there is about
    // news, and it is chased inside the same poll rather than remembered.
    hasOlder: mode === 'forward' ? state.hasOlder : page.has_more,
    // The line between «was already here» and «arrived while I watched» is drawn once, on the first
    // answer — an empty journal at that moment leaves it unset, and everything later is new.
    settled: state.status === null ? top : state.settled,
    offline: false,
    refused: false,
  };
}

/**
 * One poll: the page next to the cursor, and every page behind it that `has_more` promises, without
 * waiting for the next tick. The cursor is the largest id of what was handed over, and the page is
 * the one *adjacent* to it rather than the freshest — between two polls more records can land than
 * a page holds, and taking the freshest would leave a hole in the middle that nothing could ever
 * find again (api README says exactly this, and it is why the loop is here).
 *
 * The first read is the exception: with no cursor the api answers with the newest page, and its
 * `has_more` is about the journal *behind* it. That is history, not news, and it is `loadOlder`
 * that goes for it — so the first read is one page and stops.
 */
export async function pull(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  let held = state;
  for (let page = 0; page < PAGES; page++) {
    const first = held.cursor === null;
    const answer = await ask(
      first ? { ...narrow } : { ...narrow, after: held.cursor ?? undefined },
    );
    const next = fold(held, answer, first ? 'first' : 'forward');
    // Nothing more in that direction, or nothing moved at all — a page that hands back no new id
    // would otherwise be asked for again forever.
    if (first || !answer.has_more || next.cursor === held.cursor) return next;
    held = next;
  }
  return held;
}

/**
 * One page further back through the journal — what a journal of hundreds of records is scrolled
 * with. Never chases `has_more` itself: going back is a person scrolling, and the next page is
 * asked for when they get there.
 */
export async function pullOlder(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  if (state.oldest === null) return state;
  return fold(state, await ask({ ...narrow, before: state.oldest }), 'back');
}

/**
 * Where the frames went, brought up to date for every file held. The worker lays the film out only
 * at `rhythm`, after the directing, and the api sends a file along with a new record about it and
 * never otherwise — so the files of a journal read while the film was being made stay as they were
 * before there was any layout, `places: []`, and no poll after that brings them in. One reading of
 * the journal from its start, under the same narrowing, does: the records are the ones already
 * held, the files are what the api says about them now.
 */
export async function relaid(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  const again = await pull({ ...NO_JOURNAL, cursor: 0 }, ask, narrow);
  return { ...state, files: { ...state.files, ...again.files } };
}

/**
 * Has the worker begun this film again since `held` was read — its job retried after a passing
 * failure, or «Повторить» pressed on another phone. Either way the last attempt's records are wiped
 * and the new ones carry larger ids, so reading on after the cursor would lay the new attempt over
 * the old one. What gives it away is a stage seen started that no longer has that start: the worker
 * writes `started_at` once per stage per attempt and empties it only to begin another, and the api's
 * retry leaves no stages at all. Going on, falling over or being ready never touches a start already
 * written — and an attempt caught before any stage began left nothing to hold.
 */
export const startedOver = (held: readonly MontageStage[], now: readonly MontageStage[]): boolean =>
  held.some(
    (was) =>
      was.started_at !== null &&
      now.find((one) => one.stage === was.stage)?.started_at !== was.started_at,
  );

/**
 * Every stage's own last records, for a screen that opens all five out. The first read is the
 * newest page of the whole journal, and a film of hundreds of records ends that page inside its
 * later stages — the earlier ones would open out onto nothing. A stage holding fewer of its last
 * records than its own counts promise is asked for them once, narrowed to it and no more than a row
 * shows: one small read a stage at most, and none where the page already held them.
 */
export async function lastOfEach(state: Journal, ask: Ask): Promise<Journal> {
  const short = state.stages.filter(
    (row) => lastOfStage(state.entries, row.stage).length < Math.min(LAST, recordsOf(row)),
  );
  const pages = await Promise.all(short.map((row) => ask({ stage: row.stage, limit: LAST })));
  // biome-ignore lint/performance/noAccumulatingSpread: at most one page per stage — seven.
  return pages.reduce((held, page) => ({ ...held, ...withPage(held, page) }), state);
}

/** Did this record arrive while the screen was open — the one question the typing asks. */
export const isFresh = (journal: Journal, entry: JournalEntry): boolean =>
  journal.settled === null || entry.id > journal.settled;
