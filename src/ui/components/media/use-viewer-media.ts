import { useEffect, useMemo, useState } from 'react';

import { itemById, resolveLink } from '@/functionality';

import type { ViewerPhoto } from './viewer/types';

export function useViewerMedia(
  photos: readonly ViewerPhoto[],
  index: number | null | undefined,
): ViewerPhoto[] {
  const [overrides, setOverrides] = useState<Record<string, Partial<ViewerPhoto>>>({});
  const photo = index === null || index === undefined ? undefined : photos[index];

  useEffect(() => {
    if (!photo?.projectId) return;
    const item = itemById(photo.projectId, photo.id);
    if (!item) return;
    let live = true;
    const variant = photo.video ? 'playback' : 'large';
    void resolveLink(item, variant).then((url) => {
      if (!live || !url) return;
      setOverrides((was) => ({
        ...was,
        [photo.id]: photo.video ? { playbackUrl: url } : { source: url },
      }));
    });
    return () => {
      live = false;
    };
  }, [photo?.id, photo?.projectId, photo?.video]);

  return useMemo(
    () => photos.map((entry) => ({ ...entry, ...overrides[entry.id] })),
    [photos, overrides],
  );
}
