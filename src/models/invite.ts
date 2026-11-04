import type { Project, Role } from './project';

export type ProjectInvite = {
  token: string;
  role: Role;
};

export type AppInvite = {
  token: string;
  maxUses: number | null;
};

export type JoinResult = { project: Project } | { joined: true };
