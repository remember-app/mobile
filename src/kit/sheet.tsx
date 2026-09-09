import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useRef } from 'react';
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

import { duration as motion, scrim, space, themed } from '@/theme';

import { useFadeIn } from './interaction';

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
  useShutOnBlur(visible, onCancel);

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

/**
 * Shuts the sheet when the screen it stands on loses focus, through the same `onCancel` the cross
 * and the scrim go through (TASK-129). A `Modal` is not drawn inside the screen that raised it, so
 * leaving that screen without closing the sheet — a `router.push`, a tapped notification, a deep
 * link, anything that is not an explicit close — left the sheet standing over whatever came next.
 *
 * Here and not on the screens: this is one rule about what a sheet is, and it was being copied by
 * hand onto every face that has one (TASK-94 and the m-17 review are the three copies it replaces).
 * A screen that puts up a new sheet now gets the behaviour with no line of its own. Every sheet in
 * the app is raised from a screen under expo-router, which is what `useFocusEffect` needs.
 *
 * The callback is memoised on nothing — a subscription torn down and built again on every render is
 * not what this wants — so it cannot read anything off the closure it was born in: a sheet mounts
 * closed, and that first closure says so forever. The ref is what the last render left.
 *
 * Blur is not the only way out this takes: expo-router runs the cleanup on teardown as well, so a
 * sheet unmounted while still up — a screen that mounts its sheet conditionally closes one that way
 * on every confirm — is cancelled too. Harmless because every `onCancel` in the app is a plain state
 * reset; a sheet whose cancel ever does more than that would feel the difference.
 */
export function useShutOnBlur(visible: boolean, onCancel: () => void): void {
  const now = useRef({ visible, onCancel });
  now.current = { visible, onCancel };

  useFocusEffect(
    useCallback(
      () => () => {
        if (now.current.visible) now.current.onCancel();
      },
      [],
    ),
  );
}

/**
 * How long the scrim stays deaf after the sheet comes up. The second tap of a double tap on the
 * button that opened the sheet lands where that button was a moment ago — which is now the scrim —
 * and closes what has only just opened, so from the outside the button reads as dead (TASK-95).
 * Long enough to swallow that second tap, short enough that nobody aiming beside the sheet on
 * purpose ever waits for it.
 */
export const SCRIM_DEAF_MS = 300;

/**
 * The scrim's `onPress`, deaf for its first {@link SCRIM_DEAF_MS}. The moment the sheet opened is
 * the moment this mounts, so a timestamp answers it: one comparison when a tap arrives, nothing
 * scheduled, nothing to clean up, and no re-render standing between the rise and the screen.
 */
export function useScrimTap(onCancel: () => void): () => void {
  const openedAt = useRef(Date.now());
  return () => {
    if (Date.now() - openedAt.current >= SCRIM_DEAF_MS) onCancel();
  };
}

function Rise({ onCancel, children }: Omit<SheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const rise = useFadeIn(motion.slow);
  const styles = useStyles();
  const onScrimTap = useScrimTap(onCancel);

  return (
    // A sheet sits where the keyboard comes up, so anything typed into one would be typed blind.
    // Android's modals already resize themselves; iOS needs telling.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tapping beside the sheet is the same as declining — once the sheet is up, see `useScrimTap`.
          Hidden from screen readers: they have the sheet's own way out below, and a full-screen
          button in front of it only gets in the way. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onScrimTap}
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

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    // The same weight of dark the kit lays over a frame, laid here over the screen it interrupts.
    backdrop: { flex: 1, backgroundColor: scrim },
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
  }),
);
