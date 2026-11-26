import { File } from 'expo-file-system';
import { Image } from 'expo-image';

import { onSignOut } from '@/functionality/auth/session';
import { cacheFolderUsage, clearCache as clearDataCache } from '@/integrations/files/cache';
import {
  clearMediaCache,
  clearMediaGroup,
  mediaCacheUsage,
} from '@/integrations/files/media-cache';
import { saveToPhone, shareFile } from '@/integrations/files/save';
import type { Item } from '@/models';

import { cachedVariant, keepVariant } from './source';

export const cachedDetail = (item: Item): string | null => cachedVariant(item, 'detail');

export const ensureDetail = (item: Item): Promise<string | null> => keepVariant(item, 'detail');

const ensureOriginal = (item: Item): Promise<string | null> => keepVariant(item, 'original');

function dropTemporary(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // the temporary original is already gone
  }
}

export async function saveItemToPhone(item: Item): Promise<boolean> {
  const local = await ensureOriginal(item);
  if (!local) return false;
  return saveToPhone(local);
}

export async function saveItemsToPhone(items: Item[]): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (const item of items) {
    if (await saveItemToPhone(item)) saved += 1;
    else failed += 1;
  }
  return { saved, failed };
}

export async function shareItem(item: Item): Promise<void> {
  const local = await ensureOriginal(item);
  if (!local) throw new Error('the original is not available');
  await shareFile(local);
  dropTemporary(local);
}

export const cacheUsage = () => {
  const media = mediaCacheUsage();
  const data = cacheFolderUsage();
  return {
    total: media.total + data,
    projects: media.projects,
    other: media.other,
    data,
  };
};

export const clearCache = (): void => {
  clearMediaCache();
  clearDataCache();
  void Image.clearDiskCache();
  void Image.clearMemoryCache();
};

export const clearCacheGroups = (projectIds: readonly string[], system: boolean): void => {
  for (const projectId of projectIds) clearMediaGroup(projectId);
  if (system) {
    clearMediaGroup(null);
    clearDataCache();
  }
};

onSignOut(clearCache);
