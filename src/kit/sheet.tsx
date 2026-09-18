import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backdrop, board, duration as motion, radius, space, themed } from '@/theme';

import { useFadeIn } from './interaction';
import { Text } from './text';

export type SheetProps = {
  visible: boolean;
  /** Tapping beside the sheet, the back button, and whatever the sheet's own way out is. */
  onCancel: () => void;
  /** The heading, in `sheetTitle` — or `sheetTitleSm` when this is a confirmation. */
  title?: string;
  narrow?: boolean;
  /** A header row instead of a heading: a thumbnail or an avatar with two lines beside it. */
  head?: ReactNode;
  /** The block of buttons at the bottom. It stays put while the body scrolls. */
  footer?: ReactNode;
  /** A long body — many contacts, many days — scrolls; the heading and the footer do not. */
  scroll?: boolean;
  children?: ReactNode;
};

/**
 * Spec 7.1 — the sheet. It comes up from the bottom over the screen it interrupts, with a handle at
 * the top of it, and it is closed by a swipe down, by a tap on the darkness, or by its own button.
 *
 * Five kinds, and all five differ only in the block at the bottom — one main button, main plus
 * quiet, dangerous plus outlined, two equal, one outlined. That block is `footer`, so the kind is a
 * matter of what a screen puts there and never of a flag here.
 *
 * A plain React Native `Modal` and nothing else: a bottom-sheet library would bring gestures the
 * layout never asked for.
 */
export function Sheet({ visible, onCancel, ...rest }: SheetProps) {
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
      <Rise onCancel={onCancel} {...rest} />
    </Modal>
  );
}

/**
 * Shuts the sheet when the screen it stands on loses focus, through the same `onCancel` the cross
 * and the darkness go through (TASK-129). A `Modal` is not drawn inside the screen that raised it,
 * so leaving that screen without closing the sheet — a `router.push`, a tapped notification, a deep
 * link, anything that is not an explicit close — left the sheet standing over whatever came next.
 *
 * Here and not on the screens: this is one rule about what a sheet is, and it was being copied by
 * hand onto every face that has one. A screen that puts up a new sheet now gets the behaviour with
 * no line of its own. Every sheet in the app is raised from a screen under expo-router, which is
 * what `useFocusEffect` needs.
 *
 * The callback is memoised on nothing — a subscription torn down and built again on every render is
 * not what this wants — so it cannot read anything off the closure it was born in: a sheet mounts
 * closed, and that first closure says so forever. The ref is what the last render left.
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
 * How long the darkness stays deaf after the sheet comes up. The second tap of a double tap on the
 * button that opened the sheet lands where that button was a moment ago — which is now the darkness
 * — and closes what has only just opened, so from the outside the button reads as dead (TASK-95).
 * Long enough to swallow that second tap, short enough that nobody aiming beside the sheet on
 * purpose ever waits for it.
 */
export const SCRIM_DEAF_MS = 300;

/**
 * The darkness's `onPress`, deaf for its first {@link SCRIM_DEAF_MS}. The moment the sheet opened is
 * the moment this mounts, so a timestamp answers it: one comparison when a tap arrives, nothing
 * scheduled, nothing to clean up, and no re-render standing between the rise and the screen.
 */
export function useScrimTap(onCancel: () => void): () => void {
  const openedAt = useRef(Date.now());
  return () => {
    if (Date.now() - openedAt.current >= SCRIM_DEAF_MS) onCancel();
  };
}

function Rise({
  onCancel,
  title,
  narrow,
  head,
  footer,
  scroll,
  children,
}: Omit<SheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const rise = useFadeIn(motion.sheet);
  const styles = useStyles();
  const onScrimTap = useScrimTap(onCancel);

  const body = (
    <>
      {head}
      {title ? (
        <Text role={narrow ? 'sheetTitleSm' : 'sheetTitle'} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );

  return (
    // A sheet sits where the keyboard comes up, so anything typed into one would be typed blind.
    // Android's modals already resize themselves; iOS needs telling.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tapping beside the sheet is the same as declining — once the sheet is up, see
          `useScrimTap`. Hidden from screen readers: they have the sheet's own way out below, and a
          full-screen button in front of it only gets in the way. */}
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
          { paddingBottom: Math.max(insets.bottom, board.bottom) },
          {
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            ],
          },
        ]}
      >
        <View testID="sheet-handle" style={styles.handle} />
        {scroll ? (
          <ScrollView contentContainerStyle={styles.body}>{body}</ScrollView>
        ) : (
          <View style={styles.body}>{body}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: backdrop },
    sheet: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '90%',
      alignSelf: 'center',
      paddingTop: space.s3,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
    },
    // Spec 7.1: the handle is always the first thing in a sheet, 40 × 4.
    handle: {
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: color.handle,
      alignSelf: 'center',
      marginBottom: space.s4,
    },
    body: { gap: space.s4 },
    footer: { gap: space.s3, paddingTop: space.s5 },
  }),
);
