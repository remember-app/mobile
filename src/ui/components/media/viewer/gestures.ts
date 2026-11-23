import { Gesture } from 'react-native-gesture-handler';
import { Easing, type SharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { clamp } from './geometry';

export type VerticalProps = {
  height: number;
  info: boolean;
  canInfo: boolean;
  zoomed: boolean;
  lift: SharedValue<number>;
  dragY: SharedValue<number>;
  hudFade: SharedValue<number>;
  reveal: SharedValue<number>;
  onInfo: (value: boolean) => void;
  onDismiss: () => void;
};

export function verticalGestures({
  height,
  info,
  canInfo,
  zoomed,
  lift,
  dragY,
  hudFade,
  reveal,
  onInfo,
  onDismiss,
}: VerticalProps) {
  const span = height * 0.32;

  const openInfo = Gesture.Pan()
    .enabled(canInfo && !info && !zoomed)
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
    .enabled(canInfo && info && !zoomed)
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
    .onStart(() => {
      hudFade.value = withTiming(0, { duration: 150 });
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
      // Экран под кадром проявляется ровно настолько, насколько кадр отошёл от края.
      reveal.value = clamp(event.translationY / 300, 0, 1);
    })
    .onEnd((event) => {
      const projected = event.translationY + event.velocityY * 0.15;
      if (projected > 70) {
        scheduleOnRN(onDismiss);
        return;
      }
      hudFade.value = withTiming(1, { duration: 150 });
      reveal.value = withTiming(0, { duration: 220 });
      dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  return { openInfo, closeInfo, dismiss };
}
