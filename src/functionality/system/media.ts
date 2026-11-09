import { systemMedia } from '@/integrations/api';
import { toSystemMedia } from '@/integrations/api/map';
import { readCache, writeCache } from '@/integrations/files/cache';
import { keepMedia } from '@/integrations/files/media-cache';
import type { SystemMediaItem } from '@/models';

const CACHE = 'system-media';

let items: SystemMediaItem[] = readCache<SystemMediaItem[]>(CACHE) ?? [];
const listeners = new Set<() => void>();
let loading = false;

export const systemMediaState = (): SystemMediaItem[] => items;

export const subscribeSystemMedia = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export async function loadSystemMedia(): Promise<void> {
  if (loading) return;
  loading = true;
  try {
    const answer = await systemMedia();
    items = await Promise.all(
      answer.items.map(async (wire) => {
        const item = toSystemMedia(wire);
        const local = await keepMedia(item.mediaId, 'preview', 'jpg', item.url);
        return { ...item, url: local ?? item.url };
      }),
    );
    writeCache(CACHE, items);
    for (const listener of listeners) listener();
  } catch (error) {
    console.warn('system media could not be loaded:', error);
  } finally {
    loading = false;
  }
}
