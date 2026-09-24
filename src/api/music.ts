import { request } from './call';
import type { UploadPlan } from './media';
import type { MusicTrackId } from './montage';

/** The track a movie is cut to: the shelf to listen to, and one's own file. */
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
export function startMusicUpload(
  token: string,
  memoryId: string,
  sizeBytes: number,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/music`, {
    method: 'POST',
    body: { size_bytes: sizeBytes },
    token,
  });
}

/**
 * «Загружено» for a track: seals the parts into one object and answers with the key the order names
 * it by, in `music_tracks`. Idempotent — a repeat only reports where the row stands — and on the
 * same long leash `finishUpload` has, since the api is waiting on R2 assembling the object.
 */

/**
 * «Загружено» for a track: seals the parts into one object and answers with the key the order names
 * it by, in `music_tracks`. Idempotent — a repeat only reports where the row stands — and on the
 * same long leash `finishUpload` has, since the api is waiting on R2 assembling the object.
 */
export function finishMusicUpload(
  token: string,
  memoryId: string,
  trackId: string,
  parts: { part_number: number; etag: string }[],
): Promise<{ id: string; status: string; key: string }> {
  return request(`/memories/${memoryId}/music/${trackId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60_000,
  });
}

/**
 * «Послушать» on step 3 (TASK-171): a signed link to one of the five off the shelf, good for the
 * hour the api signs its links for. Outside `/memories` and behind the plain token — the shelf is
 * one for the whole product, the same five for everyone, so there is no memory to be a member of
 * and no role to weigh. 404 for an id that is not on it, 503 while the api has no bucket.
 */

/**
 * «Послушать» on step 3 (TASK-171): a signed link to one of the five off the shelf, good for the
 * hour the api signs its links for. Outside `/memories` and behind the plain token — the shelf is
 * one for the whole product, the same five for everyone, so there is no memory to be a member of
 * and no role to weigh. 404 for an id that is not on it, 503 while the api has no bucket.
 */
export function previewMusicTrack(token: string, trackId: MusicTrackId): Promise<{ url: string }> {
  return request(`/music/tracks/${trackId}`, { token });
}

/**
 * Tell the api where to push to. Idempotent: the same device token registered twice is one row,
 * so this can run on every launch without asking whether it already ran.
 */
