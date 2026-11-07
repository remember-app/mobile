import { currentToken, onSignOut } from '@/functionality/auth/session';
import {
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  updateProject as apiUpdateProject,
  listProjects,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Project, ProjectCard } from '@/models';

const CACHE = 'projects';

export type ProjectsState = {
  status: 'loading' | 'ready' | 'error';
  cards: ProjectCard[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  cards: ProjectCard[];
  nextOffset: number | null;
};

let state: ProjectsState = {
  status: 'loading',
  cards: [],
  nextOffset: null,
  error: null,
};
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const deletedListeners = new Set<(projectId: string) => void>();

export function onProjectDeleted(listener: (projectId: string) => void): () => void {
  deletedListeners.add(listener);
  return () => {
    deletedListeners.delete(listener);
  };
}

export const projectsState = (): ProjectsState => state;

export const subscribeProjects = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(next: ProjectsState): void {
  state = next;
  for (const listener of listeners) listener();
}

function revive(card: ProjectCard): ProjectCard {
  return {
    ...card,
    eventStart: new Date(card.eventStart),
    eventEnd: card.eventEnd === null ? null : new Date(card.eventEnd),
  };
}

function persist(): void {
  writeCache(CACHE, { cards: state.cards, nextOffset: state.nextOffset });
}

export function hydrateProjects(): void {
  const stored = readCache<Stored>(CACHE);
  if (!stored || !Array.isArray(stored.cards)) return;
  emit({
    status: 'ready',
    cards: stored.cards.map(revive),
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export function clearProjects(): void {
  emit({ status: 'loading', cards: [], nextOffset: null, error: null });
  removeCache(CACHE);
}

export function projectById(id: string): ProjectCard | undefined {
  return state.cards.find((card) => card.id === id);
}

export function myRoleOf(id: string) {
  return projectById(id)?.myRole;
}

export function upsertProjectCard(project: Project): ProjectCard {
  const current = projectById(project.id);
  const card: ProjectCard = { ...project, previewUrls: current?.previewUrls ?? [] };
  const exists = current !== undefined;
  emit({
    ...state,
    status: 'ready',
    cards: exists
      ? state.cards.map((item) => (item.id === project.id ? card : item))
      : [card, ...state.cards],
    error: null,
  });
  persist();
  return card;
}

export function adjustProjectCounts(
  id: string,
  delta: { members?: number; shared?: number },
): void {
  const card = projectById(id);
  if (!card) return;
  emit({
    ...state,
    cards: state.cards.map((item) =>
      item.id === id
        ? {
            ...item,
            memberCount: Math.max(0, item.memberCount + (delta.members ?? 0)),
            sharedCount: Math.max(0, item.sharedCount + (delta.shared ?? 0)),
          }
        : item,
    ),
  });
  persist();
}

export async function loadProjects(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && state.status === 'ready') return;
  const token = currentToken();
  if (!token) {
    emit({ status: 'error', cards: [], nextOffset: null, error: new Error('not signed in') });
    return;
  }
  inFlight = (async () => {
    if (state.cards.length === 0) emit({ ...state, status: 'loading', error: null });
    try {
      const page = await listProjects(token);
      emit({
        status: 'ready',
        cards: page.items,
        nextOffset: page.nextOffset,
        error: null,
      });
      persist();
    } catch (error) {
      emit({ ...state, status: state.cards.length > 0 ? 'ready' : 'error', error });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function loadMoreProjects(): Promise<void> {
  if (inFlight) return inFlight;
  const token = currentToken();
  const offset = state.nextOffset;
  if (!token || offset === null) return;
  inFlight = (async () => {
    try {
      const page = await listProjects(token, { offset });
      const seen = new Set(state.cards.map((card) => card.id));
      emit({
        status: 'ready',
        cards: [...state.cards, ...page.items.filter((card) => !seen.has(card.id))],
        nextOffset: page.nextOffset,
        error: null,
      });
      persist();
    } catch (error) {
      emit({ ...state, error });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function createProject(input: {
  title: string;
  eventStart: string;
  eventEnd?: string | null;
  storageBytes?: number;
}): Promise<ProjectCard> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const project = await apiCreateProject(token, input);
  const card: ProjectCard = { ...project, previewUrls: [] };
  emit({ ...state, status: 'ready', cards: [card, ...state.cards], error: null });
  persist();
  return card;
}

export async function updateProject(
  id: string,
  patch: {
    title?: string;
    eventStart?: string;
    eventEnd?: string | null;
  },
): Promise<ProjectCard> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const project: Project = await apiUpdateProject(token, id, patch);
  const current = projectById(id);
  const card: ProjectCard = { ...project, previewUrls: current?.previewUrls ?? [] };
  emit({
    ...state,
    status: 'ready',
    cards: state.cards.map((item) => (item.id === id ? card : item)),
    error: null,
  });
  persist();
  return card;
}

export async function deleteProject(id: string): Promise<void> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  await apiDeleteProject(token, id);
  emit({ ...state, cards: state.cards.filter((card) => card.id !== id), error: null });
  persist();
  for (const listener of deletedListeners) listener(id);
}

onSignOut(clearProjects);
