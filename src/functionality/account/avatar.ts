import { File } from 'expo-file-system';
import { currentToken, onSignOut, refreshSession } from '@/functionality/auth/session';
import {
  removeAvatar as apiRemoveAvatar,
  completeUpload,
  getAvatar,
  setAvatar,
  startUpload,
} from '@/integrations/api';
import { readFilePart } from '@/integrations/files/parts';
import { putPart } from '@/integrations/storage/upload';
import type { UploadedPart } from '@/models';

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
  const size = new File(uri).size;
  if (!size) throw new Error('avatar file is empty');
  const plan = await startUpload(value, null, { kind: 'photo', sizeBytes: size, fileName });
  const parts: UploadedPart[] = [];
  const total = Math.max(1, Math.ceil(size / plan.partBytes));
  for (let number = 1; number <= total; number += 1) {
    const url = plan.parts[number - 1];
    if (!url) throw new Error(`no link for part ${number}`);
    const start = (number - 1) * plan.partBytes;
    const bytes = readFilePart(uri, {
      start,
      length: Math.min(plan.partBytes, size - start),
    });
    parts.push({ part_number: number, etag: await putPart(url, bytes) });
  }
  const done = await completeUpload(value, null, plan.id, parts);
  const { url } = await setAvatar(value, done.mediaId);
  emit({ url, status: 'idle' });
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
