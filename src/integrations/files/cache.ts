import { Directory, File, Paths } from 'expo-file-system';

const folder = () => new Directory(Paths.document, 'cache');
const fileOf = (name: string): File | null =>
  /^[a-z0-9._-]+$/i.test(name) ? new File(folder(), `${name}.json`) : null;

export function readCache<T>(name: string): T | null {
  const file = fileOf(name);
  if (!file) return null;
  try {
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch (error) {
    console.warn(`cache ${name} could not be read:`, error);
    return null;
  }
}

export function writeCache(name: string, value: unknown): void {
  const file = fileOf(name);
  if (!file) return;
  try {
    if (!folder().exists) folder().create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(value));
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
  const file = fileOf(name);
  if (!file) return;
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.warn(`cache ${name} could not be removed:`, error);
  }
}
