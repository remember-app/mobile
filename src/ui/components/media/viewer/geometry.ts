import { Image as RNImage } from 'react-native';
import type { Box, Target, ViewerPhoto } from './types';

export function boxFor(
  media: { width: number; height: number } | null,
  width: number,
  height: number,
): Box {
  const ratio = media && media.height > 0 ? media.width / media.height : null;
  if (ratio === null) return { width, height };
  return { width, height: Math.min(height, width / ratio) };
}

export function mediaSize(photo: ViewerPhoto): { width: number; height: number } | null {
  if (photo.width && photo.height) return { width: photo.width, height: photo.height };
  if (typeof photo.source === 'number') {
    const asset = RNImage.resolveAssetSource(photo.source);
    if (asset?.width && asset?.height) return { width: asset.width, height: asset.height };
  }
  return null;
}

export function targetFor(photo: ViewerPhoto | undefined, width: number, height: number): Target {
  const box = boxFor(photo ? mediaSize(photo) : null, width, height);
  return { left: (width - box.width) / 2, top: (height - box.height) / 2, ...box };
}

export const clamp = (value: number, min: number, max: number): number => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};
