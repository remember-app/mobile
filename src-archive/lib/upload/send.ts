import { File, FileMode, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ApiError,
  apiReason,
  finishUpload,
  refreshUpload,
  reportUploadFailure,
  setContributionStatus,
  startUpload,
  type UploadPlan,
} from '@/api';
import { useAuth } from '@/lib/auth';
import {
  missingParts,
  type PartRange,
  partDeadline,
  type QueuedFile,
  type UploadFailure,
  uploadedParts,
} from '@/lib/upload/queue';

const QUEUE_FILE = 'uploads.json';
const RETRY_MS = 15000;
const RETRIES = 20;
class UploadError extends Error {
  constructor(readonly failure: UploadFailure) {
    super(failure.reason);
  }
}
function failure(error: unknown): UploadFailure {
  if (error instanceof UploadError) return error.failure;
  if (error instanceof ApiError) {
    return { reason: 'api', status: error.status, said: apiReason(error.body) };
  }
  console.warn('upload parks, the api does not answer:', error);
  return { reason: 'offline' };
}
const said = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ');
const reported = new WeakMap<QueuedFile, string>();
function report(file: QueuedFile, failure: UploadFailure) {
  if (failure.reason !== 'unreadable' && failure.reason !== 'iCloud') return;
  const line = `${failure.reason}: ${failure.detail}`;
  if (reported.get(file) === line) return;
  reported.set(file, line);
  reportUploadFailure({
    upload_failure: failure.reason,
    detail: failure.detail,
    file: file.filename,
    memory: file.memoryId,
    ...(file.mediaId === undefined ? {} : { media: file.mediaId }),
    platform: `${Platform.OS} ${Platform.Version}`,
  }).catch((error) => console.warn('the upload failure does not reach the api:', error));
}
let queue: QueuedFile[] = [];
let restored = false;
let session: string | null = null;
let asking: string | null = null;
let running = false;
let retrying: ReturnType<typeof setTimeout> | null = null;
let idle = 0;
const listeners = new Set<() => void>();
const store = () => new File(Paths.document, QUEUE_FILE);
function restore() {
  if (restored) return;
  restored = true;
  try {
    const saved = store();
    if (saved.exists) {
      queue = (JSON.parse(saved.textSync()) as QueuedFile[]).map(
        ({ error, cloud, ...file }) => file,
      );
    }
  } catch {
    queue = [];
  }
}
function notify() {
  for (const listener of listeners) listener();
}
function changed() {
  queue = [...queue];
  notify();
  try {
    const file = store();
    if (!file.exists) file.create({ intermediates: true });
    file.write(JSON.stringify(queue));
  } catch {}
}
async function assetInfo(
  file: QueuedFile,
  shouldDownloadFromNetwork: boolean,
): Promise<MediaLibrary.AssetInfo | null> {
  try {
    return await MediaLibrary.getAssetInfoAsync(file.assetId, { shouldDownloadFromNetwork });
  } catch (error) {
    console.warn(`${file.filename} cannot be read off the gallery:`, error);
    throw new UploadError({
      reason: 'unreadable',
      detail: `getAssetInfoAsync, download ${shouldDownloadFromNetwork ? 'on' : 'off'}: ${said(error)}`,
    });
  }
}
function openable(asset: MediaLibrary.AssetInfo): File | string {
  if (!asset.localUri) return `no localUri, isNetworkAsset ${asset.isNetworkAsset}`;
  try {
    const source = new File(asset.localUri);
    if (source.exists && source.size > 0) return source;
    return `${asset.localUri}: exists ${source.exists}, size ${source.size}`;
  } catch (error) {
    return `${asset.localUri}: ${said(error)}`;
  }
}
async function sourceFile(file: QueuedFile): Promise<File> {
  const asset = await assetInfo(file, false);
  if (!asset) throw new UploadError({ reason: 'gone' });
  const onPhone = openable(asset);
  if (typeof onPhone !== 'string') return onPhone;
  const cloud = asset.isNetworkAsset === true;
  if (cloud) {
    console.info(`${file.filename} comes down from iCloud before it goes up`);
    file.cloud = true;
    changed();
  }
  try {
    const brought = await assetInfo(file, true);
    const down = brought === null ? 'no entry on the second ask' : openable(brought);
    if (typeof down !== 'string') return down;
    console.warn(
      `${file.filename} does not come down from ${cloud ? 'iCloud' : 'the gallery'}, the file parks: ${down}`,
    );
    throw new UploadError({ reason: cloud ? 'iCloud' : 'unreadable', detail: down });
  } finally {
    if (cloud) {
      delete file.cloud;
      changed();
    }
  }
}
async function planFor(file: QueuedFile, token: string, size: number): Promise<UploadPlan> {
  if (file.mediaId === undefined) {
    const plan = await startUpload(token, file.memoryId, {
      kind: file.kind,
      size_bytes: size,
      captured_at: file.capturedAt,
      duration_seconds: file.durationSeconds,
      file_name: file.filename.slice(0, 255),
    });
    file.mediaId = plan.id;
    file.size = size;
    file.partSize = plan.upload.part_size;
    changed();
    return plan;
  }
  const plan = await refreshUpload(token, file.memoryId, file.mediaId);
  if (plan.upload.part_size !== file.partSize) {
    file.partSize = plan.upload.part_size;
    file.parts = {};
    changed();
  }
  return plan;
}
function readPart(source: File, part: PartRange): Uint8Array<ArrayBuffer> {
  try {
    const handle = source.open(FileMode.ReadOnly);
    try {
      handle.offset = part.start;
      return handle.readBytes(part.length);
    } finally {
      handle.close();
    }
  } catch (error) {
    console.warn(`part ${part.number} cannot be read off the phone:`, error);
    throw new UploadError({
      reason: 'unreadable',
      detail: `read part ${part.number}: ${said(error)}`,
    });
  }
}
async function putPart(
  url: string,
  source: File,
  part: PartRange,
): Promise<string | UploadFailure> {
  const bytes = readPart(source, part);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), partDeadline(part.length));
  let status: number | undefined;
  let response: Response;
  let expired: boolean;
  try {
    response = await fetch(url, { method: 'PUT', body: bytes, signal: abort.signal });
    status = response.status;
    expired =
      status === 403 ||
      (status === 400 && (await response.text()).includes('<Code>ExpiredToken</Code>'));
  } catch (error) {
    console.warn(`part ${part.number} does not reach storage:`, error);
    return { reason: 'storageOffline', part: part.number, status };
  } finally {
    clearTimeout(timer);
  }
  if (expired) return { reason: 'partNotTaken', part: part.number };
  if (!response.ok) {
    throw new UploadError({ reason: 'partRefused', part: part.number, status: response.status });
  }
  const etag = response.headers.get('etag');
  if (etag === null) throw new UploadError({ reason: 'noReceipt', part: part.number });
  return etag;
}
async function send(file: QueuedFile, token: string) {
  const source = await sourceFile(file);
  let plan = await planFor(file, token, source.size);
  const size = file.size ?? source.size;
  const partSize = plan.upload.part_size;
  const linkFor = (number: number) => {
    const link = plan.upload.parts.find((part) => part.part_number === number)?.url;
    if (link === undefined) throw new UploadError({ reason: 'noLink', part: number });
    return link;
  };
  for (const part of missingParts(size, partSize, file.parts)) {
    let sent = await putPart(linkFor(part.number), source, part);
    if (typeof sent !== 'string') {
      plan = await planFor(file, token, size);
      if (plan.upload.part_size !== partSize) throw new UploadError({ reason: 'partSizeChanged' });
      sent = await putPart(linkFor(part.number), source, part);
      if (typeof sent !== 'string') throw new UploadError(sent);
    }
    file.parts[part.number] = sent;
    idle = 0;
    changed();
  }
  const done = await finishUpload(token, file.memoryId, plan.id, uploadedParts(file.parts));
  if (done.first_upload) {
    asking = file.memoryId;
    notify();
  }
}
const askedMemory = () => asking;
export function useAskAll(): string | null {
  return useSyncExternalStore(subscribe, askedMemory, askedMemory);
}
export function answerAskAll(answer: 'done' | 'more_coming' | null) {
  const memoryId = asking;
  asking = null;
  notify();
  if (answer === null || memoryId === null || session === null) return;
  void setContributionStatus(session, memoryId, answer).catch(() => {});
}
function alreadyIn(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    typeof (
      error.body as {
        status?: unknown;
      } | null
    )?.status === 'string'
  );
}
const waiting = () => queue.find((file) => file.error === undefined);
async function run() {
  restore();
  if (running || session === null) return;
  const token = session;
  running = true;
  if (retrying !== null) clearTimeout(retrying);
  retrying = null;
  try {
    for (let next = waiting(); next !== undefined; next = waiting()) {
      try {
        await send(next, token);
        queue = queue.filter((file) => file !== next);
        idle = 0;
      } catch (error) {
        if (alreadyIn(error)) queue = queue.filter((file) => file !== next);
        else {
          next.error = failure(error);
          report(next, next.error);
        }
      }
      changed();
    }
  } finally {
    running = false;
  }
  retryLater();
}
function retryLater() {
  if (queue.length === 0 || retrying !== null || idle >= RETRIES) return;
  retrying = setTimeout(() => {
    retrying = null;
    idle += 1;
    retry();
  }, RETRY_MS);
}
function retry() {
  for (const file of queue) delete file.error;
  changed();
  void run();
}
export function wake() {
  if (queue.length === 0) return;
  idle = 0;
  retry();
}
export function enqueue(memoryId: string, assets: readonly MediaLibrary.Asset[]) {
  restore();
  const queued = new Set(queue.map((file) => `${file.memoryId}:${file.assetId}`));
  for (const asset of assets) {
    if (queued.has(`${memoryId}:${asset.id}`)) continue;
    queue.push({
      assetId: asset.id,
      memoryId,
      filename: asset.filename,
      uri: asset.uri,
      kind: asset.mediaType === 'video' ? 'video' : 'photo',
      capturedAt: asset.creationTime ? new Date(asset.creationTime).toISOString() : null,
      durationSeconds: asset.mediaType === 'video' ? (asset.duration ?? 0) : null,
      parts: {},
    });
  }
  changed();
  void run();
}
export function drop(memoryId: string, ...assetIds: string[]) {
  const leaving = new Set(assetIds);
  queue = queue.filter((file) => file.memoryId !== memoryId || !leaving.has(file.assetId));
  changed();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  restore();
  return queue;
}
export function useUploads(): QueuedFile[] {
  const { status, token } = useAuth();
  useEffect(() => {
    session = token;
    if (status === 'signed-out') {
      queue = [];
      asking = null;
      changed();
    } else {
      void run();
    }
  }, [status, token]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      idle = 0;
      if (!running) retryLater();
    });
    return () => subscription.remove();
  }, []);
  return useSyncExternalStore(subscribe, snapshot);
}
