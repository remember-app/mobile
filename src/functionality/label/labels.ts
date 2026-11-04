import { currentToken, onSignOut } from '@/functionality/auth/session';
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

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function order(labels: Label[]): Label[] {
  return [...labels].sort(
    (left, right) =>
      Number(right.shared) - Number(left.shared) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  );
}

export function hydrateLabels(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.labels)) return;
  emit(projectId, {
    status: 'ready',
    labels: stored.labels.map((label) => ({ ...label, createdAt: new Date(label.createdAt) })),
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
      const page = await listLabels(token(), projectId);
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
      const page = await listLabels(token(), projectId, {
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
  input: { name: string; color: `#${string}`; description?: string | null; shared: boolean },
): Promise<Label> {
  const label = await apiCreateLabel(token(), projectId, {
    name: input.name,
    colorHex: input.color,
    description: input.description ?? null,
    shared: input.shared,
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
  patch: { name?: string; color?: `#${string}`; description?: string | null },
): Promise<Label> {
  const label = await apiUpdateLabel(token(), projectId, labelId, {
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.color === undefined ? {} : { colorHex: patch.color }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
  });
  const current = labelsState(projectId);
  emit(projectId, {
    ...current,
    labels: order(current.labels.map((item) => (item.id === labelId ? label : item))),
  });
  persist(projectId);
  return label;
}

export async function deleteLabel(projectId: ProjectId, labelId: LabelId): Promise<void> {
  await apiDeleteLabel(token(), projectId, labelId);
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
  const { attached } = await attachLabelItems(token(), projectId, labelId, itemIds);
  if (attached > 0) {
    setItemLabels(projectId, itemIds, labelId, true);
    await bumpCount(projectId, labelId, attached);
  }
  return attached;
}

export async function detachItems(
  projectId: ProjectId,
  labelId: LabelId,
  itemIds: ProjectItemId[],
): Promise<number> {
  const { detached } = await detachLabelItems(token(), projectId, labelId, itemIds);
  if (detached > 0) {
    setItemLabels(projectId, itemIds, labelId, false);
    await bumpCount(projectId, labelId, -detached);
  }
  return detached;
}

async function bumpCount(projectId: ProjectId, labelId: LabelId, delta: number): Promise<void> {
  const current = labelsState(projectId);
  const label = current.labels.find((item) => item.id === labelId);
  if (!label) return;
  emit(projectId, {
    ...current,
    labels: current.labels.map((item) =>
      item.id === labelId ? { ...item, itemCount: Math.max(0, item.itemCount + delta) } : item,
    ),
  });
  persist(projectId);
}

onSignOut(clearLabels);
onProjectDeleted(forgetLabels);
