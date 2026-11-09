import { onSignOut, restoreSession, sessionState } from '@/functionality/auth/session';
import { hydrateContacts, loadContacts } from '@/functionality/contact/contacts';
import { hydrateLabels } from '@/functionality/label/labels';
import { hydrateGallery } from '@/functionality/media/gallery';
import { hydrateMontages } from '@/functionality/montage/montages';
import { hydrateMovies } from '@/functionality/movie/movies';
import { isOnline, subscribeNetwork } from '@/functionality/network/network';
import { hydrateMembers } from '@/functionality/project/members';
import { hydrateProjects, loadProjects } from '@/functionality/project/projects';
import { registerPush } from '@/functionality/push/push';
import { hydrateLibrarySongs, hydrateProjectSongs } from '@/functionality/song/songs';
import { hydrateUploads, pump } from '@/functionality/upload/queue';
import { onAppActive } from '@/integrations/app-state';
import {
  defineUploadTask,
  registerUploadTask,
  unregisterUploadTask,
} from '@/integrations/background';
import type { ProjectId } from '@/types/id';

defineUploadTask(async () => {
  await pump();
});

let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;
  onAppActive(() => {
    void pump();
  });
  subscribeNetwork(() => {
    if (isOnline()) void pump();
  });
  onSignOut(() => {
    void unregisterUploadTask();
  });
}

export function hydrateGlobal(): void {
  hydrateProjects();
  hydrateContacts();
  hydrateUploads();
  hydrateLibrarySongs();
}

export function hydrateProject(projectId: ProjectId): void {
  hydrateGallery(projectId);
  hydrateLabels(projectId);
  hydrateMembers(projectId);
  hydrateMontages(projectId);
  hydrateMovies(projectId);
  hydrateProjectSongs(projectId);
}

export async function startApp(): Promise<void> {
  hydrateGlobal();
  await restoreSession();
  const session = sessionState();
  if ('token' in session) {
    wire();
    void registerUploadTask();
    void registerPush();
    void pump();
  }
}

export async function refreshGlobal(): Promise<void> {
  const session = sessionState();
  if (!('token' in session)) return;
  await Promise.allSettled([loadProjects(true), loadContacts(true)]);
}
