import { restoreSession, sessionState } from '@/functionality/auth/session';
import { hydrateContacts, loadContacts } from '@/functionality/contact/contacts';
import { hydrateLabels } from '@/functionality/label/labels';
import { hydrateGallery } from '@/functionality/media/gallery';
import { hydrateMembers } from '@/functionality/project/members';
import { hydrateProjects, loadProjects } from '@/functionality/project/projects';
import { hydrateUploads, pump } from '@/functionality/upload/queue';
import type { ProjectId } from '@/types/id';

export function hydrateGlobal(): void {
  hydrateProjects();
  hydrateContacts();
  hydrateUploads();
}

export function hydrateProject(projectId: ProjectId): void {
  hydrateGallery(projectId);
  hydrateLabels(projectId);
  hydrateMembers(projectId);
}

export async function startApp(): Promise<void> {
  hydrateGlobal();
  await restoreSession();
  const session = sessionState();
  if ('token' in session) void pump();
}

export async function refreshGlobal(): Promise<void> {
  const session = sessionState();
  if (!('token' in session)) return;
  await Promise.allSettled([loadProjects(true), loadContacts(true)]);
}
