import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { themed, type } from '@/theme';

/** The kit's seven type roles (section 2). Roles, not sizes: ask for `title`, not for 22px. */
export type TypeRole = keyof typeof type;

/**
 * Text in the kit's voice. CSS inherits `color` from `body`; React Native inherits nothing and
 * defaults to black, so a screen that reaches for `type.body` alone gets black on ink — invisible.
 * This is the one place that pairs a role with the colour it is read in, so no screen has to
 * remember. `meta` brings its own muted colour and keeps it.
 */
export function Text({
  role = 'body',
  style,
  ...rest
}: // React Native's own `role` is the ARIA one, and it is `accessibilityRole` spelled twice; the
// kit's roles are the useful meaning of the word here, so this takes the name over.
Omit<TextProps, 'role'> & {
  role?: TypeRole;
}) {
  const styles = useStyles();

  return (
    <RNText
      style={[styles.paper, type[role], role === 'meta' ? styles.meta : null, style]}
      {...rest}
    />
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    paper: { color: color.paper },
    // `.t-meta` is the one role the kit gives a colour of its own.
    meta: { color: color.muted },
  }),
);
