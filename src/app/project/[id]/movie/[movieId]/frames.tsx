import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadGallery, loadMovies } from '@/functionality';
import { montageItemIds } from '@/models';
import type { ProjectId } from '@/types/id';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
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
  const items = useMemo(() => {
    const ids = movie?.montage ? montageItemIds(movie.montage) : [];
    return ids.flatMap((itemId) => gallery.items.filter((item) => item.id === itemId).slice(0, 1));
  }, [gallery.items, movie]);

  const photos = useMemo<Photo[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
        video: item.kind === 'video',
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
      })),
    [items],
  );
  const viewer = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
        video: item.kind === 'video',
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
      })),
    [items],
  );

  const bar = (
    <AppBar
      boxed
      title={t('montage.movie.framesTitle')}
      left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
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
