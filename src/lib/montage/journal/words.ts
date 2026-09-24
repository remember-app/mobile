import type { JournalEntry } from '@/api';
import { formatRuntime } from '@/lib/dates';
import type { Strings } from '@/strings';

/**
 * One record of the journal read out as a sentence — why a frame was taken, why it was passed over,
 * and the marks that stand beside it. The only part of the journal that needs the dictionary.
 */
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
  return Object.hasOwn(words, reason) ? words[reason as keyof typeof words] : words.other;
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
 * Why a record went the way it did — the one pill a sheet about a single file stands under its
 * decision: why a frame was passed over, or why it was taken (`whyTaken`). The same words the
 * journal's own pills say it in (`marksOf`), so the two can never name the reason differently.
 */
export const whyDecided = (entry: JournalEntry, s: Strings): string | undefined =>
  entry.decision === 'skip' ? reasonWord(entry.reason, s) : whyTaken(entry, s);

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
