import type { MediaId, ProjectId, ProjectItemId, UploadId } from '@/types/id';

import type { MediaKind } from './media';
import type { PublicUser } from './user';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export type DeriveStatus = 'queued' | 'running' | 'done' | 'failed';

export type UploadFile = {
  name: string;
  format: string;
  bytes: number;
};

export type UploadFailure = {
  code: string | null;
  message: string | null;
};

export type Upload = {
  id: UploadId;
  projectId: ProjectId | null;
  kind: MediaKind;
  file: UploadFile;
  status: UploadStatus;
  derive: DeriveStatus | null;
  failure: UploadFailure | null;
  mediaId: MediaId | null;
  uploader: PublicUser | null;
  createdAt: Date;
};

export type UploadPlan = {
  id: UploadId;
  path: string;
  partBytes: number;
  parts: string[];
};

export type UploadedPart = {
  part_number: number;
  etag: string;
};

export type UploadComplete = {
  mediaId: MediaId;
  itemId: ProjectItemId | null;
  status: 'processing';
};
