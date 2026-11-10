import { currentToken, onSignOut } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import {
  downloadLinks as apiDownloadLinks,
  updateMedia as apiUpdateMedia,
  deleteMedia,
  getItem,
  listGallery,
  type MediaPatch,
  updateItemDescription,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import { forgetItemMedia } from '@/integrations/files/media-cache';
import type { DownloadLink, Item } from '@/models';
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
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `gallery-${projectId}`;

export const galleryState = (projectId: ProjectId): GalleryState => states.get(projectId) ?? EMPTY;

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
      capturedAt: item.media.capturedAt === null ? null : new Date(item.media.capturedAt),
    },
  };
}

function persist(projectId: ProjectId): void {
  const current = galleryState(projectId);
  writeCache(cacheName(projectId), { items: current.items, nextCursor: current.nextCursor });
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
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
  for (const item of galleryState(projectId).items) forgetItemMedia(item.media.id, item.projectId);
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

function mergeItem(projectId: ProjectId, item: Item): void {
  const current = galleryState(projectId);
  const exists = current.items.some((candidate) => candidate.id === item.id);
  const items = exists
    ? current.items.map((candidate) => (candidate.id === item.id ? item : candidate))
    : [...current.items, item].sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
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
      const page = await listGallery(token(), projectId);
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
      const page = await listGallery(token(), projectId, {
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

export async function loadItem(projectId: ProjectId, itemId: ProjectItemId): Promise<Item> {
  const known = itemById(projectId, itemId);
  if (known) return known;
  const item = await getItem(token(), projectId, itemId);
  mergeItem(projectId, item);
  return item;
}

export async function updateItem(
  projectId: ProjectId,
  itemId: ProjectItemId,
  description: string | null,
): Promise<Item> {
  const item = await updateItemDescription(token(), projectId, itemId, description);
  mergeItem(projectId, item);
  return item;
}

export async function updateMediaInfo(
  projectId: ProjectId,
  itemId: ProjectItemId,
  patch: MediaPatch,
): Promise<Item> {
  const item = itemById(projectId, itemId) ?? (await loadItem(projectId, itemId));
  const media = await apiUpdateMedia(token(), projectId, item.media.id, patch);
  const updated = { ...item, media };
  mergeItem(projectId, updated);
  return updated;
}

export async function downloadItems(
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<DownloadLink[]> {
  return apiDownloadLinks(token(), projectId, itemIds);
}

export async function removeItem(projectId: ProjectId, itemId: ProjectItemId): Promise<void> {
  const item = itemById(projectId, itemId);
  if (!item) return;
  await deleteMedia(token(), projectId, item.media.id);
  const current = galleryState(projectId);
  emit(projectId, {
    ...current,
    items: current.items.filter((candidate) => candidate.id !== itemId),
  });
  persist(projectId);
}

onSignOut(clearGalleries);
onProjectDeleted(forgetGallery);
