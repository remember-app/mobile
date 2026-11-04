import type { JournalEntry } from '@/api';
import { formatRuntime } from '@/lib/dates';
import type { Strings } from '@/strings';
export function reasonWord(reason: string | null, s: Strings): string | undefined {
  if (!reason) return undefined;
  const words = s.montage.live.reason;
  return Object.hasOwn(words, reason) ? words[reason as keyof typeof words] : words.other;
}
export const whyDecided = (entry: JournalEntry, s: Strings): string | undefined =>
  entry.decision === 'skip' ? reasonWord(entry.reason, s) : undefined;
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
  return [took, entry.story_part === null ? undefined : live.part(entry.story_part)].filter(
    (mark): mark is string => mark !== undefined,
  );
}
