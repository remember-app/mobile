import { currentToken, onSignOut } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import {
  deleteMovie as apiDelete,
  listMovies as apiList,
  renameMovie as apiRename,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Movie } from '@/models';
import type { MovieId, ProjectId } from '@/types/id';

export type MoviesState = {
  status: 'loading' | 'ready' | 'error';
  items: Movie[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  items: Movie[];
  nextOffset: number | null;
};

const EMPTY: MoviesState = {
  status: 'loading',
  items: [],
  nextOffset: null,
  error: null,
};

const states = new Map<ProjectId, MoviesState>();
const inFlight = new Map<ProjectId, Promise<void>>();
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `movies-${projectId}`;

export const moviesState = (projectId: ProjectId): MoviesState => states.get(projectId) ?? EMPTY;

export const subscribeMovies = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: MoviesState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function revive(movie: Movie): Movie {
  return { ...movie, createdAt: new Date(movie.createdAt) };
}

function persist(projectId: ProjectId): void {
  const current = moviesState(projectId);
  writeCache(cacheName(projectId), {
    items: current.items,
    nextOffset: current.nextOffset,
  });
}

export function hydrateMovies(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.items)) return;
  emit(projectId, {
    status: 'ready',
    items: stored.items.map(revive),
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export async function loadMovies(projectId: ProjectId, force = false): Promise<void> {
  const existing = inFlight.get(projectId);
  if (existing) return existing;
  const current = moviesState(projectId);
  if (!force && current.status === 'ready') return;
  emit(projectId, { ...current, status: 'loading', error: null });
  const request = apiList(token(), projectId)
    .then((page) => {
      emit(projectId, {
        status: 'ready',
        items: page.items.map(revive),
        nextOffset: page.nextOffset,
        error: null,
      });
      persist(projectId);
    })
    .catch((error: unknown) => {
      emit(projectId, { ...moviesState(projectId), status: 'error', error });
      throw error;
    })
    .finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, request);
  return request;
}

export async function renameMovie(
  projectId: ProjectId,
  movieId: MovieId,
  name: string,
): Promise<Movie> {
  const renamed = await apiRename(token(), projectId, movieId, name);
  const current = moviesState(projectId);
  emit(projectId, {
    ...current,
    items: current.items.map((movie) => (movie.id === movieId ? renamed : movie)),
  });
  persist(projectId);
  return renamed;
}

export async function removeMovie(projectId: ProjectId, movieId: MovieId): Promise<void> {
  await apiDelete(token(), projectId, movieId);
  const current = moviesState(projectId);
  emit(projectId, {
    ...current,
    items: current.items.filter((movie) => movie.id !== movieId),
  });
  persist(projectId);
}

function forgetMovies(projectId: string): void {
  states.delete(projectId);
  removeCache(cacheName(projectId));
  for (const listener of listeners) listener();
}

export function clearMovies(): void {
  for (const projectId of states.keys()) removeCache(cacheName(projectId));
  states.clear();
  for (const listener of listeners) listener();
}

onProjectDeleted(forgetMovies);
onSignOut(clearMovies);
