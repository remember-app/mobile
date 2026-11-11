import NativeSlider from '@react-native-community/slider';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type AnimatedStyle,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { resolveDeviceAsset } from '@/functionality';
import { IconButton } from '@/ui/kit/button';
import { radius, space, useTheme } from '@/ui/theme';

import { boxFor, clamp, mediaSize } from './geometry';
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
  onZoomed,
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
  onZoomed: (value: boolean) => void;
  active: boolean;
  visible: boolean;
}) {
  const [uri, setUri] = useState<string | null>(photo.playbackUrl ?? null);
  const [zoomed, setZoomed] = useState(false);
  const videoBox = boxFor(mediaSize(photo), width, height);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fromScale = useSharedValue(1);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromFocalX = useSharedValue(0);
  const fromFocalY = useSharedValue(0);
  const pinching = useSharedValue(false);
  const notified = useSharedValue(false);

  const change = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomed(value);
    },
    [onZoomed],
  );

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

  const pinch = Gesture.Pinch()
    .enabled(!info)
    .onStart((event) => {
      pinching.value = true;
      notified.value = false;
      fromScale.value = scale.value;
      fromX.value = x.value;
      fromY.value = y.value;
      fromFocalX.value = event.focalX;
      fromFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const next = clamp(fromScale.value * event.scale, 1, 5);
      const ratio = next / fromScale.value;
      const maxX = (width * (next - 1)) / 2;
      const maxY = (height * (next - 1)) / 2;
      x.value = clamp(
        event.focalX - width / 2 - ratio * (fromFocalX.value - width / 2 - fromX.value),
        -maxX,
        maxX,
      );
      y.value = clamp(
        event.focalY - height / 2 - ratio * (fromFocalY.value - height / 2 - fromY.value),
        -maxY,
        maxY,
      );
      scale.value = next;
      if (next > 1.02 && !notified.value) {
        notified.value = true;
        scheduleOnRN(change, true);
      }
    })
    .onEnd(() => {
      pinching.value = false;
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        scheduleOnRN(change, false);
      } else {
        const maxX = (width * (scale.value - 1)) / 2;
        const maxY = (height * (scale.value - 1)) / 2;
        x.value = clamp(x.value, -maxX, maxX);
        y.value = clamp(y.value, -maxY, maxY);
        scheduleOnRN(change, true);
      }
    })
    .onFinalize(() => {
      pinching.value = false;
    });

  const move = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(1)
    .onStart(() => {
      if (pinching.value) return;
      fromX.value = x.value;
      fromY.value = y.value;
    })
    .onUpdate((event) => {
      if (pinching.value) return;
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      x.value = clamp(fromX.value + event.translationX, -maxX, maxX);
      y.value = clamp(fromY.value + event.translationY, -maxY, maxY);
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    zoomed,
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
    <GestureDetector
      gesture={Gesture.Simultaneous(pinch, Gesture.Race(move, openInfo, closeInfo, dismiss))}
    >
      <Animated.View style={[viewerStyles.page, style]}>
        {uri ? (
          <Video
            uri={uri}
            box={videoBox}
            active={active}
            onTap={onTap}
            visible={visible && !zoomed}
            zoomStyle={zoomStyle}
          />
        ) : photo.source ? (
          <View style={videoBox}>
            <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
              <Image
                source={photo.source}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </Animated.View>
          </View>
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
  zoomStyle,
}: {
  uri: string;
  box: Box;
  active: boolean;
  onTap: () => void;
  visible: boolean;
  zoomStyle: AnimatedStyle<ViewStyle>;
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
      <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      </Animated.View>
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
