import { File, Paths } from 'expo-file-system';
// `expo-media-library/legacy` for the reason the upload screen gives at length: the SDK 57 root
// throws from the calls this app was written against. Only these two are wanted here.
import * as MediaLibrary from 'expo-media-library/legacy';

import type { Original } from '@/api';

/**
 * The way back out of the app: what the api signed a link to, onto the phone it is read on. Both
 * screens that put something there share this — the gallery saves originals one at a time and by
 * the armful, the memory screen saves the finished montage — and they must behave the same, since
 * to the person holding the phone it is one «скачать».
 */

/** The one answer nothing here can work around, and the one worth pointing somewhere. */
export const REFUSED =
  'Remember may not add to this phone’s gallery — that is turned on in Settings.';

/**
 * The one grant saving needs, asked for at the moment it is needed: adding to the gallery, not
 * reading it — a different question from the one the upload screen asks, and the phone only puts it
 * once. Already answered means no dialog and a straight answer. What to say when it is «no» is the
 * caller's, because each screen has its own place to say it; the words are `REFUSED` either way.
 */
export async function maySaveToPhone(): Promise<boolean> {
  const { granted } = await MediaLibrary.requestPermissionsAsync(true);
  return granted;
}

/**
 * One file onto the phone: down into the cache, over into the phone's own gallery, and out of the
 * cache again — the copy that stays is the one the gallery app holds.
 *
 * `andThen` runs on the cached copy while it still exists, which is the only window anything local
 * can be done in. That is what the montage screen hands to the share sheet: `url` is signed and
 * dies in a quarter of an hour, so whoever it was sent to would get a refusal instead of a video.
 * The gallery passes nothing and the copy just goes.
 *
 * ponytail: the local name is the record's id and an extension guessed from `kind` — every photo
 * lands as `.jpg` and every video as `.mp4`, because neither `media_items` nor `original_key`
 * carries the name the file had. The upgrade path is the upload sending the real filename, and
 * this reading it back from the record.
 */
export async function saveToPhone(file: Original, andThen?: (uri: string) => Promise<void>) {
  const target = new File(Paths.cache, `${file.id}.${file.kind === 'video' ? 'mp4' : 'jpg'}`);
  // `idempotent`, because the same file downloaded twice must not fail on the leftover of the
  // first go — the cache is swept by the system whenever it likes, but not reliably.
  const saved = await File.downloadFileAsync(file.url, target, { idempotent: true });
  try {
    await MediaLibrary.saveToLibraryAsync(saved.uri);
    await andThen?.(saved.uri);
  } finally {
    // Two copies of a video on a phone is what fills it up; the gallery's is the one that counts.
    // Swallowed, and not merely tidiness: `delete()` throws on a file the system already swept
    // from the cache, and a bare throw here would turn a save that worked into a failure in the
    // caller's count. The copy that matters is in the phone's gallery by this line either way.
    try {
      saved.delete();
    } catch {}
  }
}
