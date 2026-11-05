import { File, FileMode } from 'expo-file-system';

export type FilePart = {
  start: number;
  length: number;
};

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
