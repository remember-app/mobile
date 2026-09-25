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
 * Text in the product's voice. CSS inherits `color` from `body`; React Native inherits nothing and
 * defaults to black, so a screen that reaches for `type.body` alone gets black on ink — invisible.
 * This is the one place that pairs a role with the colour it is read in, so no screen has to
 * remember. `meta` and `note` bring `muted` with them: spec 10.1 keeps every readable secondary
 * line on `muted` and leaves `faint` to what is unavailable or decorative.
 */
export function Text({
  role = 'body',
  tone,
  style,
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
