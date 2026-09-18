// What the four steps of an order add up to (spec 8, «Ролик: заказ по шагам»): which frames go in,
// what the video is about, what it is cut to, how long it runs and which way up. The screen
// (`app/memory/[id]/order.tsx`) draws the steps; everything here is the arithmetic behind them, and
// the one place that turns what was picked into the body the api takes.
//
// Kept apart from that screen for the reason `@/upload-queue` is kept apart from `@/uploads`: this
// is the part that decides what actually reaches the worker, and it is the part that can be checked
// without a phone. Nothing here imports a value — the api's types come in as types alone, so a test
// can import this module as it is.
import type { MediaItem, MontageOrientation, MontageWishes, MusicTrackId } from '@/api';

/**
 * The shelf of tracks, in the layout's own order (`design/screens/MontageMusic.html`), each with the
 * running time of the file the worker holds (`projects/montage/tracks/README.md`). The times are
 * facts about those five files and not something the api hands out — there is no route that lists
 * the shelf, and a list of five that changes about once a year is not worth one.
 *
 * ponytail: nothing here can play them either — the worker holds the mp3s and nothing signs a link
 * to one, so step 3 shows no «Послушать» button. It is the one thing the layout draws that the api
 * cannot answer yet; the row in the kit already takes the button, so the day a preview route exists
 * it is a prop and not a redraw.
 */
export const TRACKS: readonly { id: MusicTrackId; length: string }[] = [
  { id: 'bright', length: '1:20' },
  { id: 'warm', length: '2:06' },
  { id: 'calm', length: '1:50' },
  { id: 'night', length: '1:50' },
  { id: 'road', length: '2:26' },
];

/**
 * How long to ask for. The api takes anything from a quarter of a minute to five and fills in a
 * minute itself when nothing is asked — these are the three round answers the layout offers, not the
 * whole range.
 */
export const LENGTHS = [30, 60, 120] as const;

export type Length = (typeof LENGTHS)[number];

/**
 * Below this there is nothing to cut a video out of, and the api refuses the order with 409
 * (`minReadyItems` in its `montages.ts`). Asked here before the first step rather than after the
 * last one: the layout answers it with `SheetTooLittle` in place of step 1, so nobody picks frames,
 * writes a story and chooses music only to be told at the end.
 */
export const MIN_FRAMES = 3;

/** How much of a story the layout takes. Well inside the api's own 2000 — it counts up, not down. */
export const STORY_LIMIT = 600;

/**
 * Everything the wizard has been told, one field per step. The two sets are the whole of step 1: the
 * automatic pass is a proposal, and these are the two directions the organizer overrules it in —
 * `dropped` is what they took out by hand, `returned` is what the pass took out and they put back.
 * Held as ids because the gallery underneath may be re-read at any moment.
 */
export type Order = {
  dropped: ReadonlySet<string>;
  returned: ReadonlySet<string>;
  story: string;
  /** One of the shelf, or none — a track nobody chose is the worker's to pick. */
  track: MusicTrackId | null;
  /** Their own track's key in R2, once it is up there. Wins over `track`; see `wishes`. */
  ownTrack: { key: string; name: string } | null;
  seconds: Length;
  orientation: MontageOrientation;
};

/** What the wizard opens on: the automatic pass as it stands, a minute long, horizontal. */
export const blankOrder = (): Order => ({
  dropped: new Set(),
  returned: new Set(),
  story: '',
  track: null,
  ownTrack: null,
  seconds: 60,
  orientation: 'landscape',
});

/**
 * The material an order can be made of: only `ready` counts. A frame still being developed has no
 * derivative the worker could measure, and the api refuses it by name in `include`/`exclude` and
 * leaves it out of the count that decides whether there is enough at all — so the screen must not
 * offer it either.
 */
export const usable = (items: readonly MediaItem[]): MediaItem[] =>
  items.filter((item) => item.status === 'ready');

/** Whether there is anything to cut at all — the question `SheetTooLittle` is the answer to. */
export const enoughMaterial = (items: readonly MediaItem[]): boolean =>
  usable(items).length >= MIN_FRAMES;

/**
 * Where one frame stands on step 1, in the kit's own words for a tile: `keep` is going into the
 * video, `auto` was dropped by the pass, `hand` was dropped by the organizer. A frame the pass
 * dropped and the organizer put back is `keep` again, and one they dropped by hand is `hand` however
 * the pass felt about it — the hand is always the last word.
 */
export type Pick = 'keep' | 'auto' | 'hand';

export function pickOf(item: MediaItem, order: Order): Pick {
  if (order.dropped.has(item.id)) return 'hand';
  if (item.screening_rejected && !order.returned.has(item.id)) return 'auto';
  return 'keep';
}

/**
 * One tap on a frame, as the two sets after it. Three states and one finger: what is in goes out,
 * what either of them dropped comes back. Nothing is ever «half in» — a frame put back by hand stays
 * in `returned` so that a second tap drops it by hand rather than handing it back to the pass.
 */
export function afterTap(
  item: MediaItem,
  order: Order,
): { dropped: Set<string>; returned: Set<string> } {
  const dropped = new Set(order.dropped);
  const returned = new Set(order.returned);

  if (pickOf(item, order) === 'keep') dropped.add(item.id);
  else {
    dropped.delete(item.id);
    if (item.screening_rejected) returned.add(item.id);
  }
  return { dropped, returned };
}

/** The frames that are going into the video, and the ones the pass has dropped and nobody restored. */
export const taken = (items: readonly MediaItem[], order: Order): MediaItem[] =>
  usable(items).filter((item) => pickOf(item, order) === 'keep');

export const droppedByPass = (items: readonly MediaItem[], order: Order): MediaItem[] =>
  usable(items).filter((item) => pickOf(item, order) === 'auto');

/**
 * Why the pass dropped a frame, in the words the sheet groups them under. The first three are the
 * worker's own verdicts (`screening.py`); `duplicate` is decided at the order rather than on the
 * file, so it never arrives from the gallery today — it is here because the layout draws it and
 * because the day the api does send it, an unknown word must not read as «other». Anything else does:
 * a reason this app has no word for is still a frame the organizer can take back.
 */
export type Reason = 'blur' | 'exposure' | 'unreadable' | 'duplicate' | 'other';

const REASONS: readonly Reason[] = ['blur', 'duplicate', 'exposure', 'unreadable', 'other'];

export const reasonOf = (raw: string | null): Reason =>
  REASONS.includes(raw as Reason) ? (raw as Reason) : 'other';

/**
 * What the pass dropped, gathered by reason — one row of `SheetRejected` each, in a fixed order so
 * the sheet does not reshuffle itself as frames are taken back. A reason with nothing left under it
 * is gone from the list: its row has nothing to say and nothing to return.
 */
export function rejectedGroups(
  items: readonly MediaItem[],
  order: Order,
): { reason: Reason; ids: string[] }[] {
  const dropped = droppedByPass(items, order);
  return REASONS.map((reason) => ({
    reason,
    ids: dropped.filter((item) => reasonOf(item.screening_reason) === reason).map((item) => item.id),
  })).filter((group) => group.ids.length > 0);
}

/**
 * The order as the api takes it (doc-03). Only what was actually settled is named: a frame nobody
 * touched is neither included nor excluded, because the worker's own pass is what decides those —
 * `include` is «this one goes in whatever you think of it» and `exclude` is «this one does not».
 *
 * `include` leaves out anything in `dropped`: a frame the pass dropped, the organizer put back and
 * then dropped by hand is still in `returned`, and naming it both ways is the one body the api
 * refuses outright. The same rule keeps the two tracks apart — their own file wins over the shelf,
 * because it is the later and more deliberate of the two answers.
 */
export function wishes(items: readonly MediaItem[], order: Order): MontageWishes {
  const material = usable(items);
  const include = material
    .filter(
      (item) => item.screening_rejected && order.returned.has(item.id) && !order.dropped.has(item.id),
    )
    .map((item) => item.id);
  const exclude = material.filter((item) => order.dropped.has(item.id)).map((item) => item.id);
  const story = order.story.trim();

  return {
    target_seconds: order.seconds,
    orientation: order.orientation,
    ...(story ? { story_text: story } : {}),
    ...(include.length > 0 ? { include_media_ids: include } : {}),
    ...(exclude.length > 0 ? { exclude_media_ids: exclude } : {}),
    ...(order.ownTrack
      ? { music_track_key: order.ownTrack.key }
      : order.track
        ? { music_track_id: order.track }
        : {}),
  };
}
