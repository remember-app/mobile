import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

export type MediaScope = 'avatars' | 'system' | 'music' | 'misc';

export type MediaUsage = {
  total: number;
  projects: { id: string; bytes: number }[];
  other: { id: MediaScope; bytes: number }[];
};

const OTHER = 'other';
const SCOPES: MediaScope[] = ['avatars', 'system', 'music', 'misc'];
const root = () => new Directory(Paths.document, 'media');
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const isProject = (group: string | null): group is string => !!group && validId(group);
const folderOf = (group: string | null, scope: MediaScope = 'misc') =>
  isProject(group) ? new Directory(root(), group) : new Directory(root(), OTHER, scope);

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

function fileOf(url: string, group: string | null, scope: MediaScope): File | null {
  const key = urlKey(url);
  return key ? new File(folderOf(group, scope), `${key.id}.${key.ext}`) : null;
}

function partOf(url: string, group: string | null, scope: MediaScope): File | null {
  const key = urlKey(url);
  const suffix = Math.random().toString(36).slice(2, 8);
  return key ? new File(folderOf(group, scope), `${key.id}.${key.ext}.${suffix}.part`) : null;
}

function cacheKeyOf(url: string, group: string | null, scope: MediaScope): string | null {
  const key = urlKey(url);
  return key ? `${folderOf(group, scope).uri}/${key.id}.${key.ext}` : null;
}

export function cachedUrl(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): string | null {
  const file = fileOf(url, group, scope);
  try {
    return file?.exists ? file.uri : null;
  } catch (error) {
    console.warn(`cached media ${url} could not be read:`, error);
    return null;
  }
}

function folderReady(group: string | null, scope: MediaScope): Directory {
  const folder = folderOf(group, scope);
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

export function keepUrl(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): Promise<string | null> {
  const key = cacheKeyOf(url, group, scope);
  if (!key) return Promise.resolve(null);
  const known = cachedUrl(url, group, scope);
  if (known) return Promise.resolve(known);
  return tracked(downloading, key, () =>
    serially(async () => {
      const file = fileOf(url, group, scope);
      const part = partOf(url, group, scope);
      if (!file || !part) return null;
      try {
        folderReady(group, scope);
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

export function keepLoaded(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): Promise<string | null> {
  const key = cacheKeyOf(url, group, scope);
  if (!key) return Promise.resolve(null);
  const known = cachedUrl(url, group, scope);
  if (known) return Promise.resolve(known);
  return tracked(copying, key, async () => {
    const file = fileOf(url, group, scope);
    const part = partOf(url, group, scope);
    if (!file || !part) return null;
    try {
      const source = await imageCachePath(url);
      if (!source) return null;
      folderReady(group, scope);
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

function sumFiles(directory: Directory): number {
  let bytes = 0;
  for (const file of directory.list()) {
    if (file instanceof File) bytes += file.size ?? 0;
  }
  return bytes;
}

export function clearMediaGroup(group: string | null): void {
  const folder = isProject(group) ? new Directory(root(), group) : new Directory(root(), OTHER);
  try {
    if (folder.exists) folder.delete();
  } catch (error) {
    console.warn(`media group ${group ?? OTHER} could not be cleared:`, error);
  }
  for (const listener of cleared) listener();
}

export function mediaCacheUsage(): MediaUsage {
  const projects: { id: string; bytes: number }[] = [];
  const other = new Map<MediaScope, number>();
  let total = 0;
  const addOther = (scope: MediaScope, bytes: number) => {
    if (bytes <= 0) return;
    other.set(scope, (other.get(scope) ?? 0) + bytes);
    total += bytes;
  };
  try {
    if (!root().exists) return { total, projects, other: [] };
    for (const entry of root().list()) {
      if (!(entry instanceof Directory)) continue;
      if (entry.name === OTHER) {
        for (const child of entry.list()) {
          if (child instanceof Directory) {
            const scope = SCOPES.includes(child.name as MediaScope)
              ? (child.name as MediaScope)
              : 'misc';
            addOther(scope, sumFiles(child));
          } else if (child instanceof File) {
            addOther('misc', child.size ?? 0);
          }
        }
        continue;
      }
      const bytes = sumFiles(entry);
      if (bytes > 0) {
        projects.push({ id: entry.name, bytes });
        total += bytes;
      }
    }
  } catch (error) {
    console.warn('media cache could not be measured:', error);
  }
  projects.sort((left, right) => right.bytes - left.bytes);
  const scopes = [...other.entries()].map(([id, bytes]) => ({ id, bytes }));
  scopes.sort((left, right) => right.bytes - left.bytes);
  return { total, projects, other: scopes };
}

export function clearMediaCache(): void {
  try {
    if (root().exists) root().delete();
  } catch (error) {
    console.warn('media cache could not be cleared:', error);
  }
  for (const listener of cleared) listener();
}
