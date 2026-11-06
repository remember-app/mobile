import { Image, type ImageSource } from 'expo-image';
import { setStatusBarHidden } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as RNImage,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { resolveDeviceAsset } from '@/functionality';
import { radius } from '@/ui/theme';

import type { Rect } from './photo-grid';
import { PhotoStrip, STRIP_PITCH } from './photo-strip';

export type ViewerPhoto = {
  id: string;
  source: ImageSource | string | null;
  width?: number;
  height?: number;
  video?: boolean;
  assetId?: string;
};

type Box = { width: number; height: number };

function boxFor(
  media: { width: number; height: number } | null,
  width: number,
  height: number,
): Box {
  const ratio = media && media.height > 0 ? media.width / media.height : null;
  if (ratio === null) return { width, height };
  return { width, height: Math.min(height, width / ratio) };
}

function mediaSize(photo: ViewerPhoto): { width: number; height: number } | null {
  if (photo.width && photo.height) return { width: photo.width, height: photo.height };
  if (typeof photo.source === 'number') {
    const asset = RNImage.resolveAssetSource(photo.source);
    if (asset?.width && asset?.height) return { width: asset.width, height: asset.height };
  }
  return null;
}

type Target = Box & { left: number; top: number };

function targetFor(photo: ViewerPhoto | undefined, width: number, height: number): Target {
  const box = boxFor(photo ? mediaSize(photo) : null, width, height);
  return { left: (width - box.width) / 2, top: (height - box.height) / 2, ...box };
}

type Props = {
  photos: readonly ViewerPhoto[];
  initialIndex: number;
  origin?: Rect;
  onClose: () => void;
  onIndex?: (index: number) => void;
};

type Phase = 'entering' | 'open' | 'leaving';

export function PhotoViewer({ photos, initialIndex, origin, onClose, onIndex }: Props) {
  const insets = useSafeAreaInsets();
  const viewPhotos = useMemo(() => [...photos].reverse(), [photos]);
  const start = Math.max(0, viewPhotos.length - 1 - initialIndex);
  const indexRef = useRef(start);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [stripDriving, setStripDriving] = useState(false);
  const dragY = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const mainRef = useAnimatedRef<ScrollViewInstance>();
  const stripRef = useAnimatedRef<ScrollViewInstance>();
  const mainX = useSharedValue(start * width);
  const stripX = useSharedValue(start * STRIP_PITCH);
  const stripActive = useSharedValue(0);
  const initialMain = useRef({ x: start * width, y: 0 });
  const cover = viewPhotos[start]?.source ?? null;
  const current = viewPhotos[index]?.source ?? null;
  const grows = Boolean(origin && cover);
  const [phase, setPhase] = useState<Phase>(grows ? 'entering' : 'open');
  const [chrome, setChrome] = useState(true);
  const progress = useSharedValue(grows ? 0 : 1);
  const flight = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromSX = useSharedValue(1);
  const fromSY = useSharedValue(1);

  useEffect(() => {
    setStatusBarHidden(!chrome, 'fade');
  }, [chrome]);

  useEffect(() => () => setStatusBarHidden(false, 'fade'), []);

  useEffect(() => {
    if (!grows) return;
    const frame = requestAnimationFrame(() => {
      progress.value = withTiming(
        1,
        { duration: 300, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (done) scheduleOnRN(setPhase, 'open');
        },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [grows, progress]);

  const targetLeft = origin?.x ?? 0;
  const targetTop = origin?.y ?? 0;
  const enter = targetFor(viewPhotos[start], width, height);
  const exit = targetFor(viewPhotos[index], width, height);

  const update = useCallback(
    (next: number) => {
      if (next === indexRef.current) return;
      indexRef.current = next;
      dragY.value = 0;
      setIndex(next);
    },
    [dragY],
  );

  const lastSettled = useRef(start);
  const settle = useCallback(
    (next: number) => {
      update(next);
      if (lastSettled.current === next) return;
      lastSettled.current = next;
      onIndex?.(viewPhotos.length - 1 - next);
    },
    [onIndex, update, viewPhotos.length],
  );

  const mainScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      mainX.value = event.contentOffset.x;
      if (stripActive.value === 0) {
        stripX.value = (event.contentOffset.x / width) * STRIP_PITCH;
        scrollTo(stripRef, stripX.value, 0, false);
      }
    },
  });

  useAnimatedReaction(
    () => Math.round(mainX.value / width),
    (next) => {
      scheduleOnRN(update, next);
    },
  );

  const leave = useCallback(() => {
    if (!origin || phase === 'leaving') {
      onClose();
      return;
    }
    const dy = dragY.value;
    fromY.value = dy;
    const shrink = 1 - Math.min(Math.abs(dy) / 2000, 0.15);
    fromSX.value = shrink;
    fromSY.value = shrink;
    flight.value = 0;
    setPhase('leaving');
    flight.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(onClose);
    });
  }, [dragY, flight, fromSX, fromSY, fromY, onClose, origin, phase]);

  const backdrop = useAnimatedStyle(() => {
    const drag = 1 - Math.min(Math.abs(dragY.value) / 300, 1);
    return { opacity: Math.min(progress.value, drag) * (1 - flight.value) };
  });
  const stripStyle = useAnimatedStyle(() => {
    const appear = Math.max(0, Math.min(1, (progress.value - 0.6) / 0.4));
    const hide = 1 - Math.min(Math.abs(dragY.value) / 72, 1);
    return { opacity: appear * hide };
  });
  const growth = useAnimatedStyle(() => {
    const t = progress.value;
    const sx = origin ? origin.width / enter.width : 1;
    const sy = origin ? origin.height / enter.height : 1;
    const tx = origin ? origin.x - enter.left : 0;
    const ty = origin ? origin.y - enter.top : 0;
    return {
      transformOrigin: 'top left',
      transform: [
        { translateX: tx * (1 - t) },
        { translateY: ty * (1 - t) },
        { scaleX: sx + (1 - sx) * t },
        { scaleY: sy + (1 - sy) * t },
      ],
    };
  });
  const landing = useAnimatedStyle(() => {
    const sx = fromSX.value;
    const sy = fromSY.value;
    const startX = (exit.width * (1 - sx)) / 2;
    const startY = (exit.height * (1 - sy)) / 2 + fromY.value;
    const endX = targetLeft - exit.left;
    const endY = targetTop - exit.top;
    const endSX = origin ? origin.width / exit.width : 1;
    const endSY = origin ? origin.height / exit.height : 1;
    const fly = flight.value;
    return {
      opacity: fly <= 0.9 ? 1 - fly / 0.9 : 0,
      transformOrigin: 'top left',
      transform: [
        { translateX: startX + (endX - startX) * fly },
        { translateY: startY + (endY - startY) * fly },
        { scaleX: sx + (endSX - sx) * fly },
        { scaleY: sy + (endSY - sy) * fly },
      ],
    };
  });

  const tileCover = origin ? Math.max(width / origin.width, height / origin.height) : 1;
  const squareStartLeft = origin ? (width - origin.width * tileCover) / 2 : 0;
  const squareStartTop = origin ? (height - origin.height * tileCover) / 2 : 0;
  const square = useAnimatedStyle(() => {
    const fly = flight.value;
    const scale = tileCover + (1 - tileCover) * fly;
    const left = squareStartLeft + (targetLeft - squareStartLeft) * fly;
    const top = (squareStartTop + fromY.value) * (1 - fly) + targetTop * fly;
    return {
      opacity: Math.min(1, fly / 0.9),
      transformOrigin: 'top left',
      transform: [{ translateX: left }, { translateY: top }, { scale }],
    };
  });

  const busy = phase !== 'open';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, busy ? styles.off : null]}
        pointerEvents={busy ? 'none' : 'auto'}
      >
        <Animated.ScrollView
          ref={mainRef}
          horizontal
          pagingEnabled={!stripDriving}
          showsHorizontalScrollIndicator={false}
          onScroll={mainScroll}
          scrollEventThrottle={16}
          scrollEnabled={!zoomed}
          contentOffset={initialMain.current}
          onMomentumScrollEnd={() => {
            settle(Math.round(mainX.value / width));
          }}
          style={StyleSheet.absoluteFill}
        >
          {viewPhotos.map((photo, at) => (
            <View key={photo.id} style={{ width, height }}>
              {Math.abs(at - index) <= 2 ? (
                photo.video ? (
                  <VideoFrame
                    photo={photo}
                    width={width}
                    height={height}
                    dragY={dragY}
                    onDismiss={leave}
                  />
                ) : (
                  <Zoomable
                    source={photo.source}
                    media={mediaSize(photo)}
                    width={width}
                    height={height}
                    dragY={dragY}
                    onZoomed={setZoomed}
                    onDismiss={leave}
                    onTap={() => setChrome((shown) => !shown)}
                  />
                )
              ) : null}
            </View>
          ))}
        </Animated.ScrollView>
      </Animated.View>
      {phase === 'entering' && cover ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flight,
            { left: enter.left, top: enter.top, width: enter.width, height: enter.height },
            growth,
          ]}
        >
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      ) : null}
      {phase === 'leaving' && current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flight,
            { left: exit.left, top: exit.top, width: exit.width, height: exit.height },
            landing,
          ]}
        >
          <Image source={current} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      ) : null}
      {phase === 'leaving' && current && origin ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.square, { width: origin.width, height: origin.height }, square]}
        >
          <Image source={current} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}
      {chrome && !zoomed && viewPhotos.length > 1 ? (
        <Animated.View
          pointerEvents={phase === 'open' ? 'auto' : 'none'}
          style={[styles.strip, { bottom: insets.bottom + 8 }, stripStyle]}
        >
          <PhotoStrip
            photos={viewPhotos}
            index={start}
            scroller={stripRef}
            main={mainRef}
            active={stripActive}
            scrollX={stripX}
            onDrive={setStripDriving}
            onSettle={(next) => settle(next)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

type ZoomProps = {
  source: ImageSource | string | null;
  media: { width: number; height: number } | null;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  onZoomed: (value: boolean) => void;
  onDismiss: () => void;
  onTap: () => void;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

function Zoomable({ source, media, width, height, dragY, onZoomed, onDismiss, onTap }: ZoomProps) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fromScale = useSharedValue(1);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);

  const change = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomed(value);
    },
    [onZoomed],
  );

  const pinch = Gesture.Pinch()
    .onStart(() => {
      fromScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(fromScale.value * event.scale, 1, 5);
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        scheduleOnRN(change, false);
      } else {
        const maxX = (width * (scale.value - 1)) / 2;
        const maxY = (height * (scale.value - 1)) / 2;
        x.value = withSpring(clamp(x.value, -maxX, maxX));
        y.value = withSpring(clamp(y.value, -maxY, maxY));
        scheduleOnRN(change, true);
      }
    });

  const move = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(1)
    .onStart(() => {
      fromX.value = x.value;
      fromY.value = y.value;
    })
    .onUpdate((event) => {
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      x.value = clamp(fromX.value + event.translationX, -maxX, maxX);
      y.value = clamp(fromY.value + event.translationY, -maxY, maxY);
    });

  const dismiss = Gesture.Pan()
    .enabled(!zoomed)
    .maxPointers(1)
    .activeOffsetY([-10000, 30])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected > 70) scheduleOnRN(onDismiss);
      else dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        scheduleOnRN(change, false);
        return;
      }
      const next = 2.5;
      const maxX = (width * (next - 1)) / 2;
      const maxY = (height * (next - 1)) / 2;
      scale.value = withTiming(next);
      x.value = withTiming(clamp((width / 2 - event.x) * (next - 1), -maxX, maxX));
      y.value = withTiming(clamp((height / 2 - event.y) * (next - 1), -maxY, maxY));
      scheduleOnRN(change, true);
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      scheduleOnRN(onTap);
    });

  const gesture = Gesture.Simultaneous(
    pinch,
    Gesture.Race(Gesture.Exclusive(doubleTap, singleTap), move, dismiss),
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dragY.value },
      { scale: scale.value * (1 - Math.min(Math.abs(dragY.value) / 2000, 0.15)) },
    ],
  }));

  const box = boxFor(media, width, height);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, style]}>
        {source ? (
          <Image
            source={source}
            style={box}
            contentFit="contain"
            transition={100}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={box} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function VideoFrame({
  photo,
  width,
  height,
  dragY,
  onDismiss,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  onDismiss: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const videoBox = boxFor(mediaSize(photo), width, height);

  useEffect(() => {
    if (!photo.assetId) return;
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
  }, [photo.assetId]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetY([-10000, 30])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected > 70) scheduleOnRN(onDismiss);
      else dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: 1 - Math.min(Math.abs(dragY.value) / 2000, 0.15) },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.page, style]}>
        {uri ? (
          <Video uri={uri} box={videoBox} />
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

function Video({ uri, box }: { uri: string; box: Box }) {
  const player = useVideoPlayer(uri, (entry) => {
    entry.loop = false;
  });
  return <VideoView player={player} style={box} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000000',
  },
  off: {
    opacity: 0,
  },
  flight: {
    position: 'absolute',
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  square: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    borderRadius: radius.tile,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
