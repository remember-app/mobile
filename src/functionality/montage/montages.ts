import { currentToken, onSignOut } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import {
  createMontage as apiCreate,
  listMontages as apiList,
  previewMontage as apiPreview,
  retryMontage as apiRetry,
  listMontageTemplates as apiTemplates,
} from '@/integrations/api';
import type { MontageCreateRequest, MontagePreviewResponse } from '@/integrations/api/contract';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Montage, MontageTemplate } from '@/models';
import type { MontageId, ProjectId } from '@/types/id';

export type MontagesState = {
  status: 'loading' | 'ready' | 'error';
  items: Montage[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  items: Montage[];
  nextOffset: number | null;
};

const EMPTY: MontagesState = {
  status: 'loading',
  items: [],
  nextOffset: null,
  error: null,
};

const states = new Map<ProjectId, MontagesState>();
const templates = new Map<ProjectId, MontageTemplate[]>();
const inFlight = new Map<ProjectId, Promise<void>>();
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `montages-${projectId}`;

export const montagesState = (projectId: ProjectId): MontagesState =>
  states.get(projectId) ?? EMPTY;

export const subscribeMontages = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: MontagesState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function revive(montage: Montage): Montage {
  return { ...montage, createdAt: new Date(montage.createdAt) };
}

function persist(projectId: ProjectId): void {
  const current = montagesState(projectId);
  writeCache(cacheName(projectId), {
    items: current.items,
    nextOffset: current.nextOffset,
  });
}

export function hydrateMontages(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.items)) return;
  emit(projectId, {
    status: 'ready',
    items: stored.items.map(revive),
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export async function loadMontages(projectId: ProjectId, force = false): Promise<void> {
  const existing = inFlight.get(projectId);
  if (existing) return existing;
  const current = montagesState(projectId);
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
      emit(projectId, { ...montagesState(projectId), status: 'error', error });
      throw error;
    })
    .finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, request);
  return request;
}

export async function createMontage(
  projectId: ProjectId,
  input: MontageCreateRequest,
): Promise<Montage> {
  const created = await apiCreate(token(), projectId, input);
  const current = montagesState(projectId);
  emit(projectId, {
    status: 'ready',
    items: [created, ...current.items],
    nextOffset: current.nextOffset,
    error: null,
  });
  persist(projectId);
  return created;
}

export async function loadMontageTemplates(projectId: ProjectId): Promise<MontageTemplate[]> {
  const cached = templates.get(projectId);
  if (cached) return cached;
  const items = await apiTemplates(token(), projectId);
  templates.set(projectId, items);
  return items;
}

export function previewMontage(
  projectId: ProjectId,
  input: Omit<MontageCreateRequest, 'payFrom'>,
): Promise<MontagePreviewResponse> {
  return apiPreview(token(), projectId, input);
}

export async function retryMontage(projectId: ProjectId, montageId: MontageId): Promise<Montage> {
  const updated = await apiRetry(token(), projectId, montageId);
  const current = montagesState(projectId);
  emit(projectId, {
    ...current,
    items: current.items.map((item) => (item.id === updated.id ? updated : item)),
  });
  persist(projectId);
  return updated;
}

function forgetMontages(projectId: string): void {
  states.delete(projectId);
  templates.delete(projectId as ProjectId);
  removeCache(cacheName(projectId));
  for (const listener of listeners) listener();
}

export function clearMontages(): void {
  for (const projectId of states.keys()) removeCache(cacheName(projectId));
  states.clear();
  templates.clear();
  for (const listener of listeners) listener();
}

onProjectDeleted(forgetMontages);
onSignOut(clearMontages);
