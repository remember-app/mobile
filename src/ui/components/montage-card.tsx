import { Image } from 'expo-image';
import type { useRouter } from 'expo-router';
import { Play, TriangleExclamationPoint } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { loadGallery } from '@/functionality';
import { itemSource, type Montage, type Movie, montageItems, montageStage } from '@/models';
import type { ProjectId } from '@/types/id';
import { MontageBackdrop } from '@/ui/components/movie-blocks';
import { useGallery } from '@/ui/hooks';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Text } from '@/ui/kit/text';
import { photo, radius, space, themed, useTheme } from '@/ui/theme';

const STAGE = {
  analysis: 'montage.stage.analysis',
  preparation: 'montage.stage.preparation',
  directing: 'montage.stage.directing',
  editing: 'montage.stage.editing',
} as const;

type AppRouter = ReturnType<typeof useRouter>;

export function openMontage(
  router: AppRouter,
  projectId: ProjectId,
  montage: Montage,
  movie?: Movie,
): void {
  if (montage.status === 'done' && movie) {
    router.navigate({
      pathname: '/project/[id]/movie/[movieId]',
      params: { id: projectId, movieId: movie.id },
    });
    return;
  }
  router.navigate({
    pathname: '/project/[id]/montage/[montageId]',
    params: { id: projectId, montageId: montage.id },
  });
}

export function MontageCard({
  montage,
  movie,
  wide,
  play = true,
  onPress,
}: {
  montage: Montage;
  movie?: Movie;
  wide?: boolean;
  play?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const gallery = useGallery(montage.projectId);
  const finished = montage.status === 'done';
  const failed = montage.status === 'failed';
  const poster = finished ? (movie?.posterUrl ?? null) : null;
  const frames = montageItems(montage, gallery.items)
    .map(itemSource)
    .filter((source): source is string => Boolean(source));

  useEffect(() => {
    if (gallery.items.length === 0) void loadGallery(montage.projectId);
  }, [gallery.items.length, montage.projectId]);

  const label = finished
    ? (movie?.name ?? t('montage.movie.title'))
    : failed
      ? t('montage.failed')
      : t(STAGE[montageStage(montage)]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.card, wide ? styles.wide : styles.square]}
    >
      {poster ? (
        <Image
          source={poster}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      {finished ? (
        <>
          <View pointerEvents="none" style={[styles.shade, styles.shadeBottom]} />
          {play ? (
            <View style={[styles.play, wide ? styles.playWide : null]}>
              <Play size={wide ? 28 : 20} color={color.onFill} fill={color.onFill} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <MontageBackdrop frames={frames} seed={montage.id} cycling={!failed} />
          <View style={styles.status}>
            {failed ? (
              <TriangleExclamationPoint size={wide ? 30 : 22} color={color.danger} />
            ) : (
              <CircularSpinner size={wide ? 30 : 22} stroke={2} />
            )}
          </View>
        </>
      )}
      <View style={[styles.words, wide ? styles.wordsWide : null]}>
        <Text
          role={wide ? 'row' : 'noteSm'}
          tone={poster || frames.length > 0 ? 'onFill' : failed ? 'danger' : 'paper'}
          numberOfLines={wide ? 1 : 2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      overflow: 'hidden',
      borderRadius: radius.card,
      backgroundColor: color.raise,
    },
    square: { aspectRatio: 1, width: '100%' },
    wide: { aspectRatio: 16 / 9, width: '100%' },
    shade: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: '60%',
    },
    shadeBottom: {
      bottom: 0,
      experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))',
    },
    play: {
      position: 'absolute',
      alignSelf: 'center',
      top: '50%',
      marginTop: -20,
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: photo.glass,
    },
    playWide: {
      width: 56,
      height: 56,
      marginTop: -28,
    },
    status: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    words: {
      position: 'absolute',
      left: space.s2,
      right: space.s2,
      bottom: space.s2,
    },
    wordsWide: {
      left: space.s4,
      right: space.s4,
      bottom: space.s3,
    },
  }),
);
