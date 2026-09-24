import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';

import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';

/**
 * Spec 7.3, detail 20 — the eight colours a label can be. Circles of 36 in one row with the room
 * between them shared out evenly, and the chosen one wearing a double ring: 3px of the surface it
 * stands on, then 2px of `paper`. Two rings and not a tick, because a tick would have to be read on
 * eight different colours.
 *
 * Every circle is a button that says its colour out loud — spec 10.4: «Цвет 2» tells nobody
 * anything, so the names come in as words from the screen, in the order the colours are in.
 */
export function Palette({
  colors,
  names,
  value,
  onChange,
  on,
  label,
  style,
}: {
  colors: readonly string[];
  /** One per colour: «жёлтый», «розовый», … */
  names: readonly string[];
  value: string;
  onChange: (color: string) => void;
  /** What the circles stand on, which is what the inner ring is drawn in. */
  on?: string;
  /** What the row of them is — «Цвет лейбла». */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.row, style]}>
      {colors.map((swatch, i) => (
        <Swatch
          key={swatch}
          color={swatch}
          name={names[i] ?? swatch}
          selected={swatch === value}
          on={on ?? color.surface}
          onPress={() => onChange(swatch)}
        />
      ))}
    </View>
  );
}

function Swatch({
  color: swatch,
  name,
  selected,
  on,
  onPress,
}: {
  color: string;
  name: string;
  selected: boolean;
  on: string;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, checked: selected }}
      // Spec 10.2: 36 drawn, 44 felt.
      hitSlop={hitSlop(TAP)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.swatch,
        { backgroundColor: swatch },
        // The double ring, as two shadows: the inner one in the colour underneath cuts the circle
        // away from the outer one, so the mark reads on a pale colour as well as on a dark one.
        selected ? { boxShadow: `0 0 0 3px ${on}, 0 0 0 5px ${color.paper}` } : null,
        hovered && !selected ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    />
  );
}

// Shape only: the one colour this draws is the one it is handed.
const styles = StyleSheet.create({
  // 44 tall for a row of 36 circles: `hitSlop` never reaches past the view it is inside (React
  // Native's own note on it), so the four points above and below each circle have to be the row's.
  row: {
    minHeight: TAP,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swatch: { width: 36, height: 36, borderRadius: radius.pill },
  hover: { opacity: 0.85 },
});
