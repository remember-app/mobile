import type { DeviceAsset } from '@/integrations/media-library';
import { type Item, itemDate, itemSource } from '@/models';
import { duration } from '@/ui/format';

import type { Photo } from './photo-grid';
import type { ViewerPhoto } from './viewer/types';

export function tileOf(item: Item): Photo {
  const video = item.kind === 'video';
  return {
    id: item.id,
    projectId: item.projectId,
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
    capturedAt: itemDate(item),
  };
}

export function viewerOf(item: Item): ViewerPhoto {
  const video = item.kind === 'video';
  return {
    id: item.id,
    projectId: item.projectId,
    source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
    thumb: item.links.thumbnail,
    video,
    playbackUrl: video ? (item.links.preview ?? item.links.original) : null,
    width: item.media.dimensions?.width,
    height: item.media.dimensions?.height,
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
