import type { ProjectId, ProjectItemId } from '@/types/id';

import { request } from './client';
import type { AnalyzeItemsRequest, AnalyzeItemsResponse } from './contract';

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
