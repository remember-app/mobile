import type { DeviceAsset } from '@/integrations/media-library';
import {
  type Item,
  itemDate,
  itemPlayback,
  itemPreview,
  itemSource,
} from '@/models';
import { duration } from '@/ui/format';

import type { Photo } from './photo-grid';
import type { ViewerPhoto } from './viewer/types';

export function tileOf(item: Item): Photo {
  const video = item.kind === 'video';
  return {
    id: item.id,
    projectId: item.projectId,
    source: itemPreview(item, 'middle') ?? itemSource(item),
    preview: itemPreview(item, 'middle'),
    original: item.kind === 'photo' ? item.links.original : null,
    video,
    playbackUrl: video ? itemPlayback(item) : null,
    note:
      video && item.media.meta.duration !== null ? duration(item.media.meta.duration) : undefined,
    width: item.media.meta.dimensions?.width,
    height: item.media.meta.dimensions?.height,
    capturedAt: itemDate(item),
  };
}

export function viewerOf(item: Item): ViewerPhoto {
  const video = item.kind === 'video';
  return {
    id: item.id,
    projectId: item.projectId,
    source: item.links.compressed ?? item.links.original ?? itemPreview(item, 'large'),
    thumb: itemPreview(item, 'small'),
    video,
    playbackUrl: video ? itemPlayback(item) : null,
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
    note: video ? duration(asset.duration) : undefined,
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
    width: asset.width,
    height: asset.height,
    video,
    playbackUrl: video ? asset.uri : null,
    capturedAt: new Date(asset.createdAt),
  };
}
