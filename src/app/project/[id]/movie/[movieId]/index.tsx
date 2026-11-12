import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  BookOpen,
  Clock,
  HardDrive,
  Images,
  Play,
  RectangleHorizontal,
  RectangleVertical,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMembers, loadMovies } from '@/functionality';
import { itemSource, montageItemIds, montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import {
  type FactItem,
  Facts,
  FramesCard,
  MusicCard,
  PromptCard,
} from '@/ui/components/montage-order/blocks';
import { duration, fullDay, megabytes } from '@/ui/format';
import { useGallery, useMembers, useMovies } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { Board } from '@/ui/kit/bars';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button, IconButton } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { BackBar } from '@/ui/screens/chrome';
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
  const [promptOpen, setPromptOpen] = useState(false);

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
  const chosen = movie.montage ? montageItems(movie.montage, gallery.items) : [];
  const ids = movie.montage ? montageItemIds(movie.montage) : [];
  const frameUrls = chosen.map(itemSource).filter((url): url is string => url !== null);
  const report = movie.montage?.manifest.directingInput?.mergedMontageData as
    | { music?: Track[] }
    | undefined;
  const allowed = settings?.musicIds ?? [];
  const tracks = allowed.map((mediaId) => report?.music?.find((one) => one.mediaId === mediaId));
  const music = tracks.flatMap((track, at) => {
    const mediaId = track?.mediaId ?? allowed[at];
    if (!mediaId) return [];
    return [{ name: track?.name ?? mediaId, author: track?.author ?? '', coverUrl: null }];
  });
  const wide = settings ? settings.dimensions.width >= settings.dimensions.height : true;
  const facts: FactItem[] = [
    ...(video?.durationSeconds != null
      ? [{ icon: Clock, value: duration(video.durationSeconds) }]
      : []),
    ...(settings
      ? [
          {
            icon: wide ? RectangleHorizontal : RectangleVertical,
            value: wide ? '16:9' : '9:16',
          },
        ]
      : []),
    ...(ids.length > 0 ? [{ icon: Images, value: String(ids.length) }] : []),
    ...(video ? [{ icon: HardDrive, value: megabytes(video.bytes) }] : []),
  ];
  const resolution = video?.width && video.height ? `${video.width} × ${video.height}` : null;
  const meta = [fullDay(movie.createdAt), author, resolution].filter(Boolean).join(' · ');
  const openFrames = () =>
    router.navigate({
      pathname: '/project/[id]/movie/[movieId]/frames',
      params: { id: projectId, movieId: movie.id },
    });

  return (
    <View style={styles.root}>
      <Board
        bar={
          <BackBar
            boxed
            title={movie.name}
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
          <Facts items={facts} />
          {meta ? (
            <Text role="meta" tone="muted">
              {meta}
            </Text>
          ) : null}
          <MusicCard songs={music} />
          <PromptCard prompt={settings?.prompt ?? null} onOpen={() => setPromptOpen(true)} />
          {ids.length > 0 ? (
            <FramesCard frames={frameUrls} count={ids.length} onPress={openFrames} />
          ) : null}
        </View>
      </Board>

      <ActionBar>
        <Button label={t('montage.movie.watch')} variant="primary" icon={Play} onPress={watch} />
      </ActionBar>
      <BottomSheet
        visible={promptOpen}
        onClose={() => setPromptOpen(false)}
        title={t('montage.movie.prompt')}
      >
        <Text role="body">{settings?.prompt ?? ''}</Text>
      </BottomSheet>
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
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
