import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
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
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { color } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(setMounted, false);
    });
  }, [progress, visible]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value * 0.55 }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
  }));

  if (!visible && !mounted) return null;

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: color.surface,
              paddingBottom: insets.bottom + space.s3,
            },
            sheet,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: color.lineStrong }]} />
          {title ? (
            <Text role="title" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
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
});
