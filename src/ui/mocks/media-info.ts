import { Image as RNImage } from 'react-native';

import type { PhotoMeta } from '@/ui/components/media/info/meta-card';
import type { Place } from '@/ui/components/media/info/place-map';
import type { Photo } from '@/ui/components/media/photo-grid';

const PLACES: Place[] = [
  { latitude: 51.5007, longitude: -0.1246, label: 'Вестминстер, Лондон' },
  { latitude: 51.5073, longitude: -0.1657, label: 'Хайд-парк, Лондон' },
  { latitude: 51.5136, longitude: -0.1365, label: 'Сохо, Лондон' },
];

function sizeOf(photo: Photo): { width: number; height: number } {
  if (photo.width && photo.height) return { width: photo.width, height: photo.height };
  if (typeof photo.source === 'number') {
    const source = RNImage.resolveAssetSource(photo.source);
    if (source?.width && source?.height) return { width: source.width, height: source.height };
  }
  return { width: 4032, height: 3024 };
}

export function mockPhotoMeta(photo: Photo, index: number): PhotoMeta {
  const { width, height } = sizeOf(photo);
  return {
    capturedAt: new Date(2026, 4, 15 + (index % 10), 16, 51),
    cameraModel: 'Apple iPhone 16 Pro',
    format: 'HEIC',
    lens: 'Основная камера',
    standard: true,
    width,
    height,
    bytes: Math.round(width * height * 0.22),
    iso: 80,
    focalLengthMm: 24,
    ev: 0,
    aperture: 1.78,
    shutter: '1/1292 s',
    place: PLACES[index % PLACES.length] ?? null,
  };
}
