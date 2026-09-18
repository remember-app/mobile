import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { themed, type } from '@/theme';

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
