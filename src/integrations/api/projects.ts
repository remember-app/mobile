import type { Project, ProjectCard } from '@/models';
import type { Page } from '@/types/api';
import type { ProjectId } from '@/types/id';

import { query, request } from './client';
import { toPage, toProject, toProjectCard } from './map';
import type { OffsetPageWire, ProjectCardWire, ProjectWire } from './wire';

export type ProjectPage = { limit?: number; offset?: number };

export type NewProject = {
  title: string;
  eventStart: string;
  eventEnd?: string | null;
};

export type ProjectPatch = {
  title?: string;
  eventStart?: string;
  eventEnd?: string | null;
  coverItemId?: string | null;
};

export function listProjects(token: string, page: ProjectPage = {}): Promise<Page<ProjectCard>> {
  return request<OffsetPageWire<ProjectCardWire>>(`/v1/projects${query(page)}`, { token }).then(
    (wire) => toPage(wire, toProjectCard),
  );
}

export function getProject(token: string, projectId: ProjectId): Promise<Project> {
  return request<ProjectWire>(`/v1/projects/${projectId}`, { token }).then(toProject);
}

export function createProject(token: string, input: NewProject): Promise<Project> {
  return request<ProjectWire>('/v1/projects', { method: 'POST', body: input, token }).then(
    toProject,
  );
}

export function updateProject(
  token: string,
  projectId: ProjectId,
  patch: ProjectPatch,
): Promise<Project> {
  return request<ProjectWire>(`/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: patch,
    token,
  }).then(toProject);
}

export function deleteProject(token: string, projectId: ProjectId): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}`, { method: 'DELETE', token });
}
