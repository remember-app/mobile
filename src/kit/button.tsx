import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, photo, radius, space, type Theme, themed, useTheme } from '@/theme';

import { Spinner } from './empty';
import { ICO_S, ICO_XS, Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.2 — the buttons. Eight of them wear words and one is round and wears a glyph, and which is
 * which is a matter of weight, never of taste: exactly one `primary` per screen, because `accent`
 * is the one main action and nothing else.
 */
export type ButtonVariant =
  | 'primary'
  | 'paper'
  | 'secondary'
  | 'small'
  | 'raise'
  | 'quiet'
  | 'danger'
  | 'dashed';

/** The heights of spec 4, by the place a button stands in rather than by the number. */
export type ButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'mini' | 'xxs';

const SIZES: Record<ButtonSize, number> = {
  // Spec 7.2 gives the dangerous button two heights, and the taller one has exactly one place in the
  // product: «Выйти из аккаунта» at the foot of `Account`.
  xl: height.logout,
  lg: height.primary,
  md: height.sheetButton,
  sm: height.small,
  xs: height.rowButton,
  // «Сбросить» in the corner of `SheetFilter` — at the height of a round button in a row.
  mini: height.roundRow,
  // The smallest thing in the product that is still a button with words in it: «Свой трек».
  xxs: height.roundTiny,
};

/** What each variant stands at unless a caller says otherwise. */
const DEFAULT_SIZE: Record<ButtonVariant, ButtonSize> = {
  primary: 'lg',
  paper: 'lg',
  secondary: 'lg',
  small: 'sm',
  raise: 'mini',
  quiet: 'sm',
  danger: 'lg',
  // «Новый лейбл», the taller of the two dashed ones.
  dashed: 'md',
};

/** The loud ones run the width they are given; the two quiet ones are as wide as their words. */
const DEFAULT_WIDE: Record<ButtonVariant, boolean> = {
  primary: true,
  paper: true,
  secondary: true,
  small: false,
  raise: false,
  quiet: false,
  danger: true,
  dashed: true,
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
  const sized = size ?? DEFAULT_SIZE[variant];
  const tall = SIZES[sized];
  // The 36s — «Сбросить» on `raise`, «Смонтировать» on paper — are smaller all through (spec 7.2,
  // detail 40): 14 a side, the glyph 6 from the words, and the words in `label` 13 / 600.
  const compact = sized === 'mini';
  const glyph = variant === 'raise' ? { size: ICO_XS } : compact ? MINI_GLYPH : { size: ICO_S };
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
        // Spec 7.2 draws the dashed one twice and squares it off only where it is tall: «Новый
        // лейбл» at 52 is a box with a hole in it, «Свой трек» at 32 is a pill like every other chip
        // in the row it stands in.
        variant === 'dashed' && tall >= height.sheetButton ? styles.boxed : null,
        variant === 'quiet' || variant === 'small' ? styles.tight : null,
        compact ? styles.snug : null,
        (wide ?? DEFAULT_WIDE[variant]) ? styles.wide : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {busy ? <Spinner size={18} track={tint} head="transparent" /> : null}
      {icon && !busy ? <Icon icon={icon} {...glyph} color={tint} /> : null}
      <Text
        role={variant === 'small' || compact ? 'label' : 'control'}
        // Spec 7.2: a label too long for one line grows the button down and is centred in it.
        style={{ color: tint, textAlign: 'center' }}
      >
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
    default:
      return color.paper;
  }
}

/**
 * The plus of «Смонтировать» (spec 8, detail 40): 15, drawn heavier than the size alone would give.
 * `raise` keeps its own 13, since «Сбросить» is drawn apart (`SheetFilter`).
 */
const MINI_GLYPH = { size: 15, stroke: 2.2 } as const;

/** The one dashed border in the kit, and the reason `lineQuiet` exists (spec 2). */
const DASHED: ViewStyle = { borderStyle: 'dashed', backgroundColor: 'transparent' };

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
    // Spec 8, `SheetFilter`: «Сбросить» is lifted by its fill and has no border at all — it is
    // needed rarely, and a ring would make it argue with the main button.
    case 'raise':
      return { backgroundColor: color.raise };
    // No shadow: a shadow would make it the main action of the screen, and it never is.
    case 'danger':
      return { backgroundColor: color.dangerFill };
    case 'dashed':
      return { ...DASHED, borderColor: color.lineQuiet };
    case 'quiet':
      return {};
  }
}

/**
 * Spec 7.2 — the round button, at the seven diameters the layout draws: 56 at the foot of the
 * gallery, 48 on the glass bar and in the viewer, 44 in a bar, 40 in a track row, 36 in a row, 32 on
 * a banner, 28 beside «Все дни» in the filter (spec 8). Under 44 the drawn size stays and the finger
 * target grows out to 44 (spec 10.2).
 *
 * The two glasses are two tones and not one: `glass` is the bar over the feed — `ink` at 62%, with a
 * darkening of its own under the bar, which is what keeps a white glyph readable over a wall of
 * photographs — and `viewer` is the paper-tinted glass of the frame window, where the picture
 * underneath is the whole point. Neither is blurred: the spec's 20–28 of backdrop blur has no
 * React Native equivalent without `expo-blur`, which is not a dependency.
 *
 * `video` is not glass at all: «Пауза» 72 in the middle of a playing video, dark, with no hairline
 * and a filled glyph (spec 7.2) — the viewer's glass vanishes over a bright frame, this does not.
 *
 * `label` is not optional: a glyph alone says nothing to a screen reader.
 */
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
   *
   * Held in, it is `accent` — except in the `paper` tone, which is held in on its own paper: the
   * tick of a track already taken (spec 7.7, detail 53), where nothing is going anywhere.
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
  const theme = useTheme();
  const { color } = theme;
  const styles = useStyles();
  const lit = on ?? false;
  const onAccent = lit && tone !== 'paper';
  // Spec 2.5: held in, the button is filled with `accent` itself, so its ring is drawn in `paper`.
  const focusRing = useFocusRing(onAccent);
  const glyph = disabled
    ? color.faint
    : onAccent
      ? color.onFill
      : (tint ?? roundGlyph(color, tone));

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
        focused ? focusRing : null,
        style,
      ]}
    >
      {/* The glyph grows with the circle: 22 in a 48 reads as a button, 22 in the viewer's 72
          reads as a plate with something small lost in it. The layout draws that one at 26. */}
      <Icon
        icon={icon}
        size={size >= 64 ? 26 : size >= 48 ? 22 : size >= 40 ? 20 : size > 28 ? 18 : 14}
        color={glyph}
        fill={tone === 'video' ? glyph : undefined}
      />
      {dot ? (
        <View
          style={[
            styles.dot,
            // Spec 7.4: ringed in the colour it stands on, which is the button's own fill — and it
            // only stands on that fill if it sits inside the circle, hence the inset by diameter.
            {
              top: Math.round(size * 0.2),
              right: Math.round(size * 0.2),
              borderColor: roundBacking(color, tone, onAccent),
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * What the glyph is read in. A round button standing on a fill of its own — the account in the root
 * bar, the two at the foot of the gallery — carries its glyph in the plain colour of text; `muted`
 * belongs to the 36 and the 32 that stand on nothing (spec 7.2).
 */
function roundGlyph(color: Theme['color'], tone: RoundTone): string {
  switch (tone) {
    case 'surface':
    // Raised above a card — the ± of the length slider. A fill of its own, so a full-voice glyph.
    case 'raise':
    // Glass is a fill: the layout reads every glyph on both glasses in `paper`, and `muted` on a
    // pane lying over a photograph is a glyph that disappears into the brightest frame behind it.
    case 'glass':
    case 'viewer':
    case 'video':
    // Drawn round a glyph on nothing, the ring is the button; the glyph inside it is full-voiced.
    case 'outline':
      return color.paper;
    case 'paper':
      return color.ink;
    case 'spark':
      // The same answer the held-in button gives: `muted` on `spark` is a glyph nobody can see.
      return color.sparkInk;
    case 'danger':
      return color.dangerText;
    default:
      return color.muted;
  }
}

/** The colour under the spark dot: the button's own fill, or the screen where there is no fill. */
function roundBacking(color: Theme['color'], tone: RoundTone, on: boolean): string {
  if (on) return color.accent;
  switch (tone) {
    case 'raise':
      return color.raise;
    case 'surface':
    // Glass has no colour of its own — it is `surface` thinned over whatever is behind it — so the
    // ring takes the opaque version. A ring in the photograph's own colours is not one anybody can
    // draw, and the dot on the glass filter button is the only place this is ever seen.
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
  // Spec 7.2 — held in: `accent`, a white hairline and the shadow. The shadow is what tells it apart
  // from a button that is merely drawn on the accent, and it is the only round one that carries one.
  if (on)
    return {
      backgroundColor: color.accent,
      borderColor: 'rgba(255,255,255,0.14)',
      boxShadow: shadow.round,
    };
  switch (tone) {
    case 'surface':
      return { backgroundColor: color.surface, borderColor: color.line };
    // The calendar beside «Все дни» (spec 8, `SheetFilter`): transparent inside a `lineQuiet` ring,
    // the same ring the chip beside it wears.
    case 'outline':
      return {
        borderColor: color.lineQuiet,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
    // Spec 7.2: raised, and without a border — the lift is the fill.
    case 'raise':
      return { backgroundColor: color.raise };
    // The glass of a bar standing over the feed — `ink` at 62%, with its own hairline.
    case 'glass':
      return { backgroundColor: photo.bar, borderColor: photo.barEdge };
    // The viewer's glass: there is no surface behind a button standing over a photograph.
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
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: space.s2,
    },
    // Spec 7.2: the quiet one and the small one both pull their sides in.
    tight: { paddingHorizontal: space.s3 },
    // A 36: 14 a side and the glyph 6 from its words.
    snug: { paddingHorizontal: 14, gap: 6 },
    boxed: { borderRadius: radius.cell },
    // A small button never shrinks when the row beside it runs long.
    wide: { width: '100%', flexShrink: 1 },
    round: {
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    off: { opacity: 0.45 },
    // Spec 7.4: a 9px dot ringed 2px in the colour of what it sits on — the ring itself comes from
    // the tone, since only the tone knows what that colour is.
    dot: {
      position: 'absolute',
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      borderWidth: 2,
    },
  }),
);
