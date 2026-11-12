import { Directory, File, Paths } from 'expo-file-system';

export type MediaRole = 'thumbnail' | 'preview' | 'original';

export type CacheGroup = { id: string; bytes: number };

const OTHER = 'other';
const root = () => new Directory(Paths.document, 'media');
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const nameOf = (id: string, role: MediaRole, ext: string) => `${role}-${id}.${ext}`;
const groupOf = (projectId: string | null) => (projectId && validId(projectId) ? projectId : OTHER);
const folderOf = (projectId: string | null) => new Directory(root(), groupOf(projectId));

const extensions: Record<MediaRole, string[]> = {
  thumbnail: ['jpg'],
  preview: ['jpg', 'mp4'],
  original: ['jpeg', 'jpg', 'png', 'heic', 'webp', 'mp4', 'mov', 'mp3', 'm4a', 'wav'],
};

function fileOf(id: string, role: MediaRole, ext: string, projectId: string | null): File | null {
  return validId(id) ? new File(folderOf(projectId), nameOf(id, role, ext)) : null;
}

export function cachedMedia(
  id: string,
  role: MediaRole,
  ext: string,
  projectId: string | null,
): string | null {
  const file = fileOf(id, role, ext, projectId);
  try {
    return file?.exists ? file.uri : null;
  } catch (error) {
    console.warn(`cached ${role} ${id} could not be read:`, error);
    return null;
  }
}

export function cachedMediaAny(
  id: string,
  role: MediaRole,
  projectId: string | null,
): string | null {
  for (const ext of extensions[role]) {
    const uri = cachedMedia(id, role, ext, projectId);
    if (uri) return uri;
  }
  return null;
}

export async function keepMedia(
  id: string,
  role: MediaRole,
  ext: string,
  url: string,
  projectId: string | null,
): Promise<string | null> {
  const file = fileOf(id, role, ext, projectId);
  if (!file) return null;
  const known = cachedMedia(id, role, ext, projectId);
  if (known) return known;
  const part = fileOf(id, role, `${ext}.part`, projectId);
  if (!part) return null;
  try {
    const folder = folderOf(projectId);
    if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, part, { idempotent: true });
    await part.move(file, { overwrite: true });
    return file.uri;
  } catch (error) {
    console.warn(`media ${role} ${id} was not kept:`, error);
    try {
      part.delete();
    } catch {
      // the half-file was already gone
    }
    return null;
  }
}

export function forgetItemMedia(id: string, projectId: string | null): void {
  for (const [role, list] of Object.entries(extensions) as [MediaRole, string[]][]) {
    for (const ext of list) {
      try {
        const file = fileOf(id, role, ext, projectId);
        if (file?.exists) file.delete();
      } catch {
        // already gone
      }
    }
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
}
