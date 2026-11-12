import { space } from '@/ui/theme';

import { type Photo, PhotoGrid, type Rect } from '../media/photo-grid';
import { OrderPage } from './wizard';

export function ShotsPage({
  photos,
  blankIndex,
  onOpen,
  onSelect,
  onRequire,
  width,
  height,
  bottom,
}: {
  photos: readonly Photo[];
  blankIndex: number | null;
  onOpen: (index: number, rect?: Rect) => void;
  onSelect: (index: number) => void;
  onRequire: (index: number) => void;
  width: number;
  height: number;
  bottom: number;
}) {
  return (
    <OrderPage width={width} height={height}>
      <PhotoGrid
        photos={photos}
        onOpen={onOpen}
        onSelect={onSelect}
        onRequire={onRequire}
        padding={{ top: space.s2, bottom }}
        blankIndex={blankIndex}
      />
    </OrderPage>
  );
}
