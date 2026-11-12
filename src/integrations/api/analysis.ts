import type { ProjectId, ProjectItemId } from '@/types/id';

import { request } from './client';
import type {
  AnalysisJobResponse,
  AnalysisJobStatus,
  AnalysisJobsResponse,
  AnalyzeItemsRequest,
  AnalyzeItemsResponse,
} from './contract';

export type AnalysisJob = AnalysisJobResponse;
export type { AnalysisJobStatus };

export function previewAnalysis(
  token: string,
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<AnalyzeItemsResponse> {
  const body: AnalyzeItemsRequest = { itemIds };
  return request<AnalyzeItemsResponse>(`/v1/projects/${projectId}/analyze/preview`, {
    method: 'POST',
    body,
    token,
  });
}

export function analyzeItems(
  token: string,
  projectId: ProjectId,
  itemIds: ProjectItemId[],
): Promise<AnalyzeItemsResponse> {
  const body: AnalyzeItemsRequest = { itemIds };
  return request<AnalyzeItemsResponse>(`/v1/projects/${projectId}/analyze`, {
    method: 'POST',
    body,
    token,
  });
}

export function listAnalysisJobs(
  token: string,
  projectId: ProjectId,
): Promise<AnalysisJobsResponse> {
  return request<AnalysisJobsResponse>(`/v1/projects/${projectId}/analyze`, { token });
}
