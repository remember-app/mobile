// «Этот файл уже здесь»: a file picked off the phone, and whether the same person already gave it
// to this memory (TASK-584). The api leaves a record's file name out of the listing and there is
// nothing else to match on, so the comparison is the photo itself: what kind it is, when it was
// shot, and its size, with the measured size and the run time narrowing a pair that already agrees.
//
// A soft answer, not a verdict. A false positive costs one question before the sending; a false
// negative spends the memory's space and the person's uplink on a second copy, silently.

import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';

import type { MediaItem } from '@/api';

const kindOf = (asset: MediaLibrary.Asset): MediaItem['kind'] =>
  asset.mediaType === 'video' ? 'video' : 'photo';

/** A video's run time in seconds, to this much of the same — the api's worker rounds it. */
const SAME_DURATION = 1;

/**
 * The half of the comparison the phone already has in hand: the kind, the instant it was shot, and
 * whichever of the measured size and the run time the record has been given.
 *
 * The record's `width`, `height` and `duration_seconds` are null until the worker has measured
 * them, and a record with no capture date says nothing about when it was shot. Either is left out
 * of the judgement rather than read as a difference — what is not there cannot disagree.
 */
export function mayBeSame(asset: MediaLibrary.Asset, record: MediaItem): boolean {
  if (record.kind !== kindOf(asset)) return false;
  if (record.captured_at === null) return false;
  if (Date.parse(record.captured_at) !== asset.creationTime) return false;
  if (record.width !== null && record.width !== asset.width) return false;
  if (record.height !== null && record.height !== asset.height) return false;
  if (
    record.duration_seconds !== null &&
    kindOf(asset) === 'video' &&
    Math.abs(record.duration_seconds - asset.duration) > SAME_DURATION
  ) {
    return false;
  }
  return true;
}

/**
 * How many bytes the original is, where the phone can say without fetching it: its local file,
 * which an original still in iCloud does not have (`@/lib/upload/send` says why that one is not
 * worth a download here). Undefined is «cannot tell», never «empty».
 */
async function sizeOf(asset: MediaLibrary.Asset): Promise<number | undefined> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
    // iOS names the file behind the entry; Android hands `file://` straight off the asset.
    const uri = info.localUri ?? (asset.uri.startsWith('file://') ? asset.uri : undefined);
    if (uri === undefined) return undefined;
    const file = new File(uri);
    return file.exists ? file.size : undefined;
  } catch (error) {
    console.warn(`${asset.filename} cannot be sized before sending:`, error);
    return undefined;
  }
}

/** The records that could be the same file as this asset, judged by what the phone sees. */
async function sameAs(asset: MediaLibrary.Asset, own: readonly MediaItem[]): Promise<boolean> {
  const candidates = own.filter((record) => mayBeSame(asset, record));
  if (candidates.length === 0) return false;
  // The size is the one thing worth a native round trip, and only where a record actually has one
  // to compare against — a record the worker never sized cannot disagree about it.
  const sized = candidates.filter((record) => record.size_bytes !== null);
  if (sized.length === 0) return true;
  const bytes = await sizeOf(asset);
  if (bytes === undefined) return true;
  return sized.some((record) => Number(record.size_bytes) === bytes);
}

/**
 * Which of the picked assets this person already gave this memory, by the gallery's own ids.
 * `own` is the memory's listing narrowed to this person's records — the caller's rule, and the one
 * `mine.tsx` already reads «my own» by.
 */
export async function alreadyThere(
  assets: readonly MediaLibrary.Asset[],
  own: readonly MediaItem[],
): Promise<Set<string>> {
  const repeats = new Set<string>();
  for (const asset of assets) {
    if (await sameAs(asset, own)) repeats.add(asset.id);
  }
  return repeats;
}
