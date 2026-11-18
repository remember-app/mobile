import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  analysisJobsState,
  avatarState,
  contactsState,
  galleryState,
  inviteState,
  labelsState,
  librarySongsState,
  membersState,
  montagesState,
  moviesState,
  networkState,
  ownSongsState,
  projectSongsState,
  projectsState,
  pushState,
  sessionState,
  subscribeAnalysisJobs,
  subscribeAvatar,
  subscribeContacts,
  subscribeGallery,
  subscribeInvites,
  subscribeLabels,
  subscribeMembers,
  subscribeMontages,
  subscribeMovies,
  subscribeNetwork,
  subscribeOwnSongs,
  subscribeProjects,
  subscribePush,
  subscribeSession,
  subscribeSongs,
  subscribeSuggestions,
  subscribeSystemMedia,
  subscribeUploads,
  suggestionsState,
  systemMediaState,
  uploadsState,
  watchMontages,
} from '@/functionality';
import type { ProjectId, ProjectItemId } from '@/types/id';

function useStore<T>(subscribe: (listener: () => void) => () => void, snapshot: () => T): T {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Подписка на срез стора, зависящий от одного аргумента — проекта или его отсутствия. */
function useScoped<A, T>(
  subscribe: (listener: () => void) => () => void,
  state: (arg: A) => T,
  arg: A,
): T {
  return useStore(
    subscribe,
    useCallback(() => state(arg), [arg, state]),
  );
}

export const useSession = () => useStore(subscribeSession, sessionState);

export function useAccount() {
  const session = useSession();
  return 'account' in session ? session.account : undefined;
}

/** Один опрос монтажей на проект, сколько бы экранов его ни просили. */
export function useMontagePolling(projectId: ProjectId, running: boolean): void {
  useEffect(() => {
    if (!running) return;
    return watchMontages(projectId);
  }, [projectId, running]);
}

export function useAnalysisJobs(projectId: ProjectId) {
  return useScoped(subscribeAnalysisJobs, analysisJobsState, projectId);
}
export const useAvatar = () => useStore(subscribeAvatar, avatarState);
export const useProjects = () => useStore(subscribeProjects, projectsState);
export const useUploads = () => useStore(subscribeUploads, uploadsState);
export const useContacts = () => useStore(subscribeContacts, contactsState);
export const useSuggestions = () => useStore(subscribeSuggestions, suggestionsState);
export const usePush = () => useStore(subscribePush, pushState);
export const useNetwork = () => useStore(subscribeNetwork, networkState);
export const useSystemMedia = () => useStore(subscribeSystemMedia, systemMediaState);

export function useProjectCard(projectId: ProjectId) {
  const state = useProjects();
  return state.cards.find((card) => card.id === projectId);
}

export function useGallery(projectId: ProjectId | undefined) {
  return useScoped(subscribeGallery, galleryState, projectId);
}

export function useItem(projectId: ProjectId, itemId: ProjectItemId) {
  const gallery = useGallery(projectId);
  return gallery.items.find((item) => item.id === itemId);
}

export function useMembers(projectId: ProjectId) {
  return useScoped(subscribeMembers, membersState, projectId);
}

export function useLabels(projectId: ProjectId) {
  return useScoped(subscribeLabels, labelsState, projectId);
}

export function useInvite(projectId: ProjectId) {
  return useScoped(subscribeInvites, inviteState, projectId);
}

export function useMontages(projectId: ProjectId | undefined) {
  return useScoped(subscribeMontages, montagesState, projectId);
}

export function useMovies(projectId: ProjectId | undefined) {
  return useScoped(subscribeMovies, moviesState, projectId);
}

export function useProjectSongs(projectId: ProjectId) {
  return useScoped(subscribeSongs, projectSongsState, projectId);
}

export const useLibrarySongs = () => useStore(subscribeSongs, librarySongsState);

export const useOwnSongs = () => useStore(subscribeOwnSongs, ownSongsState);
