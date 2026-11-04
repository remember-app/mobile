import { Directory, File, Paths } from 'expo-file-system';

const folder = () => new Directory(Paths.cache, 'video');
const keeping = new Map<string, Promise<string | null>>();
function videoFile(id: string): File | null {
  return /^[0-9a-f-]{36}$/i.test(id) ? new File(folder(), `${id}.mp4`) : null;
}
export function cachedVideo(id: string): string | null {
  try {
    const file = videoFile(id);
    return file?.exists ? file.uri : null;
  } catch (e) {
    console.warn('the video cache could not be read for', id, e);
    return null;
  }
}
export function keepVideo(id: string, url: string): Promise<string | null> {
  const held = keeping.get(id);
  if (held !== undefined) return held;
  const run = keep(id, url).finally(() => keeping.delete(id));
  keeping.set(id, run);
  return run;
}
async function keep(id: string, url: string): Promise<string | null> {
  const file = videoFile(id);
  if (file === null) return null;
  const part = new File(folder(), `${id}.part`);
  try {
    if (file.exists) return file.uri;
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, part, { idempotent: true });
    await part.move(file, { overwrite: true });
    return file.uri;
  } catch (e) {
    console.warn('the video was not kept on this phone:', id, e);
    try {
      part.delete();
    } catch {}
    return null;
  }
}
