import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { color, radius, space } from '@/theme';

import { shade } from './shades';
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
  const disabled = input.editable === false;

  return (
    <View style={styles.field}>
      <Text role="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={color.muted}
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
          styles.input,
          // The kit's cascade puts the answer above the focus: a field in error keeps its error
          // border while it is being fixed, and the raised background is what shows the focus.
          { borderColor: borderColor(state, focused), backgroundColor: focused ? color.raise : color.surface },
          disabled ? styles.inputOff : null,
          style,
        ]}
      />
      {hint ? <Text style={[styles.hint, hintColor(state)]}>{hint}</Text> : null}
    </View>
  );
}

function borderColor(state: FieldState | undefined, focused: boolean): string {
  if (state === 'error') return shade.errorLine;
  if (state === 'ok') return shade.fixedLine;
  return focused ? color.ember : color.line;
}

function hintColor(state: FieldState | undefined) {
  if (state === 'error') return { color: shade.danger };
  if (state === 'ok') return { color: color.fixed };
  return null;
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch', maxWidth: 420, gap: space.s2 },
  input: {
    minHeight: 52,
    paddingHorizontal: space.s4,
    color: color.paper,
    borderWidth: 1,
    borderRadius: radius.card,
    fontSize: 16,
  },
  inputOff: { color: color.muted, backgroundColor: color.ink },
  hint: { fontSize: 13, lineHeight: 16.9, color: color.muted },
});
