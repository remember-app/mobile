import { useCallback, useSyncExternalStore } from 'react';

import {
  contactsState,
  galleryState,
  inviteState,
  labelsState,
  membersState,
  projectsState,
  pushState,
  sessionState,
  subscribeContacts,
  subscribeGallery,
  subscribeInvites,
  subscribeLabels,
  subscribeMembers,
  subscribeProjects,
  subscribePush,
  subscribeSession,
  subscribeUploads,
  uploadsState,
} from '@/functionality';
import type { ProjectId, ProjectItemId } from '@/types/id';

function useStore<T>(subscribe: (listener: () => void) => () => void, snapshot: () => T): T {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const useSession = () => useStore(subscribeSession, sessionState);
export const useProjects = () => useStore(subscribeProjects, projectsState);
export const useUploads = () => useStore(subscribeUploads, uploadsState);
export const useContacts = () => useStore(subscribeContacts, contactsState);
export const usePush = () => useStore(subscribePush, pushState);

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
