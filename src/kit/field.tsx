import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';

import { radius, space, themed, useTheme, type Theme } from '@/theme';

import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/** `.field-ok` and `.field-error` — the kit's two answers to something already typed. */
export type FieldState = 'ok' | 'error';

/**
 * The kit's field, section 4: label, input, and a line underneath that says what to do. Height 52,
 * and the focused border is ember without the glow — a field is never the main action on a screen.
 *
 * `state` colours the border and the hint together: `ok` while a username is still free, `error`
 * when the hint has to say what is wrong. Everything else is a plain `TextInput` and behaves like
 * one, `editable={false}` included.
 */
export function Field({
  label,
  hint,
  state,
  style,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  state?: FieldState;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const disabled = input.editable === false;

  return (
    <View style={styles.field}>
      <Text role="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.color.muted}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.box,
          styles.type,
          // The kit's cascade puts the answer above the focus: a field in error keeps its error
          // border while it is being fixed, and the raised background is what shows the focus.
          {
            borderColor: borderColor(theme, state, focused),
            backgroundColor: focused ? theme.color.raise : theme.color.surface,
          },
          disabled ? styles.boxOff : null,
          disabled ? styles.typeOff : null,
          style,
        ]}
      />
      {hint ? <Text style={[styles.hint, hintColor(theme, state)]}>{hint}</Text> : null}
    </View>
  );
}

/**
 * The same field with something other than a `TextInput` in the middle of it — a day taken from the
 * platform's own calendar, where there is nothing to type. Label, box and hint are the ones above,
 * to the pixel; what differs is that the box is pressed rather than written in, so hover, focus and
 * the press are drawn here instead of arriving from the input.
 *
 * `children` is what stands where the typed text would: the value at the left, an icon at the right.
 */
export function FieldShell({
  label,
  hint,
  disabled,
  children,
  ...press
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const theme = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <View style={styles.field}>
      <Text role="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        // Read out as well as drawn, the way the field above hands its hint to the input.
        accessibilityHint={hint}
        disabled={disabled}
        {...press}
        {...props}
        style={({ pressed }) => [
          styles.box,
          styles.row,
          {
            // A finger has no hover, so the press is where the same lift is felt.
            borderColor: borderColor(theme, undefined, focused, hovered || pressed),
            backgroundColor: focused ? theme.color.raise : theme.color.surface,
          },
          focused ? focusRing : null,
          disabled ? styles.boxOff : null,
        ]}
      >
        {children}
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function borderColor(
  { color, shade }: Theme,
  state: FieldState | undefined,
  focused: boolean,
  hovered = false,
): string {
  if (state === 'error') return shade.rustText;
  if (state === 'ok') return shade.fixedLine;
  if (focused) return color.ember;
  // `.input:hover` — the hairline lifts, and that is all of it: the raised background belongs to
  // the focus alone.
  return hovered ? shade.lineHi : color.line;
}

function hintColor({ color, shade }: Theme, state: FieldState | undefined) {
  if (state === 'error') return { color: shade.rustText };
  if (state === 'ok') return { color: color.fixed };
  return null;
}

// `.input` comes in two halves so that both fields can wear it: the box is what a `View` can hold,
// the type is what only text takes. The input above puts on both; the shell's box, only the first.
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    field: { alignSelf: 'stretch', maxWidth: 420, gap: space.s2 },
    box: {
      minHeight: 52,
      paddingHorizontal: space.s4,
      borderWidth: 1,
      borderRadius: radius.card,
    },
    // `.input:disabled` — the half of it the box owns.
    boxOff: { backgroundColor: color.ink },
    type: { color: color.paper, fontSize: 16 },
    typeOff: { color: color.muted },
    // The value takes the width it needs and the icon sits out at the edge, both on the line the
    // typed text would have been on.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
    hint: { fontSize: 13, lineHeight: 16.9, color: color.muted },
  }),
);
