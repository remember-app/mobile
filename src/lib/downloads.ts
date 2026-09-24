import { Directory, File, Paths } from 'expo-file-system';
// `expo-media-library/legacy` for the reason the upload screen gives at length: the SDK 57 root
// throws from the calls this app was written against. Only these two are wanted here.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

import type { Original } from '@/api';

/**
 * The way back out of the app: what the api signed a link to, onto the phone it is read on. Both
 * screens that put something there share this — the gallery saves originals one at a time and by
 * the armful, the memory screen saves the finished montage — and they must behave the same, since
 * to the person holding the phone it is one «скачать».
 */

/**
 * The one grant saving needs, asked for at the moment it is needed: adding to the gallery, not
 * reading it — a different question from the one the upload screen asks, and the phone only puts it
 * once. Already answered means no dialog and a straight answer. What to say when it is «no» is the
 * caller's, because each screen has its own place to say it; the words are `error.galleryRefused`
 * either way, which is why they live in the dictionary and not beside this call.
 */
export async function maySaveToPhone(): Promise<boolean> {
  const { granted } = await MediaLibrary.requestPermissionsAsync(true);
  return granted;
}

/**
 * What a downloaded file is called on the phone.
 *
 * The id is what names the file, and it arrives off the wire: one with a slash or a `..` in it
 * would have the download written outside the cache and over something the app keeps. Every real
 * id here is a uuid, so anything that is not one gets a plain name instead of a path.
 *
 * ponytail: the extension is guessed from `kind` — every photo lands as `.jpg` and every video as
 * `.mp4`, because neither `media_items` nor `original_key` carries the name the file had. The
 * upgrade path is the upload sending the real filename, and this reading it back from the record.
 */
function localName(file: Original) {
  const name = /^[0-9a-f-]{36}$/i.test(file.id) ? file.id : 'download';
  return `${name}.${file.kind === 'video' ? 'mp4' : 'jpg'}`;
}

/**
 * One file onto the phone: down into the cache, over into the phone's own gallery, and out of the
 * cache again — the copy that stays is the one the gallery app holds.
 */
export async function saveToPhone(file: Original) {
  const target = new File(Paths.cache, localName(file));
  try {
    // `idempotent`, because the same file downloaded twice must not fail on the leftover of the
    // first go — the cache is swept by the system whenever it likes, but not reliably.
    const saved = await File.downloadFileAsync(file.url, target, { idempotent: true });
    await MediaLibrary.saveToLibraryAsync(saved.uri);
  } finally {
    // Two copies of a video on a phone is what fills it up; the gallery's is the one that counts.
    // Inside the same `try` as the download, so a video cut off halfway does not sit in the cache
    // until the system decides to sweep it — a partial montage is hundreds of megabytes of nothing.
    // Swallowed, and not merely tidiness: `delete()` throws both on a file that was never written
    // and on one the system already swept, and a bare throw here would turn a save that worked
    // into a failure in the caller's count. The copy that matters is in the phone's gallery by
    // this line either way.
    try {
      target.delete();
    } catch {}
  }
}

/**
 * The place the local copies for the share sheet are made, empty. Whatever an earlier share left
 * there goes first, so the phone never holds more than the last share's own copies.
 *
 * They are not deleted the moment the sheet answers, and no timer deletes them later: an answered
 * sheet does not say that the app it went to has read the file — on Android the answer can come as
 * soon as an app is picked, before that app has opened — and a copy swept then leaves it nothing to
 * read. Apart from the cache's other files so they can be wiped as a set.
 */
function freshSharedDir() {
  const dir = new Directory(Paths.cache, 'shared');
  if (dir.exists) dir.delete();
  dir.create();
  return dir;
}

/**
 * One file down into the share folder. It goes out as this copy and never as the link the api
 * signed: that one dies in a quarter of an hour, so whoever it reached would get a refusal instead
 * of a photograph.
 */
async function copyForSharing(file: Original, dir: Directory) {
  const saved = await File.downloadFileAsync(file.url, new File(dir, localName(file)));
  return saved.uri;
}

/**
 * The phone's own share sheet on one local copy. `expo-sharing` and not React Native's own `Share`,
 * which attaches a file on iOS only: on Android it drops `url` before the intent and the chooser
 * opens with nothing to send. Closing the sheet is not a failure and resolves; a sheet that could
 * not open at all is logged and not shown, because there is nothing under the frame the person is
 * looking at that they could do about it.
 */
const handOn = (uri: string) =>
  Sharing.shareAsync(uri).catch((e) => console.warn('share sheet skipped:', e));

/**
 * Files handed on instead of kept — the viewer's «Поделиться» (doc-02) and its armful. The sheet
 * takes one file per call, so several files are several sheets, one after the other: the next is
 * downloaded and opened once the last has been answered. `keepGoing` is asked before each one — the
 * only way to break the chain is to leave the screen it runs for.
 *
 * All the files of one call are one share: the folder is wiped once, before the first, and never
 * between them, or the copy just handed to an app would be pulled out from under it.
 */
export async function shareFiles(
  files: readonly Original[],
  keepGoing: () => boolean = () => true,
) {
  const dir = freshSharedDir();
  for (const file of files) {
    if (!keepGoing()) return;
    await handOn(await copyForSharing(file, dir));
  }
}

export const shareFile = (file: Original) => shareFiles([file]);

/**
 * The montage's «Сохранить и поделиться»: into the phone's gallery and out through the sheet from
 * the same copy, so the video comes down once. The gallery takes its own copy of the file; the one
 * in the share folder is the sheet's, and goes with the next share.
 */
export async function saveAndShare(file: Original) {
  const uri = await copyForSharing(file, freshSharedDir());
  await MediaLibrary.saveToLibraryAsync(uri);
  await handOn(uri);
}
