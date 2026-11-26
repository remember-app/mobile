import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, TriangleExclamationPoint } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  loadGallery,
  loadLibrarySongs,
  loadMontages,
  loadMovies,
  loadProjectSongs,
  loadProjects,
  retryMontage,
} from '@/functionality';
import {
  itemThumb,
  montageItemIds,
  montageItems,
  montageRunning,
  montageStage,
  movieOfMontage,
  songPool,
} from '@/models';
import type { ProjectId } from '@/types/id';
import {
  MontageBackdrop,
  MontageConfigCard,
  VideoDetailsCard,
} from '@/ui/components/montage/movie-blocks';
import { stageLabel } from '@/ui/components/montage/stages';
import {
  useGallery,
  useLibrarySongs,
  useMontagePolling,
  useMontages,
  useMovies,
  useProjectCard,
  useProjectSongs,
} from '@/ui/hooks';
import { Board } from '@/ui/kit/chrome/bars';
import { ActionBar } from '@/ui/kit/controls/action-bar';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { Empty } from '@/ui/kit/display/empty';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar } from '@/ui/screens/chrome';
import { radius, space, useTheme } from '@/ui/theme';

export default function MontageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const montages = useMontages(projectId);
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);
  const projectSongs = useProjectSongs(projectId);
  const library = useLibrarySongs();
  const montage = montages.items.find((entry) => entry.id === montageId);
  const running = montageRunning(montage);
  useMontagePolling(projectId, running);
  const fetchedMovie = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProjects();
    void loadMontages(projectId);
    void loadMovies(projectId);
    void loadGallery(projectId);
    void loadProjectSongs(projectId);
    void loadLibrarySongs();
  }, [projectId]);

  const movie =
    montage && montage.status === 'done' ? movieOfMontage(movies.items, montage.id) : undefined;
  const movieId = movie?.id ?? null;

  useEffect(() => {
    if (montage?.status !== 'done' || fetchedMovie.current) return;
    fetchedMovie.current = true;
    void loadMovies(projectId, true).catch(() => undefined);
  }, [montage?.status, projectId]);

  useEffect(() => {
    if (!movieId) return;
    router.replace({
      pathname: '/project/[id]/movie/[movieId]',
      params: { id: projectId, movieId },
    });
  }, [movieId, projectId, router]);

  const journal = () =>
    router.navigate({
      pathname: '/project/[id]/montage/[montageId]/journal',
      params: { id: projectId, montageId },
    });

  const heading =
    montage?.manifest.preparationConfig?.name?.trim() || project?.title || t('montage.waiting');

  const bar = (
    <BackBar
      title={heading}
      right={
        <IconButton
          icon={BookOpen}
          label={t('montage.journal.title')}
          tone="surface"
          size={44}
          onPress={journal}
        />
      }
    />
  );

  if (!montage) {
    return (
      <Board bar={bar}>
        {montages.status === 'ready' ? <Empty sign="dashed" title={t('montage.notFound')} /> : null}
      </Board>
    );
  }

  const settings = montage.manifest.preparationConfig;
  const ids = montageItemIds(montage);
  const chosen = montageItems(montage, gallery.items);
  const songs = songPool(projectSongs.items, library.items);
  const music = (settings?.musicIds ?? []).flatMap((mediaId) => {
    const song = songs.find((entry) => entry.originalId === mediaId);
    return song ? [song] : [];
  });
  const frames = chosen.map(itemThumb).filter((source): source is string => Boolean(source));
  const failed = montage.status === 'failed';
  const wide = settings ? settings.dimensions.width >= settings.dimensions.height : false;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await retryMontage(projectId, montage.id);
      await loadMontages(projectId, true);
    } catch {
      setError(t('montage.order.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Board bar={bar} body={{ paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.poster, { backgroundColor: color.raise }]}>
          <MontageBackdrop frames={frames} seed={montage.id} cycling={!failed} />
          {failed ? (
            <TriangleExclamationPoint size={40} color={color.danger} />
          ) : (
            <CircularSpinner size={44} stroke={3} />
          )}
          <Text role="title" tone={frames.length > 0 ? 'onFill' : undefined} style={styles.stage}>
            {failed ? t('montage.failed') : t(stageLabel(montageStage(montage)))}
          </Text>
          {failed && montage.error ? (
            <Text
              role="meta"
              tone={frames.length > 0 ? 'onFill' : 'muted'}
              numberOfLines={4}
              style={styles.reason}
            >
              {montage.error}
            </Text>
          ) : null}
        </View>
        <View style={styles.body}>
          <MontageConfigCard
            prompt={settings?.prompt ?? null}
            items={chosen}
            music={music.map((song) => ({
              id: song.originalId,
              name: song.name,
              author: song.author,
            }))}
          />
          <VideoDetailsCard
            durationSeconds={settings?.targetSeconds}
            chips={[
              { text: wide ? t('montage.order.horizontal') : t('montage.order.vertical') },
              {
                text: `${t('montage.order.shotsTitle')}: ${
                  gallery.status === 'ready' ? chosen.length : ids.length
                }`,
              },
            ]}
          />
          {error ? (
            <Text role="body" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Board>
      <ActionBar>
        {failed ? (
          <Button
            label={t('montage.retry')}
            variant="primary"
            disabled={busy}
            onPress={() => void retry()}
          />
        ) : (
          <Button
            label={t('montage.journal.open')}
            variant="primary"
            icon={BookOpen}
            onPress={journal}
          />
        )}
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
    gap: space.s3,
    paddingHorizontal: space.s5,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  stage: {
    textAlign: 'center',
  },
  reason: {
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s4,
  },
});
