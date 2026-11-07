import { currentToken, refreshSession } from '@/functionality/auth/session';
import { loadMembers } from '@/functionality/project/members';
import { loadProjects } from '@/functionality/project/projects';
import { shareConsumables as apiShareConsumables, type ConsumableShare } from '@/integrations/api';
import type { ProjectId } from '@/types/id';

export type { ConsumableShare };

export async function shareProjectConsumables(
  projectId: ProjectId,
  share: ConsumableShare,
): Promise<void> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  await apiShareConsumables(token, projectId, share);
  await Promise.allSettled([refreshSession(), loadProjects(true), loadMembers(projectId, true)]);
}
