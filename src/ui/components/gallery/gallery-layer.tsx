import { type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Слой экрана поверх сетки: уезжает при открытии просмотрщика и проявляется при возврате.
 * `reveal` отдаёт проявление жесту закрытия, чтобы слой шёл за пальцем, а не таймером.
 */
export function GalleryLayer({
  hidden,
  reveal,
  children,
}: {
  hidden: boolean;
  reveal?: SharedValue<number>;
  children: ReactNode;
}) {
  const fade = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    if (reveal) return;
    fade.value = withTiming(hidden ? 0 : 1, { duration: 220 });
  }, [fade, hidden, reveal]);
  const style = useAnimatedStyle(() => ({ opacity: reveal ? reveal.value : fade.value }));
  return (
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.layer, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
