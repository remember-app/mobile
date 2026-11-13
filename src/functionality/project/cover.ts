import { labelsState, loadLabels } from '@/functionality/label/labels';
import { galleryState, loadGallery } from '@/functionality/media/gallery';
import { readCache, writeCache } from '@/integrations/files/cache';
import { urlKey } from '@/integrations/files/media-cache';
import { itemSource } from '@/models';
import type { ProjectId } from '@/types/id';

const COVER = ['обложка', 'cover'];
const CACHE = 'covers';
const TTL = 5 * 60 * 60 * 1000;

type Stored = Record<string, { id: string; until: number }>;

const idOf = (url: string) => urlKey(url)?.id ?? url;

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
  const frames = chosen.map(itemSource).filter((url): url is string => url !== null);
  if (frames.length === 0) return frames;

  const stored = readCache<Stored>(CACHE) ?? {};
  const current = stored[projectId];
  const now = Date.now();
  const shown =
    current && current.until > now ? frames.find((url) => idOf(url) === current.id) : null;
  if (shown) return [shown, ...frames.filter((url) => url !== shown)];

  const pick = frames[Math.floor(Math.random() * frames.length)] ?? frames[0];
  if (!pick) return frames;
  stored[projectId] = { id: idOf(pick), until: now + TTL };
  writeCache(CACHE, stored);
  return [pick, ...frames.filter((url) => url !== pick)];
}
