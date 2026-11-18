import { onSignOut, requireToken } from '@/functionality/auth/session';
import { setItemLabels } from '@/functionality/media/gallery';
import { onProjectDeleted } from '@/functionality/project/projects';
import {
  createLabel as apiCreateLabel,
  deleteLabel as apiDeleteLabel,
  updateLabel as apiUpdateLabel,
  attachLabelItems,
  detachLabelItems,
  listLabels,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Label } from '@/models';
import type { LabelId, ProjectId, ProjectItemId } from '@/types/id';

export type LabelsState = {
  status: 'loading' | 'ready' | 'error';
  labels: Label[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  labels: Label[];
  nextOffset: number | null;
};

const EMPTY: LabelsState = {
  status: 'loading',
  labels: [],
  nextOffset: null,
  error: null,
};

const states = new Map<ProjectId, LabelsState>();
const inFlight = new Map<ProjectId, Promise<void>>();
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `labels-${projectId}`;

export const labelsState = (projectId: ProjectId): LabelsState => states.get(projectId) ?? EMPTY;

export const subscribeLabels = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: LabelsState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function persist(projectId: ProjectId): void {
  const current = labelsState(projectId);
  writeCache(cacheName(projectId), { labels: current.labels, nextOffset: current.nextOffset });
}

function order(labels: Label[]): Label[] {
  return [...labels].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

export function hydrateLabels(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.labels)) return;
  emit(projectId, {
    status: 'ready',
    labels: stored.labels,
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export function clearLabels(): void {
  states.clear();
  for (const listener of listeners) listener();
}

export function forgetLabels(projectId: ProjectId): void {
  states.delete(projectId);
  removeCache(cacheName(projectId));
  for (const listener of listeners) listener();
}

export function labelById(projectId: ProjectId, labelId: LabelId): Label | undefined {
  return labelsState(projectId).labels.find((label) => label.id === labelId);
}

export async function loadLabels(projectId: ProjectId, force = false): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  if (!force && labelsState(projectId).status === 'ready') return;
  const run = (async () => {
    try {
      const page = await listLabels(requireToken(), projectId);
      emit(projectId, {
        status: 'ready',
        labels: page.items,
        nextOffset: page.nextOffset,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, {
        ...labelsState(projectId),
        status: labelsState(projectId).labels.length > 0 ? 'ready' : 'error',
        error,
      });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

export async function loadMoreLabels(projectId: ProjectId): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  const current = labelsState(projectId);
  if (current.nextOffset === null) return;
  const run = (async () => {
    try {
      const page = await listLabels(requireToken(), projectId, {
        offset: current.nextOffset ?? undefined,
      });
      const seen = new Set(current.labels.map((label) => label.id));
      emit(projectId, {
        status: 'ready',
        labels: [...current.labels, ...page.items.filter((label) => !seen.has(label.id))],
        nextOffset: page.nextOffset,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, { ...labelsState(projectId), error });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

export async function createLabel(
  projectId: ProjectId,
  input: { name: string; color: `#${string}` },
): Promise<Label> {
  const label = await apiCreateLabel(requireToken(), projectId, {
    name: input.name,
    color: input.color,
  });
  const current = labelsState(projectId);
  emit(projectId, {
    ...current,
    status: 'ready',
    labels: order([label, ...current.labels]),
    error: null,
  });
  persist(projectId);
  return label;
}

export async function updateLabel(
  projectId: ProjectId,
  labelId: LabelId,
  patch: { name?: string; color?: `#${string}` },
): Promise<Label> {
  const label = await apiUpdateLabel(requireToken(), projectId, labelId, patch);
  const current = labelsState(projectId);
  emit(projectId, {
    ...current,
    labels: order(current.labels.map((item) => (item.id === labelId ? label : item))),
  });
  persist(projectId);
  return label;
}

export async function deleteLabel(projectId: ProjectId, labelId: LabelId): Promise<void> {
  await apiDeleteLabel(requireToken(), projectId, labelId);
  const current = labelsState(projectId);
  emit(projectId, {
    ...current,
    labels: current.labels.filter((label) => label.id !== labelId),
  });
  persist(projectId);
}

export async function attachItems(
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
): Promise<number> {
  const { attached } = await attachLabelItems(requireToken(), projectId, labelId, itemIds);
  if (attached > 0) {
    setItemLabels(projectId, itemIds, labelId, true);
    await bumpItems(projectId, labelId, itemIds, true);
  }
  return attached;
}

export async function detachItems(
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
): Promise<number> {
  const { detached } = await detachLabelItems(requireToken(), projectId, labelId, itemIds);
  if (detached > 0) {
    setItemLabels(projectId, itemIds, labelId, false);
    await bumpItems(projectId, labelId, itemIds, false);
  }
  return detached;
}

async function bumpItems(
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
  attached: boolean,
): Promise<void> {
  const current = labelsState(projectId);
  emit(projectId, {
    ...current,
    labels: current.labels.map((label) => {
      if (label.id !== labelId) return label;
      const next = new Set(label.itemsIds);
      for (const itemId of itemIds) {
        if (attached) next.add(itemId);
        else next.delete(itemId);
      }
      return { ...label, itemsIds: [...next] };
    }),
  });
  persist(projectId);
}

onSignOut(clearLabels);
onProjectDeleted(forgetLabels);
