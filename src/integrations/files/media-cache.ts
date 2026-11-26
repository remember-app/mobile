import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

export type MediaScope = 'avatars' | 'system' | 'music' | 'misc';
type Lane = 'image' | 'video' | 'other';

export type MediaFile = {
  id: string;
  ext: string;
  group: string | null;
  scope?: MediaScope;
  lane?: Lane;
  priority?: number;
};

export type MediaUsage = {
  total: number;
  projects: { id: string; bytes: number }[];
  other: { id: MediaScope; bytes: number }[];
};

const OTHER = 'other';
const SCOPES: MediaScope[] = ['avatars', 'system', 'music', 'misc'];
const LIMITS: Record<Lane, number> = { image: 3, video: 1, other: 2 };
const MAX_BYTES = 600 * 1024 * 1024;
const TIMEOUT_MS = 25_000;
const root = () => new Directory(Paths.document, 'media');
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const isProject = (group: string | null): group is string => !!group && validId(group);
const folderOf = (group: string | null, scope: MediaScope = 'misc') =>
  isProject(group) ? new Directory(root(), group) : new Directory(root(), OTHER, scope);
const versionFile = () => new File(root(), '.variant-v2');

function resetOldCache(): void {
  try {
    if (versionFile().exists) return;
    const folder = root();
    if (folder.exists) folder.delete();
    folder.create({ intermediates: true, idempotent: true });
    versionFile().create();
  } catch (error) {
    console.warn('old media cache could not be cleared:', error);
  }
}

resetOldCache();

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

const laneOf = (ext: string): Lane => (ext === 'mp4' ? 'video' : ext === 'm4a' ? 'other' : 'image');

function fileOf(file: MediaFile): File | null {
  if (!validId(file.id) || !/^[a-z0-9]+$/i.test(file.ext)) return null;
  return new File(folderOf(file.group, file.scope), `${file.id}.${file.ext}`);
}

function partOf(file: MediaFile): File | null {
  if (!validId(file.id) || !/^[a-z0-9]+$/i.test(file.ext)) return null;
  const suffix = Math.random().toString(36).slice(2, 8);
  return new File(folderOf(file.group, file.scope), `${file.id}.${file.ext}.${suffix}.part`);
}

function cacheKeyOf(file: MediaFile): string | null {
  const target = fileOf(file);
  return target?.uri ?? null;
}

export function cachedFile(file: MediaFile): string | null {
  const target = fileOf(file);
  try {
    return target?.exists ? target.uri : null;
  } catch (error) {
    console.warn(`cached media ${file.id} could not be read:`, error);
    return null;
  }
}

export function cachedUrl(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): string | null {
  const key = urlKey(url);
  return key ? cachedFile({ ...key, group, scope }) : null;
}

function folderReady(group: string | null, scope: MediaScope): Directory {
  const folder = folderOf(group, scope);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return folder;
}

export async function cacheLocalFile(
  sourceUri: string,
  name: string,
  group: string | null,
  scope: MediaScope = 'misc',
): Promise<string> {
  const folder = folderReady(group, scope);
  const target = new File(folder, name);
  await new File(sourceUri).copy(target, { overwrite: true });
  return target.uri;
}

const active: Record<Lane, number> = { image: 0, video: 0, other: 0 };
const waiting: { lane: Lane; priority: number; start: () => void }[] = [];

function pump(): void {
  for (let index = 0; index < waiting.length; ) {
    const task = waiting[index];
    if (!task || active[task.lane] >= LIMITS[task.lane]) {
      index += 1;
      continue;
    }
    waiting.splice(index, 1);
    active[task.lane] += 1;
    task.start();
  }
}

function schedule<T>(lane: Lane, priority: number, run: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    waiting.push({
      lane,
      priority,
      start: () => {
        void run()
          .then(resolve, reject)
          .finally(() => {
            active[lane] -= 1;
            pump();
          });
      },
    });
    waiting.sort((left, right) => right.priority - left.priority);
    pump();
  });
}

const downloading = new Map<string, Promise<string | null>>();

function tracked(key: string, run: () => Promise<string | null>): Promise<string | null> {
  const running = downloading.get(key);
  if (running) return running;
  const promise = run().finally(() => downloading.delete(key));
  downloading.set(key, promise);
  return promise;
}

function trimCache(): void {
  try {
    if (!root().exists) return;
    const files: { file: File; size: number; at: number }[] = [];
    const walk = (directory: Directory) => {
      for (const entry of directory.list()) {
        if (entry instanceof Directory) walk(entry);
        else if (entry instanceof File) {
          const info = entry.info();
          files.push({ file: entry, size: info.size ?? 0, at: info.modificationTime ?? 0 });
        }
      }
    };
    walk(root());
    let total = files.reduce((sum, entry) => sum + entry.size, 0);
    if (total <= MAX_BYTES) return;
    files.sort((left, right) => left.at - right.at);
    for (const entry of files) {
      if (total <= MAX_BYTES) break;
      try {
        entry.file.delete();
        total -= entry.size;
      } catch (error) {
        console.warn(`old media ${entry.file.name} could not be deleted:`, error);
      }
    }
  } catch (error) {
    console.warn('media cache could not be trimmed:', error);
  }
}

export function keepFile(
  file: MediaFile,
  resolveUrl: (fresh: boolean) => Promise<string | null>,
): Promise<string | null> {
  const key = cacheKeyOf(file);
  if (!key) return Promise.resolve(null);
  const known = cachedFile(file);
  if (known) return Promise.resolve(known);
  return tracked(key, () =>
    schedule(file.lane ?? laneOf(file.ext), file.priority ?? 0, async () => {
      const target = fileOf(file);
      const part = partOf(file);
      if (!target || !part) return null;
      folderReady(file.group, file.scope ?? 'misc');
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const url = await resolveUrl(attempt > 0);
        if (!url) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          await File.downloadFileAsync(url, part, {
            idempotent: true,
            signal: controller.signal,
          });
          await part.move(target, { overwrite: true });
          trimCache();
          return target.uri;
        } catch (error) {
          if (attempt === 1) console.warn(`media ${file.id} was not kept:`, error);
          try {
            part.delete();
          } catch {
            // the half-file was already gone
          }
        } finally {
          clearTimeout(timer);
        }
      }
      return null;
    }),
  );
}

export function keepUrl(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): Promise<string | null> {
  const key = urlKey(url);
  if (!key) return Promise.resolve(null);
  return keepFile({ ...key, group, scope }, () => Promise.resolve(url));
}

const copying = new Map<string, Promise<string | null>>();

export function keepLoaded(
  url: string,
  group: string | null,
  scope: MediaScope = 'misc',
): Promise<string | null> {
  const key = urlKey(url);
  if (!key) return Promise.resolve(null);
  const file: MediaFile = { ...key, group, scope };
  const known = cachedFile(file);
  if (known) return Promise.resolve(known);
  const cacheKey = `${cacheKeyOf(file)}:loaded`;
  const running = copying.get(cacheKey);
  if (running) return running;
  const task = (async () => {
    const target = fileOf(file);
    const part = partOf(file);
    if (!target || !part) return null;
    try {
      let source = await Image.getCachePathAsync(url);
      if (!source) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        source = await Image.getCachePathAsync(url);
      }
      if (!source) return null;
      folderReady(group, scope);
      await new File(source).copy(part, { overwrite: true });
      await part.move(target, { overwrite: true });
      return target.uri;
    } catch (error) {
      console.warn(`displayed media ${file.id} could not be copied:`, error);
      try {
        part.delete();
      } catch {
        // the half-file was already gone
      }
      return null;
    }
  })().finally(() => copying.delete(cacheKey));
  copying.set(cacheKey, task);
  return task;
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
    other.set(scope, bytes);
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
    resetOldCache();
  } catch (error) {
    console.warn('media cache could not be cleared:', error);
  }
  for (const listener of cleared) listener();
}
