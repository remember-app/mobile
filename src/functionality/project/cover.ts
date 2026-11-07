import { labelsState, loadLabels } from '@/functionality/label/labels';
import { galleryState, loadGallery } from '@/functionality/media/gallery';
import type { ProjectId } from '@/types/id';

const COVER = ['обложка', 'cover'];

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
  return chosen
    .map((item) => item.links.thumbnail ?? item.links.preview ?? item.links.original)
    .filter((url): url is string => url !== null);
}
