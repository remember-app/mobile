// The bookkeeping behind an upload that can be interrupted: what a file is cut into, what R2 has
// already taken, and what is therefore still to send. Kept apart from the sending itself (`@/
// uploads`) because this is the part that decides whether a resumed upload carries on or starts
// again — and the part that can be checked without a phone.

/** One file waiting to go into a memory, and how far it got. This is what survives a restart. */
export type QueuedFile = {
  /** The gallery's own id. Identity of the entry, so the same photo is never queued twice. */
  assetId: string;
  memoryId: string;
  filename: string;
  kind: 'photo' | 'video';
  capturedAt: string | null;
  durationSeconds: number | null;
  /** The `media_items` row the api minted. Absent means this file has not been announced yet. */
  mediaId?: string;
  /** The size the intent declared, and the one the api signed part links against. */
  size?: number;
  partSize?: number;
  /** Part number → R2's etag. The whole of what makes a resume a resume. */
  parts: Record<number, string>;
  /** Why it is parked. Cleared on every retry, so it is always the last reason and not the first. */
  error?: string;
};

/** One slice of the file: which part number it is, and the bytes it is cut from. */
export type PartRange = { number: number; start: number; length: number };

/** How many slices a file of this size falls into — the same count the api signs links for. */
export const partCount = (size: number, partSize: number) =>
  Math.max(1, Math.ceil(size / partSize));

/**
 * The slices still to send: every part R2 has not answered for yet, in order.
 *
 * This is the whole of «докачивается, а не начинается заново». A part R2 took is remembered by
 * its etag, and an etag in hand keeps that slice out of this list for good — through a dropped
 * connection, a re-issued link, or the app being killed and opened again.
 */
export function missingParts(
  size: number,
  partSize: number,
  done: Record<number, string>,
): PartRange[] {
  return Array.from({ length: partCount(size, partSize) }, (_, index) => ({
    number: index + 1,
    start: index * partSize,
    // Every slice but the last is a whole part; the last is whatever the file has left.
    length: Math.min(partSize, size - index * partSize),
  })).filter((part) => done[part.number] === undefined);
}

/**
 * The parts as the «загружено» callback reports them. Sorted by number and not by the key order
 * of the object: those are strings, and by string order part 10 comes before part 9 — which S3
 * answers with `InvalidPart` after the whole file is already up there.
 */
export function uploadedParts(done: Record<number, string>): { part_number: number; etag: string }[] {
  return Object.entries(done)
    .map(([number, etag]) => ({ part_number: Number(number), etag }))
    .sort((a, b) => a.part_number - b.part_number);
}

/** How far along one file is, 0…1. A file the api has not sized yet stands at nought. */
export function progress(file: QueuedFile): number {
  if (!file.size || !file.partSize) return 0;
  return Math.min(Object.keys(file.parts).length / partCount(file.size, file.partSize), 1);
}
