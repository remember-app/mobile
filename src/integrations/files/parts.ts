import { File, FileMode } from 'expo-file-system';

export type FilePart = {
  start: number;
  length: number;
};

export async function fileDigest(uri: string): Promise<string | null> {
  try {
    return await new File(uri).digest('SHA-256');
  } catch (error) {
    console.warn('file could not be fingerprinted:', error);
    return null;
  }
}

export function readFilePart(uri: string, part: FilePart): Uint8Array<ArrayBuffer> {
  const source = new File(uri);
  const handle = source.open(FileMode.ReadOnly);
  try {
    handle.offset = part.start;
    return handle.readBytesSync(part.length);
  } finally {
    handle.close();
  }
}
