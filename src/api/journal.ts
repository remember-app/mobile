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
 * The four fractions of the gaze arrive as one `focus`, or as nothing at all.
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
  /** Where on the frame the director is looking, in fractions of it — never in pixels. */
  focus: { x: number; y: number; w: number; h: number } | null;
  created_at: string;
};

/**
 * A file one of those records is about, signed the way the gallery's frames are. Only the files met
 * in the page just handed over, so a journal of hundreds of records about the same frames is not
 * re-signed in full on every poll — and a frame that has since been deleted simply has no entry
 * here, which is not an error: the record about it stays either way.
 */

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

/** Somebody watching the assembly right now. The api hands out no more than this about them. */
export type Viewer = Pick<Contact, 'id' | 'username'>;

/** One page of the journal, as the route answers. */

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
  /** How many records at most. The api's own page is 200, and it takes up to 500. */
  limit?: number;
};

/**
 * How the video was put together, live and afterwards (api README, «Журнал монтажа»). Any member
 * reads it, a viewer included, and the reading itself is what marks the reader as watching — there
 * is no «я смотрю» to send. A montage with no journal at all answers with an empty one rather than
 * an error, and a finished video's journal is read the same way years later.
 */

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

/**
 * «Свой трек с телефона» (doc-03, spec 8 step 3): the organizer's own music instead of one off the
 * shelf. It goes into R2 the way material does — this announces the file and hands back the signed
 * links to send it with — and it is the organizer's alone, 403 for anybody else. 413 over the
 * file ceiling, 503 while the api has no bucket.
 *
 * The plan is the same shape the media intent answers with, deliberately: the parts are cut and
 * sent by the same arithmetic (`@/lib/upload/queue`), and `@/lib/music` is what does the sending. There is
 * no re-issue route for these links — a track is small and the hour is long — so an upload that
 * breaks is started again rather than resumed.
 */
