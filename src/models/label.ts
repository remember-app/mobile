import type { LabelId, ProjectId, UserId } from '@/types/id';

export type Label = {
  id: LabelId;
  projectId: ProjectId;
  ownerId: UserId;
  name: string;
  color: `#${string}`;
  description: string | null;
  shared: boolean;
  itemCount: number;
  createdAt: Date;
};
