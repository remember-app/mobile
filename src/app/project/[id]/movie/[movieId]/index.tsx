import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadMontages, loadMovies } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { fullDay } from '@/ui/format';
import { useMontages, useMovies } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { photo, radius, space, useTheme } from '@/ui/theme';

export default function MovieScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const montages = useMontages(projectId);
  const movie = movies.items.find((entry) => entry.id === movieId);
  const montage = movie ? montages.items.find((entry) => entry.id === movie.montageId) : undefined;
  const player = useVideoPlayer(movie?.videoUrl ?? null, (entry) => {
    entry.loop = false;
  });
  const view = useRef<VideoView>(null);

  useEffect(() => {
    void loadMovies(projectId);
    void loadMontages(projectId);
  }, [projectId]);

  if (!movie) {
    return (
      <Board>
        {movies.status === 'ready' ? (
          <Empty sign="dashed" title={t('montage.movie.unavailable')} />
        ) : (
          <View style={styles.centre}>
            <CircularSpinner size={40} />
          </View>
        )}
      </Board>
    );
  }

  const watch = () => {
    if (!movie.videoUrl) return;
    player.play();
    void view.current?.enterFullscreen();
  };

  return (
    <View style={styles.root}>
      <Board
        bar={
          <AppBar
            boxed
            title={movie.name}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
        body={{ paddingBottom: insets.bottom + 100 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('montage.movie.watch')}
          onPress={watch}
          style={[styles.poster, { backgroundColor: color.raise }]}
        >
          <VideoView
            ref={view}
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls
            onFullscreenExit={() => player.pause()}
          />
          {movie.posterUrl ? (
            <Image
              source={movie.posterUrl}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <View pointerEvents="none" style={styles.shade} />
          <View style={styles.play}>
            <Play size={30} color={color.onFill} fill={color.onFill} />
          </View>
        </Pressable>
        <View style={styles.body}>
          <Card style={styles.card}>
            <Text role="title" numberOfLines={2}>
              {movie.name}
            </Text>
            <Text role="meta" tone="muted">
              {fullDay(movie.createdAt)}
            </Text>
          </Card>
          {montage ? (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text role="row">{t('montage.movie.shots')}</Text>
                <Text role="rowPlain" tone="muted">
                  {montage.itemIds.length}
                </Text>
              </View>
            </Card>
          ) : null}
        </View>
      </Board>
      <ActionBar>
        <Button label={t('montage.movie.watch')} variant="primary" icon={Play} onPress={watch} />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  poster: {
    aspectRatio: 16 / 9,
    marginHorizontal: space.s5,
    marginTop: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.card,
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))',
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: photo.glass,
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s4,
  },
  card: {
    padding: space.s4,
    gap: space.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
