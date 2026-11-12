import { currentToken, onSignOut } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import { getSong, listLibrarySongs, listProjectSongs } from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Song } from '@/models';
import type { ProjectId, SongId } from '@/types/id';

export type SongsState = {
  status: 'loading' | 'ready' | 'error';
  items: Song[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  items: Song[];
  nextOffset: number | null;
};

const EMPTY: SongsState = {
  status: 'loading',
  items: [],
  nextOffset: null,
  error: null,
};

const projectStates = new Map<ProjectId, SongsState>();
const projectInFlight = new Map<ProjectId, Promise<void>>();
let library: SongsState = EMPTY;
let libraryInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const projectCache = (projectId: ProjectId) => `songs-${projectId}`;
const libraryCache = 'songs-library';

export const projectSongsState = (projectId: ProjectId): SongsState =>
  projectStates.get(projectId) ?? EMPTY;

export const librarySongsState = (): SongsState => library;

export const subscribeSongs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function notify(): void {
  for (const listener of listeners) listener();
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function persistProject(projectId: ProjectId): void {
  const current = projectSongsState(projectId);
  writeCache(projectCache(projectId), {
    items: current.items,
    nextOffset: current.nextOffset,
  });
}

export function hydrateProjectSongs(projectId: ProjectId): void {
  const stored = readCache<Stored>(projectCache(projectId));
  if (!stored || !Array.isArray(stored.items)) return;
  projectStates.set(projectId, {
    status: 'ready',
    items: stored.items,
    nextOffset: stored.nextOffset,
    error: null,
  });
  notify();
}

export function hydrateLibrarySongs(): void {
  const stored = readCache<Stored>(libraryCache);
  if (!stored || !Array.isArray(stored.items)) return;
  library = {
    status: 'ready',
    items: stored.items,
    nextOffset: stored.nextOffset,
    error: null,
  };
  notify();
}

export async function loadProjectSongs(projectId: ProjectId, force = false): Promise<void> {
  const existing = projectInFlight.get(projectId);
  if (existing) return existing;
  const current = projectSongsState(projectId);
  if (!force && current.status === 'ready') return;
  projectStates.set(projectId, { ...current, status: 'loading', error: null });
  notify();
  const request = listProjectSongs(token(), projectId)
    .then((page) => {
      projectStates.set(projectId, {
        status: 'ready',
        items: page.items,
        nextOffset: page.nextOffset,
        error: null,
      });
      persistProject(projectId);
      notify();
    })
    .catch((error: unknown) => {
      projectStates.set(projectId, {
        ...projectSongsState(projectId),
        status: 'error',
        error,
      });
      notify();
      throw error;
    })
    .finally(() => projectInFlight.delete(projectId));
  projectInFlight.set(projectId, request);
  return request;
}

export async function loadLibrarySongs(force = false): Promise<void> {
  if (libraryInFlight) return libraryInFlight;
  if (!force && library.status === 'ready') return;
  library = { ...library, status: 'loading', error: null };
  notify();
  const request = listLibrarySongs(token())
    .then((page) => {
      library = {
        status: 'ready',
        items: page.items,
        nextOffset: page.nextOffset,
        error: null,
      };
      writeCache(libraryCache, { items: library.items, nextOffset: library.nextOffset });
      notify();
    })
    .catch((error: unknown) => {
      library = { ...library, status: 'error', error };
      notify();
      throw error;
    })
    .finally(() => {
      libraryInFlight = null;
    });
  libraryInFlight = request;
  return request;
}

function forgetProjectSongs(projectId: string): void {
  projectStates.delete(projectId);
  removeCache(projectCache(projectId));
  notify();
}

export function clearSongs(): void {
  for (const projectId of projectStates.keys()) removeCache(projectCache(projectId));
  projectStates.clear();
  library = EMPTY;
  removeCache(libraryCache);
  notify();
}

export async function songUrl(songId: SongId): Promise<string> {
  return (await getSong(token(), songId)).url;
}

onProjectDeleted(forgetProjectSongs);
onSignOut(clearSongs);
