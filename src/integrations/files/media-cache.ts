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
  const suffix = Math.random().toString(36).slice(2, 8);
  return key ? new File(folderOf(group), `${key.id}.${key.ext}.${suffix}.part`) : null;
}

function cacheKeyOf(url: string, group: string | null): string | null {
  const key = urlKey(url);
  return key ? `${groupOf(group)}/${key.id}.${key.ext}` : null;
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

const downloading = new Map<string, Promise<string | null>>();
const copying = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

function serially<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

function tracked(
  map: Map<string, Promise<string | null>>,
  key: string,
  run: () => Promise<string | null>,
): Promise<string | null> {
  const running = map.get(key);
  if (running) return running;
  const promise = run().finally(() => map.delete(key));
  map.set(key, promise);
  return promise;
}

export function keepUrl(url: string, group: string | null): Promise<string | null> {
  const key = cacheKeyOf(url, group);
  if (!key) return Promise.resolve(null);
  const known = cachedUrl(url, group);
  if (known) return Promise.resolve(known);
  return tracked(downloading, key, () =>
    serially(async () => {
      const file = fileOf(url, group);
      const part = partOf(url, group);
      if (!file || !part) return null;
      try {
        folderReady(group);
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
    }),
  );
}

export function keepLoaded(url: string, group: string | null): Promise<string | null> {
  const key = cacheKeyOf(url, group);
  if (!key) return Promise.resolve(null);
  const known = cachedUrl(url, group);
  if (known) return Promise.resolve(known);
  return tracked(copying, key, async () => {
    const file = fileOf(url, group);
    const part = partOf(url, group);
    if (!file || !part) return null;
    try {
      const source = await imageCachePath(url);
      if (!source) return null;
      folderReady(group);
      await new File(source).copy(part, { overwrite: true });
      await part.move(file, { overwrite: true });
      return file.uri;
    } catch (error) {
      console.warn(`displayed media ${url} could not be copied:`, error);
      try {
        part.delete();
      } catch {
        // the half-file was already gone
      }
      return null;
    }
  });
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
