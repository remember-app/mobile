import { onSignOut, requireToken } from '@/functionality/auth/session';
import {
  createOwnSong as apiCreate,
  deleteOwnSong as apiDelete,
  updateSong as apiUpdate,
  listMySongs,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Song } from '@/models';
import type { MediaId, SongId } from '@/types/id';

export type OwnSongsState = {
  status: 'loading' | 'ready' | 'error';
  items: Song[];
  error: unknown;
};

export type OwnSongInput = {
  name: string;
  author?: string | null;
  originalId: MediaId;
  coverId?: MediaId | null;
  previewCoverId?: MediaId | null;
};

const EMPTY: OwnSongsState = { status: 'loading', items: [], error: null };
const CACHE = 'songs-mine-v3';

let state: OwnSongsState = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const ownSongsState = (): OwnSongsState => state;

export const subscribeOwnSongs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function notify(): void {
  for (const listener of listeners) listener();
}

function set(next: OwnSongsState): void {
  state = next;
  writeCache(CACHE, next.items);
  notify();
}

const byName = (items: Song[]): Song[] =>
  [...items].sort((left, right) => left.name.localeCompare(right.name));

export function hydrateOwnSongs(): void {
  const stored = readCache<Song[]>(CACHE);
  if (!Array.isArray(stored)) return;
  state = { status: 'ready', items: stored, error: null };
  notify();
}

export async function loadOwnSongs(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && state.status === 'ready') return;
  state = { ...state, status: 'loading', error: null };
  notify();
  inFlight = listMySongs(requireToken(), { limit: 100 })
    .then((page) => set({ status: 'ready', items: page.items, error: null }))
    .catch((error: unknown) => {
      state = { ...state, status: 'error', error };
      notify();
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function rememberSongDuration(songId: SongId, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const song = state.items.find((item) => item.id === songId);
  if (!song || (song.duration !== null && song.duration > 0)) return;
  set({
    ...state,
    items: state.items.map((item) => (item.id === songId ? { ...item, duration: seconds } : item)),
  });
}

export async function createOwnSong(input: OwnSongInput): Promise<Song> {
  const song = await apiCreate(requireToken(), input);
  set({ ...state, items: byName([...state.items, song]) });
  return song;
}

export async function updateOwnSong(
  songId: SongId,
  patch: { name?: string; author?: string | null; coverId?: MediaId | null },
): Promise<Song> {
  const song = await apiUpdate(requireToken(), songId, patch);
  const known = state.items.find((item) => item.id === songId)?.duration ?? null;
  const merged = song.duration == null && known !== null ? { ...song, duration: known } : song;
  set({ ...state, items: byName(state.items.map((item) => (item.id === songId ? merged : item))) });
  return merged;
}

export async function deleteOwnSong(songId: SongId): Promise<void> {
  await apiDelete(requireToken(), songId);
  set({ ...state, items: state.items.filter((item) => item.id !== songId) });
}

export function clearOwnSongs(): void {
  state = EMPTY;
  removeCache(CACHE);
  notify();
}

onSignOut(clearOwnSongs);
