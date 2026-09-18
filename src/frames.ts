import { memberName, type MediaItem, type Member, type Memory } from '@/api';
import { formatEventDates, startOfDay } from '@/dates';
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
 * `preview_url` is the worker's large copy of whatever the record is: for a photo the big
 * derivative, for a video the playable 720p file (architecture.md, TASK-136). The viewer reaches
 * for a video's directly and mounts a player on that branch, before ever getting to the image — a
 * video only lands here when its preview was never made, and its poster is the honest thing to draw
 * then. So the fallback carries two: a photo the worker has not got to yet, and a video that fell
 * over on the way; both are the thumbnail blown up, which is the mush that was reported, and both
 * stop being it the moment the worker finishes.
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
 * The list a quiet re-read leaves on screen. The api hands the whole list back every time and signs
 * every link afresh, so a row that has not changed in any way still arrives with a new
 * `thumbnail_url` — and a new url is a new file to `expo-image` and `expo-video`, which fetch it
 * again. While one frame is developing that happened to everything visible every three seconds.
 *
 * So a row that is already `ready` keeps the object it had, links and all: nothing about a finished
 * one ever moves again, and holding the old one holds its url still. Everything else — still
 * developing, fallen, or new since the last read — is taken as it came, which is the whole reason
 * the re-read happens.
 *
 * Written for the gallery and taken by the montage list as well (`memory/films.tsx`): both are a
 * list of rows the worker finishes one at a time, both are polled quietly while it does, and both
 * carry signed links that move on every answer. `expo-video` rebuilds the player whenever the url
 * it was handed changes, so on that face the re-read started the montage somebody was watching over
 * again every five seconds (TASK-125, found in review).
 *
 * Only for the quiet loop. A read somebody asked for wants the fresh links: the old ones expire in
 * a quarter of an hour, and a face that never re-signs them ends up drawing nothing at all.
 */
export function keepReady<T extends { id: string; status: string }>(
  current: readonly T[] | null,
  fresh: readonly T[],
): T[] {
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
 * Whether a frame can be marked for taking home — «ждущие и упавшие кадры не отмечаются:
 * скачивать нечего» (kit, «Экраны» 4, «Выбор»). The frame's reading and not the record's status, so
 * a `ready` record whose derivative never arrived is out of the picking too; it stays in the sheet,
 * plain and untappable.
 *
 * One rule and not two, because a day's «Выбрать все 9» has to mean exactly what nine taps on nine
 * frames would: the count on the daymark and the gate on a single tap are the same question asked
 * in two places, and this is the place it is answered.
 */
export function mayPick(item: MediaItem): boolean {
  return frameOf(item).state === 'ready';
}

/** One day of a memory's material: the day itself, and the frames shot on it. */
export type FrameDay = {
  /** The instant that day began here — the sort key, and the day the daymark writes out. */
  at: number;
  frames: MediaItem[];
};

/**
 * When a frame happened, as the whole gallery reads it: the day the camera stamped, falling back to
 * the day the file arrived — the same reading the api sorts the listing by
 * (`coalesce(captured_at, created_at)`). A stamp that will not parse is the epoch, which puts that
 * frame at the very end of whichever direction the sheet is read in.
 */
export function shotAt(item: MediaItem): number {
  return Date.parse(item.captured_at ?? item.created_at) || 0;
}

/** The local day a frame belongs to — the day the phone looking at it says, not UTC's. */
export function dayOf(item: MediaItem): number {
  return startOfDay(new Date(shotAt(item))).getTime();
}

/** Everything under one heading, and what that heading is about (spec 7.7, four kinds of it). */
export type FrameGroup = { key: string; frames: MediaItem[] } & (
  | { by: 'day'; at: number }
  | { by: 'person'; who: string }
  | { by: 'kind'; kind: MediaItem['kind'] }
);

/** How the sheet is cut into groups, and which way each group reads (`SheetSort`). */
export type GroupBy = FrameGroup['by'];
export type Order = 'newest' | 'oldest';
export type Sort = { by: GroupBy; order: Order };

/** What the gallery is arranged as until somebody says otherwise: by day, newest first. */
export const SORT_DEFAULT: Sort = { by: 'day', order: 'newest' };

/** Whether it is arranged any other way — which is the whole of what the spark dot means (spec 7.4). */
export function arranged(sort: Sort): boolean {
  return sort.by !== SORT_DEFAULT.by || sort.order !== SORT_DEFAULT.order;
}

/**
 * What of the gallery is shown (`SheetFilter`): who brought it, what it is, which day it is from.
 * An empty set is «everybody» and «every day» rather than «nobody» — the chip that says so is the
 * one the sheet opens with.
 */
export type Filter = {
  people: ReadonlySet<string>;
  days: ReadonlySet<number>;
  kind: MediaItem['kind'] | 'all';
};

/** Nothing filtered out, which is what the gallery stands at until the sheet says otherwise. */
export const FILTER_NONE: Filter = { people: new Set(), days: new Set(), kind: 'all' };

/** Whether anything is being held back — the other spark dot. */
export function filtering(filter: Filter): boolean {
  return filter.people.size > 0 || filter.days.size > 0 || filter.kind !== 'all';
}

/**
 * The gallery as the filter leaves it. Three questions, all three answered against the record
 * itself, so the count the sheet's own button carries («Показать 486 кадров») is worked out by
 * exactly what the sheet will then show.
 */
export function framesMatching(items: readonly MediaItem[], filter: Filter): MediaItem[] {
  return items.filter(
    (item) =>
      (filter.kind === 'all' || item.kind === filter.kind) &&
      (filter.people.size === 0 || filter.people.has(item.uploaded_by)) &&
      (filter.days.size === 0 || filter.days.has(dayOf(item))),
  );
}

/**
 * The gallery cut into the groups the sort asks for, each group already reading in the direction it
 * asks for. One place for all three cuts, because they are one question — «что стоит над полосой» —
 * and the screen only writes the heading it is handed.
 *
 * The order between groups is the cut's own: days run the way the frames inside them do, people
 * stand by how much they brought (the most first — that is the list the layout draws), and the two
 * kinds keep the order they are named in, photos before videos, because that is a pair and not a
 * ranking.
 */
export function groupFrames(items: readonly MediaItem[], { by, order }: Sort): FrameGroup[] {
  const within = [...items].sort((a, b) =>
    order === 'newest' ? shotAt(b) - shotAt(a) : shotAt(a) - shotAt(b),
  );

  if (by === 'kind') {
    return (['photo', 'video'] as const)
      .map((kind) => ({
        by: 'kind' as const,
        kind,
        key: `kind-${kind}`,
        frames: within.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.frames.length > 0);
  }

  if (by === 'person') {
    return cut(within, (item) => item.uploaded_by)
      .map(([who, frames]) => ({ by: 'person' as const, who, key: `who-${who}`, frames }))
      .sort((a, b) => b.frames.length - a.frames.length);
  }

  return cut(within, dayOf)
    .map(([at, frames]) => ({ by: 'day' as const, at, key: `day-${at}`, frames }))
    .sort((a, b) => (order === 'newest' ? b.at - a.at : a.at - b.at));
}

/**
 * Frames into buckets by whatever key is asked for, each bucket keeping the order they came in. The
 * buckets themselves come back in the order they were first met, so whoever sorts them afterwards
 * gets a stable answer out of a stable one.
 */
function cut<K>(items: readonly MediaItem[], keyOf: (item: MediaItem) => K): [K, MediaItem[]][] {
  const groups = new Map<K, MediaItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    const held = groups.get(key);
    if (held === undefined) groups.set(key, [item]);
    else held.push(item);
  }
  return [...groups];
}

/**
 * The gallery cut into the local days its frames were shot on, the newest day first — what the
 * contact sheet needs to draw a daymark over each strip (kit, «Экраны» 4, «День»).
 *
 * Local days, not UTC ones: the day a frame belongs to is the day the phone looking at it says,
 * which is also the day `formatDay` prints over the strip. The day itself is `captured_at` falling
 * back to `created_at` — the same reading the api sorts the gallery by
 * (`coalesce(captured_at, created_at)`), so a day is one unbroken run of what it hands over and the
 * frames inside it keep the order they arrived in. Only the days are turned around: the api sends
 * the oldest shot first, the way a montage would play them, and a sheet is read from the newest day
 * down.
 *
 * A frame whose day will not parse lands on the epoch day at the very bottom, the way the camera
 * roll's own cut treats one the phone never stamped. It is not dropped: somebody sent it, and it is
 * in the memory.
 *
 * This is the gallery's own cut and deliberately not `@/media-window`'s: that one is about the
 * phone's whole camera roll and exists to float the event's days above the rest of it, and here
 * every frame is already the event's — there is no window left to sort by.
 */
export function framesByDay(items: readonly MediaItem[]): FrameDay[] {
  return cut(items, dayOf)
    .map(([at, frames]) => ({ at, frames }))
    .sort((a, b) => b.at - a.at);
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
