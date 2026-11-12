import { Image, type ImageSource } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { boxFor, clamp } from './geometry';
import { verticalGestures } from './gestures';
import { viewerStyles } from './styles';

type Props = {
  source: ImageSource | string | null;
  hd?: string | null;
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
  hd,
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
  const [hdReady, setHdReady] = useState(false);
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

  useEffect(() => setHdReady(false), [hd]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[viewerStyles.page, style]}>
        {source ? (
          <View style={box}>
            <Image
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={100}
              cachePolicy="memory-disk"
            />
            {hd ? (
              <Image
                source={hd}
                style={[StyleSheet.absoluteFill, hdReady ? null : styles.hidden]}
                contentFit="contain"
                transition={120}
                cachePolicy="memory-disk"
                onLoad={() => setHdReady(true)}
              />
            ) : null}
          </View>
        ) : (
          <View style={box} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
});
