import { request } from './call';
import type { Contact } from './contacts';
import type { MediaItem } from './media';
import type { Montage, MontageStage, MontageStageCode } from './montage';

/** What the director said while cutting, as the api hands it over page by page. */
/**
 * One thing the director said, out loud, while putting the video together. Everything but the stage
 * is optional: a record with no `media_id` is a thought about the plan rather than about a frame,
 * and one with no `decision` is a thought with nothing settled in it.
 *
 * `id` is a number and it is the cursor — the largest one held is what the next poll asks after.
 */
export type JournalEntry = {
  id: number;
  stage: MontageStageCode;
  media_id: string | null;
  thought: string | null;
  decision: 'take' | 'skip' | null;
  /** Why it was passed over, by the worker's own vocabulary — no fixed set, see `reasonWord`. */
  reason: string | null;
  series_size: number | null;
  story_part: number | null;
  story_part_title: string | null;
  source_from_seconds: number | null;
  source_to_seconds: number | null;
  labels: string[] | null;
  /**
   * What the record says beyond its own columns, and its shape is the stage's own (api
   * `docs/journal.md`, «Запись журнала»): the fields a frame was described in at `analysis`, the two
   * shares of sound in a part of the story at `music`, and nothing anywhere else.
   *
   * Free-form on the wire and free-form here, for the reason the api's own column is: each stage
   * writes its own keys and the app reads the ones it has words for. {@link JournalDetails} names
   * the keys the api documents; a key that is not in it simply is not drawn.
   */
  details: JournalDetails | null;
  created_at: string;
};

/**
 * The `details` of a record, as the api documents it. Every key may be absent — the worker is not
 * obliged to say everything about every frame — so nothing here is required and a missing key is a
 * field the screen does not draw, never a zero.
 */
export type JournalDetails = {
  /** `analysis` — the description was taken ready-made out of a past film. */
  earlier?: boolean;
  /** `analysis` — how many people are in the frame. */
  people?: number;
  /** `analysis` — the place, the light and the time, the mood, the shot the camera took. */
  place?: string;
  light?: string;
  mood?: string;
  shot?: string;
  /** `analysis`, a clip only — how the camera moves, and what is said over it. */
  camera?: string;
  speech?: string;
  /** `analysis`, a clip only — where in it the good moments are and what happens at each. */
  moments?: { seconds: number; text: string }[];
  /** `analysis` — the long description, in free text. */
  text?: string;
  /** `music` — how much of the music is heard in this part of the story, 0…1. */
  music?: number;
  /** `music` — how much of the frames' own sound, 0…1. The two never add up to one. */
  live?: number;
};

/**
 * A file one of those records is about, signed the way the gallery's frames are. Only the files met
 * in the page just handed over, so a journal of hundreds of records about the same frames is not
 * re-signed in full on every poll — and a frame that has since been deleted simply has no entry
 * here, which is not an error: the record about it stays either way.
 */
export type JournalFile = {
  id: string;
  kind: MediaItem['kind'];
  uploaded_by: string;
  /** The name off the phone — «IMG_2041.MOV», and empty where the upload never brought one. */
  file_name: string | null;
  captured_at: string | null;
  /** How long the file itself runs — not to be read as the length of a place below. */
  duration_seconds: number | null;
  thumbnail_url: string | null;
  /**
   * Where this frame ended up in this video, in the order it plays. A list because one frame
   * legitimately stands in a video twice — a clip cut in half, a photo that comes back at the end —
   * and empty while there is no layout yet, which is every frame during the screening.
   */
  places: { start_seconds: number; duration_seconds: number }[];
};

/** Somebody watching the assembly right now. The api hands out no more than this about them. */
export type Viewer = Pick<Contact, 'id' | 'username'>;

/** One page of the journal, as the route answers. */
export type MontageJournal = {
  montage: { id: string; status: Montage['status'] };
  stages: MontageStage[];
  /** Always newest first, whichever way the cursor was going. */
  entries: JournalEntry[];
  /** Is there more in the direction that was asked for — and if so, ask again straight away. */
  has_more: boolean;
  files: JournalFile[];
  viewers: Viewer[];
};

/**
 * The cursor and the one narrowing the app asks for, as the route takes them. The route also takes
 * `limit` and `media_id`; nothing here sends either, so neither is here.
 */
export type JournalQuery = {
  /** Records newer than this one, and of those the ones *next to* the cursor — see `@/lib/montage/journal`. */
  after?: number;
  /** Records older than this one — paging back through a journal already being read. */
  before?: number;
  stage?: MontageStageCode;
};

/**
 * How the video was put together, live and afterwards (api README, «Журнал монтажа»). Any member
 * reads it, a viewer included, and the reading itself is what marks the reader as watching — there
 * is no «я смотрю» to send. A montage with no journal at all answers with an empty one rather than
 * an error, and a finished video's journal is read the same way years later.
 */
export function fetchJournal(
  token: string,
  memoryId: string,
  montageId: string,
  query: JournalQuery = {},
): Promise<MontageJournal> {
  const asked = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return request(`/memories/${memoryId}/montages/${montageId}/journal${asked ? `?${asked}` : ''}`, {
    token,
  });
}
