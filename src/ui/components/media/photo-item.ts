import { type Item, itemSource } from '@/models';
import { duration } from '@/ui/format';

import type { Photo } from './photo-grid';
import type { ViewerPhoto } from './viewer/types';

export function tileOf(item: Item): Photo {
  const video = item.kind === 'video';
  return {
    id: item.id,
    source: itemSource(item),
    preview: video
      ? (item.links.thumbnail ?? item.links.preview)
      : (item.links.preview ?? item.links.thumbnail ?? item.links.original),
    original: item.kind === 'photo' ? item.links.original : null,
    video,
    playbackUrl: video ? (item.links.preview ?? item.links.original) : null,
    note: video && item.media.duration !== null ? duration(item.media.duration) : undefined,
    width: item.media.dimensions?.width,
    height: item.media.dimensions?.height,
    capturedAt: item.media.capturedAt,
  };
}

export function viewerOf(item: Item): ViewerPhoto {
  const video = item.kind === 'video';
  return {
    id: item.id,
    source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
    video,
    playbackUrl: video ? (item.links.preview ?? item.links.original) : null,
    width: item.media.dimensions?.width,
    height: item.media.dimensions?.height,
    capturedAt: item.media.capturedAt,
  };
}
