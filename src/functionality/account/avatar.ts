import { File } from 'expo-file-system';
import { currentToken, onSignOut, refreshSession } from '@/functionality/auth/session';
import {
  removeAvatar as apiRemoveAvatar,
  completeAvatarUpload,
  getAvatar,
  startAvatarUpload,
} from '@/integrations/api';
import { readFilePart } from '@/integrations/files/parts';
import { putPart } from '@/integrations/storage/upload';

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

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

export async function loadAvatar(): Promise<void> {
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
  const value = token();
  const start = await startAvatarUpload(value, fileName);
  const size = new File(uri).size;
  if (!size) throw new Error('avatar file is empty');
  const bytes = readFilePart(uri, { start: 0, length: size });
  await putPart(start.url, bytes);
  const done = await completeAvatarUpload(value, start.mediaId);
  emit({ url: done.url, status: 'idle' });
  await refreshSession();
}

export async function removeAvatar(): Promise<void> {
  await apiRemoveAvatar(token());
  emit({ url: null, status: 'idle' });
  await refreshSession();
}

onSignOut(() => {
  emit({ url: null, status: 'idle' });
});
