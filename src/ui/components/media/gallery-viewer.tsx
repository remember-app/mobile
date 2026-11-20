import type { ReactNode } from 'react';

import type { GallerySelection } from '@/ui/gallery-selection';

import type { Rect } from './photo-grid';
import { PhotoViewer, type ViewerPhoto } from './photo-viewer';
import { type PhotoViewerState, usePhotoViewer } from './use-photo-viewer';

export type GalleryViewerState = PhotoViewerState;

export function useGalleryViewer() {
  const state = usePhotoViewer();
  return {
    ...state,
    open: (index: number, rect?: Rect) => state.setViewer({ index, rect }),
    close: () => state.setViewer(null),
  };
}

type Props = {
  photos: readonly ViewerPhoto[];
  viewer: GalleryViewerState | null;
  onClose: () => void;
  onIndex?: (index: number) => void;
  onLoadMore?: () => void;
  selection?: GallerySelection<string>;
  onSelect?: (index: number) => void;
  info?: (index: number) => ReactNode;
  author?: string;
  authorAvatarUrl?: string | null;
  onDelete?: (photo: ViewerPhoto) => void;
};

export function GalleryViewer({
  photos,
  viewer,
  onClose,
  onIndex,
  onLoadMore,
  selection,
  onSelect,
  info,
  author,
  authorAvatarUrl,
  onDelete,
}: Props) {
  if (viewer === null) return null;
  const id = photos[viewer.index]?.id;
  return (
    <PhotoViewer
      photos={photos}
      initialIndex={viewer.index}
      origin={viewer.rect}
      onClose={onClose}
      onIndex={onIndex}
      onLoadMore={onLoadMore}
      renderInfo={info}
      author={author}
      authorAvatarUrl={authorAvatarUrl}
      onDelete={onDelete}
      selected={selection && id ? selection.has(id) : undefined}
      onSelect={
        selection && id
          ? onSelect
            ? () => onSelect(viewer.index)
            : () => selection.toggle(id)
          : undefined
      }
    />
  );
}
