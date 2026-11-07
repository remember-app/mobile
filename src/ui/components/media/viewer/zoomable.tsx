import { Image, type ImageSource } from 'expo-image';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { boxFor, clamp } from './geometry';
import { verticalGestures } from './gestures';
import { viewerStyles } from './styles';

type Props = {
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

export function Zoomable({
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
}: Props) {
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
      <Animated.View style={[viewerStyles.page, style]}>
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
