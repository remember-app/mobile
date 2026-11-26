import { onSignOut, requireToken } from '@/functionality/auth/session';
import { itemLinks } from '@/integrations/api';
import { type Item, type ItemLinkVariant, hasVariant } from '@/models';

type Link = { url: string; expiresAt: number };

const links = new Map<string, Link>();
const inFlight = new Map<string, Promise<string | null>>();

const keyOf = (item: Item, variant: ItemLinkVariant): string => `${item.id}:${variant}`;

export function previewLink(item: Item, size: 'small' | 'middle'): string | null {
  return item.links[size];
}

export function resolveLink(item: Item, variant: ItemLinkVariant): Promise<string | null> {
  if (!hasVariant(item, variant)) return Promise.resolve(null);
  const key = keyOf(item, variant);
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
