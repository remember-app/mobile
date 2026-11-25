import type { ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Image } from '@/ui/kit/primitives/image';

import { boxFor, clamp } from './geometry';
import { verticalGestures } from './gestures';
import { viewerStyles } from './styles';
import { useZoom } from './zoom';

type Props = {
  source: ImageSource | string | null;
  hd?: string | null;
  group?: string | null;
  media: { width: number; height: number } | null;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  hudFade: SharedValue<number>;
  info: boolean;
  canInfo: boolean;
  onInfo: (value: boolean) => void;
  onZoomed: (value: boolean) => void;
  onDismiss: () => void;
  reveal: SharedValue<number>;
  onTap: () => void;
};

export function Zoomable({
  source,
  hd,
  group,
  media,
  width,
  height,
  dragY,
  lift,
  hudFade,
  info,
  canInfo,
  onInfo,
  onZoomed,
  onDismiss,
  reveal,
  onTap,
}: Props) {
  const [hdReady, setHdReady] = useState(false);
  const { zoomed, change, scale, x, y, pinch, move } = useZoom({
    width,
    height,
    info,
    onZoomed,
  });

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    canInfo,
    zoomed,
    lift,
    dragY,
    hudFade,
    onInfo,
    onDismiss,
    reveal,
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
              group={group}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={100}
              cachePolicy="memory-disk"
            />
            {hd ? (
              <Image
                source={hd}
                group={group}
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
