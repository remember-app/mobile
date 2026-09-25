import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backdrop, board, duration as motion, radius, space, themed, type } from '@/theme';

import { DISMISS_KEYBOARD, KEYBOARD_SCROLL, useFadeIn } from './interaction';
import { Text } from './text';

export type SheetProps = {
  visible: boolean;
  /** Tapping beside the sheet, the back button, and whatever the sheet's own way out is. */
  onCancel: () => void;
  /** The heading, in `sheetTitle`. */
  title?: string;
  /** A header row instead of a heading: a thumbnail or an avatar with two lines beside it. */
  head?: ReactNode;
  /** The block of buttons at the bottom. It stays put while the body scrolls. */
  footer?: ReactNode;
  /**
   * The height the layout gives this sheet (spec 4, «Высоты листов»). A floor and not a cap: a
   * sheet that holds less pushes its footer down to it (spec 7.1, the `flex-grow` spacer), one that
   * holds more grows to hold it — the handle, the heading and the buttons are never what gives.
   */
  height?: number;
  /**
   * What stands between one block of the sheet and the next, the handle and the buttons included
   * (spec 8). A question — every confirmation, «Это всё?», «Материала мало» — is the default 18;
   * the two sheets the feed is tuned from are `tuning`, 20; the ones that set out facts or rows are
   * `list`, 14.
   */
  rhythm?: keyof typeof RHYTHM;
  children?: ReactNode;
};

const RHYTHM = { list: 14, question: 18, tuning: 20 } as const;

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
 *
 * Every body scrolls once it outgrows the sheet — there is no sheet that does not, so a new one
 * cannot forget to (TASK-358). What stands still around it is {@link pinnable}'s call.
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

/** How much of the window a sheet may take; the rest stays darkness (spec 4). */
const CEILING = 0.9;
const HANDLE = 4;
const EDGE = 1;

/**
 * Whether the handle, the heading and the buttons can stand still while the body scrolls between
 * them (spec 7.1): they, the sheet's own edges and one line of the body fit in the height the sheet
 * was actually given — nine tenths of the window at most. When they do not —
 * the smallest phone at the largest system type — the whole sheet under the handle scrolls as one;
 * pinned, the buttons would stand below the screen with nothing to bring them back, and a body
 * squeezed to nothing is a question nobody can read (TASK-358).
 *
 * All of it is measured: `sheet` is the sheet as laid out, `top` and `foot` the heading and the
 * buttons (`null` where it has none). Scrolling or not, the sheet holds the same blocks with the
 * same gaps, so its height — and the answer — is the same in both, and one never flips the other.
 */
export function pinnable({
  sheet,
  line,
  gap,
  bottom,
  top,
  foot,
}: {
  sheet: number;
  line: number;
  gap: number;
  bottom: number;
  top: number | null;
  foot: number | null;
}): boolean {
  // The column as `Rise` stacks it: handle, heading, body, spacer, buttons — one gap between each.
  const blocks = [HANDLE, top, line, ...(foot === null ? [] : [0, foot])].filter(
    (block) => block !== null,
  );
  const column = blocks.reduce((sum, block) => sum + block, 0) + gap * (blocks.length - 1);
  return EDGE * 2 + space.s3 + column + bottom <= sheet;
}

/** A block's height as it was last laid out, 0 until it has been — for {@link pinnable} and `Board`. */
export function useMeasured(): [number, (event: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(0);
  return [height, (event) => setHeight(event.nativeEvent.layout.height)];
}

function Rise({
  onCancel,
  title,
  head,
  footer,
  height,
  rhythm = 'question',
  children,
}: Omit<SheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [risen, setRisen] = useState(false);
  const rise = useFadeIn(motion.sheet, () => setRisen(true));
  const styles = useStyles();
  const onScrimTap = useScrimTap(onCancel);
  const gap = { gap: RHYTHM[rhythm] };
  const bottom = Math.max(insets.bottom, board.bottom);
  const [sheet, onSheet] = useMeasured();
  const [top, onTop] = useMeasured();
  const [foot, onFoot] = useMeasured();
  const heading = head || title;
  // Until the sheet has been laid out it stands as drawn.
  const pinned =
    sheet === 0 ||
    pinnable({
      sheet,
      line: type.body.lineHeight * fontScale,
      gap: RHYTHM[rhythm],
      bottom,
      top: heading ? top : null,
      foot: footer ? foot : null,
    });

  // Measured wherever they stand — the same width in the column and in the scroll — so moving them
  // from one to the other never changes the answer that moved them.
  const heads = heading ? (
    <View style={gap} onLayout={onTop}>
      {head}
      {title ? (
        <Text role="sheetTitle" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  ) : null;
  const buttons = footer ? (
    <>
      <View style={styles.fill} />
      <View style={styles.footer} onLayout={onFoot}>
        {footer}
      </View>
    </>
  ) : null;

  return (
    // A sheet sits where the keyboard comes up, so anything typed into one would be typed blind.
    // Android's modals already resize themselves; iOS needs telling.
    //
    // Not while the sheet is still rising (TASK-386). Giving way is a layout animation, and one
    // that catches the sheet mid-rise plays it out of the values React holds for it — still the
    // rise's start, invisible and 24 lower, because the rise runs on the native driver — and leaves
    // it there: a field that takes the keyboard on opening («Новый лейбл») got the darkness and the
    // keyboard and no sheet. What the keyboard did meanwhile is kept and given way to at once when
    // the rise ends.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={risen}
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

      {/* One column with one gap, as the layout draws it: handle, blocks, spacer, buttons. The
          spacer takes a gap on either side of it even when it has nothing to give, so the buttons
          never stand closer than two gaps under the last block — the measure the heights of spec 4
          were taken by. Not pinned, the heading and the buttons go into the scroll in the same
          order and with the same gap, so a sheet that fits looks the same either way. */}
      {/* A tap or a drag on the sheet itself, beside its field, takes the keyboard down
          (TASK-377); a tap on the darkness still declines the whole sheet. */}
      <Animated.View
        accessibilityViewIsModal
        {...DISMISS_KEYBOARD}
        onLayout={onSheet}
        style={[
          styles.sheet,
          gap,
          { paddingBottom: bottom },
          height ? { minHeight: height } : null,
          {
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            ],
          },
        ]}
      >
        <View testID="sheet-handle" style={styles.handle} />
        {pinned ? heads : null}
        {/* A body that fits neither scrolls nor bounces. */}
        <ScrollView
          style={pinned ? styles.body : null}
          contentContainerStyle={[gap, pinned ? null : styles.fill]}
          alwaysBounceVertical={false}
          {...KEYBOARD_SCROLL}
        >
          {pinned ? null : heads}
          {children}
          {pinned ? null : buttons}
        </ScrollView>
        {pinned ? buttons : null}
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
      maxHeight: `${CEILING * 100}%`,
      alignSelf: 'center',
      paddingTop: space.s3,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
      borderWidth: EDGE,
      borderColor: color.line,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
    },
    // Spec 7.1: the handle is always the first thing in a sheet, 40 × 4.
    handle: {
      width: 40,
      height: HANDLE,
      borderRadius: radius.pill,
      backgroundColor: color.handle,
      alignSelf: 'center',
    },
    // Between a pinned heading and pinned buttons the body is as tall as it is — the spacer, not
    // the scroll, takes what a floor leaves over — and gives way once it outgrows the sheet.
    body: { flexGrow: 0 },
    // The spacer of spec 7.1: what a sheet with a floor does not fill, it leaves above the footer.
    fill: { flexGrow: 1 },
    // Spec 7.1, detail 8: the buttons at the foot stand 8 apart.
    footer: { gap: space.s2 },
  }),
);
