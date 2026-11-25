import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  BookOpen,
  Calendar,
  Clock,
  HardDrive,
  Play,
  RectangleHorizontal,
  RectangleVertical,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMembers, loadMovies } from '@/functionality';
import { cachedUrl, keepUrl } from '@/integrations/files/media-cache';
import { itemSource, montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { LoadError } from '@/ui/components/feedback/load-error';
import {
  type FactItem,
  Facts,
  FramesCard,
  MusicCard,
  PromptCard,
} from '@/ui/components/montage/order/blocks';
import { duration, numericDay } from '@/ui/format';
import { useGallery, useMembers, useMovies } from '@/ui/hooks';
import { Board } from '@/ui/kit/chrome/bars';
import { BottomSheet } from '@/ui/kit/chrome/bottom-sheet';
import { ActionBar } from '@/ui/kit/controls/action-bar';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { Empty } from '@/ui/kit/display/empty';
import { Avatar } from '@/ui/kit/primitives/avatar';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar } from '@/ui/screens/chrome';
import { photo, radius, space, useTheme } from '@/ui/theme';

type Track = { mediaId: string; name?: string; author?: string };

export default function MovieScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const members = useMembers(projectId);
  const gallery = useGallery(projectId);
  const movie = movies.items.find((entry) => entry.id === movieId);
  const videoUrl = movie?.videoUrl ?? null;
  const videoLocal = videoUrl ? cachedUrl(videoUrl, projectId) : null;
  const player = useVideoPlayer(videoLocal ?? videoUrl, (entry) => {
    entry.loop = false;
  });
  const view = useRef<VideoView>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const hadMovie = useRef(movies.items.some((entry) => entry.id === movieId));

  useEffect(() => {
    if (!hadMovie.current) void loadMovies(projectId, true).catch(() => undefined);
    void loadMembers(projectId);
    void loadGallery(projectId).catch(() => undefined);
  }, [projectId]);

  if (!movie) {
    return (
      <Board bar={<BackBar title={t('montage.movie.title')} />}>
        {movies.status === 'error' ? (
          <LoadError onRetry={() => void loadMovies(projectId, true)} />
        ) : movies.status === 'ready' ? (
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

  const download = async () => {
    if (!videoUrl || downloading) return;
    setDownloading(true);
    try {
      const local = cachedUrl(videoUrl, projectId) ?? (await keepUrl(videoUrl, projectId));
      if (!local) return;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(local, { mimeType: 'video/mp4' });
      }
    } finally {
      setDownloading(false);
    }
  };

  const member = members.members.find((entry) => entry.userId === movie.createdBy);
  const video = movie.video;
  const settings = movie.montage?.manifest.preparationConfig ?? null;
  const chosen = movie.montage ? montageItems(movie.montage, gallery.items) : [];
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
    { icon: Calendar, value: numericDay(movie.createdAt) },
    ...(video ? [{ icon: HardDrive, value: (video.bytes / 1024 ** 3).toFixed(2) }] : []),
  ];
  const openFrames = () =>
    router.navigate({
      pathname: '/project/[id]/movie/[movieId]/frames',
      params: { id: projectId, movieId: movie.id },
    });
  const openMusic = () =>
    router.navigate({
      pathname: '/project/[id]/movie/[movieId]/music',
      params: { id: projectId, movieId: movie.id },
    });

  return (
    <View style={styles.root}>
      <Board
        bar={
          <BackBar
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
          onPress={movie.videoUrl ? watch : undefined}
          style={[styles.poster, { width: width - space.s2 * 2, backgroundColor: color.raise }]}
        >
          {movie.videoUrl ? (
            <>
              <VideoView
                ref={view}
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls
                onFullscreenExit={() => player.pause()}
              />
              {movie.posterUrl ? (
                <Image
                  source={movie.posterUrl}
                  group={movie.projectId}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null}
              <View pointerEvents="none" style={styles.shade} />
              <View style={styles.play}>
                <Play size={30} color={color.onFill} fill={color.onFill} />
              </View>
            </>
          ) : (
            <Image
              source={require('../../../../assets/logo/logo-heart-7-complete.png')}
              style={styles.logo}
              contentFit="contain"
            />
          )}
          {member ? (
            <View style={styles.creator}>
              <Avatar
                name={member.name}
                username={member.username}
                size={32}
                uri={member.avatarUrl}
              />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.body}>
          <Facts items={facts} />
          <MusicCard
            songs={music}
            group={projectId}
            onPress={music.length > 1 ? openMusic : undefined}
          />
          <PromptCard prompt={settings?.prompt ?? null} onOpen={() => setPromptOpen(true)} />
          {frameUrls.length > 0 ? (
            <FramesCard frames={frameUrls} group={projectId} onPress={openFrames} />
          ) : null}
        </View>
      </Board>

      <ActionBar>
        <Button
          label={downloading ? t('montage.movie.downloading') : t('montage.movie.download')}
          variant="primary"
          disabled={!videoUrl || downloading}
          onPress={() => void download()}
        />
      </ActionBar>
      <BottomSheet visible={promptOpen} onClose={() => setPromptOpen(false)}>
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
    alignSelf: 'center',
    marginTop: space.s4,
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
  logo: {
    width: 160,
    height: 160,
  },
  creator: {
    position: 'absolute',
    left: space.s3,
    top: space.s3,
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
