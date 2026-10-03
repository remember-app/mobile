import type { JournalEntry, JournalQuery, MontageJournal, MontageStage } from '@/api';
import type { Journal } from '@/lib/montage/journal';

/**
 * The api's answers about a montage, written out by hand to the shape its README publishes («Журнал
 * монтажа»). Nothing here touches a network or the live stand.
 */

export const entry = (id: number, over: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  stage: 'directing',
  media_id: null,
  thought: `мысль ${id}`,
  decision: null,
  reason: null,
  series_size: null,
  story_part: null,
  story_part_title: null,
  source_from_seconds: null,
  source_to_seconds: null,
  labels: null,
  details: null,
  created_at: '2026-09-21T16:42:00Z',
  ...over,
});

/** A page of the journal. Records go out newest first, whichever way the cursor was going. */
export const page = (ids: number[], over: Partial<MontageJournal> = {}): MontageJournal => ({
  montage: { id: 'm', status: 'processing' },
  stages: [],
  entries: ids.map((id) => entry(id)).sort((a, b) => b.id - a.id),
  has_more: false,
  files: [],
  viewers: [],
  ...over,
});

/** A row of ids, oldest to newest — the batch an «understanding» stage writes in one go. */
export const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** An api that hands back the pages it was given, one per ask, and records what it was asked. */
export function serving(pages: MontageJournal[]) {
  const asked: JournalQuery[] = [];
  let at = 0;
  return {
    asked,
    ask: async (query: JournalQuery) => {
      asked.push(query);
      return pages[at++] ?? page([]);
    },
  };
}

export const idsOf = (journal: Journal) => journal.entries.map((one) => one.id);

/** One of the five stages of the making, as the api reports it. */
export const stage = (
  code: MontageStage['stage'],
  state: MontageStage['state'],
  eta: number | null = null,
): MontageStage => ({
  stage: code,
  state,
  started_at: null,
  finished_at: null,
  eta_seconds: eta,
  done_count: 0,
  total_count: null,
  outcome: {},
  updated_at: '2026-09-21T16:42:00Z',
  taken_count: 0,
  skipped_count: 0,
  thought_count: 0,
});
