import { onSignOut } from '@/functionality/auth/session';
import { cachedMedia, clearMediaCache, keepMedia } from '@/integrations/files/media-cache';
import { saveToPhone, shareFile } from '@/integrations/files/save';
import type { Item } from '@/models';

const previewExt = (item: Item): string | null =>
  item.kind === 'audio' ? null : item.kind === 'video' ? 'mp4' : 'jpg';

export const cachedThumbnail = (item: Item): string | null =>
  cachedMedia(item.media.id, 'thumbnail', 'jpg');

export const cachedPreview = (item: Item): string | null => {
  const ext = previewExt(item);
  return ext === null ? null : cachedMedia(item.media.id, 'preview', ext);
};

export const cachedOriginal = (item: Item): string | null =>
  cachedMedia(item.media.id, 'original', item.media.format);

export async function ensureThumbnail(item: Item): Promise<string | null> {
  if (!item.links.thumbnail) return null;
  return keepMedia(item.media.id, 'thumbnail', 'jpg', item.links.thumbnail);
}

export async function ensurePreview(item: Item): Promise<string | null> {
  const ext = previewExt(item);
  if (ext === null || !item.links.preview) return null;
  return keepMedia(item.media.id, 'preview', ext, item.links.preview);
}

export async function ensureOriginal(item: Item): Promise<string | null> {
  if (!item.links.original) return null;
  return keepMedia(item.media.id, 'original', item.media.format, item.links.original);
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
}

onSignOut(clearMediaCache);
