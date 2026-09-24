// What the director said while putting a video together, as the app holds it (spec 7.6 and 7.7,
// «Монтаж в прямом эфире»). Three things live here and nothing else: the reading of the journal —
// the poll, the cursor and what a broken connection does to what is already on screen; everything a
// screen has to work *out* of an answer — which stage is on, what is in the director's hands, how
// long is left, where on a frame the eye is; and the two helpers that turn a record into words.
//
// Apart from the screens on purpose, the way `@/montage` is apart from the order wizard: all of the
// arithmetic above can be run without a phone, and the two screens of the milestone (the live one
// and the finished one) read the same journal through the same hook.
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  ApiError,
  fetchJournal,
  MONTAGE_STAGES,
  type JournalEntry,
  type JournalFile,
  type JournalQuery,
  type Montage,
  type MontageJournal,
  type MontageStage,
  type MontageStageCode,
  type Viewer,
} from '@/api';
import { formatRuntime } from '@/dates';
import { GAZE, useReducedMotion, type StepState } from '@/kit';
import { beingMade } from '@/montage';
import type { Strings } from '@/strings';

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
 * One page folded into what is already held. The records are kept by id, so a page that overlaps
 * what is here — a retried poll, a page asked for twice — costs nothing and loses nothing.
 */
function fold(state: Journal, page: MontageJournal, mode: 'first' | 'forward' | 'back'): Journal {
  const ids = page.entries.map((entry) => entry.id);
  const top = ids.length > 0 ? Math.max(...ids) : null;
  const bottom = ids.length > 0 ? Math.min(...ids) : null;

  const held = new Map(state.entries.map((entry) => [entry.id, entry] as const));
  for (const entry of page.entries) held.set(entry.id, entry);

  return {
    status: page.montage.status,
    // Whole every time, both of them: five rows and a handful of watchers are the cheap part of the
    // answer, and the api is the authority on who is still looking.
    stages: page.stages,
    viewers: page.viewers,
    entries: [...held.values()].sort((a, b) => b.id - a.id),
    files: { ...state.files, ...Object.fromEntries(page.files.map((file) => [file.id, file])) },
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
    const answer = await ask(first ? { ...narrow } : { ...narrow, after: held.cursor ?? undefined });
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

/* ── What the screens work out of it ──────────────────────────────────── */

/** How many stages there are in all — the «из 5». */
export const STAGE_COUNT = MONTAGE_STAGES.length;

/** «Этап 3 из 5»: the place of a stage in the pipeline, counted from one. */
export const stageNumber = (stage: MontageStageCode): number => MONTAGE_STAGES.indexOf(stage) + 1;

/**
 * The stage the video is on now: the one being worked on, or — when none is — the one that fell
 * over, and failing that the last one the worker has reached. A `pending` row is not reached: the
 * worker writes all five as it opens the job, so between two stages the answer is the one just
 * done and not the last row of the five. Null before anything is known, which is a montage still
 * standing in the queue as much as a journal not read yet.
 */
export function currentStage(stages: readonly MontageStage[]): MontageStage | null {
  const inOrder = [...stages].sort((a, b) => stageNumber(a.stage) - stageNumber(b.stage));
  return (
    inOrder.find((stage) => stage.state === 'running') ??
    inOrder.find((stage) => stage.state === 'failed') ??
    inOrder.filter((stage) => stage.state !== 'pending').pop() ??
    null
  );
}

/**
 * «В руках режиссёра» — the freshest record that is about a frame at all. The card at the top of
 * the live screen is a window onto one file, so a thought about the plan as a whole does not take
 * the frame out of its hands: it goes into the journal underneath and the card holds what it held.
 */
export const inHand = (entries: readonly JournalEntry[]): JournalEntry | null =>
  entries.find((entry) => entry.media_id !== null) ?? null;

/** The last records of one stage, freshest first — two of them on the live screen (spec 7.6). */
export const lastOfStage = (
  entries: readonly JournalEntry[],
  stage: MontageStageCode,
  many = 2,
): JournalEntry[] => entries.filter((entry) => entry.stage === stage).slice(0, many);

/**
 * «Осталось ≈ 8 мин»: what the stages that are not behind us still add up to. The worker's estimate
 * for the stage being worked on is what is *left* of it, not its whole length, so this is a plain
 * sum — rounded up, because a minute and a half left is «2 мин» and never «1», and never below one
 * while there is anything at all to wait for.
 *
 * Null when not a single stage has an estimate: no number is better than a made-up one, and the
 * screen simply does not draw the line. Null too once a stage has fallen over — the ones after it
 * still carry the worker's opening guesses, but nobody is waiting for them any more.
 */
export function minutesLeft(stages: readonly MontageStage[]): number | null {
  if (stages.some((stage) => stage.state === 'failed')) return null;
  const ahead = stages.filter((stage) => stage.state !== 'done');
  if (!ahead.some((stage) => stage.eta_seconds !== null)) return null;
  const seconds = ahead.reduce((sum, stage) => sum + (stage.eta_seconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Where the kit's square goes, for a gaze that arrives as fractions of the frame. The middle of
 * what the director is looking at becomes the middle of the square, and the square is then held
 * inside the frame — an eye on the very edge of a photograph must not hang half of the marker over
 * nothing. A frame smaller than the square itself simply gets it at the corner.
 *
 * `size` is 96 on the card and 110 on the sheet's taller frame (`SheetLiveFile`): the same eye, drawn
 * at the size the picture under it is drawn at.
 */
export function gazeAt(
  focus: JournalEntry['focus'],
  frame: { width: number; height: number },
  size: number = GAZE,
): { left: number; top: number } | undefined {
  if (!focus) return undefined;
  const inside = (middle: number, along: number) =>
    Math.max(0, Math.min(along - size, middle * along - size / 2));
  return {
    left: inside(focus.x + focus.w / 2, frame.width),
    top: inside(focus.y + focus.h / 2, frame.height),
  };
}

/**
 * How long a stage has been at it — what it has taken so far while it runs, and what it took once it
 * is behind. Whole minutes and nothing under one: a stage that started eight seconds ago is not
 * «0 мин», it is a stage with nothing to say about its own length yet.
 */
export function stageMinutes(stage: MontageStage, now: number = Date.now()): number | null {
  if (stage.started_at === null) return null;
  const from = new Date(stage.started_at).getTime();
  const to = stage.finished_at === null ? now : new Date(stage.finished_at).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const minutes = Math.floor((to - from) / 60000);
  return minutes >= 1 ? minutes : null;
}

/**
 * The line under a stage's name (spec detail 56) — «212 из 214 годятся · 1 мин». What came of it
 * where the worker has said, how far through it is where it has not, and its own time after either.
 *
 * Every stage's outcome is its own shape, so each is read for the one thing worth a clause out of
 * the keys the api names («Журнал монтажа»); a key that did not arrive is simply not drawn, and a
 * stage nobody has reached yet has no line at all rather than a line of nothing.
 */
export function stageLine(
  stage: MontageStage,
  s: Strings,
  now: number = Date.now(),
): string | undefined {
  const { live } = s.montage;
  const minutes = stageMinutes(stage, now);
  const spent =
    minutes === null
      ? undefined
      : stage.state === 'running'
        ? live.running(minutes)
        : live.minutes(minutes);
  const parts = [cameOf(stage, s) ?? soFar(stage, s), spent].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** What the stage says it came to, in the one clause its own keys can fill. */
function cameOf(stage: MontageStage, s: Strings): string | undefined {
  const { live } = s.montage;
  const came = stage.outcome;
  switch (stage.stage) {
    case 'screening':
      return came.kept !== undefined && came.of !== undefined
        ? live.kept(came.kept, came.of)
        : undefined;
    case 'understanding':
      return came.faces === undefined ? undefined : live.faces(came.faces);
    case 'directing':
      return came.parts === undefined ? undefined : live.parts(came.parts);
    case 'rhythm':
      // A film with no music has nothing to lay out to: the stage still runs, and «0 склеек» would
      // be a count of what never could have happened.
      if (came.track?.length === 0) return live.noTrack;
      return came.cuts === undefined ? undefined : live.cuts(came.cuts);
    case 'assembly':
      return formatRuntime(came.seconds ?? null);
  }
}

/** «61 из 212» — how far through it is, for a stage that has not come to anything yet. */
function soFar(stage: MontageStage, s: Strings): string | undefined {
  return stage.total_count === null
    ? undefined
    : s.montage.live.doneOf(stage.done_count, stage.total_count);
}

/**
 * Where one of the five stands, in the kit's own words for a step. A stage the worker has not
 * reached has no row at all in the answer, which is the same thing as `pending`: it is ahead.
 *
 * Both screens of the making ask it — the live one about a stage being worked on, the finished one
 * about five that are behind — so the answer is worked out here rather than twice on two screens.
 */
export function stageStanding(stage: MontageStage | undefined): StepState {
  if (stage === undefined || stage.state === 'pending') return 'waiting';
  return stage.state;
}

/**
 * «собран за 14 мин» — the whole making, added up out of the stages that have both ends (spec 7.6,
 * `MontageLiveDone`). Their own times and not the span from the first to the last: what is worth
 * saying is how long the work took, and a montage that stood in a queue between two stages did not
 * spend that wait being made.
 *
 * Rounded up and never under a minute, the way «осталось ≈» is: a video cut in forty seconds was
 * still cut, and «собран за 0 мин» is the screen saying nothing happened. Null when not one stage
 * has finished — the line is then simply not drawn, rather than drawn around a made-up number.
 */
export function madeInMinutes(stages: readonly MontageStage[]): number | null {
  const spans = stages
    .map((stage) =>
      stage.started_at === null || stage.finished_at === null
        ? NaN
        : new Date(stage.finished_at).getTime() - new Date(stage.started_at).getTime(),
    )
    .filter((span) => !Number.isNaN(span) && span >= 0);
  if (spans.length === 0) return null;
  return Math.max(
    1,
    Math.ceil(spans.reduce((sum, span) => sum + span, 0) / 60000),
  );
}

/**
 * «Как собирался» in three numbers (spec 7.6, detail 44): every frame the worker looked at, the ones
 * the director took into the film, and the cuts they came to. Each is one stage's own outcome under
 * the keys the api names, so a montage whose journal is missing one of them shows two tiles rather
 * than a tile with nothing in it — the same rule the line under a stage's name follows.
 *
 * The words belong to the screen and arrive with the dictionary, the way `stageLine`'s do: what is
 * worked out here is which number answers which of them.
 */
export function howMade(
  stages: readonly MontageStage[],
  s: Strings,
): { figure: number; label: string }[] {
  const { live } = s.montage;
  const outcomeOf = (code: MontageStageCode) => stages.find((one) => one.stage === code)?.outcome;
  const cuts = outcomeOf('assembly')?.cuts;
  const three = [
    { figure: outcomeOf('screening')?.of, label: live.watched },
    { figure: outcomeOf('directing')?.frames, label: live.tookIn },
    { figure: cuts, label: live.glued(cuts ?? 0) },
  ];
  return three.filter(
    (tile): tile is { figure: number; label: string } => tile.figure !== undefined,
  );
}

/** Every record a stage holds, which is what the way into its journal is counted in. */
export const recordsOf = (stage: MontageStage): number =>
  stage.taken_count + stage.skipped_count + stage.thought_count;

/**
 * Which records the journal is showing — the four chips over it (spec 7.6, `MontageLiveStage`). The
 * three narrow ones are drawn against the api's own counts, so they are cut the way the api counts
 * them: by the decision on the record, and «мысли» is a record with no decision at all.
 */
export type Sift = 'all' | 'thoughts' | 'take' | 'skip';

export function sifted(entries: readonly JournalEntry[], sift: Sift): JournalEntry[] {
  if (sift === 'all') return [...entries];
  if (sift === 'thoughts') return entries.filter((entry) => entry.decision === null);
  return entries.filter((entry) => entry.decision === sift);
}

/**
 * Where a frame lay in the film (spec 7.6, `SheetLiveFile`) — «Часть 2 «Клятвы» · 1:12–1:16 · и ещё
 * 1». A fact of the layout and not of the thought: the seconds are the file's own `places`, so the
 * line is there whether the director said anything about the frame or not — and on the road without
 * the director it never does. The part of the story is the record's, and a frame that stands in the
 * video twice says so by a count rather than by a second line: the sheet is about the frame, not
 * about the cutting list.
 *
 * A record that passed the frame over has none of this, however the file is laid out: its card is
 * about why it was passed over, and a frame the organizer then asked for is placed on the card of
 * the record that took it.
 */
export function placeLine(
  entry: JournalEntry,
  file: JournalFile | undefined,
  s: Strings,
): string | undefined {
  if (entry.decision === 'skip') return undefined;
  const { live } = s.montage;
  const [place, ...rest] = file?.places ?? [];
  const from = place === undefined ? undefined : formatRuntime(place.start_seconds);
  const to =
    place === undefined ? undefined : formatRuntime(place.start_seconds + place.duration_seconds);
  const parts = [
    entry.story_part === null
      ? undefined
      : live.partOf(entry.story_part, entry.story_part_title ?? undefined),
    from !== undefined && to !== undefined ? `${from}–${to}` : undefined,
    rest.length === 0 ? undefined : live.morePlaces(rest.length),
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** Did this record arrive while the screen was open — the one question the typing asks. */
export const isFresh = (journal: Journal, entry: JournalEntry): boolean =>
  journal.settled === null || entry.id > journal.settled;

/* ── The record, in words ─────────────────────────────────────────────── */

/**
 * A reason code in words — why a frame was passed over, and `included` on the one kind of take that
 * has a reason at all. The worker's vocabulary is open — the api puts no check on the column — so a
 * code this app has no word for is read as «not suitable» rather than shown raw or dropped: it is
 * still an honest thing to say about a frame nobody took.
 *
 * Own keys only: the code is the model's own words, and `in` would hand `__proto__` or
 * `constructor` back as an object or a function for the screen to render.
 */
export function reasonWord(reason: string | null, s: Strings): string | undefined {
  if (!reason) return undefined;
  const words = s.montage.live.reason;
  return Object.prototype.hasOwnProperty.call(words, reason)
    ? words[reason as keyof typeof words]
    : words.other;
}

/**
 * Why a frame was taken, where the worker says: `included`, the organizer asked for it at the order —
 * the one reason it writes on a take (montage README, «Слово организатора видно с обеих сторон»).
 * It stands beside «Беру», never instead of it (spec 28). Any other code on a take has no word here:
 * «не подошёл» beside «беру» would be the record arguing with itself.
 */
export const whyTaken = (entry: JournalEntry, s: Strings): string | undefined =>
  entry.decision === 'take' && entry.reason === 'included'
    ? s.montage.live.reason.included
    : undefined;

/**
 * What a record wears as pills (spec 7.7): the decision first, then what qualifies it. «Беру» alone
 * for a photograph, «Беру 0:04–0:07» where a piece of a video was taken, «Взял 1 из 4» where it was
 * one of a burst, and beside either why it was taken and the part of the story it went into. A
 * record with no decision is a thought and wears nothing — it is the plate, not the pill.
 */
export function marksOf(entry: JournalEntry, s: Strings): string[] {
  const { live } = s.montage;
  if (entry.decision === null) return [];
  if (entry.decision === 'skip') {
    const why = reasonWord(entry.reason, s);
    return why ? [live.skip, why] : [live.skip];
  }

  const from = formatRuntime(entry.source_from_seconds);
  const to = formatRuntime(entry.source_to_seconds);
  const took =
    from !== undefined && to !== undefined
      ? live.tookFrom(from, to)
      : entry.series_size !== null && entry.series_size > 1
        ? live.tookOneOf(entry.series_size)
        : live.take;
  return [
    took,
    whyTaken(entry, s),
    entry.story_part === null ? undefined : live.part(entry.story_part),
  ].filter((mark): mark is string => mark !== undefined);
}

/* ── Reading it live ──────────────────────────────────────────────────── */

const watchApp = (listener: () => void) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};

const appActive = () => AppState.currentState === 'active';

/** Whether the app is the thing on the phone's screen at all. Polling stops when it is not. */
function useAppActive(): boolean {
  return useSyncExternalStore(watchApp, appActive, appActive);
}

/**
 * The journal of one video, read and kept up to date — what both screens of the live montage stand
 * on. It polls while the video is being made and stops the moment it is ready or has fallen over:
 * nothing more is coming, and what was read stays where it is. It also stops while the screen is
 * behind another one or the app is in somebody's pocket, and reads once the moment either comes
 * back — a phone that spent a minute asleep catches up in one poll, whatever landed meanwhile.
 *
 * A read that never comes back changes one word and nothing else (`offline`): the journal on screen
 * is the truth as of the last answer, and throwing it away because the lift has no signal would be
 * the one thing a person watching would never forgive. The next poll that succeeds takes the word
 * off again. A 404 is not that (`refused`): the api is saying this reader is not in the memory, and
 * polling stops until the screen comes back in front — on either road the journal is read by, the
 * poll and the page further back.
 */
export function useMontageJournal(
  token: string | null,
  memoryId: string,
  montageId: string,
  { stage }: Narrow = {},
): Journal & { standing: Standing; loadOlder: () => void; restart: () => void } {
  const [state, setState] = useState<Journal>(NO_JOURNAL);
  /** The same thing a poll reads and folds into — state itself is a render behind. */
  const held = useRef<Journal>(NO_JOURNAL);
  /** One read at a time: a poll may chase several pages, and two of them would race the cursor. */
  const reading = useRef(false);
  const focused = useIsFocused();
  const active = useAppActive();

  const ask = useCallback<Ask>(
    (query) => fetchJournal(token ?? '', memoryId, montageId, query),
    [token, memoryId, montageId],
  );

  const read = useCallback(
    async (older = false) => {
      if (!token || reading.current) return;
      reading.current = true;
      // What this read started from. If the journal underneath was thrown away while it was in
      // flight — another video, another narrowing — its answer belongs to the journal that is gone.
      const from = held.current;
      try {
        const narrow = { stage };
        // A poll that breaks halfway through its pages is dropped whole rather than kept in part:
        // the cursor then stays where it was and the next one asks for the same records again.
        let next = await (older ? pullOlder : pull)(from, ask, narrow);
        // Ready under the journal of a stage that was read while the film was being made: its
        // files predate the layout, and this is the last read there will be (`relaid`). The whole
        // journal is not read again — the one screen that reads it through the making leaves for
        // the film's page the moment it is ready, and that page reads it from nothing.
        if (
          stage !== undefined &&
          from.cursor !== null &&
          from.status !== 'ready' &&
          next.status === 'ready'
        ) {
          next = await relaid(next, ask, narrow);
        }
        if (held.current !== from) return;
        held.current = next;
        setState(next);
      } catch (e) {
        if (held.current !== from) return;
        held.current =
          e instanceof ApiError && e.status === 404
            ? { ...from, refused: true }
            : { ...from, offline: true };
        setState(held.current);
      } finally {
        reading.current = false;
      }
    },
    [token, ask, stage],
  );

  /**
   * Everything held thrown away, and the journal read again from nothing. Another video, or the same
   * one under a different narrowing, is another journal — and so is a fallen one queued again: the
   * api wipes the last attempt's records with it, and a screen still holding them would be showing
   * a making that no longer exists, stopped at `failed` with nothing left to poll for.
   */
  const restart = useCallback(() => {
    // A fresh object and not `NO_JOURNAL` itself: a first read still in the air started from that
    // very object, and `held.current !== from` must see the journal it read for as gone.
    held.current = { ...NO_JOURNAL };
    setState(held.current);
  }, []);

  useEffect(restart, [restart, ask, stage]);

  // On the way in, and again the moment the screen comes back in front or the app wakes up.
  useEffect(() => {
    if (focused && active) void read();
  }, [focused, active, read]);

  // And on its own while the worker still owes this one. An interval rather than a timeout chained
  // off each read, the same reasoning the gallery's own loop carries: one read failing on a bad
  // connection would end the chain, and end it silently.
  const making = !state.refused && (state.status === null || beingMade(state.status));
  useEffect(() => {
    if (!focused || !active || !making) return;
    const timer = setInterval(() => void read(), WHILE_LIVE_MS);
    return () => clearInterval(timer);
  }, [focused, active, making, read]);

  const standing: Standing = state.refused
    ? 'refused'
    : state.status === 'failed'
      ? 'failed'
      : state.status === 'ready'
        ? 'ready'
        : state.offline
          ? 'offline'
          : state.status === null
            ? 'opening'
            : 'live';

  const loadOlder = useCallback(() => void read(true), [read]);

  return { ...state, standing, loadOlder, restart };
}

/** How long one step of the typing takes, and how many steps a thought is spread over. */
const TYPE_MS = 30;
const TYPE_STEPS = 60;

/**
 * A thought being said rather than simply being there (spec 7.6). Nothing streams — the api hands
 * over the whole sentence at once — so this is the app's own doing, and it only ever applies to a
 * record that arrived while somebody was watching: everything that was already in the journal when
 * the screen opened stands there finished, or opening a montage from last week would replay an
 * afternoon of typing.
 *
 * Longer thoughts are typed in bigger steps rather than over a longer time: the api lets a thought
 * run to 500 characters, and a sentence that takes fifteen seconds to appear is not being said, it
 * is being withheld. «Reduce motion» puts the whole of it up at once, which is also what the kit's
 * own cursor does under that setting.
 *
 * The sentence comes back in two halves, `said` and `unsaid`, and the kit lays the second out
 * without drawing it: the words take their final room from the first letter, so nothing under them
 * moves while they arrive (spec 7.6, «экран не прыгает»). A new sentence starts from nothing on the
 * very render it arrives on, not one frame later with the last one's length.
 */
export function useTypedThought(
  text: string | null | undefined,
  fresh: boolean,
): { said: string; unsaid: string } {
  const reduced = useReducedMotion();
  const whole = text ?? '';
  const typing = fresh && !reduced && whole !== '';
  const [typed, setTyped] = useState({ of: whole, at: typing ? 0 : whole.length });
  const at = typed.of === whole ? typed.at : typing ? 0 : whole.length;

  useEffect(() => {
    if (!typing) {
      setTyped({ of: whole, at: whole.length });
      return;
    }
    setTyped({ of: whole, at: 0 });
    const step = Math.max(1, Math.ceil(whole.length / TYPE_STEPS));
    let upTo = 0;
    const timer = setInterval(() => {
      upTo = Math.min(whole.length, upTo + step);
      setTyped({ of: whole, at: upTo });
      if (upTo === whole.length) clearInterval(timer);
    }, TYPE_MS);
    return () => clearInterval(timer);
  }, [whole, typing]);

  return { said: whole.slice(0, at), unsaid: whole.slice(at) };
}
