import type { ImageSource } from 'expo-image';

export type MockUploadStatus = 'uploading' | 'done' | 'failed';

export type MockUpload = {
  id: string;
  projectId: string;
  source: ImageSource | null;
  video: boolean;
  assetId: string | null;
  width: number | null;
  height: number | null;
  status: MockUploadStatus;
  progress: number;
};

type NewUpload = {
  source: ImageSource | null;
  video: boolean;
  assetId: string | null;
  width?: number | null;
  height?: number | null;
};

const EMPTY: readonly MockUpload[] = [];
const byProject = new Map<string, MockUpload[]>();
const snapshots = new Map<string, readonly MockUpload[]>();
const timers = new Map<string, ReturnType<typeof setInterval>>();
const listeners = new Set<() => void>();
let sequence = 0;

function snapshot(projectId: string) {
  snapshots.set(projectId, [...(byProject.get(projectId) ?? [])]);
  for (const listener of listeners) listener();
}

function change(projectId: string, id: string, patch: Partial<MockUpload>) {
  const list = byProject.get(projectId);
  const index = list?.findIndex((upload) => upload.id === id) ?? -1;
  const current = list?.[index];
  if (!list || !current) return;
  list[index] = { ...current, ...patch };
  snapshot(projectId);
}

function stop(id: string) {
  const timer = timers.get(id);
  if (timer) clearInterval(timer);
  timers.delete(id);
}

function start(projectId: string, id: string) {
  stop(id);
  timers.set(
    id,
    setInterval(() => {
      const upload = byProject.get(projectId)?.find((entry) => entry.id === id);
      if (upload?.status !== 'uploading') {
        stop(id);
        return;
      }
      const progress = Math.min(1, upload.progress + 0.03 + Math.random() * 0.05);
      if (progress >= 1) {
        stop(id);
        change(projectId, id, { progress: 1, status: 'done' });
      } else {
        change(projectId, id, { progress });
      }
    }, 140),
  );
}

export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function uploadsOf(projectId: string): readonly MockUpload[] {
  return snapshots.get(projectId) ?? EMPTY;
}

export function enqueueMockUploads(projectId: string, uploads: readonly NewUpload[]) {
  const list = byProject.get(projectId) ?? [];
  byProject.set(projectId, list);
  const added = uploads.map((upload) => ({
    id: `upload-${Date.now()}-${sequence++}`,
    projectId,
    source: upload.source,
    video: upload.video,
    assetId: upload.assetId,
    width: upload.width ?? null,
    height: upload.height ?? null,
    status: 'uploading' as const,
    progress: 0,
  }));
  list.unshift(...added);
  snapshot(projectId);
  for (const upload of added) start(projectId, upload.id);
}

export function cancelMockUpload(projectId: string, id: string) {
  stop(id);
  const list = byProject.get(projectId);
  const index = list?.findIndex((upload) => upload.id === id) ?? -1;
  if (!list || index < 0) return;
  list.splice(index, 1);
  snapshot(projectId);
}

export function retryMockUpload(projectId: string, id: string) {
  change(projectId, id, { status: 'uploading', progress: 0 });
  start(projectId, id);
}
