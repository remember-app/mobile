import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BookOpen, HardDrive, Monitor, Play } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMembers, loadMovies } from '@/functionality';
import { montageItemIds } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { MontageConfigCard, VideoDetailsCard } from '@/ui/components/movie-blocks';
import { fullDay, megabytes } from '@/ui/format';
import { useGallery, useMembers, useMovies } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { photo, radius, space, useTheme } from '@/ui/theme';

type Track = { mediaId: string; name?: string; author?: string };

export default function MovieScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const members = useMembers(projectId);
  const gallery = useGallery(projectId);
  const movie = movies.items.find((entry) => entry.id === movieId);
  const player = useVideoPlayer(movie?.videoUrl ?? null, (entry) => {
    entry.loop = false;
  });
  const view = useRef<VideoView>(null);

  useEffect(() => {
    void loadMovies(projectId, true).catch(() => undefined);
    void loadMembers(projectId);
    void loadGallery(projectId).catch(() => undefined);
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

  const member = members.members.find((entry) => entry.userId === movie.createdBy);
  const author = member?.name?.trim() || member?.username || null;
  const video = movie.video;
  const settings = movie.montage?.manifest.preparationConfig ?? null;
  const ids = movie.montage ? montageItemIds(movie.montage) : [];
  const chosen = ids.flatMap((itemId) =>
    gallery.items.filter((item) => item.id === itemId).slice(0, 1),
  );
  const report = movie.montage?.manifest.directingInput?.mergedMontageData as
    | { music?: Track[] }
    | undefined;
  const allowed = settings?.musicIds ?? [];
  const tracks = allowed.map((mediaId) => report?.music?.find((one) => one.mediaId === mediaId));
  const frames = () =>
    router.navigate({
      pathname: '/project/[id]/movie/[movieId]/frames',
      params: { id: projectId, movieId: movie.id },
    });

  return (
    <View style={styles.root}>
      <Board
        bar={
          <AppBar
            boxed
            title={movie.name}
            left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
            right={
              <IconButton
                icon={BookOpen}
                label={t('montage.journal.title')}
                tone="surface"
                size={44}
                onPress={() =>
                  router.navigate({
                    pathname: '/project/[id]/montage/[montageId]/journal',
                    params: { id: projectId, montageId: movie.montageId },
                  })
                }
              />
            }
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
          <MontageConfigCard
            prompt={settings?.prompt ?? null}
            items={chosen}
            music={tracks.map((track, at) => ({
              id: track?.mediaId ?? allowed[at] ?? '',
              name: track?.name,
              author: track?.author,
            }))}
            onFrames={frames}
          />
          <VideoDetailsCard
            durationSeconds={video?.durationSeconds}
            meta={[fullDay(movie.createdAt), ...(author ? [author] : [])]}
            chips={[
              ...(video?.width && video.height
                ? [{ icon: Monitor, text: `${video.width} × ${video.height}` }]
                : []),
              ...(video ? [{ icon: HardDrive, text: megabytes(video.bytes) }] : []),
            ]}
          />
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
    gap: space.s4,
  },
  files: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  thumbs: {
    flexDirection: 'row',
    gap: space.s1,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  music: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  tracks: {
    flexShrink: 1,
    gap: 2,
  },
  fileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderRadius: radius.pill,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
