// «Выбрать все за эту дату»: the upload screen opens on the phone's whole camera roll, and the only
// thing it knows about the event is the memory's window. This cuts the roll into the days it was
// shot over and floats the event's own days to the top, so the common case — everything shot at the
// event — is one tap per day and not fifty.

import type { Memory } from '@/api';
import { endOfDay, startOfDay } from '@/lib/dates';

/** As much of an expo-media-library `Asset` as the cut needs: epoch ms, 0 when the file has none. */
export type Captured = { creationTime?: number | null };

/** One day of the camera roll: the day itself, whether the event was on, and what was shot on it. */
export type ShootingDay<T> = {
  /** The instant that day began here — the sort key, and the day the screen writes out. */
  at: number;
  /** Whether this day falls inside the memory's event window. */
  inEvent: boolean;
  assets: T[];
};

/**
 * The camera roll cut into the local days it was shot over, the event's days first and the rest of
 * the roll behind them, each run of days newest first.
 *
 * The days are *local* days, not UTC ones: the day a photo belongs to is the day the phone holding
 * it says, which is also the day `formatDay` prints over the strip. The window is local for the
 * same reason — the api carries its ends as RFC 3339 with an offset, and both are widened back out
 * to the whole local day the way the create screen narrowed them down. A memory without an end is
 * a single day; `null` is a memory that has not arrived, and then no day is the event's and the
 * roll is simply the roll.
 *
 * An asset the phone gave no capture date lands on the epoch day at the very bottom, which is where
 * the roll's own order would have put it anyway. It is not dropped: nothing places it inside the
 * event, but it is still on the phone and somebody may still want to send it.
 */
export function assetsByDay<T extends Captured>(
  memory: Pick<Memory, 'event_start' | 'event_end'> | null,
  assets: readonly T[],
): ShootingDay<T>[] {
  const from = memory === null ? 0 : startOfDay(new Date(memory.event_start)).getTime();
  // An empty window when there is no memory: `-1` is before every day the loop below can build,
  // so nothing is the event's rather than everything.
  const until =
    memory === null ? -1 : endOfDay(new Date(memory.event_end ?? memory.event_start)).getTime();

  const days = new Map<number, ShootingDay<T>>();
  for (const asset of assets) {
    const at = startOfDay(new Date(asset.creationTime || 0)).getTime();
    let day = days.get(at);
    if (day === undefined) {
      day = { at, inEvent: at >= from && at <= until, assets: [] };
      days.set(at, day);
    }
    day.assets.push(asset);
  }

  // Newest day first, as the roll itself comes off the phone, with the event lifted whole above it.
  return [...days.values()].sort((a, b) => Number(b.inEvent) - Number(a.inEvent) || b.at - a.at);
}
