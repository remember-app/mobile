import { request } from './call';

/** Ordering a movie and reading what became of it. */
/**
 * The tracks the montage worker holds, by id. Five strings the api enumerates and refuses anything
 * outside of, so they are written out here rather than typed as `string` — what each one sounds
 * like is the worker's (`projects/montage/tracks`), and what each one is called on screen is the
 * screen's. The shelf's own order is the layout's, and it lives in `@/lib/montage/order` beside the running
 * time of each one.
 */
export type MusicTrackId = 'bright' | 'warm' | 'calm' | 'night' | 'road';

/**
 * Which way up the finished video stands (doc-03). The api takes these two and nothing else, and
 * leaves it out as «horizontal» — which is what every montage was before the choice existed.
 */
export type MontageOrientation = 'landscape' | 'portrait';

/**
 * What was asked for at the order — the wishes doc-03 allows, every one of them optional. This is
 * the body `orderMontage` sends, and `Montage.params` coming back is the same shape plus the two
 * fields an older order may still carry.
 *
 * The four steps of the order (spec 8) fill them in: the frames picked out by hand, the story, the
 * music, the length and the shape. `@/lib/montage/order` is what turns a wizard's state into this.
 */
export type MontageWishes = {
  /**
   * Any whole number of seconds inside this memory's own range, which is the material's and not a
   * constant — `previewMontage` is the one place it is known, and the length step reads it from
   * there rather than working it out. Left out, the api picks its own and clamps it, so «не
   * сказали» is always a legal order and never a 400.
   */
  target_seconds?: number;
  /** What the organizer said the video is about, in their own words. */
  story_text?: string;
  /** The frames settled by hand: these go in whatever the worker thinks, those stay out. */
  include_media_ids?: string[];
  exclude_media_ids?: string[];
  /**
   * The music, in the order it plays: ids off the worker's shelf and keys of tracks the organizer
   * sent up themselves (`music/<uuid>`), mixed freely. A list and not one answer since doc-03 grew
   * the step — and the app sends it on every order, empty included, because an empty list is «без
   * музыки, живой звук из видео» and a missing one is only «ничего не сказали».
   */
  music_tracks?: string[];
  /**
   * What to do with each of those tracks, in words, keyed by the track exactly as it stands in
   * `music_tracks` of the same order. Only tracks the order names (400 for any other) and only the
   * ones something was said about; up to 500 characters each. It took the place of one line for
   * the whole order, `music_note`, which the api now drops unread.
   */
  music_wishes?: Record<string, string>;
  orientation?: MontageOrientation;
};

/**
 * A video assembled out of a memory (doc-03). The row as the api hands it out, minus its storage
 * key: `video_url` is the signed link standing in for it, and it is there only while the montage is
 * `ready` — before that it is null, which is «ещё не готово» and not an error, exactly as the
 * gallery's missing derivatives are. `duration_seconds` is the length the worker actually made,
 * so it too arrives only with the finished video; `params` is what was asked for at the order.
 */
export type Montage = {
  id: string;
  memory_id: string;
  ordered_by: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  duration_seconds: number | null;
  /**
   * The wishes it was ordered with. An order placed before the list of tracks named one track in
   * one of two fields the api no longer takes, and one placed before the wishes went to each track
   * carries a single `music_note` for the whole order instead of `music_wishes`; the api hands both
   * out as they were written, and their cards still say what they were cut to.
   */
  params: MontageWishes & {
    music_track_id?: MusicTrackId;
    music_track_key?: string;
    music_note?: string;
  };
  /** The worker's own line about why it fell over. Only ever set on a `failed` one. */
  error_text: string | null;
  created_at: string;
  video_url: string | null;
  /** The still off the finished video, signed the same way `video_url` is, and null while there is
      none — an older montage cut before posters were kept, or one not yet ready. */
  poster_url: string | null;
  /**
   * How far the making has got — the five stages in pipeline order with a state each, and nothing
   * else about them: the card in the strip draws «3 из 5» and five bars out of this without opening
   * anybody's journal (api README, «Список роликов»).
   *
   * `null` on a finished montage and on one the worker has not opened yet — on the first there is
   * nothing left to show, on the second nothing yet — and absent altogether from the answer `retry`
   * gives back, which is why it is optional as well as nullable.
   */
  stages?: MontageStep[] | null;
};

/** One of the five as the list reports it: where it stands, and not a word more. */
export type MontageStep = { stage: MontageStageCode; state: MontageStage['state'] };

/**
 * Every montage of a memory, newest first. Any member reads it, a viewer included — the video is
 * the reward for everybody who brought material. 503 while the api has no bucket configured.
 */
export function listMontages(token: string, memoryId: string): Promise<Montage[]> {
  return request(`/memories/${memoryId}/montages`, { token });
}

/**
 * The six ready-made films of `MontageTemplate` (spec 8), by the api's own ids and in the order the
 * screen draws them. The order of the answer is the order of the tiles and does not change.
 */
export type MontageTemplateId =
  | 'for_myself'
  | 'quick'
  | 'report'
  | 'short_form'
  | 'parents'
  | 'dopamine';

/**
 * One template: a filled-in order and nothing more than one. What comes back here is what goes out
 * in `orderMontage`, minus the `id` and plus whatever the person changed on the way — which is the
 * whole of the autopilot (doc-03).
 *
 * The story is written on the server, in the reader's own language and with this memory's name and
 * dates already in it, and the length comes clamped to what the material can carry. What is *not*
 * here is the name on the tile: those six words are the app's own, kept in `@/strings` by id.
 */
export type MontageTemplate = {
  id: MontageTemplateId;
  story_text: string;
  target_seconds: number;
  orientation: MontageOrientation;
  music_tracks: string[];
  /**
   * A wish for each of its tracks that has one, keyed as in `music_tracks`. Always there, `{}`
   * where the template has nothing to say about its music.
   */
  music_wishes: Record<string, string>;
};

/**
 * The organizer's alone, 403 for anybody else — nobody but them can order the film.
 *
 * The docs promise `music_wishes` on every template, `{}` included; an older api, or a slip of this
 * one, leaves it out or sends null. That is a template with nothing to say about its tracks, and it
 * is made one here, where the answer comes in, so that nothing reading a template has to ask.
 */
export function listMontageTemplates(token: string, memoryId: string): Promise<MontageTemplate[]> {
  return request<
    (Omit<MontageTemplate, 'music_wishes'> & { music_wishes?: Record<string, string> | null })[]
  >(`/memories/${memoryId}/montage-templates`, { token }).then((came) =>
    came.map((one) => ({ ...one, music_wishes: one.music_wishes ?? {} })),
  );
}

/**
 * «Итог перед монтажом» (spec 8, `MontageSummary`): what the order would come to, worked out by the
 * api off the very same body the order sends. The numbers are the frames that would actually go in
 * — everything ready, minus `exclude_media_ids` — and the length range is this memory's own.
 *
 * The app never counts any of this itself: the floor and the ceiling of the length step, the people
 * in the film and the wait in minutes all have one source, and it is this. Nothing is written by
 * it, so a screen may ask as often as it likes; every refusal the order has, this has too, in the
 * same words — a summary that agreed to something the order would turn down is worse than none.
 */
export type MontagePreview = {
  photos: number;
  videos: number;
  /** How many different people brought those frames. */
  people: number;
  min_seconds: number;
  max_seconds: number;
  /** What the order would write down: what was asked for, or the api's own, clamped to the range. */
  target_seconds: number;
  orientation: MontageOrientation;
  /** Roughly how long the making would take. A bearing and not a promise — the api says so too. */
  estimate_minutes: number;
};

export function previewMontage(
  token: string,
  memoryId: string,
  wishes: MontageWishes,
): Promise<MontagePreview> {
  return request(`/memories/${memoryId}/montages/preview`, {
    method: 'POST',
    body: wishes,
    token,
  });
}

/**
 * «Смонтируй ролик» — the organizer's alone, 403 for anybody else. Every wish may be left out: the
 * api fills the length in itself and clamps it, an empty list of tracks is a film with the video's
 * own sound, and no orientation is horizontal. 409 when there is too little material to cut
 * anything out of, and the body then carries how much there is against how much is needed; 400 for
 * a frame named as both in and out, for a frame that is not this memory's, for a track that is
 * neither off the shelf nor this memory's, and for a wish about a track the order does not name.
 */
export function orderMontage(
  token: string,
  memoryId: string,
  wishes: MontageWishes,
): Promise<Montage> {
  return request(`/memories/${memoryId}/montages`, { method: 'POST', body: wishes, token });
}

/**
 * Queue a fallen montage again — the organizer's too. The same row goes back in the queue rather
 * than a second one being written, so the answer is the montage as it now stands. 409 when it is
 * not a failed one, which is «somebody already pressed this».
 */
export function retryMontage(token: string, memoryId: string, montageId: string): Promise<Montage> {
  return request(`/memories/${memoryId}/montages/${montageId}/retry`, { method: 'POST', token });
}

/**
 * The five stages of making a video, in the order the worker walks them (api README, «Журнал
 * монтажа»). The order is itself the contract: «этап 3 из 5» on screen is a position in this list,
 * and the api sorts its own answer by it rather than by when the worker got round to each one.
 */
export const MONTAGE_STAGES = [
  'screening',
  'understanding',
  'directing',
  'rhythm',
  'assembly',
] as const;

export type MontageStageCode = (typeof MONTAGE_STAGES)[number];

/**
 * What a stage came to, free-form on the wire because each stage's result is its own shape. These
 * are the keys the api names as the ones an app may count on; a key that is not there is simply not
 * drawn, and the phrase itself is built on this side.
 */
export type MontageStageOutcome = {
  /** `screening` — «212 из 214 годятся», and why the rest went, by reason code. */
  kept?: number;
  of?: number;
  reasons?: Record<string, number>;
  /** `understanding` — «37 лиц, 5 людей в главных». */
  faces?: number;
  people?: number;
  animals?: number;
  /** `directing` — «3 части, 61 кадр». */
  parts?: number;
  frames?: number;
  part_titles?: string[];
  /**
   * `rhythm` — the tracks it was laid out to, in the order of the order, and how many cuts moved
   * to them. A film with no music is `track: []` and `cuts: 0`.
   */
  track?: string[];
  bpm?: number;
  /** `assembly` — the cuts and the running time of what came out. */
  cuts?: number;
  seconds?: number;
};

/**
 * One of the five stages as the journal reports it. `done_count` moves only on the two stages the
 * worker counts as it goes, screening and assembly; the other three hold it at 0 until they are
 * done. On those two `eta_seconds` is reckoned again at every step as what is left of the stage; on
 * the rest it stays the estimate of the whole of it (`minutesLeft`). The three counts at the end are
 * the api's own tally over the records — the worker never writes those, so they cannot disagree.
 */
export type MontageStage = {
  stage: MontageStageCode;
  state: 'pending' | 'running' | 'done' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  eta_seconds: number | null;
  done_count: number;
  /** Null until there is something to count against — «61 из ?» is not drawn. */
  total_count: number | null;
  outcome: MontageStageOutcome;
  updated_at: string;
  taken_count: number;
  skipped_count: number;
  thought_count: number;
};
