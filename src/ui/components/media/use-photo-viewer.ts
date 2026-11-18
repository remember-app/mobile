import { useRef, useState } from 'react';

import type { MeasureTile, Rect } from './photo-grid';

export type PhotoViewerState = { index: number; rect?: Rect };

/** Состояние полноэкранного просмотра и пересчёт плитки при пролистывании. */
export function usePhotoViewer() {
  const [viewer, setViewer] = useState<PhotoViewerState | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);
  const onIndex = (index: number) =>
    measureTile.current?.(index, (rect) =>
      setViewer((was) => (was === null ? was : { index, rect })),
    );
  return { viewer, setViewer, measureTile, onIndex };
}
