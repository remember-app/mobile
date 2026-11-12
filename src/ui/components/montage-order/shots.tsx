import { useState } from 'react';
import { space } from '@/ui/theme';

import { type Photo, PhotoGrid, type Rect } from '../media/photo-grid';
import { PhotoViewer } from '../media/photo-viewer';
import type { ViewerPhoto } from '../media/viewer/types';
import { OrderPage } from './wizard';

export function ShotsPage({
  photos,
  viewerPhotos,
  selectedAt,
  ids,
  onToggle,
  onToggleRequired,
  width,
  height,
  bottom,
}: {
  photos: readonly Photo[];
  viewerPhotos: readonly ViewerPhoto[];
  selectedAt: ReadonlyMap<string, number>;
  ids: readonly string[];
  onToggle: (itemId: string) => void;
  onToggleRequired: (itemId: string) => void;
  width: number;
  height: number;
  bottom: number;
}) {
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);
  return (
    <>
      <OrderPage width={width} height={height}>
        <PhotoGrid
          photos={photos}
          onOpen={(index, rect) => setViewer({ index, rect })}
          onSelect={(index) => {
            const itemId = ids[index];
            if (itemId) onToggle(itemId);
          }}
          onRequire={(index) => {
            const itemId = ids[index];
            if (itemId) onToggleRequired(itemId);
          }}
          padding={{ top: space.s2, bottom }}
          blankIndex={viewer?.index ?? null}
        />
      </OrderPage>
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
          onIndex={(index) => setViewer((was) => (was === null ? was : { ...was, index }))}
          selected={selectedAt.has(ids[viewer.index] ?? '')}
          onSelect={() => {
            const itemId = ids[viewer.index];
            if (itemId) onToggle(itemId);
          }}
        />
      )}
    </>
  );
}
