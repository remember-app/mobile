import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { themed, type } from '@/theme';

import { TAP } from './tap';

/** The spec's type roles (section 3). Roles, not sizes: ask for `title`, not for 19px. */
export type TypeRole = keyof typeof type;

/**
 * Which of the colour roles the words are read in. Every one of them is a token — the point of
 * naming them here is that no component writes `{ color: … }` by hand, and so no component can
 * quietly invent a shade the spec does not have.
 */
export type TextTone =
  | 'paper'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'spark'
  | 'sparkInk'
  | 'danger'
  | 'onFill';

/**
 * How far words grow with the system's type (TASK-377): twice their size and no further. ×2 is
 * Android's own largest step, and it is where the widest word the dictionary puts in running text —
 * «зарегистрироваться», Onest 400 at 16 — still fits whole in the column of the narrowest phone
 * (316 of 328 at 360); iOS goes on to ×3.571, where it would break letter by letter. Every text
 * input of the kit stops here too. A cell that measured its own room (`fitCell`) is the one thing
 * that says otherwise, and it grows down with what it holds.
 */
export const TYPE_MOST = 2;

/**
 * The headings stop earlier (TASK-377): Unbounded is wide, and a heading grows only while the widest
 * word it carries still fits whole in the room it has on the narrowest iPhone, 375 — measured off
 * the font file in `tests/kit/large-type.test.ts`, which names the words and the rooms. The bar's
 * one-line headings do not grow at all, the way an iOS navigation bar's title does not: the longest
 * of them, «Изменить воспоминание», already fills the bar at ×1.
 */
export const HEADING_MOST: Partial<Record<TypeRole, number>> = {
  hero: 1.13,
  heroNarrow: 1.33,
  display: 1.29,
  displaySm: 1.16,
  emptyTitle: 1.93,
  sheetTitle: 1.2,
  sheetTitleSm: 1.28,
  barTitle: 1,
  barTitleLive: 1,
  pillTitle: 1,
};

/**
 * The roles that are one word — the product's name — and so shrink to the width they are given
 * rather than break: on a phone narrower than the one the ceiling was measured on, and at any size.
 */
const ONE_WORD = new Set<TypeRole>(['hero', 'heroNarrow']);

/**
 * Text in the product's voice. CSS inherits `color` from `body`; React Native inherits nothing and
 * defaults to black, so a screen that reaches for `type.body` alone gets black on ink — invisible.
 * This is the one place that pairs a role with the colour it is read in, so no screen has to
 * remember. `meta` and `note` bring `muted` with them: spec 10.1 keeps every readable secondary
 * line on `muted` and leaves `faint` to what is unavailable or decorative.
 *
 * And the one place that says how far the role grows with the system's type ({@link TYPE_MOST},
 * {@link HEADING_MOST}) — a caller that measured its own room says so with `maxFontSizeMultiplier`,
 * and is heard.
 */
export function Text({
  role = 'body',
  tone,
  style,
  maxFontSizeMultiplier,
  ...rest
}: // React Native's own `role` is the ARIA one, and it is `accessibilityRole` spelled twice; the
// spec's roles are the useful meaning of the word here, so this takes the name over.
Omit<TextProps, 'role'> & {
  role?: TypeRole;
  tone?: TextTone;
}) {
  const styles = useStyles();

  return (
    <RNText
      style={[
        styles[tone ?? (role === 'meta' || role === 'note' ? 'muted' : 'paper')],
        type[role],
        style,
      ]}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? HEADING_MOST[role] ?? TYPE_MOST}
      {...(ONE_WORD.has(role) ? { numberOfLines: 1, adjustsFontSizeToFit: true } : null)}
      {...rest}
    />
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    paper: { color: color.paper },
    muted: { color: color.muted },
    faint: { color: color.faint },
    accent: { color: color.accentText },
    spark: { color: color.spark },
    sparkInk: { color: color.sparkInk },
    danger: { color: color.dangerText },
    onFill: { color: color.onFill },
  }),
);

/** What words keep clear of the sides of a cell they are fitted into, so they never meet the next. */
const FIT_INSET = 4;

/**
 * Words in a cell whose width the layout fixes — a day of the calendar, a ready length on the
 * slider — on large system type (TASK-372). The words grow only as far as the cell holds them
 * (`em`: how wide the widest of them runs, in em of the role's size), since beyond that they are
 * read, and pressed, as the next cell's; the cell grows down with them instead, never under the 44 a
 * finger needs. At the system's own size the cell is the layout's `rest`. Unmeasured (`width` 0),
 * nothing is held back.
 */
export function fitCell({
  fontScale,
  width,
  role,
  em,
  rest,
}: {
  fontScale: number;
  width: number;
  role: TypeRole;
  em: number;
  rest: number;
}): { most: number | undefined; height: number } {
  const { fontSize, lineHeight } = type[role];
  const most = width > 0 ? Math.max(1, (width - FIT_INSET) / (fontSize * em)) : undefined;
  const grown = Math.min(fontScale, most ?? fontScale);
  return {
    most,
    height: fontScale > 1 ? Math.max(TAP, Math.ceil(lineHeight * grown) + FIT_INSET) : rest,
  };
}

/**
 * A label the eye does not need and a screen reader does (spec 7.9, «скрытая подпись»): the field
 * in `SheetInvite`, the search in `Contacts`, the story box in `MontageStory` all carry one. Clipped
 * to 1 × 1 rather than removed, because a placeholder is not a label.
 */
export function HiddenLabel({ children, nativeID }: { children: string; nativeID?: string }) {
  return (
    <RNText nativeID={nativeID} style={hidden.clip}>
      {children}
    </RNText>
  );
}

const hidden = StyleSheet.create({
  clip: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
