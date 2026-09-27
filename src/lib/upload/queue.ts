// The bookkeeping behind an upload that can be interrupted: what a file is cut into, what R2 has
// already taken, and what is therefore still to send. Kept apart from the sending itself (`@/
// uploads`) because this is the part that decides whether a resumed upload carries on or starts
// again — and the part that can be checked without a phone.
//
// Nothing here reaches `@/api` or `@/lib/language`: both of those end at a native module, and this file
// is the one a test can import as it is.
import type { Strings } from '@/strings';

/**
 * Why a file is parked: which line the app has for it and what goes into that line, never the
 * sentence itself. The queue is written to disk and outlives both a language switch and the app,
 * so a reason worded at the moment the upload broke is a reason in whatever language that moment
 * happened to be in (TASK-93). The words are picked in `failureText`, when the banner is drawn.
 */
export type UploadFailure =
  /** The gallery no longer has the entry. */
  | { reason: 'gone' }
  /**
   * The phone would not hand the file over: no file behind the entry, a grant taken back since the
   * pick, or bytes that would not come off it. It is about the file, not about any server — and not
   * about iCloud either, which has its own reason below (TASK-419).
   */
  | { reason: 'unreadable'; detail: string }
  /**
   * The original lives in iCloud — «Оптимизация хранения», the ordinary state of a full iPhone —
   * and could not be brought down just now. The phone carries the download on in the background,
   * so this is a file to try again and not one to give up on.
   */
  | { reason: 'iCloud'; detail: string }
  | { reason: 'partSizeChanged' }
  | { reason: 'noReceipt' | 'noLink' | 'partNotTaken'; part: number }
  | { reason: 'partRefused'; part: number; status: number }
  /**
   * Storage never answered for a part: the connection dropped, or it went quiet past
   * `partDeadline`. `status` is storage's code when one had come before the line went.
   */
  | { reason: 'storageOffline'; part: number; status?: number }
  /**
   * No api at the other end at all — the line every screen shows for a dead network. Only a call to
   * the api lands here: storage and the phone's own gallery have reasons of their own (TASK-413).
   */
  | { reason: 'offline' }
  /**
   * The api answered and refused. `said` is its own wording when it sent one: that comes down the
   * wire already in a language (TASK-91) and is the one reason here nothing translates.
   */
  | { reason: 'api'; status: number; said?: string };

/**
 * That reason in the language the app is speaking right now. A file name or a part number is never
 * in it: the file is named on its own line, and the part is where it happened, not what happened.
 * Nor is which of storage's three ways of not taking a part it was — a refusal, links that kept
 * running out, a part taken with no receipt all leave the file in the same place, on storage's side.
 *
 * The two api fallbacks are the same two `errorMessage` picks in `@/api` — said here rather than
 * imported, because importing that module drags the whole native side in behind it.
 */
export function failureText(s: Strings, failure: UploadFailure): string {
  switch (failure.reason) {
    case 'gone':
      return s.upload.gone;
    case 'unreadable':
      return s.upload.unreadable;
    case 'iCloud':
      return s.upload.iCloud;
    case 'partSizeChanged':
      return s.upload.partSizeChanged;
    case 'noLink':
      return s.upload.noLink;
    case 'partRefused':
    case 'partNotTaken':
    case 'noReceipt':
      return s.upload.storageRefused;
    case 'storageOffline':
      return s.upload.storageOffline;
    case 'offline':
      return s.error.offline;
    case 'api':
      if (failure.status === 429) return s.error.tooMany;
      return failure.said ?? s.error.status(failure.status);
  }
}

/** Storage's own code, where it answered with one — what the words above leave out on purpose. */
function storageCode(failure: UploadFailure): number | undefined {
  return failure.reason === 'partRefused' || failure.reason === 'storageOffline'
    ? failure.status
    : undefined;
}

/** The step the phone balked at and what it said there, word for word — left out of the words too. */
function phoneDetail(failure: UploadFailure): string | undefined {
  return failure.reason === 'unreadable' || failure.reason === 'iCloud'
    ? failure.detail
    : undefined;
}

/** A file the queue could not get out, and why. */
export type ParkedFile = QueuedFile & { error: UploadFailure };

/**
 * Why one parked file did not go, as its line in the block of failures says it (spec detail 51):
 * the reason, and after it whichever the file itself can add — storage's own code where storage
 * answered with one (TASK-413 wants it seen), or the phone's own words where it refused the file
 * (TASK-434). A failure is always one or the other, never both.
 */
export function parkedReason(s: Strings, failure: UploadFailure): string {
  const words = failureText(s, failure);
  const said = storageCode(failure) ?? phoneDetail(failure);
  return said === undefined ? words : `${words} (${said})`;
}

/** One file waiting to go into a memory, and how far it got. This is what survives a restart. */
export type QueuedFile = {
  /** The gallery's own id. Identity of the entry, so the same photo is never queued twice. */
  assetId: string;
  memoryId: string;
  filename: string;
  /**
   * The gallery's own picture of it, for «Мои кадры» to draw while the file is on its way. Absent
   * on a queue left by a build older than that screen: the tile then stands without a picture.
   */
  uri?: string;
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
  error?: UploadFailure;
  /**
   * Set while the original is being brought down from iCloud, so the screen can say that instead of
   * standing at nought with no word for it. As transient as `error` and dropped the same way when a
   * queue comes back from disk: a download the app was killed in the middle of is not going on.
   */
  cloud?: true;
};

/** One slice of the file: which part number it is, and the bytes it is cut from. */
export type PartRange = { number: number; start: number; length: number };

/** How many slices a file of this size falls into — the same count the api signs links for. */
export const partCount = (size: number, partSize: number) =>
  Math.max(1, Math.ceil(size / partSize));

/**
 * The slowest uplink a part is still waited out on, in bytes a millisecond: 32 is 256 kbit/s, a
 * phone at the edge of a cell in a crowd. A whole 8 MiB part takes a little over four minutes at that.
 */
const SLOWEST_UPLINK = 32;

/** On top of the bytes themselves: the connection, the handshake, storage taking the part in. */
const PART_GRACE_MS = 30_000;

/**
 * How long storage is given for one part before it counts as not answering. Scaled to the part and
 * not one number for all: the part size is the api's to hand out (8 MiB today), and a small photo's
 * one part has no business hanging for the minutes a whole part may honestly take.
 *
 * ponytail: a deadline for the whole part and not for silence — `fetch` reports no upload progress,
 * so a link slower than `SLOWEST_UPLINK` never gets a whole part through and parks as a dropped
 * connection. XHR's `upload.onprogress` is the way to a timer that restarts on every byte sent.
 */
export const partDeadline = (bytes: number) => PART_GRACE_MS + bytes / SLOWEST_UPLINK;

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
export function uploadedParts(
  done: Record<number, string>,
): { part_number: number; etag: string }[] {
  return Object.entries(done)
    .map(([number, etag]) => ({ part_number: Number(number), etag }))
    .sort((a, b) => a.part_number - b.part_number);
}

/** How far along one file is, 0…1. A file the api has not sized yet stands at nought. */
export function progress(file: QueuedFile): number {
  if (!file.size || !file.partSize) return 0;
  return Math.min(Object.keys(file.parts).length / partCount(file.size, file.partSize), 1);
}
