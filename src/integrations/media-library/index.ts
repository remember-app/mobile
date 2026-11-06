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

export async function resolveDeviceAsset(id: string): Promise<LocalMedia> {
  const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: true });
  if (!info.localUri) throw new Error(`asset ${id} has no local file`);
  const kind = info.mediaType === 'video' ? 'video' : info.mediaType === 'photo' ? 'photo' : null;
  if (!kind) throw new Error(`asset ${id} is not a photo or a video`);
  return {
    uri: info.localUri,
    fileName: info.filename,
    kind,
    sizeBytes: new File(info.localUri).size,
    capturedAt: new Date(info.creationTime).toISOString(),
    durationSeconds: kind === 'video' ? info.duration : null,
  };
}
