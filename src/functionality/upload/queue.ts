import * as VideoThumbnails from 'expo-video-thumbnails';

import { currentToken, onSignOut } from '@/functionality/auth/session';
import { onProjectDeleted } from '@/functionality/project/projects';
import { cancelUpload, completeUpload, resumeUpload, startUpload } from '@/integrations/api';
import { cacheLocalFile, onCacheCleared } from '@/integrations/files/media-cache';
import { type FilePart, readFilePart } from '@/integrations/files/parts';
import { putPart } from '@/integrations/storage/upload';
import type { MediaKind, UploadComplete, UploadedPart, UploadPlan } from '@/models';
import type { ProjectId, ProjectItemId, UploadId } from '@/types/id';

const MAX_PARALLEL = 3;

async function runPool<T>(
  next: () => T | undefined,
  run: (item: T) => Promise<void>,
): Promise<void> {
  const worker = async () => {
    for (;;) {
      const item = next();
      if (item === undefined) return;
      await run(item);
    }
  };
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));
}

type UploadFile = {
  projectId: ProjectId | null;
  uri: string;
  fileName: string;
  kind: MediaKind;
};

export type QueuedUpload = {
  localId: string;
  projectId: ProjectId | null;
  uri: string;
  posterUri: string | null;
  fileName: string;
  kind: MediaKind;
  sizeBytes: number;
  capturedAt: string | null;
  durationSeconds: number | null;
  fingerprint: string | null;
  /** Кадр, в который превратилась загрузка: пока запись жива, галерея показывает именно его. */
  itemId: ProjectItemId | null;
  uploadId: UploadId | null;
  partBytes: number | null;
  parts: Record<number, string>;
  status: 'waiting' | 'sending' | 'failed';
  error: string | null;
};

export type UploadsState = {
  items: QueuedUpload[];
  sending: boolean;
};

let state: UploadsState = { items: [], sending: false };
const listeners = new Set<() => void>();
const completed = new Set<
  (upload: UploadComplete, projectId: ProjectId | null, localId: string) => void | Promise<void>
>();
const localPreviews = new Map<string, string>();
const localPlaybacks = new Map<string, string>();

export const localPreviewOf = (itemId: string): string | undefined => localPreviews.get(itemId);
export const localPlaybackOf = (itemId: string): string | undefined => localPlaybacks.get(itemId);

function stagedName(localId: string, fileName: string): string {
  const ext = fileName.split('.').at(-1)?.toLowerCase() ?? '';
  return `${localId}.${/^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'}`;
}

async function stage(file: UploadFile, localId: string) {
  try {
    const uri = await cacheLocalFile(file.uri, stagedName(localId, file.fileName), file.projectId);
    let posterUri: string | null = null;
    if (file.kind === 'photo') posterUri = uri;
    if (file.kind === 'video') {
      try {
        const shot = await VideoThumbnails.getThumbnailAsync(uri, { time: 200, quality: 0.7 });
        posterUri = await cacheLocalFile(shot.uri, `${localId}.jpg`, file.projectId);
      } catch (error) {
        console.warn('video thumbnail was not created:', error);
      }
    }
    return { uri, posterUri };
  } catch (error) {
    console.warn('upload file could not be cached:', error);
    return { uri: file.uri, posterUri: null };
  }
}

export const uploadsState = (): UploadsState => state;

export const subscribeUploads = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function onUploaded(
  listener: (
    upload: UploadComplete,
    projectId: ProjectId | null,
    localId: string,
  ) => void | Promise<void>,
): () => void {
  completed.add(listener);
  return () => {
    completed.delete(listener);
  };
}

function emit(next: UploadsState): void {
  state = next;
  for (const listener of listeners) listener();
}

function update(localId: string, patch: Partial<QueuedUpload>): void {
  emit({
    ...state,
    items: state.items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
  });
}

export function clearUploads(): void {
  localPreviews.clear();
  localPlaybacks.clear();
  emit({ items: [], sending: false });
}

export async function enqueueUploads(
  files: (UploadFile & {
    sizeBytes: number;
    capturedAt?: string | null;
    durationSeconds?: number | null;
    fingerprint?: string | null;
  })[],
): Promise<QueuedUpload[]> {
  const added: QueuedUpload[] = new Array(files.length);
  let cursor = 0;
  await runPool(
    () => (cursor < files.length ? cursor++ : undefined),
    async (at) => {
      const file = files[at];
      if (!file) return;
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const staged = await stage(file, localId);
      added[at] = {
        localId,
        projectId: file.projectId,
        uri: staged.uri,
        posterUri: staged.posterUri,
        fileName: file.fileName,
        kind: file.kind,
        sizeBytes: file.sizeBytes,
        capturedAt: file.capturedAt ?? null,
        durationSeconds: file.durationSeconds ?? null,
        fingerprint: file.fingerprint ?? null,
        itemId: null,
        uploadId: null,
        partBytes: null,
        parts: {},
        status: 'waiting',
        error: null,
      };
    },
  );
  emit({ ...state, items: [...state.items, ...added] });
  void pump();
  return added;
}

export function retryUpload(localId: string): void {
  const item = state.items.find((candidate) => candidate.localId === localId);
  const token = currentToken();
  if (token && item?.uploadId) {
    void cancelUpload(token, item.projectId, item.uploadId, true).catch(() => undefined);
  }
  update(localId, {
    status: 'waiting',
    error: null,
    uploadId: null,
    partBytes: null,
    parts: {},
  });
  void pump();
}

export async function removeUpload(localId: string): Promise<void> {
  const item = state.items.find((candidate) => candidate.localId === localId);
  if (!item) return;
  const token = currentToken();
  if (token && item.uploadId)
    await cancelUpload(token, item.projectId, item.uploadId, true).catch(() => undefined);
  if (item.itemId) {
    localPreviews.delete(item.itemId);
    localPlaybacks.delete(item.itemId);
  }
  emit({ ...state, items: state.items.filter((candidate) => candidate.localId !== localId) });
}

export async function removeProjectUploads(projectId: ProjectId): Promise<void> {
  const token = currentToken();
  const targets = state.items.filter((item) => item.projectId === projectId);
  for (const item of targets) {
    if (token && item.uploadId) {
      await cancelUpload(token, item.projectId, item.uploadId, true).catch(() => undefined);
    }
    if (item.itemId) {
      localPreviews.delete(item.itemId);
      localPlaybacks.delete(item.itemId);
    }
  }
  emit({ ...state, items: state.items.filter((item) => item.projectId !== projectId) });
}

export function progressOf(item: QueuedUpload): { done: number; total: number } {
  const total = item.partBytes === null ? 0 : Math.ceil(item.sizeBytes / item.partBytes);
  return { done: Object.keys(item.parts).length, total };
}

export async function pump(): Promise<void> {
  if (state.sending) return;
  const token = currentToken();
  if (!token) return;
  emit({ ...state, sending: true });
  const inFlight = new Set<string>();
  try {
    await runPool(
      () => state.items.find((item) => item.status === 'waiting' && !inFlight.has(item.localId)),
      async (item) => {
        inFlight.add(item.localId);
        try {
          const done = await send(item, token);
          if (done) await finish(item, done);
        } catch (error) {
          update(item.localId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'upload failed',
          });
        } finally {
          inFlight.delete(item.localId);
        }
      },
    );
  } finally {
    emit({ ...state, sending: false });
  }
}

function rangeOf(sizeBytes: number, partBytes: number, number: number): FilePart {
  const start = (number - 1) * partBytes;
  return { start, length: Math.min(partBytes, sizeBytes - start) };
}

async function planFor(item: QueuedUpload, token: string): Promise<UploadPlan> {
  if (item.uploadId === null) {
    const plan = await startUpload(token, item.projectId, {
      kind: item.kind,
      sizeBytes: item.sizeBytes,
      fileName: item.fileName.slice(0, 255),
      capturedAt: item.capturedAt,
      durationSeconds: item.durationSeconds,
    });
    update(item.localId, {
      uploadId: plan.id,
      partBytes: plan.partBytes,
      parts: {},
      status: 'sending',
    });
    return plan;
  }
  const plan = await resumeUpload(token, item.projectId, item.uploadId);
  const patch: Partial<QueuedUpload> =
    plan.partBytes === item.partBytes
      ? { status: 'sending' }
      : { status: 'sending', partBytes: plan.partBytes, parts: {} };
  update(item.localId, patch);
  return plan;
}

async function send(item: QueuedUpload, token: string): Promise<UploadComplete | null> {
  let plan: UploadPlan = await planFor(item, token);
  const partBytes = plan.partBytes;
  const total = Math.ceil(item.sizeBytes / partBytes);
  for (let number = 1; number <= total; number += 1) {
    const known = state.items.find((candidate) => candidate.localId === item.localId);
    if (known?.parts[number] !== undefined) continue;
    const range = rangeOf(item.sizeBytes, partBytes, number);
    const perform = async (): Promise<string> => {
      const url = plan.parts[number - 1];
      if (!url) throw new Error(`no link for part ${number}`);
      return putPart(url, readFilePart(item.uri, range));
    };
    let etag: string;
    try {
      etag = await perform();
    } catch {
      plan = await planFor(item, token);
      if (plan.partBytes !== partBytes) throw new Error('part size changed');
      etag = await perform();
    }
    const current = state.items.find((candidate) => candidate.localId === item.localId);
    if (!current) return null;
    update(item.localId, { parts: { ...current.parts, [number]: etag }, error: null });
  }
  const current = state.items.find((candidate) => candidate.localId === item.localId);
  if (!current) return null;
  const parts: UploadedPart[] = Object.entries(current.parts).map(([number, etag]) => ({
    part_number: Number(number),
    etag,
  }));
  return completeUpload(token, item.projectId, plan.id, parts);
}

async function finish(item: QueuedUpload, done: UploadComplete): Promise<void> {
  update(item.localId, { itemId: done.itemId });
  if (done.itemId !== null) {
    if (item.posterUri) localPreviews.set(done.itemId, item.posterUri);
    if (item.kind === 'video') {
      localPlaybacks.set(done.itemId, item.uri);
    }
  }
  await Promise.allSettled(
    [...completed].map((listener) => listener(done, item.projectId, item.localId)),
  );
  emit({ ...state, items: state.items.filter((candidate) => candidate.localId !== item.localId) });
}

onSignOut(clearUploads);
onCacheCleared(clearUploads);
onProjectDeleted((projectId) => {
  void removeProjectUploads(projectId);
});
