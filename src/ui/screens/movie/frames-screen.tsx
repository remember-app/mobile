import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadLabels, loadMembers, loadMovies } from '@/functionality';
import { montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen, useGalleryScreen } from '@/ui/components/media/gallery-screen';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { useGallerySelection } from '@/ui/gallery-selection';
import { useGallery, useLabels, useMembers, useMovies } from '@/ui/hooks';
import { Board } from '@/ui/kit/chrome/bars';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { BackBar } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function MovieFramesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const selection = useGallerySelection<string>();
  const { filters, setFilters } = useGalleryFilters();

  useEffect(() => {
    void loadMovies(projectId);
    void loadGallery(projectId);
    void loadLabels(projectId).catch(() => undefined);
    void loadMembers(projectId).catch(() => undefined);
  }, [projectId]);

  const movie = movies.items.find((entry) => entry.id === movieId);
  const used = useMemo(
    () => new Set(movie?.montage?.journal.directing?.usedItemIds ?? []),
    [movie],
  );
  const items = useMemo(
    () => (movie?.montage ? filterItems(montageItems(movie.montage, gallery.items), filters) : []),
    [filters, gallery.items, movie],
  );

  const photos = useMemo<Photo[]>(
    () =>
      items.map((item) => ({
        ...tileOf(item),
        accent: used.has(item.id),
        selected: selection.has(item.id),
      })),
    [items, selection, used],
  );
  const viewer = useMemo(() => items.map(viewerOf), [items]);
  const galleryScreen = useGalleryScreen(photos, viewer, selection);

  const bar = <BackBar title={t('montage.movie.framesTitle')} />;

  if (photos.length === 0) {
    return <Board bar={bar} />;
  }

  return (
    <GalleryScreen
      photos={photos}
      viewerPhotos={viewer}
      viewer={galleryScreen.viewer}
      onOpen={galleryScreen.onOpen}
      onClose={galleryScreen.onClose}
      onIndex={galleryScreen.onIndex}
      measureRef={galleryScreen.measureTile}
      selection={selection}
      hud={{
        canSelect: true,
        onSelectingChange: (next) => {
          if (!next) selection.clear();
        },
        filters,
        onFiltersChange: setFilters,
        labels: labels.labels,
        members: members.members,
        bottom: insets.bottom + space.s3,
      }}
      padding={{ top: insets.top + 60, bottom: insets.bottom + space.s4 }}
      empty={<Board bar={bar} />}
      header={
        <BlurBar edge="top" style={styles.top}>
          {bar}
        </BlurBar>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    paddingHorizontal: 0,
  },
});
