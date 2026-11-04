import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { letGo, SIDEWAYS } from '@/lib/gesture';
import { backdrop, board, duration as motion, radius, space, themed, type } from '@/theme';
import { SheetFoot } from './button';
import {
  DISMISS_KEYBOARD,
  EASE,
  KEYBOARD_SCROLL,
  useFadeIn,
  useReducedMotion,
} from './interaction';
import { Text, TYPE_MOST } from './text';
export type SheetProps = {
  visible: boolean;
  onCancel: () => void;
  title?: string;
  head?: ReactNode;
  lead?: ReactNode;
  footer?: ReactNode;
  height?: number;
  rhythm?: keyof typeof RHYTHM;
  children?: ReactNode;
};
const RHYTHM = { list: 14, question: 18, tuning: 20 } as const;
export function Sheet({ visible, onCancel, ...rest }: SheetProps) {
  useShutOnBlur(visible, onCancel);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Rise onCancel={onCancel} {...rest} />
    </Modal>
  );
}
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
export const SCRIM_DEAF_MS = 300;
export function useScrimTap(onCancel: () => void): () => void {
  const openedAt = useRef(Date.now());
  return () => {
    if (Date.now() - openedAt.current >= SCRIM_DEAF_MS) onCancel();
  };
}
const CEILING = 0.9;
const HANDLE = 4;
const EDGE = 1;
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
  const blocks = [HANDLE, top, line, ...(foot === null ? [] : [0, foot])].filter(
    (block) => block !== null,
  );
  const column = blocks.reduce((sum, block) => sum + block, 0) + gap * (blocks.length - 1);
  return EDGE + space.s3 + column + bottom <= sheet;
}
export function useMeasured(): [number, (event: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(0);
  return [height, (event) => setHeight(event.nativeEvent.layout.height)];
}
const LEAD = space.s2;
function Rise({
  onCancel,
  title,
  head,
  lead,
  footer,
  height,
  rhythm = 'question',
  children,
}: Omit<SheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [risen, setRisen] = useState(false);
  const rise = useFadeIn(motion.sheet, () => setRisen(true));
  const reduced = useReducedMotion();
  const drag = useRef(new Animated.Value(0)).current;
  const styles = useStyles();
  const onScrimTap = useScrimTap(onCancel);
  const gap = { gap: RHYTHM[rhythm] };
  const bottom = Math.max(insets.bottom, board.bottom);
  const [sheet, onSheet] = useMeasured();
  const [top, onTop] = useMeasured();
  const [foot, onFoot] = useMeasured();
  const heading = head || title;
  const closer = lead && heading ? { marginTop: LEAD - RHYTHM[rhythm] } : null;
  const pinned =
    sheet === 0 ||
    pinnable({
      sheet,
      line: type.body.lineHeight * Math.min(fontScale, TYPE_MOST),
      gap: RHYTHM[rhythm],
      bottom,
      top: heading ? top : null,
      foot: footer ? foot : null,
    });
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const still = useRef(reduced);
  still.current = reduced;
  const catchUp = () => {
    if (still.current) return drag.setValue(0);
    Animated.timing(drag, {
      toValue: 0,
      duration: motion.sheet,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  };
  const pull = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => g.dy >= SIDEWAYS && g.dy > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (letGo(g)) return cancel.current();
          catchUp();
        },
        onPanResponderTerminate: catchUp,
      }).panHandlers,
    [],
  );
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
        <SheetFoot.Provider value>{footer}</SheetFoot.Provider>
      </View>
    </>
  ) : null;
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={risen}
    >
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
        onAccessibilityEscape={onCancel}
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
              { translateY: drag },
            ],
          },
        ]}
      >
        <View {...pull} style={gap}>
          <View testID="sheet-handle" style={styles.handle} />
          {pinned ? heads : null}
        </View>

        <ScrollView
          style={pinned ? [styles.body, closer] : null}
          contentContainerStyle={[gap, pinned ? null : styles.fill]}
          alwaysBounceVertical={false}
          {...KEYBOARD_SCROLL}
        >
          {pinned ? null : heads}
          {lead ? <View style={pinned ? null : closer}>{lead}</View> : null}
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
      borderTopWidth: EDGE,
      borderTopColor: color.line,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
    },
    handle: {
      width: 40,
      height: HANDLE,
      borderRadius: radius.pill,
      backgroundColor: color.handle,
      alignSelf: 'center',
    },
    body: { flexGrow: 0 },
    fill: { flexGrow: 1 },
    footer: { gap: space.s2 },
  }),
);
