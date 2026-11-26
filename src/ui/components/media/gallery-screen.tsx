import { type MutableRefObject, type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

import type { Label, Member } from '@/models';
import type { GallerySelection } from '@/ui/gallery-selection';
import type { GalleryFilterFields, GalleryFiltersValue } from '../gallery/gallery-filters';
import type { GalleryPrimary } from '../gallery/gallery-hud';
import { GalleryHud } from '../gallery/gallery-hud';
import { GalleryLayer } from '../gallery/gallery-layer';
import { useGalleryChrome } from '../gallery/use-gallery-chrome';
import { GalleryViewer, type GalleryViewerState, useGalleryViewer } from './gallery-viewer';
import type { MeasureTile, Photo, Rect } from './photo-grid';
import { PhotoGrid } from './photo-grid';
import type { ViewerPhoto } from './photo-viewer';

export function useGalleryScreen(
  photos: readonly Photo[],
  viewerPhotos: readonly ViewerPhoto[],
  selection?: GallerySelection<string>,
) {
  const viewer = useGalleryViewer();
  return {
    ...viewer,
    viewerPhotos,
    onOpen: (index: number, rect?: Rect) => viewer.open(index, rect),
    onClose: viewer.close,
    onSelect: selection
      ? (index: number) => {
          const photo = photos[index];
          if (photo) selection.toggle(photo.id);
        }
      : undefined,
  };
}

export type GalleryHudConfig = {
  primary?: GalleryPrimary;
  showWhenEmpty?: boolean;
  keepPrimary?: boolean;
  rightButtons?: number;
  selectionDefault?: boolean;
  selecting?: boolean;
  canSelect?: boolean;
  onSelectingChange?: (selecting: boolean) => void;
  selectionTools?: ReactNode;
  renderSelectionActions?: (progress: SharedValue<number>) => ReactNode;
  bottom: number;
  filters: GalleryFiltersValue;
  onFiltersChange: (value: GalleryFiltersValue) => void;
  labels?: Label[];
  members?: Member[];
  filterFields?: GalleryFilterFields;
};

type Props = {
  photos: readonly Photo[];
  viewerPhotos: readonly ViewerPhoto[];
  viewer: GalleryViewerState | null;
  onOpen: (index: number, rect?: Rect) => void;
  onClose: () => void;
  onCloseStart?: () => void;
  onIndex?: (index: number) => void;
  measureRef?: MutableRefObject<MeasureTile | null>;
  onLoadMore?: () => void;
  onScroll?: (offset: number) => void;
  onSelect?: (index: number) => void;
  onRequire?: (index: number) => void;
  padding: { top: number; bottom: number };
  selection?: GallerySelection<string>;
  info?: (id: string) => ReactNode;
  author?: string;
  authorAvatarUrl?: string | null;
  onDelete?: (photo: ViewerPhoto) => void;
  loading?: ReactNode;
  empty?: ReactNode;
  header?: ReactNode | ((progress: SharedValue<number>) => ReactNode);
  footer?: ReactNode;
  emptyMark?: boolean;
  hud?: GalleryHudConfig;
};

export function GalleryScreen({
  photos,
  viewerPhotos,
  viewer,
  onOpen,
  onClose,
  onCloseStart,
  onIndex,
  measureRef,
  onLoadMore,
  onScroll,
  onSelect,
  onRequire,
  padding,
  selection,
  info,
  author,
  authorAvatarUrl,
  onDelete,
  loading,
  empty,
  header,
  footer,
  emptyMark,
  hud,
}: Props) {
  const chrome = useGalleryChrome({
    selectionDefault: hud?.selectionDefault,
    canSelect: Boolean(hud?.canSelect),
    selecting: hud?.selecting,
    onSelectingChange: hud?.onSelectingChange,
  });
  const selecting = hud ? chrome.selecting : Boolean(onSelect);
  const shownPhotos =
    hud && !selecting ? photos.map((photo) => ({ ...photo, selected: undefined })) : photos;
  const viewingIndex = viewer === null ? -1 : viewer.index;
  const viewing = viewingIndex < 0 ? undefined : viewerPhotos[viewingIndex];
  // Своё место экран занимает уже во время закрытия просмотрщика: он проявляется под
  // уезжающим кадром, а не возникает после того, как тот исчез.
  const [closing, setClosing] = useState(false);
  const reveal = useSharedValue(1);
  useEffect(() => {
    if (viewer === null) setClosing(false);
  }, [viewer]);
  const chromeLayer = (
    <GalleryLayer hidden={viewer !== null && !closing} reveal={reveal}>
      {typeof header === 'function' ? header(chrome.chrome) : header}
      {footer}
    </GalleryLayer>
  );

  return (
    <View style={styles.root}>
      {loading ? (
        loading
      ) : photos.length === 0 ? (
        (empty ?? null)
      ) : (
        <PhotoGrid
          photos={shownPhotos}
          onOpen={onOpen}
          onSelect={selecting ? onSelect : undefined}
          onRequire={onRequire}
          padding={padding}
          blankIndex={viewer?.index ?? null}
          measureRef={measureRef}
          emptyMark={emptyMark}
          onLoadOlder={onLoadMore}
          onScroll={
            hud
              ? (offset) => {
                  chrome.onScroll(offset);
                  onScroll?.(offset);
                }
              : onScroll
          }
        />
      )}
      {chromeLayer}
      {hud && !loading && (photos.length > 0 || hud.showWhenEmpty) ? (
        <GalleryHud
          chrome={chrome.chrome}
          filterAnim={chrome.filterAnim}
          actionsOpen={chrome.actionsOpen}
          hidden={viewer !== null && !closing}
          reveal={reveal}
          filtering={chrome.filtering}
          onFilterToggle={() => chrome.setFiltering((was) => !was)}
          filters={hud.filters}
          labels={hud.labels ?? []}
          members={hud.members ?? []}
          filterFields={hud.filterFields}
          onFiltersChange={hud.onFiltersChange}
          primary={hud.primary}
          keepPrimary={hud.keepPrimary}
          rightButtons={hud.rightButtons}
          selecting={chrome.selecting}
          canSelect={Boolean(hud.canSelect)}
          onSelectingToggle={chrome.toggleSelecting}
          selectionTools={hud.selectionTools}
          renderSelectionActions={hud.renderSelectionActions}
          bottom={hud.bottom}
        />
      ) : null}
      <GalleryViewer
        photos={viewerPhotos}
        viewer={viewer}
        onClose={onClose}
        onCloseStart={() => {
          setClosing(true);
          onCloseStart?.();
        }}
        reveal={reveal}
        onIndex={onIndex}
        onLoadMore={onLoadMore}
        selected={selecting && viewing ? selection?.has(viewing.id) : undefined}
        onSelect={
          selecting && viewing
            ? onSelect
              ? () => onSelect(viewingIndex)
              : () => selection?.toggle(viewing.id)
            : undefined
        }
        info={info}
        author={author}
        authorAvatarUrl={authorAvatarUrl}
        onDelete={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
