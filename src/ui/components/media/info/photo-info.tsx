import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { photo, space, themed } from '@/ui/theme';

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export function PhotoInfo({
  children,
  lift,
  onDismiss,
}: {
  children?: ReactNode;
  lift: SharedValue<number>;
  onDismiss: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const atTop = useSharedValue(true);
  const canClose = useSharedValue(false);
  const scroll = Gesture.Native();
  const pan = Gesture.Pan()
    .activeOffsetY([-10000, 12])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      canClose.value = atTop.value;
    })
    .onUpdate((event) => {
      if (!canClose.value || event.translationY <= 0) return;
      lift.value = clamp(1 - event.translationY / 320, 0, 1);
    })
    .onEnd((event) => {
      if (!canClose.value || event.translationY <= 0) return;
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected > 70) {
        lift.value = withTiming(0, { duration: 220 });
        scheduleOnRN(onDismiss);
      } else {
        lift.value = withSpring(1, { damping: 20, stiffness: 220 });
      }
    });

  return (
    <View style={styles.panel}>
      <GestureDetector gesture={Gesture.Simultaneous(scroll, pan)}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            atTop.value = event.nativeEvent.contentOffset.y <= 0.5;
          }}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s4 }]}
        >
          {children}
        </ScrollView>
      </GestureDetector>
    </View>
  );
}

const useStyles = themed(({ color, name }) =>
  StyleSheet.create({
    panel: {
      flex: 1,
      backgroundColor: name === 'dark' ? photo.viewer : color.ink,
    },
    body: {
      paddingTop: space.s4,
      paddingHorizontal: space.s4,
    },
  }),
);
