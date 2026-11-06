import { ChevronLeft } from 'lucide-react-native';
import { createContext, useContext } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { height, photo, radius, space, type Theme, themed, type, useTheme } from '@/ui/theme';
import { ICO, ICO_S, ICO_XS, Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, useHoverFocus, useReducedMotion } from './interaction';
import { Text, type TypeRole } from './text';
export type ButtonVariant =
  | 'primary'
  | 'paper'
  | 'secondary'
  | 'small'
  | 'outline'
  | 'raise'
  | 'quiet'
  | 'link'
  | 'danger'
  | 'dashed';
export type ButtonSize = 'xl' | 'lg' | 'md' | 'ms' | 'sm' | 'xs' | 'mini' | 'xxs' | 'line';
const SIZES: Record<ButtonSize, number> = {
  xl: height.logout,
  lg: height.primary,
  md: height.sheetButton,
  ms: height.quietSheet,
  sm: height.small,
  xs: height.rowButton,
  mini: height.roundRow,
  xxs: height.roundTiny,
  line: type.label.lineHeight as number,
};
const DEFAULT_SIZE: Record<ButtonVariant, ButtonSize> = {
  primary: 'lg',
  paper: 'lg',
  secondary: 'lg',
  small: 'sm',
  outline: 'mini',
  raise: 'mini',
  quiet: 'sm',
  link: 'line',
  danger: 'lg',
  dashed: 'md',
};
export const SheetFoot = createContext(false);
const RINGED = new Set<ButtonVariant>(['secondary', 'small', 'outline', 'dashed']);
export const DEFAULT_WIDE: Record<ButtonVariant, boolean> = {
  primary: true,
  paper: true,
  secondary: true,
  small: false,
  outline: false,
  raise: false,
  quiet: false,
  link: false,
  danger: true,
  dashed: true,
};
export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  wide?: boolean;
  disabled?: boolean;
  icon?: IconComponent;
  glyph?: {
    size: number;
    stroke?: number;
  };
  trailingIcon?: IconComponent;
  labelRole?: TypeRole;
  labelTone?: 'paper';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};
export function Button({
  label,
  variant = 'secondary',
  size,
  wide,
  disabled,
  icon,
  glyph: drawn,
  trailingIcon,
  labelRole,
  labelTone,
  onPress,
  style,
}: ButtonProps) {
  const { hovered, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const styles = useStyles();
  const off = !!disabled;
  const link = variant === 'link';
  const tint = labelTone && !off ? theme.color[labelTone] : contentColor(theme, variant, off);
  const footQuiet = useContext(SheetFoot) && variant === 'quiet';
  const sized = size ?? (footQuiet ? 'ms' : DEFAULT_SIZE[variant]);
  const tall = SIZES[sized];
  const boxed = variant === 'dashed' && tall >= height.sheetButton;
  const kind = variant === 'quiet' || link ? null : variant === 'small' ? 'row' : KIND[sized];
  const main = kind === 'main' && sized === 'lg';
  const glyph =
    drawn ??
    (variant === 'raise'
      ? { size: ICO_XS }
      : boxed
        ? BOXED_GLYPH
        : kind === 'small'
          ? SMALL_GLYPH
          : variant === 'paper' && sized === 'mini'
            ? MAKE_GLYPH
            : main
              ? MAIN_GLYPH
              : (ROW_GLYPH[sized] ?? { size: ICO_S }));
  const words = label;
  return (
    <Pressable
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={words}
      accessibilityState={{ disabled: off }}
      disabled={off}
      hitSlop={hitSlop(tall, tall)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: tall },
        RINGED.has(variant) ? null : styles.flat,
        fill(theme, variant, off, hovered),
        boxed ? styles.boxed : null,
        variant === 'quiet' ? styles.tight : null,
        link ? styles.bare : null,
        kind === 'row' ? (sized === 'xxs' ? styles.inRowPill : styles.inRow) : null,
        kind === 'small' ? styles.small : null,
        main ? styles.main : null,
        (wide ?? DEFAULT_WIDE[variant]) ? styles.wide : null,
        pressed && !reduced ? PRESS : null,
        style,
      ]}
    >
      {icon ? <Icon icon={icon} {...glyph} color={tint} /> : null}
      <Text
        role={labelRole ?? wordsRole(variant, sized, kind)}
        style={[{ color: tint, textAlign: 'center' }, link ? styles.underline : null]}
      >
        {words}
      </Text>
      {trailingIcon ? <Icon icon={trailingIcon} size={ICO_S} color={tint} /> : null}
    </Pressable>
  );
}
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
    case 'link':
      return color.accentText;
    default:
      return color.paper;
  }
}
type Kind = 'main' | 'small' | 'row';
const KIND: Record<ButtonSize, Kind> = {
  xl: 'main',
  lg: 'main',
  md: 'main',
  ms: 'main',
  sm: 'small',
  xs: 'row',
  mini: 'row',
  xxs: 'row',
  line: 'row',
};
function wordsRole(variant: ButtonVariant, sized: ButtonSize, kind: Kind | null): TypeRole {
  if (kind === 'row' || variant === 'link') return 'label';
  if (kind === 'small') return 'controlSm';
  if (variant === 'quiet') return SIZES[sized] >= height.quietSheet ? 'controlMd' : 'controlSm';
  if (sized === 'md') return variant === 'dashed' ? 'controlSm' : 'controlMd';
  return 'control';
}
const MAIN_GLYPH = { size: 19, stroke: 2.1 } as const;
const SMALL_GLYPH = { size: 16 } as const;
const BOXED_GLYPH = { size: 16, stroke: 2.2 } as const;
const ROW_GLYPH: Partial<
  Record<
    ButtonSize,
    {
      size: number;
      stroke: number;
    }
  >
> = {
  xs: { size: 14, stroke: 1.8 },
  mini: { size: 14, stroke: 1.8 },
  xxs: { size: 14, stroke: 2.2 },
};
const MAKE_GLYPH = { size: 15, stroke: 2.2 } as const;
const DASHED: ViewStyle = { borderStyle: 'dashed', backgroundColor: 'transparent' };
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
    case 'paper':
      return { backgroundColor: color.paper };
    case 'secondary':
      return {
        borderColor: color.lineStrong,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    case 'small':
      return { borderColor: color.line, backgroundColor: hovered ? color.raise : 'transparent' };
    case 'outline':
      return {
        borderColor: color.lineQuiet,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    case 'raise':
      return { backgroundColor: color.raise };
    case 'danger':
      return { backgroundColor: color.dangerFill };
    case 'dashed':
      return { ...DASHED, borderColor: color.lineQuiet };
    case 'quiet':
    case 'link':
      return {};
  }
}
export type RoundTone =
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
  glyph?: {
    size: number;
    stroke?: number;
    filled?: boolean;
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
      hitSlop={hitSlop(size)}
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
      <Icon
        icon={icon}
        size={drawn?.size ?? roundGlyphSize(size)}
        stroke={drawn?.stroke}
        color={glyph}
        fill={tone === 'video' || drawn?.filled ? glyph : undefined}
      />
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
export function roundGlyphSize(diameter: number): number {
  if (diameter >= 64) return 26;
  if (diameter >= 48) return 22;
  if (diameter >= 40) return 20;
  if (diameter > 28) return 16;
  return 14;
}
export const BAR_GLYPH = { size: ICO, stroke: 1.9 } as const;
export function BackButton({
  label,
  onPress,
  size,
  style,
}: {
  label: string;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <IconButton
      icon={ChevronLeft}
      label={label}
      size={size}
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
    small: { paddingHorizontal: 18, gap: 7 },
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
