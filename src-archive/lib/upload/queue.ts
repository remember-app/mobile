import type { Strings } from '@/strings';
export type UploadFailure =
  | {
      reason: 'gone';
    }
  | {
      reason: 'unreadable';
      detail: string;
    }
  | {
      reason: 'iCloud';
      detail: string;
    }
  | {
      reason: 'partSizeChanged';
    }
  | {
      reason: 'noReceipt' | 'noLink' | 'partNotTaken';
      part: number;
    }
  | {
      reason: 'partRefused';
      part: number;
      status: number;
    }
  | {
      reason: 'storageOffline';
      part: number;
      status?: number;
    }
  | {
      reason: 'offline';
    }
  | {
      reason: 'api';
      status: number;
      said?: string;
    };
export function failureText(s: Strings, failure: UploadFailure): string {
  switch (failure.reason) {
    case 'gone':
      return s.upload.gone;
    case 'unreadable':
      return s.upload.unreadable;
    case 'iCloud':
      return s.upload.iCloud;
    case 'partSizeChanged':
      return s.upload.partSizeChanged;
    case 'noLink':
      return s.upload.noLink;
    case 'partRefused':
    case 'partNotTaken':
    case 'noReceipt':
      return s.upload.storageRefused;
    case 'storageOffline':
      return s.upload.storageOffline;
    case 'offline':
      return s.error.offline;
    case 'api':
      if (failure.status === 429) return s.error.tooMany;
      return failure.said ?? s.error.status(failure.status);
  }
}
function storageCode(failure: UploadFailure): number | undefined {
  return failure.reason === 'partRefused' || failure.reason === 'storageOffline'
    ? failure.status
    : undefined;
}
function phoneDetail(failure: UploadFailure): string | undefined {
  return failure.reason === 'unreadable' || failure.reason === 'iCloud'
    ? failure.detail
    : undefined;
}
export type ParkedFile = QueuedFile & {
  error: UploadFailure;
};
export function parkedReason(s: Strings, failure: UploadFailure): string {
  const words = failureText(s, failure);
  const said = storageCode(failure) ?? phoneDetail(failure);
  return said === undefined ? words : `${words} (${said})`;
}
export type QueuedFile = {
  assetId: string;
  memoryId: string;
  filename: string;
  uri?: string;
  kind: 'photo' | 'video';
  capturedAt: string | null;
  durationSeconds: number | null;
  mediaId?: string;
  size?: number;
  partSize?: number;
  parts: Record<number, string>;
  error?: UploadFailure;
  cloud?: true;
};
export type PartRange = {
  number: number;
  start: number;
  length: number;
};
export const partCount = (size: number, partSize: number) =>
  Math.max(1, Math.ceil(size / partSize));
const SLOWEST_UPLINK = 32;
const PART_GRACE_MS = 30000;
export const partDeadline = (bytes: number) => PART_GRACE_MS + bytes / SLOWEST_UPLINK;
export function missingParts(
  size: number,
  partSize: number,
  done: Record<number, string>,
): PartRange[] {
  return Array.from({ length: partCount(size, partSize) }, (_, index) => ({
    number: index + 1,
    start: index * partSize,
    length: Math.min(partSize, size - index * partSize),
  })).filter((part) => done[part.number] === undefined);
}
export function uploadedParts(done: Record<number, string>): {
  part_number: number;
  etag: string;
}[] {
  return Object.entries(done)
    .map(([number, etag]) => ({ part_number: Number(number), etag }))
    .sort((a, b) => a.part_number - b.part_number);
}
export function progress(file: QueuedFile): number {
  if (!file.size || !file.partSize) return 0;
  return Math.min(Object.keys(file.parts).length / partCount(file.size, file.partSize), 1);
}
