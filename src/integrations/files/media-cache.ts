import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

export type CacheGroup = { id: string; bytes: number };

const OTHER = 'other';
const root = () => new Directory(Paths.document, 'media');
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const groupOf = (group: string | null) => (group && validId(group) ? group : OTHER);
const folderOf = (group: string | null) => new Directory(root(), groupOf(group));

const cleared = new Set<() => void>();

export function onCacheCleared(listener: () => void): () => void {
  cleared.add(listener);
  return () => {
    cleared.delete(listener);
  };
}

export function urlKey(url: string): { id: string; ext: string } | null {
  if (!/^https?:/i.test(url)) return null;
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const id = parts.at(-1);
    const ext = parts.at(-2);
    if (!id || !ext || !validId(id) || !/^[a-z0-9]+$/i.test(ext)) return null;
    return { id: id.toLowerCase(), ext: ext.toLowerCase() };
  } catch {
    return null;
  }
}

function fileOf(url: string, group: string | null): File | null {
  const key = urlKey(url);
  return key ? new File(folderOf(group), `${key.id}.${key.ext}`) : null;
}

function partOf(url: string, group: string | null): File | null {
  const key = urlKey(url);
  return key ? new File(folderOf(group), `${key.id}.${key.ext}.part`) : null;
}

export function cachedUrl(url: string, group: string | null): string | null {
  const file = fileOf(url, group);
  try {
    return file?.exists ? file.uri : null;
  } catch (error) {
    console.warn(`cached media ${url} could not be read:`, error);
    return null;
  }
}

function folderReady(group: string | null): Directory {
  const folder = folderOf(group);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return folder;
}

export async function keepUrl(url: string, group: string | null): Promise<string | null> {
  const file = fileOf(url, group);
  const part = partOf(url, group);
  const known = cachedUrl(url, group);
  if (!file || !part || known) return known;
  try {
    folderReady(group);
    if (part.exists) part.delete();
    await File.downloadFileAsync(url, part, { idempotent: true });
    await part.move(file, { overwrite: true });
    return file.uri;
  } catch (error) {
    console.warn(`media ${url} was not kept:`, error);
    try {
      part.delete();
    } catch {
      // the half-file was already gone
    }
    return null;
  }
}

export async function keepLoaded(url: string, group: string | null): Promise<string | null> {
  const known = cachedUrl(url, group);
  if (known) return known;
  const file = fileOf(url, group);
  const part = partOf(url, group);
  if (file && part) {
    try {
      const source = await imageCachePath(url);
      if (source) {
        folderReady(group);
        if (part.exists) part.delete();
        await new File(source).copy(part, { overwrite: true });
        await part.move(file, { overwrite: true });
        return file.uri;
      }
    } catch (error) {
      console.warn(`displayed media ${url} could not be copied:`, error);
      try {
        part.delete();
      } catch {
        // the half-file was already gone
      }
    }
  }
  return keepUrl(url, group);
}

async function imageCachePath(url: string): Promise<string | null> {
  const first = await Image.getCachePathAsync(url);
  if (first) return first;
  await new Promise((resolve) => setTimeout(resolve, 350));
  return Image.getCachePathAsync(url);
}

export function clearMediaGroup(group: string | null): void {
  const folder = folderOf(group);
  try {
    if (folder.exists) folder.delete();
  } catch (error) {
    console.warn(`media group ${groupOf(group)} could not be cleared:`, error);
  }
}

export function mediaCacheUsage(): { total: number; groups: CacheGroup[] } {
  const groups: CacheGroup[] = [];
  let total = 0;
  try {
    if (!root().exists) return { total, groups };
    for (const entry of root().list()) {
      if (!(entry instanceof Directory)) continue;
      let bytes = 0;
      for (const file of entry.list()) {
        if (file instanceof File) bytes += file.size ?? 0;
      }
      if (bytes > 0) {
        groups.push({ id: entry.name, bytes });
        total += bytes;
      }
    }
  } catch (error) {
    console.warn('media cache could not be measured:', error);
  }
  groups.sort((a, b) => b.bytes - a.bytes);
  return { total, groups };
}

export function clearMediaCache(): void {
  try {
    if (root().exists) root().delete();
  } catch (error) {
    console.warn('media cache could not be cleared:', error);
  }
  for (const listener of cleared) listener();
}
