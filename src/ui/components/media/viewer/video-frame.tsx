import { useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer, VideoView } from 'expo-video';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type AnimatedStyle,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { cachedUrl, keepUrl } from '@/integrations/files/media-cache';
import { IconButton } from '@/ui/kit/controls/button';
import { Image } from '@/ui/kit/primitives/image';
import { radius, space, useTheme } from '@/ui/theme';

import { boxFor, clamp, mediaSize } from './geometry';
import { verticalGestures } from './gestures';
import type { ViewerLayout } from './layout';
import { viewerStyles } from './styles';
import type { Box, ViewerPhoto } from './types';
import { useZoom } from './zoom';

export function VideoFrame({
  photo,
  width,
  height,
  layout,
  dragY,
  lift,
  info,
  onInfo,
  onDismiss,
  onTap,
  onZoomed,
  active,
  visible,
  muted,
  onMutedChange,
  speed,
  onSpeedChange,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  layout: ViewerLayout;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  info: boolean;
  onInfo: (value: boolean) => void;
  onDismiss: () => void;
  onTap: () => void;
  onZoomed: (value: boolean) => void;
  active: boolean;
  visible: boolean;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  speed: number;
  onSpeedChange: (value: boolean) => void;
}) {
  const [uri, setUri] = useState<string | null>(photo.playbackUrl ?? null);
  const videoBox = boxFor(mediaSize(photo), width, height);
  const { zoomed, pinch, move, zoomStyle } = useZoom({ width, height, info, onZoomed });

  useEffect(() => {
    const group = photo.projectId ?? null;
    const url = photo.playbackUrl;
    const local = url ? cachedUrl(url, group) : null;
    setUri(local ?? url ?? null);
    if (active && url && !local) void keepUrl(url, group);
  }, [active, photo.playbackUrl, photo.projectId]);

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    zoomed,
    lift,
    dragY,
    onInfo,
    onDismiss,
  });

  const speedStart = useSharedValue({ x: 0, y: 0 });
  const speedMoved = useSharedValue(false);
  const speedActivated = useSharedValue(false);
  const speedPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(400)
        .maxDistance(10000)
        .numberOfPointers(1)
        .enabled(active && !zoomed)
        .onTouchesDown((event, manager) => {
          const touch = event.allTouches[0];
          if (!touch || (touch.x > 32 && width - touch.x > 32)) {
            manager.fail();
            return;
          }
          speedStart.value = { x: touch.x, y: touch.y };
          speedMoved.value = false;
        })
        .onTouchesMove((event, manager) => {
          if (speedActivated.value) return;
          const touch = event.allTouches[0];
          if (!touch) return;
          const dx = touch.x - speedStart.value.x;
          const dy = touch.y - speedStart.value.y;
          if (dx * dx + dy * dy > 64) {
            speedMoved.value = true;
            manager.fail();
          }
        })
        .onStart(() => {
          if (speedMoved.value) return;
          speedActivated.value = true;
          scheduleOnRN(onSpeedChange, true);
        })
        .onEnd(() => {
          speedActivated.value = false;
          scheduleOnRN(onSpeedChange, false);
        })
        .onFinalize(() => {
          speedActivated.value = false;
          scheduleOnRN(onSpeedChange, false);
        }),
    [active, zoomed, width, onSpeedChange, speedActivated, speedMoved, speedStart],
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: 1 - Math.min(Math.abs(dragY.value) / 2000, 0.15) },
    ],
  }));

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        pinch,
        Gesture.Race(move, openInfo, closeInfo, dismiss),
        speedPress,
      )}
    >
      <Animated.View style={[viewerStyles.page, style]}>
        {uri ? (
          <Video
            uri={uri}
            box={videoBox}
            width={width}
            layout={layout}
            active={active}
            onTap={onTap}
            visible={visible}
            muted={muted}
            onMutedChange={onMutedChange}
            speed={speed}
            zoomStyle={zoomStyle}
          />
        ) : (photo.thumb ?? photo.source) ? (
          <View style={videoBox}>
            <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
              <Image
                source={photo.thumb ?? photo.source}
                group={photo.projectId}
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
  width,
  layout,
  active,
  onTap,
  visible,
  muted,
  onMutedChange,
  speed,
  zoomStyle,
}: {
  uri: string;
  box: Box;
  width: number;
  layout: ViewerLayout;
  active: boolean;
  onTap: () => void;
  visible: boolean;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  speed: number;
  zoomStyle: AnimatedStyle<ViewStyle>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(uri, (entry) => {
    entry.loop = true;
    entry.timeUpdateEventInterval = 0.02;
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    player.playbackRate = speed;
  }, [speed, player]);

  const wasActive = useRef(false);
  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
      if (wasActive.current) player.currentTime = 0;
    }
    wasActive.current = active;
  }, [active, player]);

  const toggle = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  const toggleMute = () => {
    onMutedChange(!muted);
  };

  const barWidth = layout.controlsWidth;
  const barBottom = layout.controlsBottom;

  return (
    <View style={styles.fill}>
      <View style={styles.centre}>
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
        </View>
      </View>
      {visible ? (
        <View
          style={[
            styles.controls,
            { bottom: barBottom, width: barWidth, left: (width - barWidth) / 2 },
          ]}
        >
          <IconButton
            icon={playing ? Pause : Play}
            label={playing ? t('action.pause') : t('action.play')}
            tone="ghost"
            size={36}
            tint={theme.color.onFill}
            hitX={14}
            glyph={{ size: 18, filled: true }}
            onPress={toggle}
          />
          <Progress player={player} uri={uri} active={active} />
          <IconButton
            icon={muted ? VolumeX : Volume2}
            label={muted ? t('action.unmute') : t('action.mute')}
            tone="ghost"
            size={36}
            tint={theme.color.onFill}
            hitX={14}
            glyph={{ size: 18, filled: true }}
            onPress={toggleMute}
          />
        </View>
      ) : null}
    </View>
  );
}

const THUMB_W = 24;
const THUMB_H = 14;
const RAIL = 5;

function Progress({ player, uri, active }: { player: VideoPlayer; uri: string; active: boolean }) {
  const { color } = useTheme();
  const width = useSharedValue(0);
  const duration = useSharedValue(0);
  const shown = useSharedValue(0);
  const sliding = useRef(false);
  const wasPlaying = useRef(false);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    duration.value = player.duration > 0 ? player.duration : duration.value;
    if (sliding.current) return;
    shown.value = withTiming(currentTime, { duration: 100, easing: Easing.linear });
  });

  useEffect(() => {
    shown.value = 0;
  }, [shown, uri, active]);

  const seek = useCallback(
    (time: number) => {
      player.currentTime = time;
    },
    [player],
  );

  const begin = useCallback(() => {
    sliding.current = true;
    wasPlaying.current = player.playing;
    if (player.playing) player.pause();
    player.scrubbingModeOptions = { scrubbingModeEnabled: true };
    player.seekTolerance = { toleranceBefore: 0.1, toleranceAfter: 0.1 };
  }, [player]);

  const end = useCallback(() => {
    sliding.current = false;
    player.scrubbingModeOptions = { scrubbingModeEnabled: false };
    player.seekTolerance = { toleranceBefore: 0, toleranceAfter: 0 };
    if (wasPlaying.current) player.play();
  }, [player]);

  const scrub = Gesture.Pan()
    .onBegin((event) => {
      scheduleOnRN(begin);
      const span = duration.value > 0 ? duration.value : 1;
      const time = clamp((event.x / Math.max(width.value, 1)) * span, 0, span);
      shown.value = time;
      scheduleOnRN(seek, time);
    })
    .onUpdate((event) => {
      const span = duration.value > 0 ? duration.value : 1;
      const time = clamp((event.x / Math.max(width.value, 1)) * span, 0, span);
      shown.value = time;
      scheduleOnRN(seek, time);
    })
    .onEnd(() => {
      scheduleOnRN(end);
    });

  const fill = useAnimatedStyle(() => {
    const span = duration.value > 0 ? duration.value : 1;
    return { width: width.value * clamp(shown.value / span, 0, 1) };
  });
  const thumb = useAnimatedStyle(() => {
    const span = duration.value > 0 ? duration.value : 1;
    const offset = width.value * clamp(shown.value / span, 0, 1) - THUMB_W / 2;
    return { transform: [{ translateX: offset }] };
  });

  return (
    <GestureDetector gesture={scrub}>
      <View
        style={styles.track}
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
        }}
      >
        <View style={styles.rail} />
        <Animated.View style={[styles.bar, { backgroundColor: color.onFill }, fill]} />
        <Animated.View style={[styles.thumb, { backgroundColor: color.onFill }, thumb]} />
      </View>
    </GestureDetector>
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
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  track: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: RAIL,
    borderRadius: RAIL / 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  bar: {
    position: 'absolute',
    left: 0,
    height: RAIL,
    borderRadius: RAIL / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_H / 2,
  },
});
