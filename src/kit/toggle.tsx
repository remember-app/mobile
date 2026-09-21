import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
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
 * Spec 7.7 — the switch given a place to stand, in the two the layout draws:
 *
 * - **in a card** (`SheetSort`) — a name, a line saying what the setting reaches, and the switch on
 *   the right, all on `ink` inside a sheet that is already `surface`;
 * - **in a pill** (`MontageLive`) — 52 tall and round-ended, a glyph, one line, the switch. It
 *   stands in the bottom layer where a button would, because it is the only thing that screen asks.
 *
 * The whole thing flips, label included, the same way the bare `Toggle` does.
 */
export function RowToggle({
  label,
  note,
  icon,
  variant = 'card',
  value,
  onValueChange,
  disabled,
  style,
}: ToggleProps & {
  /** What the setting reaches, under the name. The card kind has it; the pill kind has no room. */
  note?: string;
  /** The glyph that opens the pill — a bell on «Сообщить, когда будет готово». */
  icon?: IconComponent;
  variant?: 'card' | 'pill';
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useRowStyles();
  const pill = variant === 'pill';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[pill ? styles.pill : styles.card, style]}
    >
      {icon ? <Icon icon={icon} size={18} color={color.muted} /> : null}
      <View style={styles.words}>
        <Text role={pill ? 'note' : 'row'}>{label}</Text>
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
    pill: {
      height: height.togglePill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingLeft: space.s4,
      paddingRight: 6,
      borderRadius: radius.pill,
      backgroundColor: color.surface,
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
