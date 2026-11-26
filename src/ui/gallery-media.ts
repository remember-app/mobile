import { useEffect, useState } from 'react';

import { localPlaybackOf, resolveLink } from '@/functionality';
import type { Item } from '@/models';

export type GalleryMedia = {
  large: Record<string, string>;
  playback: Record<string, string>;
};

export function useGalleryMedia(items: readonly Item[]): GalleryMedia {
  const [large, setLarge] = useState<Record<string, string>>({});
  const [playback, setPlayback] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    for (const item of items) {
      if (item.kind === 'photo' && !large[item.id]) {
        void resolveLink(item, 'large').then((url) => {
          if (live && url) setLarge((was) => ({ ...was, [item.id]: url }));
        });
      }
      if (item.kind === 'video' && !playback[item.id] && !localPlaybackOf(item.id)) {
        void resolveLink(item, 'playback').then((url) => {
          if (live && url) setPlayback((was) => ({ ...was, [item.id]: url }));
        });
      }
    }
    return () => {
      live = false;
    };
  }, [items, large, playback]);

  return { large, playback };
}
