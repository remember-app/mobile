import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { MediaItem } from '@/api';

const kindOf = (asset: MediaLibrary.Asset): MediaItem['kind'] =>
  asset.mediaType === 'video' ? 'video' : 'photo';
const SAME_DURATION = 1;
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
async function sizeOf(asset: MediaLibrary.Asset): Promise<number | undefined> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
    const uri = info.localUri ?? (asset.uri.startsWith('file://') ? asset.uri : undefined);
    if (uri === undefined) return undefined;
    const file = new File(uri);
    return file.exists ? file.size : undefined;
  } catch (error) {
    console.warn(`${asset.filename} cannot be sized before sending:`, error);
    return undefined;
  }
}
async function sameAs(asset: MediaLibrary.Asset, own: readonly MediaItem[]): Promise<boolean> {
  const candidates = own.filter((record) => mayBeSame(asset, record));
  if (candidates.length === 0) return false;
  const sized = candidates.filter((record) => record.size_bytes !== null);
  if (sized.length === 0) return true;
  const bytes = await sizeOf(asset);
  if (bytes === undefined) return true;
  return sized.some((record) => Number(record.size_bytes) === bytes);
}
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
