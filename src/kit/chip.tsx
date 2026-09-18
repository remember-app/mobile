import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Avatar } from './member';
import { Text } from './text';

/**
 * Spec 7.3 — the chip: a pill 44 high that is offered rather than pressed home. Four kinds, and the
 * difference between them is what stands inside: words alone, a face and a name, the same chip
 * already chosen, or one there is nothing behind.
 *
 * Chips lie in a wrapping row 8 apart and wrap as they need to; that row belongs to the screen.
 */
export function Chip({
  label,
  avatar,
  selected,
  disabled,
  onPress,
  style,
}: {
  label: string;
  /** A person's name — the chip then carries their circle at 32 in front of it. */
  avatar?: string;
  /** Chosen: the chip fills with `paper` and loses its border, the way a segment does. */
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      // A chip nobody can press is a label, and a label is not a button — so it says nothing about
      // being pressable to a screen reader either.
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={onPress ? { disabled: !!disabled, selected: !!selected } : undefined}
      disabled={disabled || !onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.chip,
        avatar ? styles.chipAvatar : null,
        selected ? styles.selected : styles.outlined,
        hovered && !selected ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {avatar ? <Avatar name={avatar} size={32} /> : null}
      <Text
        role="chip"
        numberOfLines={1}
        style={{ color: disabled ? color.faint : selected ? color.ink : color.paper }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    chip: {
      minHeight: height.small,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    // A chip with a face in it pulls its left side in to 6 so the circle sits against the edge.
    chipAvatar: { paddingLeft: 6 },
    outlined: { borderColor: color.line },
    selected: { backgroundColor: color.paper },
    hover: { backgroundColor: color.raise },
  }),
);
