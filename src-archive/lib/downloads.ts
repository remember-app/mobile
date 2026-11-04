import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import type { Original } from '@/api';
export async function maySaveToPhone(): Promise<boolean> {
  const { granted } = await MediaLibrary.requestPermissionsAsync(true);
  return granted;
}
function localName(file: Original) {
  const name = /^[0-9a-f-]{36}$/i.test(file.id) ? file.id : 'download';
  return `${name}.${file.kind === 'video' ? 'mp4' : 'jpg'}`;
}
export async function saveToPhone(file: Original) {
  const target = new File(Paths.cache, localName(file));
  try {
    const saved = await File.downloadFileAsync(file.url, target, { idempotent: true });
    await MediaLibrary.saveToLibraryAsync(saved.uri);
  } finally {
    try {
      target.delete();
    } catch {}
  }
}
function freshSharedDir() {
  const dir = new Directory(Paths.cache, 'shared');
  if (dir.exists) dir.delete();
  dir.create();
  return dir;
}
async function copyForSharing(file: Original, dir: Directory) {
  const saved = await File.downloadFileAsync(file.url, new File(dir, localName(file)));
  return saved.uri;
}
const handOn = (uri: string) =>
  Sharing.shareAsync(uri).catch((e) => console.warn('share sheet skipped:', e));
export async function shareFiles(
  files: readonly Original[],
  keepGoing: () => boolean = () => true,
) {
  const dir = freshSharedDir();
  for (const file of files) {
    if (!keepGoing()) return;
    await handOn(await copyForSharing(file, dir));
  }
}
export const shareFile = (file: Original) => shareFiles([file]);
export async function saveAndShare(file: Original) {
  const uri = await copyForSharing(file, freshSharedDir());
  await MediaLibrary.saveToLibraryAsync(uri);
  await handOn(uri);
}
