import type { ProjectId, UserId } from '@/types/id';

export type Role = 'admin' | 'contributor' | 'viewer';

export type Contribution = 'not_started' | 'more_coming' | 'done' | 'nothing';

export type ProjectSummary = {
  id: ProjectId;
  title: string;
  eventStart: Date;
  eventEnd: Date | null;
  coverUrl: string | null;
  itemCount: number;
  memberCount: number;
  sharedCount: number;
  myRole: Role;
  myContribution: Contribution;
};

export type ProjectCard = ProjectSummary & {
  previewUrls: string[];
};

export type Project = ProjectSummary;

export type Member = {
  userId: UserId;
  username: string | null;
  name: string | null;
  role: Role;
  contribution: Contribution;
  joinedAt: Date;
  invitedBy: UserId | null;
};
