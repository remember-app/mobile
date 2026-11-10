import NativeSlider from '@react-native-community/slider';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveDeviceAsset } from '@/functionality';
import { IconButton } from '@/ui/kit/button';
import { radius, space, useTheme } from '@/ui/theme';

import { boxFor, mediaSize } from './geometry';
import { verticalGestures } from './gestures';
import { viewerStyles } from './styles';
import type { Box, ViewerPhoto } from './types';

export function VideoFrame({
  photo,
  width,
  height,
  dragY,
  lift,
  info,
  onInfo,
  onDismiss,
  onTap,
  active,
  visible,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  info: boolean;
  onInfo: (value: boolean) => void;
  onDismiss: () => void;
  onTap: () => void;
  active: boolean;
  visible: boolean;
}) {
  const [uri, setUri] = useState<string | null>(photo.playbackUrl ?? null);
  const videoBox = boxFor(mediaSize(photo), width, height);

  useEffect(() => {
    if (!photo.assetId) {
      setUri(photo.playbackUrl ?? null);
      return;
    }
    let live = true;
    resolveDeviceAsset(photo.assetId).then(
      (local) => {
        if (live) setUri(local.uri);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [photo.assetId, photo.playbackUrl]);

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    zoomed: false,
    lift,
    dragY,
    onInfo,
    onDismiss,
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: 1 - Math.min(Math.abs(dragY.value) / 2000, 0.15) },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(openInfo, closeInfo, dismiss)}>
      <Animated.View style={[viewerStyles.page, style]}>
        {uri ? (
          <Video uri={uri} box={videoBox} active={active} onTap={onTap} visible={visible} />
        ) : photo.source ? (
          <Image
            source={photo.source}
            style={videoBox}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={videoBox} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function Video({
  uri,
  box,
  active,
  onTap,
  visible,
}: {
  uri: string;
  box: Box;
  active: boolean;
  onTap: () => void;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const sliding = useRef(false);
  const player = useVideoPlayer(uri, (entry) => {
    entry.loop = true;
    entry.timeUpdateEventInterval = 0.25;
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!sliding.current) setPosition(currentTime);
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
  });

  useEventListener(player, 'mutedChange', ({ muted: isMuted }) => {
    setMuted(isMuted);
  });

  useEffect(() => {
    setPosition(0);
  }, [uri]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  const toggle = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  const toggleMute = () => {
    player.muted = !player.muted;
  };

  const duration = player.duration > 0 ? player.duration : 1;

  return (
    <View style={box}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} />
      <Pressable style={styles.center} onPress={toggle} />
      {visible ? (
        <View style={[styles.controls, { bottom: insets.bottom + space.s3 + 20 }]}>
          <IconButton
            icon={playing ? Pause : Play}
            label={playing ? t('action.pause') : t('action.play')}
            tone="ghost"
            size={32}
            tint={theme.color.onFill}
            hitX={14}
            onPress={toggle}
          />
          <NativeSlider
            style={styles.track}
            value={position}
            minimumValue={0}
            maximumValue={duration}
            minimumTrackTintColor={theme.color.onFill}
            maximumTrackTintColor="rgba(255,255,255,0.35)"
            thumbTintColor={theme.color.onFill}
            onSlidingStart={() => {
              sliding.current = true;
            }}
            onValueChange={(value) => {
              setPosition(value);
              player.currentTime = value;
            }}
            onSlidingComplete={(value) => {
              player.currentTime = value;
              sliding.current = false;
            }}
          />
          <IconButton
            icon={muted ? VolumeX : Volume2}
            label={muted ? t('action.unmute') : t('action.mute')}
            tone="ghost"
            size={32}
            tint={theme.color.onFill}
            hitX={14}
            onPress={toggleMute}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    left: '40%',
    right: '40%',
    top: '40%',
    bottom: '40%',
  },
  controls: {
    position: 'absolute',
    left: space.s4,
    right: space.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  track: {
    flex: 1,
    height: 32,
  },
});
