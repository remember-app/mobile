import { labelsState, loadLabels } from '@/functionality/label/labels';
import { galleryState, loadGallery } from '@/functionality/media/gallery';
import type { ProjectId } from '@/types/id';

const COVER = ['обложка', 'cover'];
const TTL = 5 * 60 * 60 * 1000;

const slotOf = (value: string): number => {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
};

const shuffle = <T>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let at = result.length - 1; at > 0; at -= 1) {
    const pick = Math.floor(Math.random() * (at + 1));
    const current = result[at];
    const other = result[pick];
    if (current === undefined || other === undefined) continue;
    result[at] = other;
    result[pick] = current;
  }
  return result;
};

export async function projectCoverFrames(projectId: ProjectId): Promise<string[]> {
  await Promise.all([loadLabels(projectId), loadGallery(projectId)]);
  const photos = galleryState(projectId).items.filter((item) => item.kind === 'photo');
  const label = labelsState(projectId).labels.find((entry) =>
    COVER.includes(entry.name.trim().toLowerCase()),
  );
  const covered = label ? photos.filter((item) => item.labelIds.includes(label.id)) : [];
  const chosen = covered.length > 0 ? covered : shuffle(photos);
  const frames = chosen
    .map((item) => item.links.original)
    .filter((url): url is string => url !== null);
  if (frames.length === 0) return frames;

  const slot = slotOf(`${projectId}:${Math.floor(Date.now() / TTL)}`);
  const pick = frames[slot % frames.length] ?? frames[0];
  if (!pick) return frames;
  return [pick, ...frames.filter((url) => url !== pick)];
}
