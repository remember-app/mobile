import { File, Paths } from 'expo-file-system';
import { writeAsStringAsync } from 'expo-file-system/legacy';
import { currentToken } from '@/functionality/auth/session';
import { readFilePart } from '@/integrations/files/parts';
import type { MediaId } from '@/types/id';

import { uploadFileOnce } from './single';

const FORMATS = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp']);

const starts = (bytes: Uint8Array, signature: number[], at = 0): boolean =>
  signature.every((value, index) => bytes[at + index] === value);

const ascii = (text: string): number[] => [...text].map((letter) => letter.charCodeAt(0));

function looksLikeImage(uri: string): boolean {
  const head = readFilePart(uri, { start: 0, length: 12 });
  return (
    starts(head, [0xff, 0xd8, 0xff]) ||
    starts(head, [0x89, 0x50, 0x4e, 0x47]) ||
    (starts(head, ascii('RIFF')) && starts(head, ascii('WEBP'), 8)) ||
    starts(head, ascii('ftyp'), 4)
  );
}

export const isImageLink = (text: string): boolean => /^https?:\/\/\S+$/i.test(text.trim());

function nameOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const last = path.split('/').filter(Boolean).at(-1) ?? '';
  const extension = last.split('.').pop()?.toLowerCase() ?? '';
  return FORMATS.has(extension) ? last : `image-${Date.now()}.jpg`;
}

export async function uploadClipboardImage(
  data: string,
): Promise<{ mediaId: MediaId; uri: string }> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  const name = `clip-${Date.now()}.jpg`;
  const target = new File(Paths.cache, name);
  await writeAsStringAsync(target.uri, base64, { encoding: 'base64' });
  const mediaId = await uploadFileOnce(token, 'photo', target.uri, name);
  return { mediaId, uri: target.uri };
}

export async function uploadImageFromLink(url: string): Promise<{ mediaId: MediaId; uri: string }> {
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const name = nameOf(url);
  const target = new File(Paths.cache, `link-${Date.now()}-${name}`);
  const file = await File.downloadFileAsync(url, target);
  if (!looksLikeImage(file.uri)) throw new Error('the link is not an image');
  const mediaId = await uploadFileOnce(token, 'photo', file.uri, name);
  return { mediaId, uri: file.uri };
}
