import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Music, Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { songUrl } from '@/functionality';
import { cachedUrl, keepUrl } from '@/integrations/files/media-cache';
import type { Song } from '@/models';
import type { SongId } from '@/types/id';
import { duration as clock } from '@/ui/format';
import { IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export type SongPlayer = {
  song: Song | null;
  playing: boolean;
  loading: boolean;
  position: number;
  total: number;
  play: (song: Song) => Promise<void>;
};

export function useSongPlayer(options?: {
  onDuration?: (songId: SongId, seconds: number) => void;
}): SongPlayer {
  const [source, setSource] = useState<string | null>(null);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [song, setSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const urls = useRef(new Map<SongId, string>());
  const learn = useRef(options?.onDuration);
  learn.current = options?.onDuration;

  useEffect(() => {
    if (playing && status.isLoaded) player.play();
  }, [playing, status.isLoaded, player]);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(false);
  }, [status.didJustFinish]);

  useEffect(() => {
    if (song !== null && status.isLoaded && status.duration > 0) {
      learn.current?.(song.id, status.duration);
    }
  }, [song, status.isLoaded, status.duration]);

  const play = async (next: Song): Promise<void> => {
    if (song?.id === next.id) {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        if (status.didJustFinish) void player.seekTo(0);
        setPlaying(true);
      }
      return;
    }
    try {
      const url = urls.current.get(next.id) ?? (await songUrl(next.id));
      urls.current.set(next.id, url);
      const local = cachedUrl(url, null, 'music') ?? (await keepUrl(url, null, 'music')) ?? url;
      setSong(next);
      if (source === local) {
        void player.seekTo(0);
        setPlaying(true);
        return;
      }
      setSource(local);
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return {
    song,
    playing,
    loading: song !== null && playing && !status.isLoaded,
    position: status.currentTime ?? 0,
    total: song?.duration ?? 0,
    play,
  };
}

export function MiniPlayer({ player }: { player: SongPlayer }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { song, playing, loading, position, total, play } = player;
  const slide = useSharedValue(song === null ? 0 : 1);

  useEffect(() => {
    slide.value = withTiming(song === null ? 0 : 1, { duration: 220 });
  }, [song, slide]);

  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - slide.value) * 120 }],
    opacity: slide.value,
  }));

  const percent = total > 0 ? Math.min(100, (position / total) * 100) : 0;

  return (
    <Animated.View
      pointerEvents={song ? 'auto' : 'none'}
      style={[styles.player, { bottom: insets.bottom + space.s3 }, body]}
    >
      {song ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('songs.pause') : t('songs.play')}
          onPress={() => void play(song)}
          style={styles.playerBody}
        >
          <View style={styles.playerRow}>
            <View style={styles.art}>
              {song.coverUrl ? (
                <Image
                  source={song.coverUrl}
                  scope="music"
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Music size={18} color={color.muted} />
              )}
            </View>
            <View style={styles.words}>
              <Text role="row" numberOfLines={1}>
                {song.name}
              </Text>
              {song.author ? (
                <Text role="meta" tone="muted" numberOfLines={1}>
                  {song.author}
                </Text>
              ) : null}
            </View>
            {loading ? (
              <View style={styles.spinner}>
                <CircularSpinner size={18} />
              </View>
            ) : (
              <IconButton
                icon={playing ? Pause : Play}
                label={playing ? t('songs.pause') : t('songs.play')}
                tone="ghost"
                size={40}
                glyph={{ size: 18, filled: true }}
                onPress={() => void play(song)}
              />
            )}
          </View>
          <View style={styles.progressRow}>
            <Text role="meta" tone="muted">
              {clock(position)}
            </Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <Text role="meta" tone="muted">
              {clock(total)}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    player: {
      position: 'absolute',
      left: space.s4,
      right: space.s4,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s3,
    },
    playerBody: {
      gap: space.s2,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    art: {
      width: 40,
      height: 40,
      borderRadius: radius.queue,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    spinner: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    bar: {
      flex: 1,
      height: 3,
      borderRadius: radius.pill,
      overflow: 'hidden',
      backgroundColor: color.line,
    },
    fill: {
      height: 3,
      backgroundColor: color.accent,
    },
  }),
);
