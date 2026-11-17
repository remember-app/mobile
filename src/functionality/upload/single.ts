import { File } from 'expo-file-system';
import { completeUpload, startUpload } from '@/integrations/api';
import { readFilePart } from '@/integrations/files/parts';
import { putPart } from '@/integrations/storage/upload';
import type { MediaKind, UploadedPart } from '@/models';
import type { MediaId } from '@/types/id';

export async function uploadFileOnce(
  token: string,
  kind: MediaKind,
  uri: string,
  fileName: string,
): Promise<MediaId> {
  const size = new File(uri).size;
  if (!size) throw new Error('file is empty');
  const plan = await startUpload(token, null, { kind, sizeBytes: size, fileName });
  const parts: UploadedPart[] = [];
  const total = Math.max(1, Math.ceil(size / plan.partBytes));
  for (let number = 1; number <= total; number += 1) {
    const url = plan.parts[number - 1];
    if (!url) throw new Error(`no link for part ${number}`);
    const start = (number - 1) * plan.partBytes;
    const bytes = readFilePart(uri, {
      start,
      length: Math.min(plan.partBytes, size - start),
    });
    parts.push({ part_number: number, etag: await putPart(url, bytes) });
  }
  const done = await completeUpload(token, null, plan.id, parts);
  return done.mediaId;
}
