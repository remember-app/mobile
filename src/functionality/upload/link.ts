import { File, Paths } from 'expo-file-system';
import { currentToken } from '@/functionality/auth/session';
import type { MediaId } from '@/types/id';

import { uploadFileOnce } from './single';

const FORMATS = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp']);

export const isImageLink = (text: string): boolean => /^https?:\/\/\S+$/i.test(text.trim());

function nameOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const last = path.split('/').filter(Boolean).at(-1) ?? '';
  const extension = last.split('.').pop()?.toLowerCase() ?? '';
  return FORMATS.has(extension) ? last : `image-${Date.now()}.jpg`;
}

export async function uploadImageFromLink(url: string): Promise<{ mediaId: MediaId; uri: string }> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const name = nameOf(url);
  const target = new File(Paths.cache, `link-${Date.now()}-${name}`);
  const file = await File.downloadFileAsync(url, target);
  const mediaId = await uploadFileOnce(token, 'photo', file.uri, name);
  return { mediaId, uri: file.uri };
}
