import {
  currentToken,
  onSignOut,
  refreshSession,
  requireToken,
} from '@/functionality/auth/session';
import { removeAvatar as apiRemoveAvatar, getAvatar, setAvatar } from '@/integrations/api';
import type { MediaId } from '@/types/id';

import { uploadFileOnce } from '../upload/single';

export type AvatarState = {
  url: string | null;
  status: 'idle' | 'loading' | 'error';
};

let state: AvatarState = { url: null, status: 'idle' };
const listeners = new Set<() => void>();

export const avatarState = (): AvatarState => state;

export const subscribeAvatar = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(next: AvatarState): void {
  state = next;
  for (const listener of listeners) listener();
}

let loading: Promise<void> | null = null;

export function loadAvatar(): Promise<void> {
  if (loading) return loading;
  loading = fetchAvatar().finally(() => {
    loading = null;
  });
  return loading;
}

async function fetchAvatar(): Promise<void> {
  const value = currentToken();
  if (!value) {
    emit({ url: null, status: 'idle' });
    return;
  }
  emit({ ...state, status: 'loading' });
  try {
    const { url } = await getAvatar(value);
    emit({ url, status: 'idle' });
  } catch {
    emit({ url: null, status: 'error' });
  }
}

export async function uploadAvatar(uri: string, fileName: string): Promise<void> {
  const value = requireToken();
  const mediaId = await uploadFileOnce(value, 'photo', uri, fileName);
  await applyAvatar(mediaId);
}

export async function applyAvatar(mediaId: MediaId): Promise<void> {
  const value = requireToken();
  const { url } = await setAvatar(value, mediaId);
  emit({ url, status: 'idle' });
  await refreshSession();
}

export async function removeAvatar(): Promise<void> {
  await apiRemoveAvatar(requireToken());
  emit({ url: null, status: 'idle' });
  await refreshSession();
}

onSignOut(() => {
  emit({ url: null, status: 'idle' });
});
