import { ChevronLeft } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { height, photo, radius, space, type Theme, themed, type, useTheme } from '@/ui/theme';
import { Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'link' | 'danger';

const VARIANT: Record<
  ButtonVariant,
  {
    tall: number;
    kind: 'main' | null;
    wide: boolean;
  }
> = {
  primary: { tall: height.primary, kind: 'main', wide: true },
  secondary: { tall: height.primary, kind: 'main', wide: true },
  danger: { tall: height.primary, kind: 'main', wide: true },
  quiet: { tall: height.small, kind: null, wide: false },
  link: { tall: type.label.lineHeight as number, kind: null, wide: false },
};

type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  wide?: boolean;
  disabled?: boolean;
  icon?: IconComponent;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'secondary',
  wide,
  disabled,
  icon,
  onPress,
  style,
}: ButtonProps) {
  const { hovered, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const styles = useStyles();
  const off = !!disabled;
  const link = variant === 'link';
  const tint = contentColor(theme, variant, off);
  const shape = VARIANT[variant];
  const tall = shape.tall;
  const main = shape.kind === 'main';
  return (
    <Pressable
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      hitSlop={hitSlop(tall, tall)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: tall },
        variant === 'secondary' ? null : styles.flat,
        fill(theme, variant, off, hovered),
        variant === 'quiet' ? styles.tight : null,
        link ? styles.bare : null,
        main ? styles.main : null,
        (wide ?? shape.wide) ? styles.wide : null,
        pressed && !reduced ? PRESS : null,
        style,
      ]}
    >
      {icon ? <Icon icon={icon} {...(main ? MAIN_GLYPH : SMALL_GLYPH)} color={tint} /> : null}
      <Text
        role={link ? 'label' : variant === 'quiet' ? 'controlSm' : 'control'}
        style={[{ color: tint, textAlign: 'center' }, link ? styles.underline : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function contentColor({ color }: Theme, variant: ButtonVariant, disabled: boolean): string {
  if (disabled) return color.faint;
  switch (variant) {
    case 'primary':
    case 'danger':
      return color.onFill;
    case 'quiet':
      return color.muted;
    case 'link':
      return color.accentText;
    default:
      return color.paper;
  }
}

const MAIN_GLYPH = { size: 19, stroke: 2.3 } as const;
const SMALL_GLYPH = { size: 16 } as const;

function fill(
  { color, shadow }: Theme,
  variant: ButtonVariant,
  disabled: boolean,
  hovered: boolean,
): ViewStyle {
  if (disabled) return { backgroundColor: color.raise };
  switch (variant) {
    case 'primary':
      return { backgroundColor: color.accent, boxShadow: shadow.primary };
    case 'secondary':
      return {
        borderColor: color.lineStrong,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    case 'danger':
      return { backgroundColor: color.dangerFill };
    case 'quiet':
    case 'link':
      return {};
  }
}

type RoundTone =
  | 'surface'
  | 'outline'
  | 'raise'
  | 'ghost'
  | 'glass'
  | 'viewer'
  | 'video'
  | 'paper'
  | 'spark'
  | 'danger';
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
  hitX,
  glyph: drawn,
  style,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: RoundTone;
  on?: boolean;
  dot?: boolean;
  disabled?: boolean;
  tint?: string;
  hitX?: number;
  glyph?: {
    size: number;
    stroke?: number;
    filled?: boolean;
    shiftX?: number;
  };
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const { color } = theme;
  const styles = useStyles();
  const lit = on ?? false;
  const onAccent = lit && tone !== 'paper';
  const glyph = disabled
    ? color.faint
    : onAccent
      ? color.onFill
      : (tint ?? roundGlyph(color, tone, size));
  return (
    <Pressable
      accessibilityRole={on === undefined ? 'button' : 'togglebutton'}
      accessibilityLabel={label}
      accessibilityState={
        on === undefined ? { disabled: !!disabled } : { disabled: !!disabled, checked: lit }
      }
      disabled={disabled}
      hitSlop={hitX === undefined ? hitSlop(size) : { left: hitX, right: hitX, top: 0, bottom: 0 }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        roundFill(theme, tone, onAccent, hovered),
        disabled ? styles.off : null,
        pressed && !reduced ? PRESS : null,
        style,
      ]}
    >
      <View style={drawn?.shiftX ? { transform: [{ translateX: drawn.shiftX }] } : null}>
        <Icon
          icon={icon}
          size={drawn?.size ?? roundGlyphSize(size)}
          stroke={drawn?.stroke}
          color={glyph}
          fill={tone === 'video' || drawn?.filled ? glyph : undefined}
        />
      </View>
      {dot ? (
        <View
          style={[
            styles.dot,
            {
              top: Math.round(size * DOT_INSET) - DOT_RING,
              right: Math.round(size * DOT_INSET) - DOT_RING,
              borderColor: roundBacking(color, tone, onAccent),
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}
const DOT = 9;
const DOT_RING = 2;
const DOT_INSET = 10 / 56;
function roundGlyphSize(diameter: number): number {
  if (diameter >= 48) return 26;
  if (diameter >= 40) return 24;
  if (diameter > 28) return 16;
  return 14;
}
const BAR_GLYPH = { size: 29, stroke: 2.3, shiftX: -1.5 } as const;
export function BackButton({
  label,
  onPress,
  size,
  tone = 'surface',
  style,
}: {
  label: string;
  onPress: () => void;
  size?: number;
  tone?: 'surface' | 'ghost';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <IconButton
      icon={ChevronLeft}
      label={label}
      size={size}
      tone={tone}
      glyph={BAR_GLYPH}
      onPress={onPress}
      style={style}
    />
  );
}
function roundGlyph(color: Theme['color'], tone: RoundTone, size: number): string {
  switch (tone) {
    case 'surface':
    case 'raise':
    case 'glass':
    case 'viewer':
    case 'video':
    case 'outline':
      return color.paper;
    case 'paper':
      return color.ink;
    case 'spark':
      return color.sparkInk;
    case 'danger':
      return color.dangerText;
    case 'ghost':
      return size >= height.roundBar ? color.paper : color.muted;
  }
}
function roundBacking(color: Theme['color'], tone: RoundTone, on: boolean): string {
  if (on) return color.accent;
  switch (tone) {
    case 'raise':
      return color.raise;
    case 'surface':
    case 'glass':
    case 'viewer':
      return color.surface;
    case 'paper':
      return color.paper;
    case 'spark':
      return color.spark;
    default:
      return color.ink;
  }
}
function roundFill(
  { color, shadow }: Theme,
  tone: RoundTone,
  on: boolean,
  hovered: boolean,
): ViewStyle {
  if (on)
    return {
      backgroundColor: color.accent,
      borderColor: 'rgba(255,255,255,0.14)',
      boxShadow: shadow.round,
    };
  switch (tone) {
    case 'surface':
      return { backgroundColor: color.surface, borderColor: color.line };
    case 'outline':
      return {
        borderColor: color.lineQuiet,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    case 'raise':
      return { backgroundColor: color.raise };
    case 'glass':
      return { backgroundColor: photo.bar, borderColor: photo.barEdge };
    case 'viewer':
      return { backgroundColor: photo.glass };
    case 'video':
      return { backgroundColor: photo.video };
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
      borderRadius: radius.field,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: space.s2,
    },
    flat: { borderWidth: 0 },
    tight: { paddingHorizontal: 14 },
    bare: { paddingHorizontal: 0, borderWidth: 0 },
    underline: { textDecorationLine: 'underline' },
    inRow: { paddingHorizontal: 14, gap: 6 },
    inRowPill: { paddingHorizontal: space.s3, gap: 6 },
    main: { gap: 9 },
    boxed: { borderRadius: radius.field },
    wide: { width: '100%', flexShrink: 1 },
    round: {
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    off: { opacity: 0.45 },
    dot: {
      position: 'absolute',
      width: DOT + DOT_RING * 2,
      height: DOT + DOT_RING * 2,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      borderWidth: DOT_RING,
    },
  }),
);
