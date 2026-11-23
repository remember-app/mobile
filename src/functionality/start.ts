import { setAudioModeAsync } from 'expo-audio';
import { loadAvatar } from '@/functionality/account/avatar';
import { onSignOut, restoreSession, sessionState } from '@/functionality/auth/session';
import { hydrateContacts, loadContacts } from '@/functionality/contact/contacts';
import { hydrateLabels } from '@/functionality/label/labels';
import { hydrateMontages } from '@/functionality/montage/montages';
import { hydrateMovies } from '@/functionality/movie/movies';
import { isOnline, subscribeNetwork } from '@/functionality/network/network';
import { hydrateMembers } from '@/functionality/project/members';
import { hydrateProjects, loadProjects } from '@/functionality/project/projects';
import { registerPush } from '@/functionality/push/push';
import { hydrateOwnSongs } from '@/functionality/song/mine';
import { hydrateLibrarySongs, hydrateProjectSongs } from '@/functionality/song/songs';
import { pump } from '@/functionality/upload/queue';
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
  hydrateLibrarySongs();
  hydrateOwnSongs();
}

export function hydrateProject(projectId: ProjectId): void {
  hydrateLabels(projectId);
  hydrateMembers(projectId);
  hydrateMontages(projectId);
  hydrateMovies(projectId);
  hydrateProjectSongs(projectId);
}

export async function startApp(): Promise<void> {
  hydrateGlobal();
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  await restoreSession();
  const session = sessionState();
  if ('token' in session) {
    wire();
    void registerUploadTask();
    void registerPush();
    void pump();
    void loadProjects(true);
    void loadAvatar().catch(() => undefined);
  }
}

export async function refreshGlobal(): Promise<void> {
  const session = sessionState();
  if (!('token' in session)) return;
  await Promise.allSettled([loadProjects(true), loadContacts(true)]);
}
