// What the four steps of an order add up to (spec 8, «Ролик: заказ по шагам»): which frames go in,
// what the video is about, what it is cut to, how long it runs and which way up. The screens
// (`app/memory/[id]/order/`) draw the steps; everything here is the arithmetic behind them, and
// the one place that turns what was picked into the body the api takes. The waiting that follows an
// order is at the foot of this file — the same subject, on the other side of the one call.
//
// Kept apart from that screen for the reason `@/lib/upload/queue` is kept apart from `@/lib/upload/send`: this
// is the part that decides what actually reaches the worker, and it is the part that can be checked
// without a phone. Nothing here imports a value — the api's types and the kit's come in as types
// alone, so a test can import this module as it is.
import type {
  MediaItem,
  Montage,
  MontageOrientation,
  MontageTemplate,
  MontageTemplateId,
  MontageWishes,
  MusicTrackId,
} from '@/api';
import type { Strings } from '@/strings';

/**
 * The shelf of tracks, in the layout's own order (`design/screens/MontageMusic.html`), each with the
 * running time of the file the worker holds (`projects/montage/video/tracks/README.md`). The times
 * are facts about those ten files and not something the api hands out — there is no route that lists
 * the shelf, and a list of ten that changes about once a year is not worth one.
 *
 * Seconds and not «1:20»: the same number is a row's own length and part of the sum over everything
 * chosen, and a figure written out once has to be parsed back to be added up. `formatRuntime` is
 * what turns it into the word, the way it does for every other length in the app.
 */
export const TRACKS: readonly { id: MusicTrackId; seconds: number }[] = [
  { id: 'bright', seconds: 80 },
  { id: 'warm', seconds: 126 },
  { id: 'calm', seconds: 110 },
  { id: 'night', seconds: 110 },
  { id: 'road', seconds: 146 },
  { id: 'merry', seconds: 120 },
  { id: 'tender', seconds: 72 },
  { id: 'dreamy', seconds: 127 },
  { id: 'mystery', seconds: 135 },
  { id: 'energetic', seconds: 231 },
];

/**
 * Which of the ten a track in an order is, or none of them — and then it is one the organizer
 * sent up themselves, whose key is a storage path (`music/<uuid>`) and never a word for a person.
 * The api reads one list of both kinds, so telling them apart is the reader's job: a shelf id has
 * a name in the dictionary, and anything else is «Свой трек».
 */
export const shelfTrack = (key: string): MusicTrackId | null =>
  TRACKS.some((track) => track.id === key) ? (key as MusicTrackId) : null;

/**
 * The music a film was cut to, in the order it plays, a word to a track — a shelf one by its name,
 * one off the phone as one. A montage ordered before the list names its one track in either of the
 * two single fields the api took then; it is still in the strip, so both are read.
 *
 * An order that handed the choice to the director names no track at all: the one word for that
 * answer stands where the list would, so the strip, a film's card and its sheet all say the same.
 */
export function trackWords(params: Montage['params'], s: Strings): string[] {
  const { music_director, music_tracks, music_track_id, music_track_key } = params;
  if (music_director) return [s.montage.directorChoice];
  if (music_tracks?.length)
    return music_tracks.map((key) => {
      const shelf = shelfTrack(key);
      return shelf ? s.montage.track[shelf] : s.montage.ownTrackShort;
    });
  if (music_track_id) return [s.montage.track[music_track_id]];
  return music_track_key ? [s.montage.ownTrackShort] : [];
}

/**
 * The four ready answers of `MontageBuild` (spec 7.3, detail 19). The fifth pill is «Всё» and is
 * not here: it is whatever this memory's material can carry, which only the api knows.
 */
export const PRESETS = [30, 60, 90, 180] as const;

/** How much of a wish about one track the api takes (400 over it) — each track has its own. */
export const WISH_LIMIT = 500;

/**
 * How many tracks one order may name: the api's schema answers 400 to the 51st
 * (`projects/api/docs/montages.md`, `music_tracks`). One list, so a file off the phone counts as
 * much as a track off the shelf.
 */
export const TRACK_LIMIT = 50;

/**
 * Below this there is nothing to cut a video out of, and the api refuses the order with 409
 * (`minReadyItems` in its `montages.ts`). Asked here before the first step rather than after the
 * last one: the layout answers it with `SheetTooLittle` in place of step 1, so nobody picks frames,
 * writes a story and chooses music only to be told at the end.
 */
export const MIN_FRAMES = 3;

/**
 * How much of a story the layout takes — tripled from 600 on the owner's word (a story told in
 * words needs three times the room a field for a name does). Still inside the api's own 2000, which
 * is what answers 400 over it; it counts up, not down.
 */
export const STORY_LIMIT = 1800;

/**
 * One track of the order, as the api takes it: `key` is either an id off the shelf (`calm`) or the
 * storage key of a file the organizer sent up themselves (`music/<uuid>`) — the api reads one list
 * of both, so this holds one kind of thing too. `name` is the phone's own name for their file, and
 * null for the shelf, whose ten names are the app's own and come from `@/strings`.
 *
 * `wish` is what to do with this one track, in the organizer's words. It is held on the track and
 * nowhere else, so a track moved carries its wish along and a track taken out takes its wish with
 * it — a wish about a track the order no longer names is the one thing the api answers 400 to.
 */
export type PickedTrack = { key: string; name: string | null; wish?: string };

/**
 * How long everything chosen runs altogether — the «2 трека · 3:45» over the block of them. Null
 * the moment one of them is a file off somebody's phone: nothing here has ever heard it and the
 * api does not say how long it is, so the block counts the tracks and stays quiet about the time
 * rather than printing a sum that is quietly short.
 */
export function pickedSeconds(tracks: readonly PickedTrack[]): number | null {
  let total = 0;
  for (const track of tracks) {
    const shelf = TRACKS.find((one) => one.id === track.key);
    if (shelf === undefined) return null;
    total += shelf.seconds;
  }
  return total;
}

/**
 * The chosen tracks with the one standing at `from` moved to `to` — what a finger dragging a row
 * of «Выбрано» by its name comes to. The list is the order they play in (doc-03), so this is the
 * whole of what the drag decides.
 */
export function movedTrack(
  tracks: readonly PickedTrack[],
  from: number,
  to: number,
): PickedTrack[] {
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return next;
}

/**
 * Where a row dragged `dy` points away from `from` comes to rest, over rows as tall as `heights` —
 * the list as it stood when the finger came down. The rows of «Выбрано» are not one height: a track
 * with a wish under its name stands taller, one with its field open taller still. So they are walked
 * past rather than counted, and the dragged row passes a neighbour once it has gone over half of it.
 */
export function landing(heights: readonly number[], from: number, dy: number): number {
  const way = dy > 0 ? 1 : -1;
  let to = from;
  let left = Math.abs(dy);
  for (;;) {
    const next = heights[to + way];
    if (next === undefined || left <= next / 2) return to;
    left -= next;
    to += way;
  }
}

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
  /**
   * Which of the six the order started from, or none at all («Настроить самому»). What it is *for*
   * is the plate on step 2 and the autopilot's own thread — the wishes it filled in are in the
   * fields beside this one, already indistinguishable from typed ones, because that is exactly what
   * a template is (doc-03): a body filled in ahead of time.
   */
  template: MontageTemplateId | null;
  /**
   * Whether the story has been touched since the template wrote it. The plate then says «Свой
   * текст»: the words are the person's now, and a template whose text was rewritten is no longer
   * the thing it names.
   */
  ownStory: boolean;
  /**
   * The music in the order it plays, each track with its own wish. Empty is an answer — a film with
   * the video's own sound.
   */
  tracks: readonly PickedTrack[];
  /**
   * The choice handed to the director instead of named tracks (spec 8, `MontageMusicDirector`): the
   * network picks the one track. The other answer to the same question as `tracks`, so the two never
   * stand together — taking one is giving up the other, and the api refuses the pair outright.
   */
  director: boolean;
  /** Any whole number of seconds; null is «не сказали», and then the api picks and clamps it. */
  seconds: number | null;
  /**
   * Whether the length was moved by hand since a template set it — `ownStory`'s twin, and for the
   * same reason: the figure on step 4 carries «из шаблона „…“» under it only while the template is
   * the one who put it there, and the slider moving it makes the number the person's own.
   */
  ownLength: boolean;
  orientation: MontageOrientation;
};

/** What the wizard opens on: the automatic pass as it stands, nothing said, horizontal. */
export const blankOrder = (): Order => ({
  dropped: new Set(),
  returned: new Set(),
  story: '',
  template: null,
  ownStory: false,
  tracks: [],
  director: false,
  seconds: null,
  ownLength: false,
  orientation: 'landscape',
});

/**
 * Everything one of the six templates decides — which is the whole order except which frames go
 * into it. A template says what kind of film this is; the material is whatever the memory holds,
 * and the automatic pass has already had its say about that (spec 8, `MontageTemplate`).
 */
export type TemplateFill = Omit<Order, 'dropped' | 'returned' | 'seconds'> & {
  /** Never «не сказали» here: a template names a length, and the api hands it over clamped. */
  seconds: number;
};

/**
 * A template as the order it fills in — the whole of what pressing a tile means (doc-03). The api
 * writes the story and hands over the length already held inside what this memory can carry, so
 * nothing here decides anything: it only puts the answer in the field that asks the question.
 *
 * `ownStory` and `ownLength` come back to false with it: the words and the figure are the
 * template's again, which is what puts its plate over the story and its line under the length —
 * and a second template pressed after the first one was edited is a fresh answer, not a half of
 * the old one.
 *
 * `director` comes back to false with them, and for the same reason: a template names its tracks, so
 * whatever was handed to the director before is answered now by the template instead. The two are one
 * question and one of them is the template's.
 */
export const fromTemplate = (template: MontageTemplate): TemplateFill => ({
  template: template.id,
  story: template.story_text,
  ownStory: false,
  // A template's tracks are the worker's own shelf, so none of them carries a name off a phone —
  // and each carries the template's wish about it, if it has one. A wish keyed to a track the
  // template does not play has no track to stand on here, and so goes nowhere.
  tracks: template.music_tracks.map((key) => ({
    key,
    name: null,
    wish: template.music_wishes[key],
  })),
  director: false,
  seconds: template.target_seconds,
  ownLength: false,
  orientation: template.orientation,
});

/**
 * Whether anything has actually been said in the wizard — the question «Отмена» asks before it
 * throws the walk away. Every field against what `blankOrder` opens with: a wizard somebody walked
 * into and straight back out of loses nothing, and a sheet asking them to confirm that would be a
 * door held shut for no reason (spec 8, `MontageSummary`).
 */
export const entered = (order: Order): boolean =>
  order.dropped.size > 0 ||
  order.returned.size > 0 ||
  order.story.trim() !== '' ||
  order.template !== null ||
  order.tracks.length > 0 ||
  order.director ||
  order.seconds !== null ||
  order.orientation !== 'landscape';

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
    ids: dropped
      .filter((item) => reasonOf(item.screening_reason) === reason)
      .map((item) => item.id),
  })).filter((group) => group.ids.length > 0);
}

/**
 * The order as the api takes it (doc-03). Every frame that is not going in is named: `exclude` is
 * what the pass dropped and nobody took back, plus everything dropped by hand. Named and not left
 * to the worker's own pass, because the api counts the film off this very body — «готовые минус
 * exclude_media_ids» is what `previewMontage` answers with, and a summary counting frames the
 * screen has already crossed out would be a summary of a different film.
 *
 * `include` is the other direction and still needed: the worker skips anything its pass rejected
 * unless the order insists on it by name (`director.py`), so a frame taken back on step 1 only
 * actually comes back if it is in this list. It leaves out anything in `dropped` — a frame put back
 * and then dropped by hand is still in `returned`, and naming it both ways is the one body the api
 * refuses outright.
 *
 * The music always goes out, empty list included: that is how the worker tells «без музыки, живой
 * звук» from an order that simply said nothing. Each wish goes under its own track's key, and only
 * where something was said: held on the track, a wish can only ever be about a track the order
 * names — the api answers 400 to any other — and an empty one is «не сказали».
 *
 * An order that handed the choice to the director names no track at all: `music_tracks` gives way to
 * the flag that says so, which is the only way the worker tells «режиссёр выберет» from «без музыки»
 * — and with no tracks there are no wishes, so neither goes out (api README, «Музыка»).
 */
export function wishes(items: readonly MediaItem[], order: Order): MontageWishes {
  const material = usable(items);
  const include = material
    .filter(
      (item) =>
        item.screening_rejected && order.returned.has(item.id) && !order.dropped.has(item.id),
    )
    .map((item) => item.id);
  const exclude = material.filter((item) => pickOf(item, order) !== 'keep').map((item) => item.id);
  const story = order.story.trim();
  const tracks = order.tracks.map((track) => track.key);
  const said = order.tracks.flatMap((track) => {
    const wish = track.wish?.trim();
    return wish ? [[track.key, wish] as const] : [];
  });

  return {
    orientation: order.orientation,
    ...(order.director ? { music_director: true } : { music_tracks: tracks }),
    ...(order.seconds === null ? {} : { target_seconds: order.seconds }),
    ...(story ? { story_text: story } : {}),
    ...(include.length > 0 ? { include_media_ids: include } : {}),
    ...(exclude.length > 0 ? { exclude_media_ids: exclude } : {}),
    ...(!order.director && said.length > 0 ? { music_wishes: Object.fromEntries(said) } : {}),
  };
}

/**
 * The shape the finished video comes out in, as width over height. Not measured off the poster and
 * not a taste: the worker cuts every montage onto one of two fixed canvases — 1920 × 1080 laid
 * down, 1080 × 1920 stood up (`projects/montage/assembly.py`, `CANVASES`) — so the orientation that
 * was ordered *is* the video's own aspect ratio, known from the moment the order is placed and
 * before there is a frame of it to look at. An order that named no orientation was cut horizontal,
 * which is the worker's own default for one (`DEFAULT_ORIENTATION`) and so the answer here too.
 */
export const shapeOf = (orientation: MontageOrientation | undefined): number =>
  orientation === 'portrait' ? 9 / 16 : 16 / 9;

/**
 * The same two shapes written the way they are read out — on the plate of a template tile («3:00 ·
 * 16:9») and in the corner of the summary's poster. Not a word for a person to translate: the
 * figure is the canvas the worker cuts onto, and it is the same in both languages.
 */
export const RATIO: Record<MontageOrientation, string> = { landscape: '16:9', portrait: '9:16' };

/* ── The waiting after the order ────────────────────────────────────────── */

/**
 * Whether the worker still owes this one. `queued` and `processing` only ever change on its side, so
 * a screen holding either has news coming that nothing will tell it — this is its reason to read
 * again, and its reason to stop.
 */
export const beingMade = (status: Montage['status']): boolean =>
  status === 'queued' || status === 'processing';

/**
 * How long the strip of films waits before reading its list again while a montage is being cut.
 * Longer than the feed waits on a thumbnail, because this is minutes of work and not seconds of it —
 * five is still inside the moment somebody spends looking at a card wondering whether it moved. The
 * montage watched live keeps a clock of its own and a far shorter one: there it is the journal being
 * read, a sentence at a time, and not one word about the whole job (`@/lib/montage/journal`).
 */
export const WHILE_MAKING_MS = 5000;

// The five stages used to be guessed from the one word the api says about the whole job — there was
// nothing else to go on. Since TASK-200 the worker writes a row per stage and the journal hands them
// over as they really are, so the guess went with the screen that drew it (TASK-221): what a stage
// is doing now lives in `@/lib/montage/journal`, off the answer rather than off an assumption.
