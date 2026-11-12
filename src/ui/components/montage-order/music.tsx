import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { songUrl } from '@/functionality';
import type { Song } from '@/models';
import type { SongId } from '@/types/id';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

import { OrderPage, OrderScroll } from './wizard';

const SONG_COVER = require('../../../../assets/images/song-cover.jpg');
const WAVE = [0.45, 0.75, 1, 0.7, 0.55];
const ON_PHOTO = '#ffffff';

export function MusicPage({
  songs,
  director,
  musicIds,
  onDirector,
  onSelect,
  width,
  height,
  top,
  bottom,
}: {
  songs: readonly Song[];
  director: boolean;
  musicIds: readonly string[];
  onDirector: (on: boolean) => void;
  onSelect: (mediaId: string) => void;
  width: number;
  height: number;
  top: number;
  bottom: number;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const [playingId, setPlayingId] = useState<SongId | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const togglePlay = async (song: Song) => {
    if (playingId === song.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = await songUrl(song.id);
      player.replace(url);
      player.play();
      setPlayingId(song.id);
    } catch {
      setPlayingId(null);
    }
  };

  useEffect(() => {
    if (playingId && status.didJustFinish) setPlayingId(null);
  }, [playingId, status.didJustFinish]);

  return (
    <OrderPage width={width} height={height}>
      <OrderScroll top={top} bottom={bottom}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: director }}
          onPress={() => onDirector(!director)}
        >
          <Card style={[styles.card, director ? { borderColor: color.accent } : null]}>
            <View style={styles.director}>
              <Text role="row">{t('montage.order.directorChoice')}</Text>
              <CheckMark on={director} />
            </View>
          </Card>
        </Pressable>
        <Card style={styles.card}>
          {songs.length === 0 ? (
            <Text role="meta" tone="muted">
              {t('montage.order.noMusicChoice')}
            </Text>
          ) : (
            songs.map((song) => (
              <TrackRow
                key={song.mediaId}
                song={song}
                on={!director && musicIds.includes(song.mediaId)}
                playing={playingId === song.id}
                onPlay={() => void togglePlay(song)}
                onSelect={() => onSelect(song.mediaId)}
              />
            ))
          )}
        </Card>
      </OrderScroll>
    </OrderPage>
  );
}

function TrackRow({
  song,
  on,
  playing,
  onPlay,
  onSelect,
}: {
  song: Song;
  on: boolean;
  playing: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={song.name}
        onPress={onPlay}
        style={styles.trackMain}
      >
        <View style={styles.art}>
          <Image
            source={song.coverUrl ?? SONG_COVER}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {playing ? (
            <>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.artShade]} />
              <Waveform />
            </>
          ) : null}
        </View>
        <View style={styles.trackWords}>
          <Text role="row" numberOfLines={1} style={playing ? { color: color.accentText } : null}>
            {song.name}
          </Text>
          <Text role="meta" tone="muted" numberOfLines={1}>
            {song.author}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={song.name}
        hitSlop={20}
        onPress={onSelect}
        style={styles.checkHit}
      >
        <CheckMark on={on} />
      </Pressable>
    </View>
  );
}

function Waveform() {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View pointerEvents="none" style={styles.wave}>
      {WAVE.map((height, index) => (
        <Bar
          key={index}
          height={height}
          tint={index === 2 ? color.accent : ON_PHOTO}
          delay={index * 90}
        />
      ))}
    </View>
  );
}

function Bar({ height, tint, delay }: { height: number; tint: string; delay: number }) {
  const styles = useStyles();
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, value]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.35 + value.value * 0.65 }],
  }));
  return (
    <Animated.View style={[styles.bar, { height: 24 * height, backgroundColor: tint }, style]} />
  );
}

function CheckMark({ on }: { on: boolean }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.check,
        {
          borderColor: on ? color.accent : color.line,
          backgroundColor: on ? color.accent : 'transparent',
        },
      ]}
    >
      {on ? <Check size={16} color={color.onFill} /> : null}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    card: {
      padding: space.s4,
      gap: space.s3,
    },
    director: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
    check: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
      paddingVertical: space.s1,
      paddingHorizontal: space.s2,
      borderRadius: radius.card,
    },
    trackMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    art: {
      width: 48,
      height: 48,
      borderRadius: radius.tile,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(128,128,128,0.25)',
    },
    artShade: {
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    wave: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    bar: {
      width: 4,
      borderRadius: 2,
    },
    trackWords: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    checkHit: {
      padding: space.s1,
    },
  }),
);
