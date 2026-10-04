import { Directory, File, Paths } from 'expo-file-system';

import type { MediaItem, Member } from '@/api';

/**
 * What the feed of a memory is drawn from before the api has answered (TASK-512, part 2; doc-12:
 * «экран сначала рисует то, что уже есть на устройстве, а запросы идут независимо»). The records as
 * the last answer had them and the roster they are read against, kept on the phone in one place and
 * dropped wherever the session is dropped.
 *
 * Documents and not cache, the reason the upload queue parks there too: the cache directory is swept
 * by the system whenever it likes, and a feed that must open with no network cannot live somewhere
 * the phone may empty it without asking.
 *
 * The account is not part of the name, and that is what `forget()` is for: the copy dies with the
 * session, so there is never a moment when it is still on the phone and the token that opens it is
 * not.
 */

/** One memory's feed as the phone keeps it: the frames, and the roster over them. */
export type Kept = { items: MediaItem[]; roster: Member[] };

/** The folder every memory's feed is kept in, wiped whole — `forgetKept` has one name to take. */
const folder = () => new Directory(Paths.document, 'feeds');

/**
 * The file one memory's feed is kept in. The id is what names it, and it arrives off the wire: one
 * with a slash or a `..` in it would put the file outside the folder that `forgetKept` takes, and a
 * real id is a uuid, so anything that is not one is not kept at all rather than written somewhere
 * odd. Null rather than a throw — the feed still draws from the api on a name like that.
 */
const store = (memoryId: string): File | null =>
  /^[0-9a-f-]{36}$/i.test(memoryId) ? new File(folder(), `${memoryId}.json`) : null;

/**
 * What this phone kept of that memory, read at the screen's first render and never after — one
 * synchronous read, so the feed is on screen on the same tick as the screen that shows it rather
 * than one answer later.
 *
 * Null wherever there is nothing kept, the file will not read, or what is in it is not the shape it
 * was written as: a feed that came back empty from a phone that ran a build from before this one is
 * a feed the api answers, which is exactly where it stood before.
 */
export function readKept(memoryId: string): Kept | null {
  const file = store(memoryId);
  if (file === null) return null;
  try {
    if (!file.exists) return null;
    const kept = JSON.parse(file.textSync()) as Kept;
    return Array.isArray(kept?.items) && Array.isArray(kept.roster) ? kept : null;
  } catch {
    return null;
  }
}

/**
 * Keep it, over the answer the api just gave. Best effort, and it says so when it fails: a phone
 * that will not write this still draws the feed, it just draws it from the api next time as well.
 *
 * A frame its owner took out of the shared feed is filtered off here and not cleaned afterwards —
 * this file is what the next launch draws without asking anybody, and a hidden frame has no business
 * being in it, whoever is holding the phone.
 */
export function keepKept(
  memoryId: string,
  items: readonly MediaItem[],
  roster: readonly Member[],
): void {
  const file = store(memoryId);
  if (file === null) return;
  try {
    const kept: Kept = { items: items.filter((item) => !item.hidden), roster: [...roster] };
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(kept));
  } catch (e) {
    console.warn('the feed was not kept on this phone:', e);
  }
}

/**
 * Every memory's feed off the phone, and nothing else on it — called from `forget()` beside the token
 * and the account copy, because a list of somebody else's photographs outliving their session is
 * the one thing here that must never happen (decision-23).
 */
export function forgetKept(): void {
  try {
    if (folder().exists) folder().delete();
  } catch (e) {
    console.warn('the kept feeds were not cleared:', e);
  }
}
