import { Image, type ImageSource } from 'expo-image';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/ui/kit/text';

import type { Rect } from './photo-grid';

export type ViewerPhoto = {
  id: string;
  source: ImageSource | null;
};

type Props = {
  photos: readonly ViewerPhoto[];
  initialIndex: number;
  origin?: Rect;
  onClose: () => void;
};

type Phase = 'entering' | 'open' | 'leaving';

export function PhotoViewer({ photos, initialIndex, origin, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const pager = useRef<PagerView>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const dragY = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const cover = photos[initialIndex]?.source ?? null;
  const current = photos[index]?.source ?? null;
  const grows = Boolean(origin && cover);
  const [phase, setPhase] = useState<Phase>(grows ? 'entering' : 'open');
  const progress = useSharedValue(grows ? 0 : 1);
  const flight = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromSX = useSharedValue(1);
  const fromSY = useSharedValue(1);

  useEffect(() => {
    pager.current?.setScrollEnabled(!zoomed);
  }, [zoomed]);

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
  const targetSX = origin ? origin.width / width : 1;
  const targetSY = origin ? origin.height / height : 1;

  const leave = useCallback(() => {
    if (!origin || index !== initialIndex || phase === 'leaving') {
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
  }, [dragY, flight, fromSX, fromSY, fromY, index, initialIndex, onClose, origin, phase]);

  const backdrop = useAnimatedStyle(() => {
    const drag = 1 - Math.min(Math.abs(dragY.value) / 300, 1);
    return { opacity: Math.min(progress.value, drag) * (1 - flight.value) };
  });
  const growth = useAnimatedStyle(() => ({
    transformOrigin: 'top left',
    transform: [
      { translateX: targetLeft * (1 - progress.value) },
      { translateY: targetTop * (1 - progress.value) },
      { scaleX: targetSX + (1 - targetSX) * progress.value },
      { scaleY: targetSY + (1 - targetSY) * progress.value },
    ],
  }));
  const landing = useAnimatedStyle(() => {
    const sx = fromSX.value;
    const sy = fromSY.value;
    const startLeft = (width / 2) * (1 - sx);
    const startTop = (height / 2) * (1 - sy) + fromY.value;
    const fly = flight.value;
    return {
      transformOrigin: 'top left',
      transform: [
        { translateX: startLeft + (targetLeft - startLeft) * fly },
        { translateY: startTop + (targetTop - startTop) * fly },
        { scaleX: sx + (targetSX - sx) * fly },
        { scaleY: sy + (targetSY - sy) * fly },
      ],
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
        <PagerView
          ref={pager}
          style={StyleSheet.absoluteFill}
          initialPage={initialIndex}
          offscreenPageLimit={1}
          onPageSelected={(event) => {
            dragY.value = 0;
            setIndex(event.nativeEvent.position);
          }}
        >
          {photos.map((photo, at) => (
            <View key={photo.id} style={styles.page}>
              {Math.abs(at - index) <= 2 ? (
                <Zoomable
                  source={photo.source}
                  width={width}
                  height={height}
                  dragY={dragY}
                  onZoomed={setZoomed}
                  onDismiss={leave}
                />
              ) : null}
            </View>
          ))}
        </PagerView>
      </Animated.View>
      {phase === 'entering' && cover ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, growth]}>
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}
      {phase === 'leaving' && current ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, landing]}>
          <Image source={current} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}
      {phase === 'open' ? (
        <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable onPress={leave} hitSlop={12} style={styles.close}>
            <X color="#ffffff" size={22} />
          </Pressable>
          <View style={styles.counter} pointerEvents="none">
            <Text role="meta" tone="onFill">
              {`${index + 1} / ${photos.length}`}
            </Text>
          </View>
          <View style={styles.close} />
        </View>
      ) : null}
    </View>
  );
}

type ZoomProps = {
  source: ImageSource | null;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  onZoomed: (value: boolean) => void;
  onDismiss: () => void;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

function Zoomable({ source, width, height, dragY, onZoomed, onDismiss }: ZoomProps) {
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
    .activeOffsetY([-10000, 4])
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd(() => {
      scheduleOnRN(onDismiss);
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

  const gesture = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, move, dismiss));

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dragY.value },
      { scale: scale.value * (1 - Math.min(Math.abs(dragY.value) / 2000, 0.15)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, style]}>
        {source ? (
          <Image
            source={source}
            style={{ width, height }}
            contentFit="cover"
            transition={100}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ width, height }} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000000',
  },
  off: {
    opacity: 0,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counter: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
