// «Выбрать всё за эту дату»: the upload screen opens on the phone's whole camera roll, and the
// only thing it knows about the event is the memory's window. This turns that window into a
// preselection, so the common case — everything shot at the event — is one tap and not fifty.

import type { Memory } from '@/api';
import { endOfDay, startOfDay } from '@/dates';

/** As much of an expo-media-library `Asset` as the pick needs: epoch ms, 0 when the file has none. */
export type Captured = { creationTime?: number | null };

/**
 * The assets shot during a memory's event, in the order they came in.
 *
 * The window is a span of *days*, not of instants: the api carries its ends as RFC 3339 with an
 * offset, and both are widened back out to the whole local day the same way the create screen
 * narrowed them down. Local on purpose — the day a photo belongs to is the day the phone holding
 * it says, which is also the day `formatEventDates` prints under the title. A memory without an
 * end is a single day.
 *
 * An asset with no capture date is never picked: nothing places it inside the event, and guessing
 * wrong here uploads somebody's whole gallery.
 */
export function assetsInEventWindow<T extends Captured>(
  memory: Pick<Memory, 'event_start' | 'event_end'>,
  assets: readonly T[],
): T[] {
  const from = startOfDay(new Date(memory.event_start)).getTime();
  const until = endOfDay(new Date(memory.event_end ?? memory.event_start)).getTime();

  return assets.filter(
    ({ creationTime }) => !!creationTime && creationTime >= from && creationTime <= until,
  );
}
