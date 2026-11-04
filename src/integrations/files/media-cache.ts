import { Directory, File, Paths } from 'expo-file-system';

export type MediaRole = 'thumbnail' | 'preview' | 'original';

const folder = () => new Directory(Paths.document, 'media');
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const nameOf = (id: string, role: MediaRole, ext: string) => `${role}-${id}.${ext}`;

const extensions: Record<MediaRole, string[]> = {
  thumbnail: ['jpg'],
  preview: ['jpg', 'mp4'],
  original: ['jpeg', 'jpg', 'png', 'heic', 'webp', 'mp4', 'mov', 'mp3', 'm4a', 'wav'],
};

function fileOf(id: string, role: MediaRole, ext: string): File | null {
  return validId(id) ? new File(folder(), nameOf(id, role, ext)) : null;
}

export function cachedMedia(id: string, role: MediaRole, ext: string): string | null {
  const file = fileOf(id, role, ext);
  try {
    return file?.exists ? file.uri : null;
  } catch (error) {
    console.warn(`cached ${role} ${id} could not be read:`, error);
    return null;
  }
}

export async function keepMedia(
  id: string,
  role: MediaRole,
  ext: string,
  url: string,
): Promise<string | null> {
  const file = fileOf(id, role, ext);
  if (!file) return null;
  const known = cachedMedia(id, role, ext);
  if (known) return known;
  const part = fileOf(id, role, `${ext}.part`);
  if (!part) return null;
  try {
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
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

export function forgetItemMedia(id: string): void {
  for (const [role, list] of Object.entries(extensions) as [MediaRole, string[]][]) {
    for (const ext of list) {
      try {
        const file = fileOf(id, role, ext);
        if (file?.exists) file.delete();
      } catch {
        // already gone
      }
    }
  }
}

export function clearMediaCache(): void {
  try {
    if (folder().exists) folder().delete();
  } catch (error) {
    console.warn('media cache could not be cleared:', error);
  }
}
