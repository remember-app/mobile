import type { JournalEntry } from '@/api';
import { formatRuntime } from '@/lib/dates';
import type { Strings } from '@/strings';

/**
 * One record of the journal read out as a sentence — why a frame was taken, why it was passed over,
 * and the marks that stand beside it. The only part of the journal that needs the dictionary.
 */
/* ── The record, in words ─────────────────────────────────────────────── */

/**
 * A reason code in words — why a frame was passed over. The list is the api's closed one
 * (`docs/journal.md`, «Причины мимо»), and the worker writes nothing outside it, so a code that
 * turns up anyway is read as «not suitable» rather than shown raw or dropped: it is still an honest
 * thing to say about a frame nobody took.
 *
 * Own keys only: the code is the model's own words, and `in` would hand `__proto__` or
 * `constructor` back as an object or a function for the screen to render.
 */
export function reasonWord(reason: string | null, s: Strings): string | undefined {
  if (!reason) return undefined;
  const words = s.montage.live.reason;
  return Object.hasOwn(words, reason) ? words[reason as keyof typeof words] : words.other;
}

/**
 * Why a record went the way it did — the one pill a sheet about a single file stands under its
 * decision: why a frame was passed over. A take wears none: the worker writes no reason on one, so
 * there is nothing to say beside «Беру». The same words the journal's own pills say it in
 * (`marksOf`), so the two can never name the reason differently.
 */
export const whyDecided = (entry: JournalEntry, s: Strings): string | undefined =>
  entry.decision === 'skip' ? reasonWord(entry.reason, s) : undefined;

/**
 * What a record wears as pills (spec 7.7): the decision first, then what qualifies it. «Беру» alone
 * for a photograph, «Беру 0:04–0:07» where a piece of a video was taken, «Взял 1 из 4» where it was
 * one of a burst, and beside a take the part of the story it went into. A record with no decision is
 * a thought and wears nothing — it is the plate, not the pill.
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
    entry.story_part === null ? undefined : live.part(entry.story_part),
  ].filter((mark): mark is string => mark !== undefined);
}
