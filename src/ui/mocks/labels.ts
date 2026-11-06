import type { LabelChip } from '@/ui/components/media/info/labels-block';
import type { Photo } from '@/ui/components/media/photo-grid';

import { mockPhotos } from './photos';

export type LabelsState = {
  all: readonly LabelChip[];
  assigned: readonly LabelChip[];
};

export type LabelWithCount = LabelChip & {
  count: number;
};

const ALL: LabelChip[] = [
  { id: 'best', name: 'Лучшее', color: '#FFB547' },
  { id: 'movie', name: 'В ролик', color: '#4BD6A0' },
  { id: 'print', name: 'На печать', color: '#4FB3FF' },
  { id: 'cover', name: 'Обложка', color: '#8A7CFF' },
  { id: 'dupes', name: 'Дубли', color: '#FF7A9C' },
];

const MOCK_PHOTOS: readonly Photo[] = mockPhotos(64);
const assigned = new Map<string, Set<string>>();
const snapshots = new Map<string, LabelsState>();
const photoSnapshots = new Map<string, readonly Photo[]>();
const listeners = new Set<() => void>();

function seed(photoId: string): number {
  let value = 0;
  for (let index = 0; index < photoId.length; index += 1) {
    value = (value * 31 + photoId.charCodeAt(index)) % 997;
  }
  return value;
}

function membership(photoId: string): Set<string> {
  const known = assigned.get(photoId);
  if (known) return known;
  const set = new Set<string>();
  const first = ALL[seed(photoId) % ALL.length];
  if (first) set.add(first.id);
  if (seed(photoId) % 3 !== 0) {
    const second = ALL[(seed(photoId) + 2) % ALL.length];
    if (second) set.add(second.id);
  }
  assigned.set(photoId, set);
  return set;
}

const counts = new Map<string, number>(
  ALL.map((label) => [
    label.id,
    MOCK_PHOTOS.filter((photo) => membership(photo.id).has(label.id)).length,
  ]),
);

let usageCache: readonly LabelWithCount[] = ALL.map((label) => ({
  ...label,
  count: counts.get(label.id) ?? 0,
}));

function refreshUsage(): void {
  usageCache = ALL.map((label) => ({ ...label, count: counts.get(label.id) ?? 0 }));
}

function emit(): void {
  for (const listener of listeners) listener();
}

function changed(): void {
  refreshUsage();
  snapshots.clear();
  photoSnapshots.clear();
  emit();
}

export function labelsState(photoId: string): LabelsState {
  const cached = snapshots.get(photoId);
  if (cached) return cached;
  const set = membership(photoId);
  const state: LabelsState = {
    all: ALL,
    assigned: ALL.filter((label) => set.has(label.id)),
  };
  snapshots.set(photoId, state);
  return state;
}

export function photosForLabel(labelId: string): readonly Photo[] {
  const cached = photoSnapshots.get(labelId);
  if (cached) return cached;
  const photos = MOCK_PHOTOS.filter((photo) => membership(photo.id).has(labelId));
  photoSnapshots.set(labelId, photos);
  return photos;
}

export function labelUsage(): readonly LabelWithCount[] {
  return usageCache;
}

export function subscribeLabels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleLabel(photoId: string, labelId: string): void {
  const set = membership(photoId);
  if (set.has(labelId)) {
    set.delete(labelId);
    counts.set(labelId, Math.max(0, (counts.get(labelId) ?? 0) - 1));
  } else {
    set.add(labelId);
    counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
  }
  refreshUsage();
  snapshots.delete(photoId);
  photoSnapshots.clear();
  emit();
}

let sequence = 0;

export function createLabel(name: string, color: string): void {
  const id = `label-${Date.now()}-${sequence++}`;
  ALL.push({ id, name: name.trim(), color });
  counts.set(id, 0);
  changed();
}

export function deleteLabel(id: string): void {
  const index = ALL.findIndex((label) => label.id === id);
  if (index < 0) return;
  ALL.splice(index, 1);
  counts.delete(id);
  for (const set of assigned.values()) set.delete(id);
  changed();
}
