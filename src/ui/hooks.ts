import { useCallback, useSyncExternalStore } from 'react';

import {
  avatarState,
  contactsState,
  galleryState,
  inviteState,
  labelsState,
  membersState,
  networkState,
  projectsState,
  pushState,
  sessionState,
  subscribeAvatar,
  subscribeContacts,
  subscribeGallery,
  subscribeInvites,
  subscribeLabels,
  subscribeMembers,
  subscribeNetwork,
  subscribeProjects,
  subscribePush,
  subscribeSession,
  subscribeSuggestions,
  subscribeUploads,
  suggestionsState,
  uploadsState,
} from '@/functionality';
import type { ProjectId, ProjectItemId } from '@/types/id';

function useStore<T>(subscribe: (listener: () => void) => () => void, snapshot: () => T): T {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const useSession = () => useStore(subscribeSession, sessionState);
export const useAvatar = () => useStore(subscribeAvatar, avatarState);
export const useProjects = () => useStore(subscribeProjects, projectsState);
export const useUploads = () => useStore(subscribeUploads, uploadsState);
export const useContacts = () => useStore(subscribeContacts, contactsState);
export const useSuggestions = () => useStore(subscribeSuggestions, suggestionsState);
export const usePush = () => useStore(subscribePush, pushState);
export const useNetwork = () => useStore(subscribeNetwork, networkState);

export function useProjectCard(projectId: ProjectId) {
  const state = useProjects();
  return state.cards.find((card) => card.id === projectId);
}

export function useGallery(projectId: ProjectId) {
  const snapshot = useCallback(() => galleryState(projectId), [projectId]);
  return useStore(subscribeGallery, snapshot);
}

export function useItem(projectId: ProjectId, itemId: ProjectItemId) {
  const gallery = useGallery(projectId);
  return gallery.items.find((item) => item.id === itemId);
}

export function useMembers(projectId: ProjectId) {
  const snapshot = useCallback(() => membersState(projectId), [projectId]);
  return useStore(subscribeMembers, snapshot);
}

export function useLabels(projectId: ProjectId) {
  const snapshot = useCallback(() => labelsState(projectId), [projectId]);
  return useStore(subscribeLabels, snapshot);
}

export function useInvite(projectId: ProjectId) {
  const snapshot = useCallback(() => inviteState(projectId), [projectId]);
  return useStore(subscribeInvites, snapshot);
}
