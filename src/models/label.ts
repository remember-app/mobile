import type { LabelId, ProjectId, ProjectItemId, UserId } from '@/types/id';

export type Label = {
  id: LabelId;
  projectId: ProjectId;
  ownerId: UserId;
  name: string;
  color: `#${string}`;
  itemsIds: ProjectItemId[];
};
