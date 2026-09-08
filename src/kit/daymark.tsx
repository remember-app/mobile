import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space, themed } from '@/theme';

import { Text } from './text';

/**
 * The kit's `.daymark`: the day a strip of the contact sheet was shot on, and at its right edge the
 * one thing that belongs to that day — the count of what is under it, or the action that acts on
 * it. Between them the hairline the kit calls «рез между полосками на листе», so whatever stands on
 * the right is held at the edge rather than left floating against the date.
 *
 * No horizontal padding of its own, which is the one place this parts from the kit's `.daymark`:
 * there the 16 is what puts the day back over a sheet bled out to the edges of the screen, and here
 * the sheet stands inside the screen's own padding already — a second inset would step every day
 * off the frames it names.
 */
export function DayMark({
  label,
  children,
  style,
}: {
  label: string;
  /** The right edge: this day's count, or the one action that belongs to this day. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.daymark, style]}>
      <Text role="meta">{label}</Text>
      <View style={styles.line} />
      {children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    daymark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: 44,
      paddingTop: space.s4,
      paddingBottom: space.s2,
    },
    line: { flex: 1, minWidth: space.s6, height: 1, backgroundColor: color.line },
  }),
);
