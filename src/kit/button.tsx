import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { height, photo, radius, space, themed, useTheme, type Theme } from '@/theme';

import { Spinner } from './empty';
import { ICO_S, Icon, type IconComponent } from './icon';
import { PRESS, hitSlop, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.2 — the buttons. Six of them wear words and one is round and wears a glyph, and which is
 * which is a matter of weight, never of taste: exactly one `primary` per screen, because `accent`
 * is the one main action and nothing else.
 */
export type ButtonVariant =
  | 'primary'
  | 'paper'
  | 'secondary'
  | 'small'
  | 'quiet'
  | 'danger'
  | 'danger-outline';

/** The heights of spec 4, by the place a button stands in rather than by the number. */
export type ButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

const SIZES: Record<ButtonSize, number> = {
  // Spec 7.2 gives the dangerous button two heights, and the taller one has exactly one place in the
  // product: «Выйти из аккаунта» at the foot of `Account`.
  xl: height.logout,
  lg: height.primary,
  md: height.sheetButton,
  sm: height.small,
  xs: height.rowButton,
};

/** What each variant stands at unless a caller says otherwise. */
const DEFAULT_SIZE: Record<ButtonVariant, ButtonSize> = {
  primary: 'lg',
  paper: 'lg',
  secondary: 'lg',
  small: 'sm',
  quiet: 'sm',
  danger: 'lg',
  'danger-outline': 'lg',
};

/** The loud ones run the width they are given; the two quiet ones are as wide as their words. */
const DEFAULT_WIDE: Record<ButtonVariant, boolean> = {
  primary: true,
  paper: true,
  secondary: true,
  small: false,
  quiet: false,
  danger: true,
  'danger-outline': true,
};

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width of its row, or exactly its words. Left off, the variant decides. */
  wide?: boolean;
  /**
   * Waiting on the server (spec 7.2): the label gives way to a spinner and to the same action said
   * in the continuous — «Отправляем» for «Отправить» — and the button stops taking presses. The
   * continuous form is a word, so it comes from the screen; without one the label simply stays.
   */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  /** A glyph before the words — the plus on «Новое воспоминание». */
  icon?: IconComponent;
  /** A glyph after them — the chevron on «Дальше» in the wizard. */
  trailingIcon?: IconComponent;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'secondary',
  size,
  wide,
  busy,
  busyLabel,
  disabled,
  icon,
  trailingIcon,
  onPress,
  style,
}: ButtonProps) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const styles = useStyles();
  // Spec 2.5: a ring in `paper` on the one button that is itself filled with `accent`.
  const focusRing = useFocusRing(variant === 'primary' && !disabled);
  const off = !!disabled;
  const tint = contentColor(theme, variant, off);
  const tall = SIZES[size ?? DEFAULT_SIZE[variant]];
  const words = busy ? (busyLabel ?? label) : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={words}
      // `busy` counts as disabled here as well as below: React Native only speaks `busy` on
      // Android, so on iOS the button would otherwise read as live while it swallows every tap.
      accessibilityState={{ disabled: off || !!busy, busy: !!busy }}
      disabled={off || busy}
      hitSlop={hitSlop(tall, tall)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: tall },
        fill(theme, variant, off, hovered),
        variant === 'quiet' || variant === 'small' ? styles.tight : null,
        (wide ?? DEFAULT_WIDE[variant]) ? styles.wide : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {busy ? <Spinner size={18} track={tint} head="transparent" /> : null}
      {icon && !busy ? <Icon icon={icon} size={ICO_S} color={tint} /> : null}
      <Text role={variant === 'small' ? 'label' : 'control'} style={{ color: tint }}>
        {words}
      </Text>
      {trailingIcon && !busy ? <Icon icon={trailingIcon} size={ICO_S} color={tint} /> : null}
    </Pressable>
  );
}

/** What the words and the glyph are drawn in. A disabled button loses the fill it sat on. */
function contentColor({ color }: Theme, variant: ButtonVariant, disabled: boolean): string {
  if (disabled) return color.faint;
  switch (variant) {
    case 'primary':
    case 'danger':
      return color.onFill;
    case 'paper':
      return color.ink;
    case 'quiet':
      return color.muted;
    case 'danger-outline':
      return color.dangerText;
    default:
      return color.paper;
  }
}

/** Fill, border and — on the main button alone — the shadow that names it the main one. */
function fill(
  { color, shadow }: Theme,
  variant: ButtonVariant,
  disabled: boolean,
  hovered: boolean,
): ViewStyle {
  // Spec 7.2: unavailable is `raise` and `faint`, and the shadow goes with the fill.
  if (disabled) return { backgroundColor: color.raise };
  switch (variant) {
    case 'primary':
      return { backgroundColor: color.accent, boxShadow: shadow.primary };
    case 'paper':
      return { backgroundColor: color.paper };
    case 'secondary':
      return {
        borderColor: color.lineStrong,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    case 'small':
      return { borderColor: color.line, backgroundColor: hovered ? color.raise : 'transparent' };
    // No shadow: a shadow would make it the main action of the screen, and it never is.
    case 'danger':
      return { backgroundColor: color.dangerFill };
    case 'danger-outline':
      return { borderColor: color.danger, backgroundColor: 'transparent' };
    case 'quiet':
      return {};
  }
}

/**
 * Spec 7.2 — the round button, at the five diameters the layout draws: 56 at the foot of the
 * gallery, 48 in the viewer, 44 in a bar, 36 in a row, 32 on a banner. Under 44 the drawn size
 * stays and the finger target grows out to 44 (spec 10.2).
 *
 * `label` is not optional: a glyph alone says nothing to a screen reader.
 */
export type RoundTone = 'surface' | 'ghost' | 'glass' | 'paper' | 'spark' | 'danger';

export function IconButton({
  icon,
  label,
  onPress,
  size = height.roundBar,
  tone = 'ghost',
  on,
  dot,
  disabled,
  tint,
  style,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: RoundTone;
  /**
   * A button that stays in rather than firing and letting go — picking mode in the memory's header.
   * Passing it at all is what makes this a switch; left off the button is a plain one and says so,
   * because `checked: false` on something that does not toggle reads as an unticked box.
   */
  on?: boolean;
  /** Spec 7.4 — the spark dot: «this is no longer at its default» (a filter on, a sort changed). */
  dot?: boolean;
  disabled?: boolean;
  /** An override for the glyph's colour where the place demands it, not where taste does. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const lit = on ?? false;
  const glyph = disabled
    ? color.faint
    : lit
      ? color.sparkInk
      : (tint ?? (tone === 'paper' ? color.ink : tone === 'danger' ? color.dangerText : color.muted));

  return (
    <Pressable
      accessibilityRole={on === undefined ? 'button' : 'togglebutton'}
      accessibilityLabel={label}
      accessibilityState={
        on === undefined ? { disabled: !!disabled } : { disabled: !!disabled, checked: lit }
      }
      disabled={disabled}
      hitSlop={hitSlop(size)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        roundFill(color, tone, lit, hovered),
        disabled ? styles.off : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      <Icon icon={icon} size={size >= 48 ? 22 : size >= 40 ? 20 : 18} color={glyph} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

function roundFill(
  color: Theme['color'],
  tone: RoundTone,
  on: boolean,
  hovered: boolean,
): ViewStyle {
  if (on) return { backgroundColor: color.spark };
  switch (tone) {
    case 'surface':
      return { backgroundColor: color.surface, borderColor: color.line };
    // The viewer's glass: there is no surface behind a button standing over a photograph.
    case 'glass':
      return { backgroundColor: photo.glass };
    case 'paper':
      return { backgroundColor: color.paper };
    case 'spark':
      return { backgroundColor: color.spark };
    case 'danger':
    case 'ghost':
      return { backgroundColor: hovered ? color.raise : 'transparent' };
  }
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    btn: {
      paddingHorizontal: space.s5,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: space.s2,
    },
    // Spec 7.2: the quiet one and the small one both pull their sides in.
    tight: { paddingHorizontal: space.s3 },
    // A small button never shrinks when the row beside it runs long.
    wide: { width: '100%', flexShrink: 1 },
    round: {
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    off: { opacity: 0.45 },
    // Spec 7.4: a 9px dot ringed 2px in the colour of what it sits on.
    dot: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      borderWidth: 2,
      borderColor: color.ink,
    },
  }),
);
