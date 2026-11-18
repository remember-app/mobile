import type { MutableRefObject } from 'react';

import { space } from '@/ui/theme';

import { type MeasureTile, type Photo, PhotoGrid, type Rect } from '../../media/photo-grid';
import { OrderPage } from './wizard';

export function ShotsPage({
  photos,
  blankIndex,
  measureRef,
  onOpen,
  onSelect,
  onRequire,
  onScroll,
  onLoadOlder,
  width,
  height,
  top,
  bottom,
}: {
  photos: readonly Photo[];
  blankIndex: number | null;
  measureRef?: MutableRefObject<MeasureTile | null>;
  onOpen: (index: number, rect?: Rect) => void;
  onSelect: (index: number) => void;
  onRequire: (index: number) => void;
  onScroll?: (offset: number) => void;
  onLoadOlder?: () => void;
  width: number;
  height: number;
  top: number;
  bottom: number;
}) {
  return (
    <OrderPage width={width} height={height}>
      <PhotoGrid
        photos={photos}
        onOpen={onOpen}
        onSelect={onSelect}
        onRequire={onRequire}
        onScroll={onScroll}
        onLoadOlder={onLoadOlder}
        padding={{ top: top + space.s2, bottom }}
        blankIndex={blankIndex}
        measureRef={measureRef}
      />
    </OrderPage>
  );
}
