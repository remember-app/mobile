import { Image } from 'expo-image';

import { onSignOut } from '@/functionality/auth/session';
import { cacheFolderUsage, clearCache as clearDataCache } from '@/integrations/files/cache';
import {
  type CacheGroup,
  cachedUrl,
  clearMediaCache,
  clearMediaGroup,
  keepUrl,
  mediaCacheUsage,
} from '@/integrations/files/media-cache';
import { saveToPhone, shareFile } from '@/integrations/files/save';
import type { Item } from '@/models';

export const cachedOriginal = (item: Item): string | null =>
  item.links.original ? cachedUrl(item.links.original, item.projectId) : null;

const keep = (url: string | null, item: Item): Promise<string | null> =>
  url ? keepUrl(url, item.projectId) : Promise.resolve(null);

export const ensureThumbnail = (item: Item): Promise<string | null> =>
  keep(item.links.thumbnail, item);

export const ensurePreview = (item: Item): Promise<string | null> => keep(item.links.preview, item);

export const ensureOriginal = (item: Item): Promise<string | null> =>
  keep(item.links.original, item);

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
}

export const cacheUsage = (): { total: number; groups: CacheGroup[] } => {
  const media = mediaCacheUsage();
  const data = cacheFolderUsage();
  return {
    total: media.total + data,
    groups: data > 0 ? [...media.groups, { id: 'json', bytes: data }] : media.groups,
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
