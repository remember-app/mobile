import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { themed } from '@/theme';

import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/** Spec 7.2, detail 79 — the sizes a film's name is tried at, largest first; its line stays 40. */
export const NAME_SIZES = [33, 30, 27, 24, 21] as const;

/**
 * The size a name is set at: the largest of {@link NAME_SIZES} at which it fits `room` whole, given
 * how `wide` it runs at the first of them — the face and its tracking both scale with the size, so
 * one measure answers for all five. Past the last it stays the last, and the name is cut there. Not
 * measured yet, it is the first.
 */
export function nameSize(wide: number, room: number): number {
  if (wide === 0 || room === 0) return NAME_SIZES[0];
  return (
    NAME_SIZES.find((size) => (wide * size) / NAME_SIZES[0] <= room) ??
    NAME_SIZES[NAME_SIZES.length - 1]
  );
}

/**
 * Spec 7.2, detail 79 — a film's name as the heading of the order's total (`MontageSummary`), and the
 * way to rename it: not a field but the heading itself, pressed. The dashed rule under the words — and
 * only as long as they are — says it can be written over.
 *
 * Always one line: the name is set at the largest size it fits the column at (`nameSize`), and cut
 * with an ellipsis at the smallest — one of the seven places the spec cuts, confirmed by chief: the
 * whole name is a press away. The line is 40 whatever the size, so nothing under it moves.
 */
export function NameHeading({
  name,
  label,
  onPress,
  style,
}: {
  name: string;
  /** «Переименовать ролик. Сейчас: Ролик для родителей» — from the screen. */
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();
  const [room, setRoom] = useState(0);
  const [wide, setWide] = useState(0);
  const size = nameSize(wide, room);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      {...props}
      style={({ pressed }) => [
        styles.heading,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      <View style={styles.name}>
        <Text
          role="filmName"
          numberOfLines={1}
          style={{ fontSize: size, letterSpacing: -0.04 * size }}
        >
          {name}
        </Text>
        <View style={styles.dash}>
          <View style={styles.dashLine} />
        </View>
      </View>
      {/* The name once more, unseen and at the first size, in room for any of it: its width is
          what the size is picked by. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text role="filmName" onLayout={(event) => setWide(event.nativeEvent.layout.width)}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

/** How thick the dashed rule is, and how far under the words it runs. */
const DASH = 1.5;

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The line of 40, 6 down to the rule, and the rest of the 50 under it.
    heading: { paddingBottom: 10 - 6 - DASH },
    name: { alignSelf: 'flex-start', maxWidth: '100%' },
    // One dashed edge of a box, the rest of it clipped: React Native dashes a whole border or none.
    dash: { height: DASH, marginTop: 6, overflow: 'hidden' },
    dashLine: {
      height: DASH * 3,
      marginHorizontal: -DASH,
      borderWidth: DASH,
      borderStyle: 'dashed',
      borderColor: color.lineStrong,
    },
    measure: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4096,
      alignItems: 'flex-start',
      opacity: 0,
      pointerEvents: 'none',
    },
  }),
);
