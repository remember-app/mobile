import { type MutableRefObject, type ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { Label, Member } from '@/models';
import type { GallerySelection } from '@/ui/gallery-selection';
import type { GalleryFilterFields, GalleryFiltersValue } from '../gallery/gallery-filters';
import type { GalleryPrimary } from '../gallery/gallery-hud';
import { GalleryHud } from '../gallery/gallery-hud';
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
  selectionDefault?: boolean;
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
  onIndex?: (index: number) => void;
  measureRef?: MutableRefObject<MeasureTile | null>;
  onLoadMore?: () => void;
  onScroll?: (offset: number) => void;
  onSelect?: (index: number) => void;
  onRequire?: (index: number) => void;
  padding: { top: number; bottom: number };
  selection?: GallerySelection<string>;
  info?: (index: number) => ReactNode;
  author?: string;
  authorAvatarUrl?: string | null;
  onDelete?: (photo: ViewerPhoto) => void;
  loading?: ReactNode;
  empty?: ReactNode;
  header?: ReactNode;
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
    viewerOpen: viewer !== null,
    selectionDefault: hud?.selectionDefault,
    canSelect: Boolean(hud?.canSelect),
  });
  const selecting = hud ? chrome.selecting : Boolean(onSelect);
  const selectingChange = useRef(hud?.onSelectingChange);
  selectingChange.current = hud?.onSelectingChange;
  useEffect(() => {
    selectingChange.current?.(chrome.selecting);
  }, [chrome.selecting]);
  const shownPhotos =
    hud && !selecting ? photos.map((photo) => ({ ...photo, selected: undefined })) : photos;

  if (loading) return <>{loading}</>;
  if (photos.length === 0) return <>{empty ?? null}</>;
  return (
    <View style={styles.root}>
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
      {header}
      {footer}
      <GalleryViewer
        photos={viewerPhotos}
        viewer={viewer}
        onClose={onClose}
        onIndex={onIndex}
        onLoadMore={onLoadMore}
        selection={selecting ? selection : undefined}
        onSelect={selecting ? onSelect : undefined}
        info={info}
        author={author}
        authorAvatarUrl={authorAvatarUrl}
        onDelete={onDelete}
      />
      {hud ? (
        <GalleryHud
          chrome={chrome.chrome}
          filterAnim={chrome.filterAnim}
          actionsOpen={chrome.actionsOpen}
          hidden={chrome.hidden}
          filtering={chrome.filtering}
          onFilterToggle={() => chrome.setFiltering((was) => !was)}
          filters={hud.filters}
          labels={hud.labels ?? []}
          members={hud.members ?? []}
          filterFields={hud.filterFields}
          onFiltersChange={hud.onFiltersChange}
          primary={hud.primary}
          selecting={chrome.selecting}
          canSelect={Boolean(hud.canSelect)}
          onSelectingToggle={chrome.toggleSelecting}
          selectionTools={hud.selectionTools}
          renderSelectionActions={hud.renderSelectionActions}
          bottom={hud.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
