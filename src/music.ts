// «Свой трек с телефона» (doc-03, spec 8 step 3): the one file this app sends that is not material.
// It goes into R2 the way a photograph does — the api signs, the phone sends the bytes, the api is
// told they are there — and the order then names it by the key that comes back.
//
// Not the queue (`@/uploads`), and deliberately: that one exists because a gallery upload is
// interrupted by the tunnel, the lift and the app being swiped away, so it lives on disk, resumes
// part by part and words every way it can fail. A track is one small file picked and sent while
// somebody watches the button, and the api has no re-issue route for its links at all — so this one
// is a straight line, and a failure is the same button pressed again. The arithmetic of cutting a
// file into parts is shared with the queue all the same: `@/upload-queue` is where it lives, and two
// copies of it could only ever disagree.
import { File } from 'expo-file-system';

import { finishMusicUpload, startMusicUpload } from '@/api';
import { missingParts, uploadedParts } from '@/upload-queue';

/** The file as the picker handed it over: where it is on the phone, and what it is called. */
export type PickedTrack = { uri: string; name: string };

/**
 * Send one track and answer with its key in R2 — what goes into the order as `music_track_key`.
 *
 * Throws what the api throws (403 for anybody but the organizer, 413 over the file ceiling, 503
 * without a bucket) and a plain `Error` when R2 itself refuses a part; both come out of `@/api`'s
 * `errorMessage` as a line a screen can show. Nothing is written down anywhere: a track that did not
 * make it is simply not chosen, and the wizard still has the shelf.
 */
export async function sendOwnTrack(
  token: string,
  memoryId: string,
  track: PickedTrack,
): Promise<string> {
  const source = new File(track.uri);
  if (!source.exists || source.size === 0) throw new Error(`${track.name} cannot be read`);

  const plan = await startMusicUpload(token, memoryId, source.size);
  const etags: Record<number, string> = {};

  for (const part of missingParts(source.size, plan.upload.part_size, etags)) {
    const link = plan.upload.parts.find((one) => one.part_number === part.number)?.url;
    if (link === undefined) throw new Error(`no link for part ${part.number}`);

    const handle = source.open();
    // Typed as the handle hands it back rather than as a plain `Uint8Array`: a view over a
    // `SharedArrayBuffer` is not a body `fetch` will take, and the two say so differently.
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      handle.offset = part.start;
      bytes = handle.readBytes(part.length);
    } finally {
      handle.close();
    }

    const response = await fetch(link, { method: 'PUT', body: bytes });
    if (!response.ok) throw new Error(`storage refused part ${part.number} (${response.status})`);
    const etag = response.headers.get('etag');
    if (etag === null) throw new Error(`storage took part ${part.number} without a receipt`);
    etags[part.number] = etag;
  }

  const done = await finishMusicUpload(token, memoryId, plan.id, uploadedParts(etags));
  return done.key;
}
