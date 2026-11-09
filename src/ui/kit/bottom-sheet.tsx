import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { radius, space, useTheme } from '@/ui/theme';

import { Text } from './text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  size?: 'auto' | 'full';
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, title, size = 'auto', children }: Props) {
  const tall = size === 'full';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { color } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const drag = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    if (visible) {
      drag.value = 0;
      setMounted(true);
      progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      return;
    }
    Keyboard.dismiss();
    progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(setMounted, false);
    });
  }, [drag, progress, visible]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value * 0.55 }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height + drag.value }],
    paddingBottom: insets.bottom + space.s3 + keyboard.height.value,
  }));

  const pan = Gesture.Pan()
    .activeOffsetY([8, 10000])
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 800) scheduleOnRN(onClose);
      else drag.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  if (!visible && !mounted) return null;

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: color.surface,
              },
              tall ? { height: height * 0.94 } : null,
              sheet,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: color.lineStrong }]} />
            {title ? (
              <Text role="title" style={styles.title}>
                {title}
              </Text>
            ) : null}
            <Pressable
              onPress={() => undefined}
              style={[styles.content, tall ? styles.fill : null]}
            >
              {children}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.s3,
    paddingHorizontal: space.s5,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: space.s3,
  },
  title: {
    marginBottom: space.s3,
    textAlign: 'center',
  },
  content: {
    gap: space.s3,
    paddingBottom: space.s3,
  },
  fill: {
    flex: 1,
  },
});
