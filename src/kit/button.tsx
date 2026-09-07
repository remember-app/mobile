import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme, type Theme } from '@/theme';

import { Spinner } from './empty';
import { ICO, ICO_S, Icon, type IconComponent } from './icon';
import { TAP, hitSlop, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';

/** The kit's `.btn-*` modifiers, section 3. */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'danger'
  | 'danger-solid'
  | 'provider';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  /** `.btn-wide` — full width of its row. */
  wide?: boolean;
  /** `.btn-sm` — 36 high; the slop below keeps the finger target at 44. */
  sm?: boolean;
  /** `aria-busy`: waiting on the server. The label goes invisible but keeps its width, so the
   *  button neither jumps nor looks broken, and the press does not go through twice. */
  busy?: boolean;
  disabled?: boolean;
  icon?: IconComponent;
  /**
   * `.brand-slot` for `variant="provider"` — the Apple or Google mark, which may only ever be drawn
   * from the provider's own set. The kit's dashed square is a slot in a demo, not a mark: until a
   * real one is here the button carries its words alone rather than an empty box.
   */
  brand?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The kit's button, section 3. Height 48 so a finger lands on it, pill-shaped, and exactly one
 * `primary` per screen — that is the one carrying the safelight glow.
 */
export function Button({
  label,
  variant = 'secondary',
  wide,
  sm,
  busy,
  disabled,
  icon,
  brand,
  onPress,
  style,
}: ButtonProps) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const focusRing = useFocusRing();
  const off = !!disabled;
  const tint = contentColor(theme, variant, off, hovered);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // `busy` counts as disabled here as well as below: RN only speaks `busy` on Android, so on
      // iOS the button would otherwise read as live while it is swallowing every tap.
      accessibilityState={{ disabled: off || !!busy, busy: !!busy }}
      disabled={off || busy}
      hitSlop={sm ? hitSlop(TAP, 36) : undefined}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.btn,
        fill(theme, variant, off, hovered),
        variant === 'quiet' || sm ? styles.tight : null,
        sm ? styles.sm : null,
        variant === 'provider' ? styles.provider : null,
        wide || variant === 'provider' ? styles.wide : null,
        off ? styles.off : null,
        // The kit's 1px press dip — a movement, so it goes when motion is turned down.
        pressed && !reduced ? styles.press : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {/* Hidden rather than unmounted: the button must not resize while it waits. */}
      <View
        style={[
          styles.content,
          variant === 'provider' ? styles.contentProvider : null,
          busy ? styles.hidden : null,
        ]}
      >
        {variant === 'provider' ? brand : null}
        {icon ? <Icon icon={icon} size={sm ? ICO_S : ICO} color={tint} /> : null}
        <Text style={[styles.label, sm ? styles.labelSm : null, { color: tint }]}>{label}</Text>
      </View>
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.busy]} pointerEvents="none">
          <Spinner size={18} track={tint} head="transparent" />
        </View>
      ) : null}
    </Pressable>
  );
}

/** What the label and icon are drawn in. Disabled primary loses the ember it sat on. */
function contentColor(
  { color, shade }: Theme,
  variant: ButtonVariant,
  disabled: boolean,
  hovered: boolean,
): string {
  if (variant === 'primary') return disabled ? color.muted : shade.onEmber;
  if (variant === 'quiet') return hovered ? color.paper : color.muted;
  if (variant === 'danger') return shade.rustText;
  // `.btn-danger-solid` reads on rust and not on the screen behind it, which in daylight is the
  // other way up from `paper`.
  if (variant === 'danger-solid') return shade.onRust;
  return color.paper;
}

/** Background, border and glow. Hover only ever resolves true on web. */
function fill(
  { color, shade, glow }: Theme,
  variant: ButtonVariant,
  disabled: boolean,
  hovered: boolean,
): ViewStyle {
  switch (variant) {
    case 'primary':
      return disabled
        ? { backgroundColor: color.raise }
        : { backgroundColor: hovered ? shade.emberHi : color.ember, boxShadow: glow };
    case 'secondary':
    case 'provider':
      return {
        backgroundColor: hovered ? color.raise : color.surface,
        borderColor: hovered ? shade.lineHi : color.line,
      };
    case 'danger':
      return {
        borderColor: shade.rustLine,
        backgroundColor: hovered ? shade.rustFillHi : 'transparent',
      };
    case 'danger-solid':
      return { backgroundColor: color.rust };
    case 'quiet':
      return {};
  }
}

// Nothing here is a colour: with the dashed brand slot gone the button's own sheet is shape and
// rhythm only, and everything that has two answers comes through `fill` and `contentColor`.
const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: space.s5,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  // `.btn-quiet` and `.btn-sm` both pull the sides in to 12.
  tight: { paddingHorizontal: space.s3 },
  sm: { minHeight: 36 },
  wide: { width: '100%', flexShrink: 1 },
  provider: { justifyContent: 'flex-start' },
  off: { opacity: 0.45 },
  press: { transform: [{ translateY: 1 }] },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  // `.btn-provider` sets its own gap — the mark stands further off its words.
  contentProvider: { gap: space.s3 },
  hidden: { opacity: 0 },
  busy: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, lineHeight: 16, fontWeight: '600' },
  labelSm: { fontSize: 14, lineHeight: 14 },
});
