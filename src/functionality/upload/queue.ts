import { currentToken, onSignOut } from '@/functionality/auth/session';
import { refreshItem } from '@/functionality/media/gallery';
import { onProjectDeleted } from '@/functionality/project/projects';
import { cancelUpload, completeUpload, resumeUpload, startUpload } from '@/integrations/api';
import { readCache, writeCache } from '@/integrations/files/cache';
import { type FilePart, fileDigest, readFilePart } from '@/integrations/files/parts';
import { putPart } from '@/integrations/storage/upload';
import type {
  MediaKind,
  UploadComplete,
  UploadDuplicate,
  UploadedPart,
  UploadPlan,
} from '@/models';
import type { ProjectId, ProjectItemId, UploadId } from '@/types/id';

const CACHE = 'uploads';
const FINISH_MS = 650;

export type QueuedUpload = {
  localId: string;
  projectId: ProjectId;
  uri: string;
  fileName: string;
  kind: MediaKind;
  sizeBytes: number;
  capturedAt: string | null;
  durationSeconds: number | null;
  fingerprint: string | null;
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
  (upload: UploadComplete, projectId: ProjectId, localId: string) => void | Promise<void>
>();
const localPreviews = new Map<string, string>();
const previewQueue: { projectId: ProjectId; itemId: ProjectItemId }[] = [];
let previewing = false;

export const localPreviewOf = (itemId: string): string | undefined => localPreviews.get(itemId);

async function watchPreview(projectId: ProjectId, itemId: ProjectItemId): Promise<void> {
  previewQueue.push({ projectId, itemId });
  if (previewing) return;
  previewing = true;
  try {
    while (previewQueue.length > 0) {
      const next = previewQueue.shift();
      if (!next) continue;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const item = await refreshItem(next.projectId, next.itemId).catch(() => undefined);
        if (item?.links.thumbnail || item?.links.preview) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  } finally {
    previewing = false;
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
  listener: (upload: UploadComplete, projectId: ProjectId, localId: string) => void | Promise<void>,
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

function persist(): void {
  writeCache(CACHE, state.items);
}

function update(localId: string, patch: Partial<QueuedUpload>): void {
  emit({
    ...state,
    items: state.items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
  });
  persist();
}

export function hydrateUploads(): void {
  const stored = readCache<QueuedUpload[]>(CACHE);
  if (!Array.isArray(stored)) return;
  emit({
    items: stored.map((item) => ({
      ...item,
      fingerprint: item.fingerprint ?? null,
      status: item.status === 'sending' ? 'waiting' : item.status,
    })),
    sending: false,
  });
}

export function clearUploads(): void {
  emit({ items: [], sending: false });
  writeCache(CACHE, []);
}

export function enqueueUploads(
  files: {
    projectId: ProjectId;
    uri: string;
    fileName: string;
    kind: MediaKind;
    sizeBytes: number;
    capturedAt?: string | null;
    durationSeconds?: number | null;
  }[],
): QueuedUpload[] {
  const added = files.map(
    (file): QueuedUpload => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      projectId: file.projectId,
      uri: file.uri,
      fileName: file.fileName,
      kind: file.kind,
      sizeBytes: file.sizeBytes,
      capturedAt: file.capturedAt ?? null,
      durationSeconds: file.durationSeconds ?? null,
      fingerprint: null,
      uploadId: null,
      partBytes: null,
      parts: {},
      status: 'waiting',
      error: null,
    }),
  );
  emit({ ...state, items: [...state.items, ...added] });
  persist();
  void pump();
  return added;
}

export function retryUpload(localId: string): void {
  update(localId, { status: 'waiting', error: null });
  void pump();
}

export async function removeUpload(localId: string): Promise<void> {
  const item = state.items.find((candidate) => candidate.localId === localId);
  if (!item) return;
  const token = currentToken();
  if (token && item.uploadId)
    await cancelUpload(token, item.projectId, item.uploadId).catch(() => undefined);
  emit({ ...state, items: state.items.filter((candidate) => candidate.localId !== localId) });
  persist();
}

export async function removeProjectUploads(projectId: ProjectId): Promise<void> {
  const token = currentToken();
  const targets = state.items.filter((item) => item.projectId === projectId);
  for (const item of targets) {
    if (token && item.uploadId) {
      await cancelUpload(token, item.projectId, item.uploadId).catch(() => undefined);
    }
  }
  emit({ ...state, items: state.items.filter((item) => item.projectId !== projectId) });
  persist();
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
  try {
    for (let next = state.items.find((item) => item.status === 'waiting'); next; ) {
      try {
        const done = await send(next, token);
        if (done) void finish(next, done);
      } catch (error) {
        update(next.localId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'upload failed',
        });
      }
      next = state.items.find((item) => item.status === 'waiting');
    }
  } finally {
    emit({ ...state, sending: false });
  }
}

function rangeOf(sizeBytes: number, partBytes: number, number: number): FilePart {
  const start = (number - 1) * partBytes;
  return { start, length: Math.min(partBytes, sizeBytes - start) };
}

async function planFor(item: QueuedUpload, token: string): Promise<UploadPlan | UploadDuplicate> {
  if (item.uploadId === null) {
    let fingerprint = item.fingerprint;
    if (fingerprint === null) {
      fingerprint = await fileDigest(item.uri);
      if (fingerprint) update(item.localId, { fingerprint });
    }
    const answer = await startUpload(token, item.projectId, {
      kind: item.kind,
      sizeBytes: item.sizeBytes,
      fileName: item.fileName.slice(0, 255),
      capturedAt: item.capturedAt,
      durationSeconds: item.durationSeconds,
      fingerprint,
    });
    if ('duplicate' in answer) return answer;
    const plan = answer;
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
  const initial = await planFor(item, token);
  if ('duplicate' in initial) {
    return { ...initial.duplicate, status: 'processing', duplicate: true };
  }
  let plan: UploadPlan = initial;
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
      const retry = await planFor(item, token);
      if ('duplicate' in retry) {
        return { ...retry.duplicate, status: 'processing', duplicate: true };
      }
      plan = retry;
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
  localPreviews.set(done.itemId, item.uri);
  await new Promise((resolve) => setTimeout(resolve, FINISH_MS));
  void watchPreview(item.projectId, done.itemId);
  await Promise.allSettled(
    [...completed].map((listener) => listener(done, item.projectId, item.localId)),
  );
  emit({ ...state, items: state.items.filter((candidate) => candidate.localId !== item.localId) });
  persist();
}

onSignOut(clearUploads);
onProjectDeleted((projectId) => {
  void removeProjectUploads(projectId);
});
