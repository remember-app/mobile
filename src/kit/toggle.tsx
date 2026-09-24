import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

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
 * Spec 7.3 — a thing that is simply on or off: 52 × 32 with a 26 white grip, `accent` when it is on
 * and `raise` when it is not, and the label stretched along the row beside it. Pressing the label
 * flips it too, which is the whole reason the row is one pressable and not a label next to a switch.
 *
 * The phone's own `Switch` wearing those colours rather than a shape of our own: it is 51 × 31 on
 * iOS to begin with, it is the control a person already knows, and the spec asks for nothing it
 * cannot do. One copy and not two — `switch.d.ts` says why the fourth colour prop matters.
 */
export function Toggle({ label, value, onValueChange, disabled }: ToggleProps) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}
    >
      <Text role="row" style={styles.label}>
        {label}
      </Text>
      <View pointerEvents="none">
        <Switch
          // Announced by the row above, which is the thing a finger actually lands on.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: color.raise, true: color.accent }}
          thumbColor={color.onFill}
          // The same white again, for the half of the web switch `thumbColor` does not reach:
          // switch.d.ts has the why.
          activeThumbColor={color.onFill}
          ios_backgroundColor={color.raise}
        />
      </View>
    </Pressable>
  );
}

/**
 * Spec 7.7 — the switch given a place to stand, in a card (`SheetSort`): a name, a line saying what
 * the setting reaches, and the switch on the right, all on `ink` inside a sheet that is already
 * `surface`. The whole thing flips, label included, the same way the bare `Toggle` does.
 */
export function RowToggle({
  label,
  note,
  value,
  onValueChange,
  disabled,
  style,
}: ToggleProps & {
  /** What the setting reaches, under the name. */
  note?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useRowStyles();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      // The line under the name says what the setting reaches — it is the only place it is explained,
      // and a label alone would keep it from a screen reader.
      accessibilityHint={note}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.card, style]}
    >
      <View style={styles.words}>
        <Text role="row">{label}</Text>
        {note ? (
          <Text role="meta" tone="muted" style={styles.note}>
            {note}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none">
        <Switch
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: color.raise, true: color.accent }}
          thumbColor={color.onFill}
          activeThumbColor={color.onFill}
          ios_backgroundColor={color.raise}
        />
      </View>
    </Pressable>
  );
}

const useRowStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4 - 2,
      paddingVertical: space.s4 - 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.section,
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    words: { flex: 1, minWidth: 0, gap: space.s1 },
    // The explanation runs to a second line rather than being cut: it is the only place the setting
    // is explained at all.
    note: { lineHeight: 17 },
  }),
);

// Shape only: every colour this draws is the switch's own prop, not a style.
const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    // The row keeps a finger's worth of height whatever the platform draws the switch at — iOS
    // draws it at 31, and the label beside it would otherwise sit in a row shorter than a tap.
    minHeight: TAP,
  },
  label: { flex: 1, minWidth: 0 },
});
