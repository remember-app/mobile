import type { MediaKind, Upload, UploadComplete, UploadedPart, UploadPlan } from '@/models';
import type { CursorPage } from '@/types/api';
import type { ProjectId, UploadId, UserId } from '@/types/id';

import { query, request } from './client';
import { toCursorPage, toUpload, toUploadComplete, toUploadPlan } from './map';
import type { CursorPageWire, UploadCompleteWire, UploadPlanWire, UploadWire } from './wire';

export type NewUpload = {
  kind: MediaKind;
  sizeBytes: number;
  fileName: string;
  capturedAt?: string | null;
  durationSeconds?: number | null;
};

export function listUploads(
  token: string,
  projectId: ProjectId,
  page: { userId?: UserId; limit?: number; cursor?: string } = {},
): Promise<CursorPage<Upload>> {
  return request<CursorPageWire<UploadWire>>(`/v1/projects/${projectId}/uploads${query(page)}`, {
    token,
  }).then((wire) => toCursorPage(wire, toUpload));
}

export function startUpload(
  token: string,
  projectId: ProjectId,
  input: NewUpload,
): Promise<UploadPlan> {
  return request<UploadPlanWire>(`/v1/projects/${projectId}/uploads`, {
    method: 'POST',
    body: input,
    token,
  }).then(toUploadPlan);
}

export function resumeUpload(
  token: string,
  projectId: ProjectId,
  uploadId: UploadId,
): Promise<UploadPlan> {
  return request<UploadPlanWire>(`/v1/projects/${projectId}/uploads/${uploadId}`, {
    token,
  }).then(toUploadPlan);
}

export function completeUpload(
  token: string,
  projectId: ProjectId,
  uploadId: UploadId,
  parts: UploadedPart[],
): Promise<UploadComplete> {
  return request<UploadCompleteWire>(`/v1/projects/${projectId}/uploads/${uploadId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
  }).then(toUploadComplete);
}

export function cancelUpload(
  token: string,
  projectId: ProjectId,
  uploadId: UploadId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/uploads/${uploadId}`, {
    method: 'DELETE',
    token,
  });
}
