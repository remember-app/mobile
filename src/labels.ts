import type { Label, MediaItem } from '@/api';
import { labelColors, type Theme } from '@/theme';

/**
 * The rules of the labels sheet (doc-13, spec 7.7 and 10.8.1), kept out of the sheet itself: what a
 * press on a label row actually does to what is marked, and what the gallery looks like afterwards.
 * Nothing here draws or fetches anything, so a test reads it without a phone — the same reason
 * `@/frames` exists beside the feed it belongs to.
 *
 * What the app never decides for itself is **who may do any of it**: `can_edit` and `can_add_media`
 * come down with every label, worked out by the api's own rule, and the sheet draws a control where
 * the server said there may be one (api README, «Кто что может»).
 */

/** The label's colour: the palette cell the server keeps, 1–8, read as the paint the client holds. */
export function labelTint(color: number, theme: Theme): string {
  const palette = labelColors(theme);
  // A cell outside the eight is the api letting through something it never should; the first colour
  // is a label somebody can still see and rename, which an invisible one is not.
  return palette[color - 1] ?? palette[0];
}

/** What one press on a label row is about to do to the marked frames. */
export type Filing = {
  /**
   * Whether every marked frame already lies in this label — which is what lights the circle. A
   * selection only half filed reads as «не лежит», because the press that follows has to add the
   * rest rather than take the lot back out.
   */
  inside: boolean;
  /** The frames that press actually names: the missing ones going in, or all of them coming out. */
  ids: string[];
};

/**
 * What the row would do, from the frames themselves — `label_ids` on each marked record is the only
 * source of truth here, and it is the one the api hands the gallery.
 *
 * Nothing marked is «не лежит» with nothing to send: the sheet is open over a selection, and an
 * empty one is a row that files nothing.
 */
export function filing(labelId: string, frames: readonly MediaItem[]): Filing {
  const holds = (frame: MediaItem) => frame.label_ids.includes(labelId);
  const inside = frames.length > 0 && frames.every(holds);
  return {
    inside,
    ids: frames.filter((frame) => (inside ? holds(frame) : !holds(frame))).map((frame) => frame.id),
  };
}

/**
 * The gallery the moment after the api answered: the same records, with the box added to or taken
 * off the ones that moved. Nothing is re-read and nothing is re-ordered — a frame lies in as many
 * labels as it likes and appears in the feed exactly once, so this only ever rewrites one array on
 * one record.
 *
 * Patched rather than re-read on purpose: the feed's own quiet re-read deliberately keeps every
 * finished record's object where it is (`keepReady` in `@/frames`), so a fresh listing would not
 * carry the new `label_ids` onto a screen anyway — and a loud re-read would blink the whole feed
 * for a change of one array.
 */
export function filed(
  items: readonly MediaItem[] | null,
  labelId: string,
  /** Which frames moved — or every one of them, which is what a deleted box takes with it. */
  ids: readonly string[] | null,
  now: boolean,
): MediaItem[] | null {
  if (items === null) return null;
  const moved = ids === null ? null : new Set(ids);
  return items.map((item) => {
    if (moved !== null && !moved.has(item.id)) return item;
    const has = item.label_ids.includes(labelId);
    // A frame put in the same box twice is in it once: the api says so, and so does the feed.
    if (now === has) return item;
    return {
      ...item,
      label_ids: now
        ? [...item.label_ids, labelId]
        : item.label_ids.filter((one) => one !== labelId),
    };
  });
}

/**
 * Whether what has been typed is a name the api will take: something other than spaces, and no
 * longer than the hundred characters it stores. The button is off until it is — an empty name
 * refused by the server would be a round trip to say what the field could have said itself.
 */
export function labelNameOk(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= LABEL_NAME_MAX;
}

/** The api's own limit on a label's name. */
export const LABEL_NAME_MAX = 100;

/** The two groups of the sheet, in the order the api already sorted them into (api README). */
export function labelGroups(labels: readonly Label[]): { shared: Label[]; own: Label[] } {
  return {
    shared: labels.filter((label) => label.shared),
    own: labels.filter((label) => !label.shared),
  };
}

/**
 * The list with one label put back into it — the row the api answers every write with, new name,
 * new colour and new count included. Made, renamed or just filled: it is one rule, because the
 * answer is one shape.
 *
 * Sorted the way the api sorts its own listing — shared first, by title within, namesakes by id —
 * so a renamed label lands where a re-read would have put it, and the list never has to be fetched
 * twice for the sake of an order.
 */
export function withLabel(labels: readonly Label[], one: Label): Label[] {
  const rest = labels.filter((label) => label.id !== one.id);
  return [...rest, one].sort(
    (a, b) =>
      Number(b.shared) - Number(a.shared) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}
