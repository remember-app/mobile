import { Image, type ImageSource } from 'expo-image';
import { setStatusBarHidden } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Trash2 } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { confirmAction } from '@/ui/confirm';
import { locale } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, IconButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { photo, radius, space, useTheme } from '@/ui/theme';
import { PhotoInfo } from './info/photo-info';
import type { Rect } from './photo-grid';
import { PhotoStrip, STRIP_PITCH } from './photo-strip';

export type ViewerPhoto = {
  id: string;
  source: ImageSource | string | null;
  width?: number;
  height?: number;
  video?: boolean;
  assetId?: string;
  capturedAt?: Date | null;
};

function dayText(value: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function timeText(value: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

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
  renderInfo?: (index: number) => ReactNode;
  author?: string;
  onDelete?: (photo: ViewerPhoto) => void;
};

type Phase = 'entering' | 'open' | 'leaving';

export function PhotoViewer({
  photos,
  initialIndex,
  origin,
  onClose,
  onIndex,
  renderInfo,
  author,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const background = theme.name === 'dark' ? photo.viewer : theme.color.surface;
  const panel = theme.name === 'dark' ? photo.viewer : theme.color.ink;
  const viewPhotos = useMemo(() => [...photos].reverse(), [photos]);
  const start = Math.max(0, viewPhotos.length - 1 - initialIndex);
  const indexRef = useRef(start);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [info, setInfo] = useState(false);
  const [stripDriving, setStripDriving] = useState(false);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const mainRef = useAnimatedRef<ScrollViewInstance>();
  const stripRef = useAnimatedRef<ScrollViewInstance>();
  const mainX = useSharedValue(start * width);
  const stripX = useSharedValue(start * STRIP_PITCH);
  const stripActive = useSharedValue(0);
  const initialMain = useRef({ x: start * width, y: 0 });
  const cover = viewPhotos[start]?.source ?? null;
  const currentPhoto = viewPhotos[index];
  const current = currentPhoto?.source ?? null;
  const startBox = boxFor(currentPhoto ? mediaSize(currentPhoto) : null, width, height);
  const startTop = (height - startBox.height) / 2;
  const grows = Boolean(origin && cover);
  const [phase, setPhase] = useState<Phase>(grows ? 'entering' : 'open');
  const [chrome, setChrome] = useState(true);
  const progress = useSharedValue(grows ? 0 : 1);
  const flight = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromSX = useSharedValue(1);
  const fromSY = useSharedValue(1);

  useEffect(() => {
    setStatusBarHidden(!chrome || info, 'fade');
  }, [chrome, info]);

  useEffect(() => {
    if (!info) setChrome(true);
  }, [info]);

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
  const rise = startTop + startBox.height * INFO_RISE;
  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -rise * lift.value }],
  }));
  const photoBottom = startTop + startBox.height;
  const infoStyle = useAnimatedStyle(() => ({
    top: photoBottom + (height * 0.4 - photoBottom) * lift.value,
    opacity: Math.min(1, lift.value * 12),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
  }));
  const authorStyle = useAnimatedStyle(() => ({
    top: photoBottom + (height * 0.4 - photoBottom) * lift.value - 44,
    opacity: lift.value,
  }));
  const stripStyle = useAnimatedStyle(() => {
    const appear = Math.max(0, Math.min(1, (progress.value - 0.6) / 0.4));
    const hide = 1 - Math.min(Math.abs(dragY.value) / 72, 1);
    const gone = Math.min(1, Math.max(0, (lift.value - 0.2) / 0.2));
    return { opacity: appear * hide * (1 - gone) };
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
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: background }, backdrop]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, busy ? styles.off : null, pagerStyle]}
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
                    lift={lift}
                    info={info}
                    onInfo={setInfo}
                    onDismiss={leave}
                  />
                ) : (
                  <Zoomable
                    source={photo.source}
                    media={mediaSize(photo)}
                    width={width}
                    height={height}
                    dragY={dragY}
                    lift={lift}
                    info={info}
                    onInfo={setInfo}
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
      <Animated.View
        style={[styles.info, { backgroundColor: panel }, infoStyle]}
        pointerEvents={info ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.fill, contentStyle]}>
          <PhotoInfo lift={lift} onDismiss={() => setInfo(false)}>
            {renderInfo?.(viewPhotos.length - 1 - index)}
          </PhotoInfo>
        </Animated.View>
      </Animated.View>
      {author ? (
        <Animated.View style={[styles.author, authorStyle]} pointerEvents="none">
          <Avatar name={author} size={34} />
        </Animated.View>
      ) : null}
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
          pointerEvents={info || phase !== 'open' ? 'none' : 'auto'}
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
      {chrome && phase === 'open' ? (
        <BlurBar edge="top" style={styles.hud}>
          <BackButton label={t('action.back')} size={52} onPress={onClose} />
          <View style={styles.hudWords}>
            {currentPhoto?.capturedAt ? (
              <>
                <Text role="row">{dayText(currentPhoto.capturedAt)}</Text>
                <Text role="meta">{timeText(currentPhoto.capturedAt)}</Text>
              </>
            ) : null}
          </View>
          {onDelete && currentPhoto ? (
            <IconButton
              icon={Trash2}
              label={t('action.delete')}
              tone="ghost"
              size={48}
              onPress={() =>
                confirmAction({
                  confirm: t('action.delete'),
                  destructive: true,
                  onConfirm: () => onDelete(currentPhoto),
                })
              }
            />
          ) : (
            <View style={styles.hudSide} />
          )}
        </BlurBar>
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
  lift: SharedValue<number>;
  info: boolean;
  onInfo: (value: boolean) => void;
  onZoomed: (value: boolean) => void;
  onDismiss: () => void;
  onTap: () => void;
};

const INFO_RISE = 0.1;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

type VerticalProps = {
  height: number;
  info: boolean;
  zoomed: boolean;
  lift: SharedValue<number>;
  dragY: SharedValue<number>;
  onInfo: (value: boolean) => void;
  onDismiss: () => void;
};

function verticalGestures({ height, info, zoomed, lift, dragY, onInfo, onDismiss }: VerticalProps) {
  const span = height * 0.32;

  const openInfo = Gesture.Pan()
    .enabled(!info && !zoomed)
    .maxPointers(1)
    .activeOffsetY([-28, 10000])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      lift.value = clamp(-event.translationY / span, 0, 1);
    })
    .onEnd((event) => {
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected < -60) {
        lift.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
        scheduleOnRN(onInfo, true);
      } else {
        lift.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const closeInfo = Gesture.Pan()
    .enabled(info && !zoomed)
    .maxPointers(1)
    .activeOffsetY([-10000, 28])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      lift.value = clamp(1 - event.translationY / span, 0, 1);
    })
    .onEnd((event) => {
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected > 60) {
        lift.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
        scheduleOnRN(onInfo, false);
      } else {
        lift.value = withSpring(1, { damping: 20, stiffness: 220 });
      }
    });

  const dismiss = Gesture.Pan()
    .enabled(!info && !zoomed)
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

  return { openInfo, closeInfo, dismiss };
}

function Zoomable({
  source,
  media,
  width,
  height,
  dragY,
  lift,
  info,
  onInfo,
  onZoomed,
  onDismiss,
  onTap,
}: ZoomProps) {
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
    .enabled(!info)
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

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    zoomed,
    lift,
    dragY,
    onInfo,
    onDismiss,
  });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(!info)
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
    Gesture.Race(Gesture.Exclusive(doubleTap, singleTap), move, dismiss, openInfo, closeInfo),
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
  lift,
  info,
  onInfo,
  onDismiss,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  info: boolean;
  onInfo: (value: boolean) => void;
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
  off: {
    opacity: 0,
  },
  flight: {
    position: 'absolute',
  },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  fill: {
    flex: 1,
  },
  author: {
    position: 'absolute',
    left: space.s4,
    zIndex: 3,
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    minHeight: 52,
  },
  hudWords: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  hudSide: {
    width: 48,
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
