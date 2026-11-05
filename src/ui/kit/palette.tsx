import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/ui/theme';
import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
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
  names: readonly string[];
  value: string;
  onChange: (color: string) => void;
  on?: string;
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
      hitSlop={hitSlop(TAP)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.swatch,
        { backgroundColor: swatch },
        selected ? { boxShadow: `0 0 0 3px ${on}, 0 0 0 5px ${color.paper}` } : null,
        hovered && !selected ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    />
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: TAP,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swatch: { width: 36, aspectRatio: 1, flexShrink: 1, borderRadius: radius.pill },
  hover: { opacity: 0.85 },
});
