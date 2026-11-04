import type { MediaId, ProjectId, ProjectItemId, UploadId } from '@/types/id';

import type { MediaKind } from './media';
import type { PublicUser } from './user';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export type DeriveStatus = 'queued' | 'running' | 'done' | 'failed';

export type Upload = {
  id: UploadId;
  projectId: ProjectId;
  kind: MediaKind;
  fileName: string;
  declaredBytes: number;
  status: UploadStatus;
  derive: DeriveStatus | null;
  errorCode: string | null;
  error: string | null;
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
  itemId: ProjectItemId;
  status: 'processing';
};
