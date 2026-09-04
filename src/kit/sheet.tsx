import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, duration as motion, space } from '@/theme';

import { useFadeIn } from './interaction';
import { shade } from './shades';

export type SheetProps = {
  visible: boolean;
  /** Tapping beside the sheet, the back button, and whatever the sheet's own way out is. */
  onCancel: () => void;
  children: ReactNode;
};

/**
 * The panel the kit brings up from the bottom of the screen (section 13's `.confirm`): a scrim over
 * what it interrupts, a grip, and 280ms of rise. Everything above the grip is the caller's — a
 * question and two buttons in `ConfirmSheet`, a form in the screens that ask for one.
 *
 * A plain React Native `Modal` and nothing else: a bottom-sheet library would bring gestures the kit
 * never asked for.
 */
export function Sheet({ visible, onCancel, children }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      // The rise below is the animation; the platform's own would play on top of it.
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Modal renders nothing while hidden, so this mounts on each open — and so does the rise. */}
      <Rise onCancel={onCancel}>{children}</Rise>
    </Modal>
  );
}

function Rise({ onCancel, children }: Omit<SheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const rise = useFadeIn(motion.slow);

  return (
    // A sheet sits where the keyboard comes up, so anything typed into one would be typed blind.
    // Android's modals already resize themselves; iOS needs telling.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tapping beside the sheet is the same as declining. Hidden from screen readers: they have
          the sheet's own way out below, and a full-screen button in front of it only gets in the way. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.backdrop, { opacity: rise }]} />
      </Pressable>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, space.s5) },
          {
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.grip} />
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: shade.scrim },
  sheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingTop: space.s6,
    paddingHorizontal: space.s5,
    gap: space.s4,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line,
    alignSelf: 'center',
    marginTop: -space.s3,
  },
});
