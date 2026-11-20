import { onSignOut, requireToken } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import {
  downloadLinks as apiDownloadLinks,
  updateMedia as apiUpdateMedia,
  deleteMedia,
  getItem,
  listGallery,
  type MediaPatch,
  updateItemComment,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import { clearMediaGroup } from '@/integrations/files/media-cache';
import type { Analysis, DownloadLink, Item } from '@/models';
import type { LabelId, ProjectId, ProjectItemId } from '@/types/id';

export type GalleryState = {
  status: 'loading' | 'ready' | 'error';
  items: Item[];
  nextCursor: string | null;
  error: unknown;
};

type Stored = {
  items: Item[];
  nextCursor: string | null;
};

const EMPTY: GalleryState = {
  status: 'loading',
  items: [],
  nextCursor: null,
  error: null,
};

const states = new Map<ProjectId, GalleryState>();
const inFlight = new Map<ProjectId, Promise<void>>();
const itemLoads = new Map<string, Promise<Item>>();
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `gallery-v4-${projectId}`;

export const galleryState = (projectId: ProjectId | undefined): GalleryState =>
  projectId ? (states.get(projectId) ?? EMPTY) : EMPTY;

export const subscribeGallery = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: GalleryState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function revive(item: Item): Item {
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    media: {
      ...item.media,
      meta: {
        ...item.media.meta,
        at: item.media.meta.at === null ? null : new Date(item.media.meta.at),
      },
    },
  };
}

function persist(projectId: ProjectId): void {
  const current = galleryState(projectId);
  writeCache(cacheName(projectId), { items: current.items, nextCursor: current.nextCursor });
}

export function hydrateGallery(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.items)) return;
  emit(projectId, {
    status: 'ready',
    items: stored.items.map(revive),
    nextCursor: stored.nextCursor,
    error: null,
  });
}

export function clearGalleries(): void {
  states.clear();
  for (const listener of listeners) listener();
}

export function forgetGallery(projectId: ProjectId): void {
  clearMediaGroup(projectId);
  states.delete(projectId);
  removeCache(cacheName(projectId));
  for (const listener of listeners) listener();
}

export function itemById(projectId: ProjectId, itemId: ProjectItemId): Item | undefined {
  return galleryState(projectId).items.find((item) => item.id === itemId);
}

export function setItemLabels(
  projectId: ProjectId,
  itemIds: ProjectItemId[],
  labelId: LabelId,
  on: boolean,
): void {
  const current = galleryState(projectId);
  if (current.items.length === 0) return;
  const ids = new Set(itemIds);
  const items = current.items.map((item) => {
    if (!ids.has(item.id)) return item;
    const labelIds = on
      ? [...new Set([...item.labelIds, labelId])]
      : item.labelIds.filter((id) => id !== labelId);
    return { ...item, labelIds };
  });
  emit(projectId, { ...current, items });
  persist(projectId);
}

export function setItemAnalyses(
  projectId: ProjectId,
  entries: readonly { itemId: ProjectItemId; analysis: Analysis | null }[],
): void {
  if (entries.length === 0) return;
  const current = galleryState(projectId);
  if (current.items.length === 0) return;
  const byId = new Map(entries.map((entry) => [entry.itemId, entry.analysis]));
  let changed = false;
  const items = current.items.map((item) => {
    if (!byId.has(item.id)) return item;
    const analysis = byId.get(item.id) ?? null;
    if (item.analysis === analysis) return item;
    changed = true;
    return { ...item, analysis };
  });
  if (!changed) return;
  emit(projectId, { ...current, items });
  persist(projectId);
}

function mergeItem(projectId: ProjectId, item: Item): void {
  const current = galleryState(projectId);
  const exists = current.items.some((candidate) => candidate.id === item.id);
  const items = exists
    ? current.items.map((candidate) => (candidate.id === item.id ? item : candidate))
    : [...current.items, item].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  emit(projectId, { ...current, items });
  persist(projectId);
}

export async function loadGallery(projectId: ProjectId, force = false): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  if (!force && galleryState(projectId).status === 'ready') return;
  const run = (async () => {
    const current = galleryState(projectId);
    if (current.items.length === 0) emit(projectId, { ...current, status: 'loading', error: null });
    try {
      const page = await listGallery(requireToken(), projectId);
      emit(projectId, {
        status: 'ready',
        items: page.items,
        nextCursor: page.nextCursor,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, {
        ...galleryState(projectId),
        status: galleryState(projectId).items.length > 0 ? 'ready' : 'error',
        error,
      });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

export async function loadMoreGallery(projectId: ProjectId): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  const current = galleryState(projectId);
  if (current.nextCursor === null) return;
  const run = (async () => {
    try {
      const page = await listGallery(requireToken(), projectId, {
        cursor: current.nextCursor ?? undefined,
      });
      const seen = new Set(current.items.map((item) => item.id));
      emit(projectId, {
        status: 'ready',
        items: [...current.items, ...page.items.filter((item) => !seen.has(item.id))],
        nextCursor: page.nextCursor,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, { ...galleryState(projectId), error });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

const allLoads = new Map<ProjectId, Promise<Item[]>>();

export function refreshGalleryAll(projectId: ProjectId): Promise<Item[]> {
  const running = allLoads.get(projectId);
  if (running) return running;
  const request = fetchGalleryAll(projectId).finally(() => allLoads.delete(projectId));
  allLoads.set(projectId, request);
  return request;
}

async function fetchGalleryAll(projectId: ProjectId): Promise<Item[]> {
  const pending = inFlight.get(projectId);
  if (pending) await pending.catch(() => undefined);
  const tokenValue = requireToken();
  const items = new Map<ProjectItemId, Item>();
  let cursor: string | undefined;
  do {
    const page = await listGallery(tokenValue, projectId, { limit: 200, cursor });
    for (const item of page.items) items.set(item.id, item);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  const list = [...items.values()];
  emit(projectId, { status: 'ready', items: list, nextCursor: null, error: null });
  persist(projectId);
  return list;
}

export async function loadItem(projectId: ProjectId, itemId: ProjectItemId): Promise<Item> {
  const known = itemById(projectId, itemId);
  if (known) return known;
  return refreshItem(projectId, itemId);
}

export function refreshItem(projectId: ProjectId, itemId: ProjectItemId): Promise<Item> {
  const key = `${projectId}:${itemId}`;
  const running = itemLoads.get(key);
  if (running) return running;
  const request = getItem(requireToken(), projectId, itemId)
    .then((item) => {
      mergeItem(projectId, item);
      return item;
    })
    .finally(() => itemLoads.delete(key));
  itemLoads.set(key, request);
  return request;
}

export async function updateItem(
  projectId: ProjectId,
  itemId: ProjectItemId,
  comment: string | null,
): Promise<Item> {
  const item = await updateItemComment(requireToken(), projectId, itemId, comment);
  mergeItem(projectId, item);
  return item;
}

export async function updateMediaInfo(
  projectId: ProjectId,
  itemId: ProjectItemId,
  patch: MediaPatch,
): Promise<Item> {
  const item = itemById(projectId, itemId) ?? (await loadItem(projectId, itemId));
  const media = await apiUpdateMedia(requireToken(), projectId, item.media.id, patch);
  const updated = { ...item, media };
  mergeItem(projectId, updated);
  return updated;
}

export async function downloadItems(
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<DownloadLink[]> {
  return apiDownloadLinks(requireToken(), projectId, itemIds);
}

export async function removeItem(projectId: ProjectId, itemId: ProjectItemId): Promise<void> {
  const item = itemById(projectId, itemId);
  if (!item) return;
  await deleteMedia(requireToken(), projectId, item.media.id);
  const current = galleryState(projectId);
  emit(projectId, {
    ...current,
    items: current.items.filter((candidate) => candidate.id !== itemId),
  });
  persist(projectId);
}

export async function removeItems(
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<{ failed: number }> {
  const targets = itemIds.flatMap((id) => {
    const item = itemById(projectId, id);
    return item ? [{ id, mediaId: item.media.id }] : [];
  });
  const results = await Promise.allSettled(
    targets.map((target) => deleteMedia(requireToken(), projectId, target.mediaId)),
  );
  const gone = new Set(
    targets.filter((_, at) => results[at]?.status === 'fulfilled').map((target) => target.id),
  );
  if (gone.size > 0) {
    const current = galleryState(projectId);
    emit(projectId, {
      ...current,
      items: current.items.filter((candidate) => !gone.has(candidate.id)),
    });
    persist(projectId);
  }
  return { failed: targets.length - gone.size };
}

onSignOut(clearGalleries);
onProjectDeleted(forgetGallery);
