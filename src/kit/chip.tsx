import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Avatar } from './member';
import { Text } from './text';

/**
 * Spec 7.3 — the chip: a pill that is offered rather than pressed home. Five heights, each
 * belonging to a place rather than to a taste (spec 7.3, spec 8):
 *
 * - **44** — a person to call in on `SheetInvite`, the tallest and the only one that carries a
 *   face: the face at 32, the name 8 after it, a `line` hairline;
 * - **40** — a filter;
 * - **36** — the quick days on `Create`, which stand on `surface` instead of on nothing, 13 a side;
 * - **34** — the journal's own filter, where a row of them sits under a bar: 13 / 600;
 * - **28** — «Все» in the head of every section of the filter (detail 80): 12 / 600 and pulled in to
 *   12 a side.
 *
 * What stands inside is the rest of it: words alone, a face and a name, a colour square and a name
 * (a label, spec 10.8.2), a glyph, and a count that is the same words a shade quieter.
 *
 * Chips lie in a wrapping row 8 apart and wrap as they need to; that row belongs to the screen. A
 * chip wider than the whole row — a long name on the largest system type — breaks its name onto a
 * second line instead of running past the edge of the screen: the width never cuts a chip.
 */
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
  /** A person's name — the chip then carries their circle at 32 in front of it. */
  avatar?: string;
  /** A label's colour — the chip then carries an 18 square of it in front of it. */
  swatch?: string;
  /** A glyph before the words: `lock` on a label only you can see. */
  icon?: IconComponent;
  /**
   * How many frames are behind this chip — «312», drawn in the same words at 60%. A figure, not a
   * sentence: it stands after the name with nothing between them.
   */
  count?: string;
  /** Chosen: the chip fills with `paper` and loses its border, the way a segment does. */
  selected?: boolean;
  /**
   * Read out as a switch that says which way it stands (`aria-pressed`) rather than as a button —
   * «Все» over a filter section, which is at once that section's state and the way to clear it.
   */
  toggle?: boolean;
  /** What it is read out as when the words alone do not say which one it is: «Все: Тип». */
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
      // A chip nobody can press is a label, and a label is not a button — so it says nothing about
      // being pressable to a screen reader either.
      accessibilityRole={onPress ? (toggle ? 'togglebutton' : 'button') : undefined}
      // The count belongs to the name when it is read out: «13 сентября 312» is one thing.
      accessibilityLabel={name ?? (count ? `${label} ${count}` : label)}
      accessibilityState={
        onPress
          ? toggle
            ? { disabled: !!disabled, checked: !!selected }
            : { disabled: !!disabled, selected: !!selected }
          : undefined
      }
      disabled={disabled || !onPress}
      // Spec 10.2: every one of them is drawn under 44 and felt at 44. Height only — a chip is
      // as wide as its words, and those are already wider than a finger.
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
      {/* A colour with nothing in it: the label's name is right beside it, and a square that
          repeats it out loud is a second name. */}
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
    // Spec 7.3, detail 16 `[правлено]`: the quick days are 13 a side, so the four stand in the
    // column of 358 on one line (353.5) — the layout's 14 ran 1.3 past it on either side.
    quickSides: { paddingHorizontal: 13 },
    // `SheetInvite`: the name 8 after the face, and a `line` hairline rather than the filter's.
    person: { gap: space.s2 },
    lined: { borderColor: color.line },
    // A chip with a face or a colour in it pulls its left side in so the circle sits against the edge.
    chipLead: { paddingLeft: 6 },
    outlined: { borderColor: color.lineQuiet },
    // The quick days stand on a screen and not over a list, so they carry a fill of their own.
    quick: { backgroundColor: color.surface, borderColor: color.line },
    selected: { backgroundColor: color.paper },
    // The name is what gives when the chip meets the edge of its row; the face, the square and the
    // count keep their size.
    label: { flexShrink: 1 },
    hover: { backgroundColor: color.raise },
    // Spec 7.3: the count is the same words at 60%, never a second colour and never a badge.
    count: { opacity: 0.6, fontVariant: ['tabular-nums'] },
    swatch: { width: 18, height: 18, borderRadius: 6 },
  }),
);
