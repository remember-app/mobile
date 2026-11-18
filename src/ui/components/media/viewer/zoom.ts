import { useCallback, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clamp } from './geometry';

/**
 * Щипок и перетаскивание одного кадра: фото и видео должны увеличиваться и
 * ходить под пальцем одинаково, поэтому жесты живут в одном месте.
 */
export function useZoom({
  width,
  height,
  info,
  onZoomed,
}: {
  width: number;
  height: number;
  info: boolean;
  onZoomed: (value: boolean) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
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

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return { zoomed, change, scale, x, y, pinch, move, zoomStyle };
}
