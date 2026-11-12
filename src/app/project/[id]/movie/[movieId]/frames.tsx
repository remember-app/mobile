import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMovies } from '@/functionality';
import { montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useGallery, useMovies } from '@/ui/hooks';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { space, useTheme } from '@/ui/theme';

export default function MovieFramesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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
  const items = useMemo(
    () => (movie?.montage ? montageItems(movie.montage, gallery.items) : []),
    [gallery.items, movie],
  );

  const photos = useMemo<Photo[]>(() => items.map(tileOf), [items]);
  const viewer = useMemo(() => items.map(viewerOf), [items]);

  const bar = (
    <AppBar
      boxed
      title={t('montage.movie.framesTitle')}
      left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
    />
  );

  if (photos.length === 0) {
    return <Board bar={bar}>{movies.status === 'ready' ? <Empty sign="dashed" /> : null}</Board>;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
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
