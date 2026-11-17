import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMovies } from '@/functionality';
import { montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useGallery, useMovies } from '@/ui/hooks';
import { Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackBar } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function MovieFramesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);

  useEffect(() => {
    void loadMovies(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  const movie = movies.items.find((entry) => entry.id === movieId);
  const used = useMemo(
    () =>
      new Set(
        movie?.montage ? montageItems(movie.montage, gallery.items).map((item) => item.id) : [],
      ),
    [gallery.items, movie],
  );
  const items = useMemo(() => {
    const ids = movie?.montage?.manifest.preparationConfig?.includeItemIds ?? [];
    const byId = new Map(gallery.items.map((item) => [item.id, item]));
    const all = ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    if (all.length > 0) return all;
    return movie?.montage ? montageItems(movie.montage, gallery.items) : [];
  }, [gallery.items, movie]);

  const photos = useMemo<Photo[]>(
    () => items.map((item) => ({ ...tileOf(item), accent: used.has(item.id) })),
    [items, used],
  );
  const viewer = useMemo(() => items.map(viewerOf), [items]);

  const bar = <BackBar title={t('montage.movie.framesTitle')} />;

  if (photos.length === 0) {
    return <Board bar={bar} />;
  }

  return (
    <View style={styles.root}>
      <PhotoGrid
        photos={photos}
        onOpen={(index, rect) => setOpen({ index, rect })}
        padding={{ top: insets.top + 60, bottom: insets.bottom + space.s4 }}
        blankIndex={open?.index ?? null}
      />
      <BlurBar edge="top" style={styles.top}>
        {bar}
      </BlurBar>
      {open === null ? null : (
        <PhotoViewer
          photos={viewer}
          initialIndex={open.index}
          origin={open.rect}
          onClose={() => setOpen(null)}
        />
      )}
    </View>
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
