import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';

export type DeviceAssetKind = 'photo' | 'video';

export type DeviceAsset = {
  id: string;
  uri: string;
  fileName: string;
  kind: DeviceAssetKind;
  width: number;
  height: number;
  duration: number;
  createdAt: string;
};

export type LocalMedia = {
  uri: string;
  fileName: string;
  kind: DeviceAssetKind;
  sizeBytes: number;
  capturedAt: string | null;
  durationSeconds: number | null;
};

export async function mediaPermission(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(false);
  return permission.granted;
}

export async function listDeviceAssets(
  after?: string,
  first = 60,
  mediaTypes: DeviceAssetKind[] = ['photo', 'video'],
): Promise<{ assets: DeviceAsset[]; next: string | null }> {
  const page = await MediaLibrary.getAssetsAsync({
    mediaType: mediaTypes,
    sortBy: [['creationTime', false]],
    first,
    ...(after === undefined ? {} : { after }),
  });
  const assets = page.assets.flatMap((asset): DeviceAsset[] => {
    const kind =
      asset.mediaType === 'video' ? 'video' : asset.mediaType === 'photo' ? 'photo' : null;
    if (!kind) return [];
    return [
      {
        id: asset.id,
        uri: asset.uri,
        fileName: asset.filename,
        kind,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        createdAt: new Date(asset.creationTime).toISOString(),
      },
    ];
  });
  return { assets, next: page.hasNextPage ? page.endCursor : null };
}

export async function assetIsFavorite(id: string): Promise<boolean> {
  const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
  return info.isFavorite ?? false;
}

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const EXIF_ZONE = /^[+-]\d{2}:\d{2}$/;

/** Теги приходят вложенными в разделы (`{Exif}`, `{TIFF}`), поэтому ищем на двух уровнях. */
function exifValue(exif: Record<string, unknown>, name: string): unknown {
  if (name in exif) return exif[name];
  for (const value of Object.values(exif)) {
    if (value && typeof value === 'object' && name in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[name];
    }
  }
  return undefined;
}

/** Дата съёмки из EXIF — то же, что потом возьмёт сервер из самого файла, вместе с её поясом. */
function exifCaptured(exif: unknown): Date | null {
  if (!exif || typeof exif !== 'object') return null;
  const tags = exif as Record<string, unknown>;
  const zone = exifValue(tags, 'OffsetTimeOriginal') ?? exifValue(tags, 'OffsetTime');
  const shift = typeof zone === 'string' ? zone.trim() : '';
  for (const key of ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']) {
    const value = exifValue(tags, key);
    const match = typeof value === 'string' ? EXIF_DATE.exec(value.trim()) : null;
    if (!match) continue;
    const [, year, month, day, hour, minute, second] = match;
    if (EXIF_ZONE.test(shift)) {
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${shift}`);
    }
    return new Date(+year, +month - 1, +day, +hour, +minute, +second);
  }
  return null;
}

export async function resolveDeviceAsset(id: string): Promise<LocalMedia> {
  const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: true });
  if (!info.localUri) throw new Error(`asset ${id} has no local file`);
  const kind = info.mediaType === 'video' ? 'video' : info.mediaType === 'photo' ? 'photo' : null;
  if (!kind) throw new Error(`asset ${id} is not a photo or a video`);
  const captured = kind === 'photo' ? exifCaptured(info.exif) : null;
  return {
    uri: info.localUri,
    fileName: info.filename,
    kind,
    sizeBytes: new File(info.localUri).size,
    capturedAt: (captured ?? new Date(info.creationTime)).toISOString(),
    durationSeconds: kind === 'video' ? info.duration : null,
  };
}
