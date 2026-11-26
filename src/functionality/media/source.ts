import { onSignOut, requireToken } from '@/functionality/auth/session';
import { itemLinks } from '@/integrations/api';
import { cachedFile, keepFile } from '@/integrations/files/media-cache';
import { hasVariant, type Item, type ItemLinkVariant } from '@/models';

type Link = { url: string; expiresAt: number };

const links = new Map<string, Link>();
const inFlight = new Map<string, Promise<string | null>>();

const keyOf = (item: Item, variant: ItemLinkVariant): string => `${item.id}:${variant}`;

export function previewLink(item: Item, size: 'small' | 'middle'): string | null {
  return item.links[size];
}

export function resolveLink(
  item: Item,
  variant: ItemLinkVariant,
  force = false,
): Promise<string | null> {
  if (!hasVariant(item, variant)) return Promise.resolve(null);
  const key = keyOf(item, variant);
  if (force) links.delete(key);
  const known = links.get(key);
  if (known && known.expiresAt > Date.now() + 30_000) return Promise.resolve(known.url);
  const running = inFlight.get(key);
  if (running) return running;
  const request = itemLinks(requireToken(), item.projectId, [{ itemId: item.id, variant }])
    .then((issued) => {
      const fresh = issued.find((entry) => entry.variant === variant);
      if (!fresh) return null;
      links.set(key, { url: fresh.url, expiresAt: new Date(fresh.expiresAt).getTime() });
      return fresh.url;
    })
    .catch((error) => {
      console.warn(`link for ${item.id} ${variant} could not be issued:`, error);
      return null;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

function mediaIdOf(item: Item, variant: ItemLinkVariant): string | null {
  if (variant === 'original') return item.variants.original;
  if (variant === 'large') return item.variants.previews.large ?? null;
  return item.variants.compressed;
}

function extensionOf(item: Item, variant: ItemLinkVariant): string {
  if (variant === 'large' || variant === 'detail') return 'jpg';
  if (variant === 'playback') return item.kind === 'audio' ? 'm4a' : 'mp4';
  return item.media.format;
}

export function cachedVariant(item: Item, variant: ItemLinkVariant): string | null {
  const id = mediaIdOf(item, variant);
  if (!id || !hasVariant(item, variant)) return null;
  return cachedFile({ id, ext: extensionOf(item, variant), group: item.projectId });
}

export function keepVariant(
  item: Item,
  variant: ItemLinkVariant,
  priority = 0,
): Promise<string | null> {
  const id = mediaIdOf(item, variant);
  if (!id || !hasVariant(item, variant)) return Promise.resolve(null);
  return keepFile(
    {
      id,
      ext: extensionOf(item, variant),
      group: item.projectId,
      priority,
    },
    (fresh) => resolveLink(item, variant, fresh),
  );
}

export function forgetLinks(itemId?: string): void {
  if (itemId === undefined) {
    links.clear();
    return;
  }
  for (const key of links.keys()) {
    if (key.startsWith(`${itemId}:`)) links.delete(key);
  }
}

onSignOut(() => links.clear());
