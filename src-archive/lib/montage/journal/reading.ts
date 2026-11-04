import type {
  JournalEntry,
  JournalFile,
  JournalQuery,
  Montage,
  MontageJournal,
  MontageStage,
  Viewer,
} from '@/api';
export const WHILE_LIVE_MS = 1500;
const PAGES = 25;
export type Journal = {
  status: Montage['status'] | null;
  stages: MontageStage[];
  entries: JournalEntry[];
  files: Record<string, JournalFile>;
  viewers: Viewer[];
  cursor: number | null;
  oldest: number | null;
  hasOlder: boolean;
  settled: number | null;
  offline: boolean;
  refused: boolean;
};
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
export type Standing = 'opening' | 'live' | 'ready' | 'failed' | 'offline' | 'refused';
export type Narrow = Pick<JournalQuery, 'stage'>;
export type Ask = (query: JournalQuery) => Promise<MontageJournal>;
function withPage(state: Journal, page: MontageJournal): Pick<Journal, 'entries' | 'files'> {
  const held = new Map(state.entries.map((entry) => [entry.id, entry] as const));
  for (const entry of page.entries) held.set(entry.id, entry);
  return {
    entries: [...held.values()].sort((a, b) => b.id - a.id),
    files: { ...state.files, ...Object.fromEntries(page.files.map((file) => [file.id, file])) },
  };
}
function fold(state: Journal, page: MontageJournal, mode: 'first' | 'forward' | 'back'): Journal {
  const ids = page.entries.map((entry) => entry.id);
  const top = ids.length > 0 ? Math.max(...ids) : null;
  const bottom = ids.length > 0 ? Math.min(...ids) : null;
  return {
    status: page.montage.status,
    stages: page.stages,
    viewers: page.viewers,
    ...withPage(state, page),
    cursor: top === null ? state.cursor : Math.max(state.cursor ?? top, top),
    oldest: bottom === null ? state.oldest : Math.min(state.oldest ?? bottom, bottom),
    hasOlder: mode === 'forward' ? state.hasOlder : page.has_more,
    settled: state.status === null ? top : state.settled,
    offline: false,
    refused: false,
  };
}
export async function pull(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  let held = state;
  for (let page = 0; page < PAGES; page++) {
    const first = held.cursor === null;
    const answer = await ask(
      first ? { ...narrow } : { ...narrow, after: held.cursor ?? undefined },
    );
    const next = fold(held, answer, first ? 'first' : 'forward');
    if (first || !answer.has_more || next.cursor === held.cursor) return next;
    held = next;
  }
  return held;
}
export async function pullOlder(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  if (state.oldest === null) return state;
  return fold(state, await ask({ ...narrow, before: state.oldest }), 'back');
}
export async function relaid(state: Journal, ask: Ask, narrow: Narrow = {}): Promise<Journal> {
  const again = await pull({ ...NO_JOURNAL, cursor: 0 }, ask, narrow);
  return { ...state, files: { ...state.files, ...again.files } };
}
export const startedOver = (held: readonly MontageStage[], now: readonly MontageStage[]): boolean =>
  held.some(
    (was) =>
      was.started_at !== null &&
      now.find((one) => one.stage === was.stage)?.started_at !== was.started_at,
  );
export const isFresh = (journal: Journal, entry: JournalEntry): boolean =>
  journal.settled === null || entry.id > journal.settled;
