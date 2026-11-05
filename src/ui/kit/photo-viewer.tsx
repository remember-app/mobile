import { Image, type ImageSource } from 'expo-image';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from './text';

export type ViewerPhoto = {
  id: string;
  source: ImageSource | null;
};

type Props = {
  photos: readonly ViewerPhoto[];
  initialIndex: number;
  onClose: () => void;
};

export function PhotoViewer({ photos, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const pager = useRef<PagerView>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const dragY = useSharedValue(0);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    pager.current?.setScrollEnabled(!zoomed);
  }, [zoomed]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(dragY.value) / 300, 1),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
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
        {photos.map((photo) => (
          <View key={photo.id} style={styles.page}>
            <Zoomable
              source={photo.source}
              width={width}
              height={height}
              dragY={dragY}
              onZoomed={setZoomed}
              onClose={onClose}
            />
          </View>
        ))}
      </PagerView>
      <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <X color="#ffffff" size={22} />
        </Pressable>
        <View style={styles.counter} pointerEvents="none">
          <Text role="meta" tone="onFill">
            {`${index + 1} / ${photos.length}`}
          </Text>
        </View>
        <View style={styles.close} />
      </View>
    </View>
  );
}

type ZoomProps = {
  source: ImageSource | null;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  onZoomed: (value: boolean) => void;
  onClose: () => void;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

function Zoomable({ source, width, height, dragY, onZoomed, onClose }: ZoomProps) {
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
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) > 140) scheduleOnRN(onClose);
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
            contentFit="contain"
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
