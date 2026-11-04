import { Directory, File, Paths } from 'expo-file-system';
import type { MediaItem, Member } from '@/api';
export type Kept = {
  items: MediaItem[];
  roster: Member[];
};
const folder = () => new Directory(Paths.document, 'feeds');
const store = (memoryId: string): File | null =>
  /^[0-9a-f-]{36}$/i.test(memoryId) ? new File(folder(), `${memoryId}.json`) : null;
export function readKept(memoryId: string): Kept | null {
  const file = store(memoryId);
  if (file === null) return null;
  try {
    if (!file.exists) return null;
    const kept = JSON.parse(file.textSync()) as Kept;
    return Array.isArray(kept?.items) && Array.isArray(kept.roster) ? kept : null;
  } catch {
    return null;
  }
}
export function keepKept(
  memoryId: string,
  items: readonly MediaItem[],
  roster: readonly Member[],
): void {
  const file = store(memoryId);
  if (file === null) return;
  try {
    const kept: Kept = { items: items.filter((item) => !item.hidden), roster: [...roster] };
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(kept));
  } catch (e) {
    console.warn('the feed was not kept on this phone:', e);
  }
}
export function forgetKept(): void {
  try {
    if (folder().exists) folder().delete();
  } catch (e) {
    console.warn('the kept feeds were not cleared:', e);
  }
}
