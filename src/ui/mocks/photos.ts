import type { ImageSource } from 'expo-image';

import type { Photo } from '@/ui/components/media/photo-grid';

const sources: ImageSource[] = [
  require('../../../assets/images/mock/party.jpg'),
  require('../../../assets/images/mock/birthday.jpg'),
  require('../../../assets/images/mock/picnic.jpg'),
  require('../../../assets/images/mock/sea.jpg'),
  require('../../../assets/images/mock/wedding.jpg'),
  require('../../../assets/images/mock/friends.jpg'),
  require('../../../assets/images/mock/city.jpg'),
  require('../../../assets/images/mock/dance.jpg'),
];

export function mockPhotos(count = 64): Photo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-${index}`,
    source: sources[index % sources.length] ?? null,
  }));
}
