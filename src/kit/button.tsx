import { createContext, useContext } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, photo, radius, space, type Theme, themed, type, useTheme } from '@/theme';

import { Spinner } from './empty';
import { ICO_S, ICO_XS, Icon, type IconComponent } from './icon';
import { hitSlop, PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, type TypeRole } from './text';

/**
 * Spec 7.2 — the buttons. Ten of them wear words and one is round and wears a glyph, and which is
 * which is a matter of weight, never of taste: exactly one `primary` per screen, because `accent`
 * is the one main action and nothing else.
 *
 * `link` is the quietest of the ten: words alone, in `accentText` and underlined, as tall as their
 * line — «Полный текст соглашения» (spec 8, `Consent`). The finger's 44 grows round it.
 *
 * `outline` is the button in a row ringed in `lineQuiet` rather than `lineStrong` — the ring the
 * round `outline` wears — «Править состав» (spec 7.2, 8 `MemorySettings`).
 */
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

/**
 * The heights of spec 4, by the place a button stands in rather than by the number — and `line`,
 * the link's, which is the height of its words.
 */
export type ButtonSize = 'xl' | 'lg' | 'md' | 'ms' | 'sm' | 'xs' | 'mini' | 'xxs' | 'line';

const SIZES: Record<ButtonSize, number> = {
  // Spec 7.2 gives the dangerous button two heights, and the taller one has exactly one place in the
  // product: «Выйти из аккаунта» at the foot of `Account`.
  xl: height.logout,
  lg: height.primary,
  md: height.sheetButton,
  // The quiet one under the main in a sheet: «Позже», «Оставить как есть».
  ms: height.quietSheet,
  sm: height.small,
  xs: height.rowButton,
  // «Сбросить» in the corner of `SheetFilter` — at the height of a round button in a row.
  mini: height.roundRow,
  // The smallest thing in the product that is still a button with words in it: «Свой трек».
  xxs: height.roundTiny,
  line: type.label.lineHeight as number,
};

/** What each variant stands at unless a caller says otherwise. */
const DEFAULT_SIZE: Record<ButtonVariant, ButtonSize> = {
  primary: 'lg',
  paper: 'lg',
  secondary: 'lg',
  small: 'sm',
  // «Править состав», the only one: the row's 36.
  outline: 'mini',
  raise: 'mini',
  quiet: 'sm',
  link: 'line',
  danger: 'lg',
  // «Новый лейбл», the taller of the two dashed ones.
  dashed: 'md',
};

/**
 * Whether a button stands in the block at the foot of a sheet — `Sheet` says so. Spec 4 and 7.2 give
 * the quiet one there a place of its own, «Позже» and «Оставить как есть»: `ms`, 48 tall with its
 * words at 15. The place decides it, wherever the sheet was raised from, so no screen has to
 * remember; a height named outright is still the button's own.
 */
export const SheetFoot = createContext(false);

/** The loud ones run the width they are given; the quiet ones are as wide as their words. */
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
  /**
   * That glyph's size and stroke, only where the layout names them for the place — «Начать монтаж»
   * 19 / 1.9, the pencil of «Настроить самому» 17 / 1.8 (spec 8). Left off, the height decides.
   */
  glyph?: { size: number; stroke?: number };
  /** A glyph after them — the chevron on «Дальше» in the wizard. */
  trailingIcon?: IconComponent;
  /**
   * The words' own size, only where the layout names one for the place: the wizard's «Отмена» is 14
   * rather than 16 (spec 7.1, detail 3). Left off, the variant decides.
   */
  labelRole?: TypeRole;
  /**
   * The words' own colour, only where the layout names one for the place: «Ещё раз» under the code
   * is a quiet button in `paper`, because it stands beside a `muted` line and has to be read out of
   * it (spec 8, `LoginCode`). Left off, the variant decides; unavailable is `faint` either way.
   */
  labelTone?: 'paper';
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
  glyph: drawn,
  trailingIcon,
  labelRole,
  labelTone,
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
  const link = variant === 'link';
  const tint = labelTone && !off ? theme.color[labelTone] : contentColor(theme, variant, off);
  const footQuiet = useContext(SheetFoot) && variant === 'quiet';
  const sized = size ?? (footQuiet ? 'ms' : DEFAULT_SIZE[variant]);
  const tall = SIZES[sized];
  // Spec 7.2 draws the dashed one twice and squares it off only where it is tall: «Новый лейбл» at
  // 52 is a box with a hole in it, «Свой трек» at 32 is a pill like every other chip in its row.
  const boxed = variant === 'dashed' && tall >= height.sheetButton;
  // The quiet one and the link are words and not a shape, and keep their own sides at any height.
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
  const words = busy ? (busyLabel ?? label) : label;

  return (
    <Pressable
      accessibilityRole={link ? 'link' : 'button'}
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
        boxed ? styles.boxed : null,
        variant === 'quiet' ? styles.tight : null,
        link ? styles.bare : null,
        kind === 'row' ? (sized === 'xxs' ? styles.inRowPill : styles.inRow) : null,
        kind === 'small' ? styles.small : null,
        main ? styles.main : null,
        (wide ?? DEFAULT_WIDE[variant]) ? styles.wide : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {busy ? <Spinner size={18} track={tint} head="transparent" /> : null}
      {icon && !busy ? <Icon icon={icon} {...glyph} color={tint} /> : null}
      <Text
        role={labelRole ?? wordsRole(variant, sized, kind)}
        // Spec 7.2: a label too long for one line grows the button down and is centred in it.
        style={[{ color: tint, textAlign: 'center' }, link ? styles.underline : null]}
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
    case 'link':
      return color.accentText;
    default:
      return color.paper;
  }
}

/**
 * Spec 7.2 — how the words sit in a button, by the place it stands in rather than by its variant:
 *
 * - **main** — 60, 56, 52: `control` 16 at 56, 15 at 52 (`controlMd`), 20 a side; a 19 glyph at
 *   2.1, 9 from the words, at 56 (detail 10), an 18 one 8 from them at 52;
 * - **small** — «малая с текстом», 44: «Сохранить» and «Поделиться» under a finished film, «Сохранить»
 *   in a contact's row — the same `control` at 14 (`controlSm`), 18 a side, a 16 glyph 7 from the
 *   words;
 * - **row** — «в строке», 40 and under: «Вернуть», «Отдать ещё», «Сбросить», «Смонтировать», «Свой
 *   трек» — and the outlined `small` at whatever height it stands («Что сняли»). The words in
 *   `label` 13 / 600, 14 a side (12 in the 32 pill), a 14 glyph 6 from the words.
 *
 * The link's `line` is the height of its words, and a link is words alone: it never asks.
 */
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

/**
 * The size of the words (spec 3, `control`): 16 on the main 56, 15 on a 52 and on the quiet 48 in a
 * sheet, 14 on the small 44 and on every other quiet one («Отмена», «Снять»). «Новый лейбл», the
 * dashed 52, is drawn at 14 like the small ones (`SheetLabels`).
 */
function wordsRole(variant: ButtonVariant, sized: ButtonSize, kind: Kind | null): TypeRole {
  if (kind === 'row' || variant === 'link') return 'label';
  if (kind === 'small') return 'controlSm';
  if (variant === 'quiet') return SIZES[sized] >= height.quietSheet ? 'controlMd' : 'controlSm';
  if (sized === 'md') return variant === 'dashed' ? 'controlSm' : 'controlMd';
  return 'control';
}

/**
 * The glyph of a main 56 (spec 7.2, detail 10): 19 at 2.1, 9 from its words — the plus of «Новое
 * воспоминание» (`Main.html`), and every 56 of the layout that names nothing else for its place.
 */
const MAIN_GLYPH = { size: 19, stroke: 2.1 } as const;

/** The glyph of «Сохранить» and «Поделиться» under a finished film (spec 8, `MontageLiveDone`). */
const SMALL_GLYPH = { size: 16 } as const;

/**
 * The plus of «Новый лейбл», the dashed box of 52 (`SheetLabels.json` e52): 16 at stroke 2.2, 8 from
 * its words at 14 — the small button's glyph rather than the 18 of a 52.
 */
const BOXED_GLYPH = { size: 16, stroke: 2.2 } as const;

/**
 * The glyph of a button in a row (spec 7.2): 14 at 1.8 — «Править состав» wears its pencil so — and
 * heavier in the 32 pill, «Свой трек» (`MontageMusic`). `raise` keeps its own 13, since «Сбросить»
 * is drawn apart (`SheetFilter`).
 */
const ROW_GLYPH: Partial<Record<ButtonSize, { size: number; stroke: number }>> = {
  xs: { size: 14, stroke: 1.8 },
  mini: { size: 14, stroke: 1.8 },
  xxs: { size: 14, stroke: 2.2 },
};

/** The plus of «Смонтировать», the paper one in a row: 15 at 2.2 (spec 8, detail 40). */
const MAKE_GLYPH = { size: 15, stroke: 2.2 } as const;

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
    // `MemorySettings.json` e15: «Править состав» in `lineQuiet` (#3A3747), not `line`.
    case 'outline':
      return {
        borderColor: color.lineQuiet,
        backgroundColor: hovered ? color.raise : 'transparent',
      };
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
    case 'link':
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
  glyph: drawn,
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
  /**
   * The glyph's size, stroke and fill where the layout names them for the place — the wizard's «x»,
   * a track's filled «Послушать» (spec 5 fills play and pause).
   */
  glyph?: { size: number; stroke?: number; filled?: boolean };
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
        size={
          drawn?.size ?? (size >= 64 ? 26 : size >= 48 ? 22 : size >= 40 ? 20 : size > 28 ? 18 : 14)
        }
        stroke={drawn?.stroke}
        color={glyph}
        fill={tone === 'video' || drawn?.filled ? glyph : undefined}
      />
      {dot ? (
        <View
          style={[
            styles.dot,
            // Spec 7.4: ringed in the colour it stands on, which is the button's own fill — and it
            // only stands on that fill if it sits inside the circle, hence the inset by diameter:
            // the layout's 9 stands 10 inside the edge of its 56, the ring round it 2 further out.
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

/**
 * Spec 7.2, detail 11 — the spark dot: 9 of `spark`, and a 2 ring *outside* it in the colour it
 * stands on (`box-shadow: 0 0 0 2px` in `FramesByPeople`), so the spark itself stays 9 across.
 * Where it stands is a share of the diameter: 10 inside a 56 (`right: 10px; top: 10px`).
 */
const DOT = 9;
const DOT_RING = 2;
const DOT_INSET = 10 / 56;

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
    // Spec 7.2: the quiet one pulls its sides in.
    tight: { paddingHorizontal: space.s3 },
    // The link is its words and nothing round them: no sides, no hairline.
    bare: { paddingHorizontal: 0, borderWidth: 0 },
    underline: { textDecorationLine: 'underline' },
    // «В строке»: 14 a side and the glyph 6 from its words — 12 a side in the 32 pill.
    inRow: { paddingHorizontal: 14, gap: 6 },
    inRowPill: { paddingHorizontal: space.s3, gap: 6 },
    // «Малая с текстом»: the words 18 in from the edge — 17 and the button's own hairline — and the
    // glyph 7 from them («Сохранить» in `Contacts`, 109).
    small: { paddingHorizontal: 17, gap: 7 },
    // The main 56: its glyph 9 from its words (spec 7.2, detail 10).
    main: { gap: 9 },
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
    // the tone, since only the tone knows what that colour is. A border is drawn inside the box, so
    // the box is the dot and its ring together.
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
