import { previewLink } from '@/functionality';
import type { DeviceAsset } from '@/integrations/media-library';
import { type Item, itemDate, itemThumb } from '@/models';
import { duration } from '@/ui/format';

import type { Photo } from './photo-grid';
import type { ViewerPhoto } from './viewer/types';

export function tileOf(item: Item): Photo {
  const small = previewLink(item, 'small');
  const middle = previewLink(item, 'middle');
  return {
    id: item.id,
    projectId: item.projectId,
    source: itemThumb(item),
    preview: small ?? middle,
    original: null,
    video: item.kind === 'video',
    playbackUrl: null,
    note:
      item.kind === 'video' && item.media.meta.duration !== null
        ? duration(item.media.meta.duration)
        : undefined,
    width: item.media.meta.dimensions?.width,
    height: item.media.meta.dimensions?.height,
    capturedAt: itemDate(item),
  };
}

export function viewerOf(item: Item): ViewerPhoto {
  const small = previewLink(item, 'small');
  const middle = previewLink(item, 'middle');
  return {
    id: item.id,
    projectId: item.projectId,
    source: middle ?? small,
    thumb: small ?? middle,
    original: null,
    video: item.kind === 'video',
    playbackUrl: null,
    width: item.media.meta.dimensions?.width,
    height: item.media.meta.dimensions?.height,
    capturedAt: itemDate(item),
  };
}

export function deviceTileOf(asset: DeviceAsset): Photo {
  const video = asset.kind === 'video';
  return {
    id: asset.id,
    source: asset.uri,
    video,
    playbackUrl: video ? asset.uri : null,
    note: video && asset.duration !== null ? duration(asset.duration) : undefined,
    width: asset.width,
    height: asset.height,
    capturedAt: new Date(asset.createdAt),
  };
}

export function deviceViewerOf(asset: DeviceAsset): ViewerPhoto {
  const video = asset.kind === 'video';
  return {
    id: asset.id,
    source: asset.uri,
    thumb: asset.uri,
    video,
    playbackUrl: video ? asset.uri : null,
    width: asset.width,
    height: asset.height,
    capturedAt: new Date(asset.createdAt),
  };
}
