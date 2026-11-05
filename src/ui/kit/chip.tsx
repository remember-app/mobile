import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, themed, useTheme } from '@/ui/theme';
import { Avatar } from './avatar';
import { Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export type ChipSize = 44 | 40 | 36 | 34 | 28;
export function Chip({
  label,
  size = 40,
  avatar,
  swatch,
  icon,
  count,
  selected,
  toggle,
  name,
  disabled,
  onPress,
  style,
}: {
  label: string;
  size?: ChipSize;
  avatar?: string;
  swatch?: string;
  icon?: IconComponent;
  count?: string;
  selected?: boolean;
  toggle?: boolean;
  name?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const tint = disabled ? color.faint : selected ? color.ink : color.paper;
  const lead = avatar || swatch;
  const role = size === 28 ? 'chipXs' : size === 34 ? 'label' : 'chip';
  return (
    <Pressable
      accessibilityRole={onPress ? (toggle ? 'togglebutton' : 'button') : undefined}
      accessibilityLabel={name ?? (count ? `${label} ${count}` : label)}
      accessibilityState={
        onPress
          ? toggle
            ? { disabled: !!disabled, checked: !!selected }
            : { disabled: !!disabled, selected: !!selected }
          : undefined
      }
      disabled={disabled || !onPress}
      hitSlop={hitSlop(TAP, size)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.chip,
        { minHeight: size },
        size === 28 ? styles.tag : size === 36 ? styles.quickSides : null,
        size === 44 ? styles.person : null,
        lead ? styles.chipLead : null,
        selected
          ? styles.selected
          : size === 36
            ? styles.quick
            : size === 44
              ? styles.lined
              : styles.outlined,
        hovered && !selected ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {avatar ? <Avatar name={avatar} size={32} /> : null}

      {swatch && !avatar ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.swatch, { backgroundColor: swatch }]}
        />
      ) : null}
      {icon ? <Icon icon={icon} size={14} color={selected ? color.ink : color.muted} /> : null}
      <Text role={role} style={[styles.label, { color: tint }]}>
        {label}
      </Text>
      {count ? (
        <Text role={role} style={[styles.count, { color: tint }]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: space.s4 - 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tag: { paddingHorizontal: space.s3 },
    quickSides: { paddingHorizontal: 13 },
    person: { gap: space.s2 },
    lined: { borderColor: color.line },
    chipLead: { paddingLeft: 6 },
    outlined: { borderColor: color.lineQuiet },
    quick: { backgroundColor: color.surface, borderColor: color.line },
    selected: { backgroundColor: color.paper },
    label: { flexShrink: 1 },
    hover: { backgroundColor: color.raise },
    count: { opacity: 0.6, fontVariant: ['tabular-nums'] },
    swatch: { width: 18, height: 18, borderRadius: 6 },
  }),
);
