import { pickFiles } from '@/integrations/documents';
import {
  assetIsFavorite,
  type DeviceAsset,
  type DeviceAssetKind,
  listDeviceAssets,
  mediaPermission,
  resolveDeviceAsset,
} from '@/integrations/media-library';
import type { ProjectId } from '@/types/id';

export type { DeviceAsset, DeviceAssetKind } from '@/integrations/media-library';
export { resolveDeviceAsset } from '@/integrations/media-library';

import { enqueueUploads } from './queue';

export async function deviceMediaAllowed(): Promise<boolean> {
  return mediaPermission();
}

export type DeviceCollection = 'all' | 'favorites' | 'photos' | 'videos';

export async function loadDeviceAssets(
  after?: string,
  first?: number,
  collection: DeviceCollection = 'all',
): Promise<{ assets: DeviceAsset[]; next: string | null }> {
  if (!(await mediaPermission())) return { assets: [], next: null };
  const types: DeviceAssetKind[] =
    collection === 'photos' ? ['photo'] : collection === 'videos' ? ['video'] : ['photo', 'video'];
  if (collection !== 'favorites') return listDeviceAssets(after, first, types);
  let cursor = after;
  const found: DeviceAsset[] = [];
  for (let page = 0; page < 5; page += 1) {
    const result = await listDeviceAssets(cursor, first, types);
    const favorites = await Promise.all(result.assets.map((asset) => assetIsFavorite(asset.id)));
    found.push(...result.assets.filter((_, at) => favorites[at]));
    cursor = result.next ?? undefined;
    if (found.length > 0 || !cursor) break;
  }
  return { assets: found, next: cursor ?? null };
}

export async function uploadDeviceAssets(
  projectId: ProjectId,
  assetIds: string[],
): Promise<number> {
  const files = [];
  for (const id of assetIds) {
    const local = await resolveDeviceAsset(id);
    files.push({
      projectId,
      uri: local.uri,
      fileName: local.fileName,
      kind: local.kind,
      sizeBytes: local.sizeBytes,
      capturedAt: local.capturedAt,
      durationSeconds: local.durationSeconds,
    });
  }
  enqueueUploads(files);
  return files.length;
}

export async function uploadAudioFiles(projectId: ProjectId): Promise<number> {
  const picked = await pickFiles(['audio/*']);
  enqueueUploads(
    picked.map((file) => ({
      projectId,
      uri: file.uri,
      fileName: file.fileName,
      kind: 'audio' as const,
      sizeBytes: file.sizeBytes,
      capturedAt: null,
      durationSeconds: null,
    })),
  );
  return picked.length;
}
