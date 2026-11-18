import type { ProjectId, SongId, UserId } from '@/types/id';

import type { Consumable } from './user';

export type Role = 'admin' | 'contributor' | 'viewer';

export type Contribution = 'not_started' | 'more_coming' | 'done';

export type ProjectSummary = {
  id: ProjectId;
  title: string;
  description: string;
  eventStart: Date;
  eventEnd: Date | null;
  consumables: Consumable;
  itemCount: number;
  memberCount: number;
  sharedCount: number;
  songIds: SongId[];
  myRole: Role;
  myContribution: Contribution;
};

export type ProjectMemberFace = {
  userId: UserId;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type ProjectCard = ProjectSummary & {
  previewUrls: string[];
  members: ProjectMemberFace[];
};

export type Project = ProjectSummary;

/** Монтаж доступен, когда участник уже сдал материал. Одно правило на все экраны. */
export function canCreateMontage(project: ProjectSummary | undefined): boolean {
  return !!project && project.myRole !== 'viewer' && project.myContribution === 'done';
}

export type Member = {
  userId: UserId;
  username: string | null;
  name: string | null;
  role: Role;
  consumables: Consumable;
  contribution: Contribution;
  joinedAt: Date;
  invitedBy: UserId | null;
  avatarUrl: string | null;
};
