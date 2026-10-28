import { Directory, File, Paths } from 'expo-file-system';

/**
 * A memory's videos, kept on the phone once they have been watched.
 *
 * The link `expo-video` is handed is signed for a quarter of an hour, so a video opened a second
 * time is a fresh download of bytes this phone already had — and with no connection there is
 * nothing to open at all. A file under the record's own id does not move: the second look is played
 * off the disk, and the phone's cache keeps it until the system sweeps it (spec doc-15 accepts
 * that sweep; managing the cache's size is the next job).
 *
 * `Paths.cache` and not `Paths.document`, unlike the kept feed: these are files that can be fetched
 * again, and the phone may take them back when it needs the room.
 */

const folder = () => new Directory(Paths.cache, 'video');

/**
 * The downloads under way, one per record. Two openings of one video — a swipe away and back while
 * the first file is still arriving — share the download that is already running instead of writing
 * the same file twice at once.
 */
const keeping = new Map<string, Promise<string | null>>();

/** Where a record's video is kept, or null for an id unsafe to name a file after. */
function videoFile(id: string): File | null {
  // The id arrives off the wire: one with a slash or a `..` would write outside the folder. Every
  // real id is a uuid, so anything that is not one is simply not kept.
  return /^[0-9a-f-]{36}$/i.test(id) ? new File(folder(), `${id}.mp4`) : null;
}

/**
 * The local copy of a record's video, or null when none has arrived. A synchronous question, so a
 * viewer can decide on its first render whether this opening is off the phone or off the wire.
 */
export function cachedVideo(id: string): string | null {
  try {
    const file = videoFile(id);
    return file?.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * Put a record's video on the phone, if it is not already there, and answer where it now lies.
 *
 * `null` for an id that cannot name a file and for a download that failed: the caller plays the
 * signed link it already had, which is exactly what the window did before this cache existed.
 */
export function keepVideo(id: string, url: string): Promise<string | null> {
  const held = keeping.get(id);
  if (held !== undefined) return held;
  const run = keep(id, url).finally(() => keeping.delete(id));
  keeping.set(id, run);
  return run;
}

async function keep(id: string, url: string): Promise<string | null> {
  const file = videoFile(id);
  if (file === null) return null;
  // Android writes the response body straight into the destination, so a download cut off halfway
  // would leave a truncated file that every later opening would take for the video. It lands under
  // `.part` instead and is moved into place only once whole; a process killed mid-download leaves
  // a part behind that the next attempt overwrites, never a file that passes for the video.
  const part = new File(folder(), `${id}.part`);
  try {
    if (file.exists) return file.uri;
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, part, { idempotent: true });
    await part.move(file, { overwrite: true });
    return file.uri;
  } catch (e) {
    console.warn('the video was not kept on this phone:', e);
    // `delete()` throws both on a file that was never written and on one already gone.
    try {
      part.delete();
    } catch {}
    return null;
  }
}
