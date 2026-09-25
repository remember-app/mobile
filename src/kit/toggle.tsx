import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed } from '@/theme';

import { TAP } from './tap';
import { Text } from './text';

export type ToggleProps = {
  /** The word beside it — and its own name, because a switch says nothing on its own. */
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * Spec 7.3, detail 17 — the switch itself: 52 × 32, a 26 white grip 3 in from its edge; `accent`
 * when it is on, `raise` inside a `line` hairline with the grip against the left when it is off.
 *
 * Drawn here and not the phone's own `Switch`: that one is the size the system decides — 63 × 28 on
 * iOS 26 — and never the layout's. Nothing moves when it flips: spec 6 gives the switch no motion, so
 * the grip is simply at the other end. It is the row that is pressed and read out, so the drawing
 * itself is hidden from a screen reader.
 */
function Track({ value, disabled }: { value: boolean; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, value ? styles.on : styles.off, disabled ? styles.unavailable : null]}
    >
      <View style={styles.grip} />
    </View>
  );
}

/**
 * Spec 7.3 — a thing that is simply on or off, and the label stretched along the row beside it.
 * Pressing the label flips it too, which is the whole reason the row is one pressable and not a
 * label next to a switch.
 */
export function Toggle({ label, value, onValueChange, disabled }: ToggleProps) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}
    >
      <Text role="row" style={styles.grow}>
        {label}
      </Text>
      <Track value={value} disabled={disabled} />
    </Pressable>
  );
}

/**
 * Spec 7.7, detail 59 — the switch given a place to stand, in a 26 card on `surface` (`Account`,
 * «Даты между днями»): the name across the card and the switch on the right, with nothing under the
 * name — the change shows itself. The whole card flips, label included, the same way the bare
 * `Toggle` does.
 */
export function RowToggle({
  label,
  value,
  onValueChange,
  disabled,
  style,
}: ToggleProps & { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.card, style]}
    >
      <Text role="row" style={styles.label}>
        {label}
      </Text>
      <Track value={value} disabled={disabled} />
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
      // The row keeps a finger's worth of height beside a switch drawn at 32.
      minHeight: TAP,
    },
    grow: { flex: 1, minWidth: 0 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4 - 2,
      paddingVertical: space.s4 - 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.cover,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    // 16 / 600: a shade over a list row's name, because it is the whole of what the card says.
    label: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21 },
    // The hairline is always there and only coloured when off, so the grip stands 3 in either way.
    track: {
      width: 52,
      height: 32,
      padding: 2,
      borderWidth: 1,
      borderRadius: radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
    },
    on: { backgroundColor: color.accent, borderColor: color.accent, justifyContent: 'flex-end' },
    off: { backgroundColor: color.raise, borderColor: color.line, justifyContent: 'flex-start' },
    // Spec 7.2's unavailable reads through the fill; a switch keeps its colours and goes out.
    unavailable: { opacity: 0.45 },
    grip: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.onFill },
  }),
);
