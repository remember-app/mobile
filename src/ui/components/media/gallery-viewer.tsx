import { type ReactNode, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { MeasureTile, Rect } from './photo-grid';
import { PhotoViewer, type ViewerPhoto } from './photo-viewer';

export type GalleryViewerState = { index: number; rect?: Rect };

/** Полноэкранный просмотр: открытие с плитки и пересчёт плитки при пролистывании. */
export function useGalleryViewer() {
  const [viewer, setViewer] = useState<GalleryViewerState | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);
  const onIndex = (index: number) => {
    measureTile.current?.(index, (rect) =>
      setViewer((was) => (was === null ? was : { index, rect })),
    );
  };
  return {
    viewer,
    setViewer,
    measureTile,
    onIndex,
    open: (index: number, rect?: Rect) => setViewer({ index, rect }),
    close: () => setViewer(null),
  };
}

type Props = {
  photos: readonly ViewerPhoto[];
  viewer: GalleryViewerState | null;
  onClose: () => void;
  onCloseStart?: () => void;
  reveal?: SharedValue<number>;
  onIndex?: (index: number) => void;
  onLoadMore?: () => void;
  info?: (id: string) => ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  author?: string;
  authorAvatarUrl?: string | null;
  onDelete?: (photo: ViewerPhoto) => void;
};

export function GalleryViewer({
  photos,
  viewer,
  onClose,
  onCloseStart,
  reveal,
  onIndex,
  onLoadMore,
  info,
  selected,
  onSelect,
  author,
  authorAvatarUrl,
  onDelete,
}: Props) {
  if (viewer === null) return null;
  return (
    <PhotoViewer
      photos={photos}
      initialIndex={viewer.index}
      origin={viewer.rect}
      onClose={onClose}
      onCloseStart={onCloseStart}
      reveal={reveal}
      onIndex={onIndex}
      onLoadMore={onLoadMore}
      renderInfo={info ? (index) => info(photos[index]?.id ?? '') : undefined}
      selected={selected}
      onSelect={onSelect}
      author={author}
      authorAvatarUrl={authorAvatarUrl}
      onDelete={onDelete}
    />
  );
}
