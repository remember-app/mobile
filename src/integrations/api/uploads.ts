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

const uploadsOf = (projectId: ProjectId | null): string =>
  projectId === null ? '/v1/uploads' : `/v1/projects/${projectId}/uploads`;

export function startUpload(
  token: string,
  projectId: ProjectId | null,
  input: NewUpload,
): Promise<UploadPlan> {
  return request<UploadPlanWire>(uploadsOf(projectId), {
    method: 'POST',
    body: input,
    token,
  }).then(toUploadPlan);
}

export function resumeUpload(
  token: string,
  projectId: ProjectId | null,
  uploadId: UploadId,
): Promise<UploadPlan> {
  return request<UploadPlanWire>(`${uploadsOf(projectId)}/${uploadId}`, {
    token,
  }).then(toUploadPlan);
}

export function completeUpload(
  token: string,
  projectId: ProjectId | null,
  uploadId: UploadId,
  parts: UploadedPart[],
): Promise<UploadComplete> {
  return request<UploadCompleteWire>(`${uploadsOf(projectId)}/${uploadId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
  }).then(toUploadComplete);
}

export function cancelUpload(
  token: string,
  projectId: ProjectId | null,
  uploadId: UploadId,
  purge = false,
): Promise<{ ok: true }> {
  return request(`${uploadsOf(projectId)}/${uploadId}${purge ? '?purge=1' : ''}`, {
    method: 'DELETE',
    token,
  });
}
