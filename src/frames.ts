import { memberName, type FrameInfo, type MediaItem, type Member, type Memory } from '@/api';
import { formatEventDates, startOfDay } from '@/dates';
import type { TileState } from '@/kit/tile';
import { currentLanguage } from '@/language';
import type { Strings } from '@/strings';

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
 * How heavy the file is, for the line on the frame's own sheet — «4,2», in the digits of the
 * language the app is speaking. Megabytes the way a phone counts them (a million bytes, not 1024²),
 * because this number stands beside the one the phone's own gallery shows for the same file.
 *
 * The unit is a word and lives in the dictionary. The size arrives as a string — it is a bigint on
 * the api's side — and a record whose size did not come down the wire has nothing to write.
 *
 * `locale` is only for a test to name a language out loud, the way `formatDay` takes one; the app
 * leaves it off and gets the language it is speaking.
 *
 * Asked of anything carrying a size, because two things do: the record the gallery holds and the
 * frame's own sheet, which reads the same number off a route of its own.
 */
export function megabytes(
  item: Pick<MediaItem, 'size_bytes'>,
  locale: string = currentLanguage(),
): string | null {
  return megabytesOf([item], locale);
}

/**
 * The same number over a whole armful — «38 МБ» in the capsule of `FramesPicking`, which is the
 * weight of everything marked. One rule for both, so a selection of one never reads differently
 * from the frame it holds.
 */
export function megabytesOf(
  items: readonly Pick<MediaItem, 'size_bytes'>[],
  locale: string = currentLanguage(),
): string | null {
  const mb = items.reduce((sum, item) => sum + Number(item.size_bytes), 0) / 1e6;
  if (!Number.isFinite(mb) || mb <= 0) return null;
  // One decimal up to «9,9 МБ», none past it: a video is hundreds of megabytes and «412,3» is a
  // digit nobody reads.
  return mb.toLocaleString(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 });
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

/**
 * Everything under one seam, and what that seam is about (spec 7.8, detail 65) — plus the feed that
 * has no seam at all, which is what it looks like by default: one unbroken wall of photographs with
 * the days read off the spine at the edge instead (`MemoryScrub`).
 */
export type FrameGroup = { key: string; frames: MediaItem[] } & (
  | { by: 'all' }
  | { by: 'day'; at: number }
  | { by: 'person'; who: string }
  | { by: 'kind'; kind: MediaItem['kind'] }
);

/**
 * How the feed is cut into groups — «СОБРАТЬ В ГРУППЫ» of `SheetSort`, and the days are deliberately
 * not one of the three: a date is a caption rather than a group, so it is its own switch.
 */
export type GroupBy = 'none' | 'person' | 'kind';
export type Order = 'newest' | 'oldest';
/** The whole of `SheetSort`: which way it reads, how it is cut, and whether the days are written. */
export type Sort = { by: GroupBy; order: Order; dates: boolean };

/**
 * What the feed stands at until somebody says otherwise: nothing grouped, newest first, and the
 * dates off — which is `MemoryFrames` itself, and `MemoryScrub` the moment a finger moves it.
 */
export const SORT_DEFAULT: Sort = { by: 'none', order: 'newest', dates: false };

/** Whether it is arranged any other way — which is the whole of what the spark dot means (spec 7.4). */
export function arranged(sort: Sort): boolean {
  return (
    sort.by !== SORT_DEFAULT.by ||
    sort.order !== SORT_DEFAULT.order ||
    sort.dates !== SORT_DEFAULT.dates
  );
}

/** Three across, in both lanes of spec 7.8 — the feed is cut by hand, so the number is named once. */
export const COLUMNS = 3;

/**
 * Spec 7.8, detail 66 — where each day begins on the feed, so the spine can hang a pill on that
 * seam. Points from the top of the list: `top` is where the first row starts and `row` is the pitch
 * of one row, a tile and the gutter under it, both worked out by the screen because it is the one
 * that knows how wide a phone is.
 *
 * Only ever asked of the ungrouped feed, which is the only arrangement where the days run in order
 * down the wall: cut by person or by kind the days interleave, and a rail of them would point at
 * nothing.
 *
 * A mark stands on the seam between two rows and never inside one, so two days beginning in the same
 * row of three share a seam — and a seam carries one pill, the day that opens it.
 */
export function dateMarks(
  frames: readonly MediaItem[],
  { top, row }: { top: number; row: number },
): { at: number; top: number }[] {
  const marks: { at: number; top: number }[] = [];
  let day: number | null = null;
  frames.forEach((item, at) => {
    const on = dayOf(item);
    if (on === day) return;
    day = on;
    const y = top + Math.floor(at / COLUMNS) * row;
    if (marks.at(-1)?.top === y) return;
    marks.push({ at: on, top: y });
  });
  return marks;
}

/**
 * What of the gallery is shown (`SheetFilter`): who brought it, what it is, which boxes it lies in,
 * which day it is from. An empty set is «everybody», «every label» and «every day» rather than
 * «nobody» — the chip that says so is the one the sheet opens with.
 */
export type Filter = {
  people: ReadonlySet<string>;
  /** Which labels, by id — this is how the contents of a box are looked at (spec 10.8.2). */
  labels: ReadonlySet<string>;
  days: ReadonlySet<number>;
  kind: MediaItem['kind'] | 'all';
};

/** Nothing filtered out, which is what the gallery stands at until the sheet says otherwise. */
export const FILTER_NONE: Filter = {
  people: new Set(),
  labels: new Set(),
  days: new Set(),
  kind: 'all',
};

/** Whether anything is being held back — the other spark dot, one rule over every group on it. */
export function filtering(filter: Filter): boolean {
  return (
    filter.people.size > 0 ||
    filter.labels.size > 0 ||
    filter.days.size > 0 ||
    filter.kind !== 'all'
  );
}

/**
 * The gallery as the filter leaves it. Four questions, all four answered against the record itself,
 * so the count the sheet's own button carries («Показать 486 кадров») is worked out by exactly what
 * the sheet will then show.
 *
 * The labels are read off the record's own `label_ids`, the way everything else here is: the api
 * cannot narrow a gallery by a label and deliberately does not try (api README, «Лейблы кадра»), and
 * that array already holds only the boxes this person is allowed to see — somebody else's private
 * label leaves no trace in it, so there is nothing here to hide and nothing to check.
 *
 * Several labels are «any of these», the same «or» the people row is (spec 10.8.2), and the four
 * questions narrow each other exactly as the other three already did.
 */
export function framesMatching(items: readonly MediaItem[], filter: Filter): MediaItem[] {
  return items.filter(
    (item) =>
      (filter.kind === 'all' || item.kind === filter.kind) &&
      (filter.people.size === 0 || filter.people.has(item.uploaded_by)) &&
      (filter.labels.size === 0 || item.label_ids.some((one) => filter.labels.has(one))) &&
      (filter.days.size === 0 || filter.days.has(dayOf(item))),
  );
}

/**
 * The same filter holding only the labels `keep` still answers for — what a box that has gone, here
 * or by somebody else's hand, does to the feed it was filtering (spec 10.8.2). Nothing else is
 * touched: a label is gone, not the choice of day or of who brought it.
 *
 * Needed because a filter still holding a dead id matches nothing at all — no frame carries it any
 * more — and the chip that could take it off again is no longer on the sheet to press. A filter
 * with nothing to drop comes back as it is, so a screen holding it re-renders over nothing.
 */
export function keepLabels(filter: Filter, keep: (labelId: string) => boolean): Filter {
  const labels = new Set([...filter.labels].filter(keep));
  return labels.size === filter.labels.size ? filter : { ...filter, labels };
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
 *
 * «Не собирать» is a cut too — into one piece, seamless. Turning the dates on cuts that one piece
 * into days (`MemoryDated`); leaving them off is the wall the spine hangs its marks beside
 * (`MemoryScrub`). Grouped by person or by kind the switch has nothing to give: the seam there is
 * already somebody's name, so the sheet holds it shut.
 */
export function groupFrames(items: readonly MediaItem[], { by, order, dates }: Sort): FrameGroup[] {
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

  if (!dates) return within.length === 0 ? [] : [{ by: 'all', key: 'all', frames: within }];

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

/** One line of the frame's own sheet: what it is called, and what it says. */
export type FrameFact = { label: string; value: string };

/**
 * The four summary lines of `SheetFrameInfo` (spec 8), in the order the layout draws them: the file,
 * the frame in pixels, the camera, the place.
 *
 * The rule the sheet is built on lives here: **a line the server knows nothing about is not drawn at
 * all**, rather than drawn with a dash in it. Half of what this reads is written by the montage
 * worker out of the original's metadata, so an older record — or one shot by a camera that stamped
 * nothing — legitimately has none of it, and a sheet of four dashes says only that the product is
 * missing something.
 *
 * A line is likewise built out of the pieces that *are* there: a camera model with no aperture
 * beside it is still a camera, and «IMG_4471.HEIC» with no weight is still the name of a file.
 *
 * `place` is the name the phone's geocoder gave the point, when it gave one. It takes the
 * coordinates' seat and never a row of its own: a frame with no point has no place line, whatever
 * is handed in.
 */
export function frameFacts(
  info: FrameInfo,
  s: Strings,
  locale?: string,
  place: string | null = null,
): FrameFact[] {
  const size = megabytes(info, locale);
  const facts: FrameFact[] = [];
  const said = (label: string, value: string) => {
    if (value !== '') facts.push({ label, value });
  };

  said(s.viewer.file, meta([info.file_name, size === null ? null : s.viewer.size(size)]));
  // Both or neither: half a pair of sides is not a size.
  if (info.width !== null && info.height !== null) {
    said(s.viewer.pixels, `${info.width} × ${info.height}`);
  }
  said(
    s.viewer.camera,
    meta([
      info.camera_model,
      info.focal_length_mm === null ? null : s.viewer.focal(info.focal_length_mm),
      info.aperture === null ? null : s.viewer.aperture(info.aperture),
    ]),
  );
  // The api sends the point and no name (README, «Сведения о кадре»); the name is the phone's
  // geocoder's, asked by the sheet (`@/geocoder`) and handed in as `place`. Until it answers, and
  // whenever it cannot, the point stands as the numbers it is.
  if (info.latitude !== null && info.longitude !== null) {
    said(s.viewer.place, place || s.viewer.coords(info.latitude, info.longitude));
  }
  return facts;
}

/** The product's one separator between two pieces of meta, over whatever is actually known. */
const meta = (parts: readonly (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');
