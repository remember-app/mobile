import { Directory, File, Paths } from 'expo-file-system';

const folder = () => new Directory(Paths.document, 'cache');
const fileOf = (name: string): File | null =>
  /^[a-z0-9._-]+$/i.test(name) ? new File(folder(), `${name}.json`) : null;

export function readCache<T>(name: string): T | null {
  try {
    const file = fileOf(name);
    if (!file) return null;
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch (error) {
    console.warn(`cache ${name} could not be read:`, error);
    return null;
  }
}

export function writeCache(name: string, value: unknown): void {
  try {
    const file = fileOf(name);
    if (!file) return;
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.writeSync(JSON.stringify(value));
  } catch (error) {
    console.warn(`cache ${name} could not be written:`, error);
  }
}

export function clearCache(): void {
  try {
    if (folder().exists) folder().delete();
  } catch (error) {
    console.warn('cache folder could not be cleared:', error);
  }
}

export function removeCache(name: string): void {
  try {
    const file = fileOf(name);
    if (!file) return;
    if (file.exists) file.delete();
  } catch (error) {
    console.warn(`cache ${name} could not be removed:`, error);
  }
}
