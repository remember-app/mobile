import { memberName, type MediaItem, type Member, type Memory } from '@/api';
import { formatEventDates } from '@/dates';
import type { TileState } from '@/kit/tile';

/**
 * What a gallery record is on screen. `@/kit/tile` is imported for its shape only and `@/api` and
 * `@/dates` are plain modules themselves, so nothing here pulls `react-native` in — which is what
 * lets a test read this file, and the reason every decision the gallery makes about a record lives
 * in it rather than inline in a screen no test can render.
 */

/** The frame a record hands the tile: what has become of it, and the picture to draw if there is one. */
export type Frame = { state: TileState; uri: string | null };

/**
 * One record read as a frame. The status is the state, with one correction: a `ready` record that
 * carries no derivative has nothing to show either, so it wears the fallen frame rather than
 * sitting in the sheet as an empty square.
 */
export function frameOf(item: MediaItem): Frame {
  return frameWith(item, item.thumbnail_url);
}

/**
 * The same record read for the one frame opened full screen. The grid's picture is the 640px
 * thumbnail the worker makes for a tile, and blown up to the whole of a phone it is the mush that
 * was reported — so this reading asks for the big derivative first and keeps the thumbnail as the
 * fallback for a record that has none.
 *
 * A photo has none *today*: the worker makes a thumbnail for a photo and a poster plus the 720p
 * copy for a video (architecture.md), so `preview_url` is only ever a video's playable file. The
 * viewer reaches for it directly and mounts a player on that branch, before ever getting to the
 * image — a video only lands here when its preview was never made, and its poster is the honest
 * thing to draw then. Which leaves the fallback carrying every photo until a large photo
 * derivative exists to point at; the moment the worker makes one, this is where it lands.
 */
export function openFrameOf(item: MediaItem): Frame {
  return frameWith(item, item.preview_url ?? item.thumbnail_url);
}

/** The correction both readings share, so the two cannot drift on what a frame with nothing is. */
function frameWith(item: MediaItem, uri: string | null): Frame {
  return { state: item.status === 'ready' && uri === null ? 'failed' : item.status, uri };
}

/**
 * Whether the list is waiting on the worker for anything. A `processing` record only ever moves on
 * the worker's side, so a screen holding one has material coming that it will never hear about —
 * this is the screen's reason to look again, and its reason to stop.
 */
export function stillPreparing(items: readonly MediaItem[] | null): boolean {
  return items?.some((item) => item.status === 'processing') ?? false;
}

/**
 * The list a quiet re-read leaves on screen. The api hands the whole gallery back every time and
 * signs every link afresh, so a record that has not changed in any way still arrives with a new
 * `thumbnail_url` — and a new url is a new file to `expo-image` and `VideoView`, which fetch it
 * again. While one frame is developing that happened to everything visible every three seconds.
 *
 * So a record that is already `ready` keeps the object it had, links and all: nothing about a
 * finished record ever moves again, and holding the old one holds its url still. Everything else —
 * still developing, fallen, or new since the last read — is taken as it came, which is the whole
 * reason the re-read happens.
 *
 * Only for the quiet loop. A read somebody asked for wants the fresh links: the old ones expire in
 * a quarter of an hour, and a face that never re-signs them ends up drawing nothing at all.
 */
export function keepReady(
  current: readonly MediaItem[] | null,
  fresh: readonly MediaItem[],
): MediaItem[] {
  const ready = new Map(
    (current ?? []).filter((item) => item.status === 'ready').map((item) => [item.id, item]),
  );
  return fresh.map((item) => ready.get(item.id) ?? item);
}

/**
 * Whether a record can be opened big. A frame still developing has nothing behind it yet — the kit
 * keeps it in the filmstrip so the count stays honest, but will not open it. A fallen one does
 * open: that is the screen the delete button is on, and a record nobody can look at is exactly the
 * one somebody wants rid of.
 */
export function mayOpen(item: MediaItem): boolean {
  return item.status !== 'processing';
}

/**
 * Which tile the filmstrip opens on — the position of the record being shown. Never below zero: a
 * record that has just been deleted is no longer in the list, and a strip told to start at «not
 * found» starts nowhere at all, so it starts at its head instead.
 */
export function frameIndex(items: readonly MediaItem[], id: string | null): number {
  const at = items.findIndex((item) => item.id === id);
  return at < 0 ? 0 : at;
}

/**
 * The line over an open frame — the person who brought it and the day of the event, the kit's
 * `.viewer__who`: «Марина · 3 сентября». The name is the one they gave, else the username they
 * claimed, exactly as the roster writes it; somebody who has since left the memory is off the
 * roster and their frame stays, so an unknown uploader is «Someone» rather than a blank.
 *
 * The day is the memory's own and not the file's. This line used to carry `captured_at`, falling
 * back to `created_at` — the day the camera wrote, else the day the file reached us. Both read as a
 * mistake under a frame: a picture sent from an old album dated the wedding «12 March 2019», and
 * anything the camera never stamped was dated by whenever somebody got round to uploading it.
 * What the line is for is when this happened, and that is one answer for the whole memory.
 *
 * `null` is a memory not read yet — the listing this screen takes it from can fail, and a name
 * alone is worth more than a name with a wrong date after it.
 */
export function shotBy(
  item: MediaItem,
  roster: readonly Member[] | null,
  memory: Memory | null,
): string {
  const who = memberName(roster?.find((member) => member.id === item.uploaded_by) ?? null);
  // A memory that did not arrive and one whose days will not parse cost this line the same thing:
  // the separator goes with the date, so a name is never left hanging off a «·».
  const when = memory === null ? '' : formatEventDates(memory.event_start, memory.event_end);
  return when === '' ? who : `${who} · ${when}`;
}
