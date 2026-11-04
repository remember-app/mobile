import { pickFiles } from '@/integrations/documents';
import {
  type DeviceAsset,
  listDeviceAssets,
  mediaPermission,
  resolveDeviceAsset,
} from '@/integrations/media-library';
import type { ProjectId } from '@/types/id';

export type { DeviceAsset, DeviceAssetKind } from '@/integrations/media-library';

import { enqueueUploads } from './queue';

export async function loadDeviceAssets(
  after?: string,
  first?: number,
): Promise<{ assets: DeviceAsset[]; next: string | null }> {
  if (!(await mediaPermission())) return { assets: [], next: null };
  return listDeviceAssets(after, first);
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
