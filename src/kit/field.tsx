import { Check } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { height, radius, space, themed, type, useTheme, type Theme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/**
 * Spec 7.3 — everything a person types into or picks from. The state of a field is never decoration:
 * `ok` is a name the server has just said is free, `error` is a line that says what is wrong and
 * what to do about it, and neither is ever guessed from the text on screen.
 */
export type FieldState = 'ok' | 'error';

/**
 * The five fields the layout draws, which differ by height and by the face the text is typed in
 * (spec 7.3):
 *
 * - `name` — 56, Unbounded: the memory's name is typed in the face it will be printed in on the cover;
 * - `email` — 60;
 * - `username` — 60, Unbounded, with an `@` in front;
 * - `handle` — 54, with an `@` in front: the same thing inside a sheet;
 * - `search` — 52, a magnifier and an `@`.
 */
export type FieldVariant = 'name' | 'email' | 'username' | 'handle' | 'search';

const BOX: Record<FieldVariant, { minHeight: number; borderRadius: number }> = {
  name: { minHeight: height.primary, borderRadius: radius.cell },
  email: { minHeight: height.fieldTall, borderRadius: radius.section },
  username: { minHeight: height.fieldTall, borderRadius: radius.section },
  handle: { minHeight: 54, borderRadius: radius.field },
  search: { minHeight: height.field, borderRadius: radius.cell },
};

const FACE: Record<FieldVariant, TextStyle> = {
  name: type.subtitleDisplay,
  email: type.subtitle,
  username: { ...type.title, fontSize: 19 },
  handle: { ...type.body, fontSize: 16 },
  search: type.body,
};

/**
 * The small line under a control saying what it does or how far it reaches. Not the field's alone —
 * the same line hangs under the theme and language switches and under the way out of an account, and
 * a copy of it in each of those places is how they drift apart.
 */
export function Hint({
  children,
  tone = 'muted',
  style,
}: {
  children: ReactNode;
  tone?: 'muted' | 'faint' | 'danger' | 'spark';
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text role="note" tone={tone} style={style}>
      {children}
    </Text>
  );
}

export function Field({
  label,
  labelHidden,
  variant = 'email',
  hint,
  state,
  prefix,
  icon,
  onSurface,
  style,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & {
  label: string;
  /**
   * The label-less field — the search on `Contacts`, the username in `SheetInvite`. Only the visible
   * line goes: the input keeps the label as its accessible name, because a placeholder is not a
   * label (spec 7.9, «скрытая подпись»).
   */
  labelHidden?: boolean;
  variant?: FieldVariant;
  /** Under the field: what to do, or — in `error` — what went wrong and what to do instead. */
  hint?: string;
  state?: FieldState;
  /** The `@` the layout puts in front of every username. */
  prefix?: string;
  /** The magnifier on the search field. */
  icon?: IconComponent;
  /**
   * Spec 7.3 — the field standing inside a sheet is filled with `ink`, the same way the segments
   * there are: the sheet under it is already `surface`, and a `surface` box on a `surface` sheet is
   * a field nobody can see the edges of.
   */
  onSurface?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const disabled = input.editable === false;

  return (
    <View style={styles.field}>
      {labelHidden ? null : <Text role="eyebrow">{label.toUpperCase()}</Text>}
      <View
        style={[
          styles.box,
          BOX[variant],
          {
            borderColor: borderColor(theme, state, focused),
            backgroundColor: disabled
              ? theme.color.raise
              : onSurface
                ? theme.color.ink
                : theme.color.surface,
          },
          focused && !state ? styles.boxFocus : null,
        ]}
      >
        {icon ? <Icon icon={icon} size={18} color={theme.color.muted} /> : null}
        {prefix ? (
          <Text tone="muted" style={FACE[variant]}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={theme.color.faint}
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
            FACE[variant],
            { color: disabled ? theme.color.faint : theme.color.paper },
            style,
          ]}
        />
        {/* Spec 7.3 — «проверено»: a 22 spark circle inside the field, beside the name it approves. */}
        {state === 'ok' ? (
          <View style={styles.tick}>
            <Icon icon={Check} size={13} color={theme.color.sparkInk} />
          </View>
        ) : null}
      </View>
      {hint ? (
        <Hint tone={state === 'error' ? 'danger' : state === 'ok' ? 'spark' : 'muted'}>{hint}</Hint>
      ) : null}
    </View>
  );
}

/**
 * The same box with something other than a `TextInput` inside it — the day taken from the phone's
 * own calendar (spec 7.3, «поле-кнопка даты»), where there is nothing to type. It is pressed rather
 * than written in, so hover, focus and the press are drawn here instead of arriving from an input.
 *
 * `children` is what stands where the typed text would: the value on the left, a chevron at the right.
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
      <Text role="eyebrow">{label.toUpperCase()}</Text>
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
          BOX.name,
          styles.between,
          {
            borderColor: theme.color.line,
            // A finger has no hover, so the press is where the same lift is felt.
            backgroundColor: hovered || pressed ? theme.color.raise : theme.color.surface,
          },
          focused ? focusRing : null,
          disabled ? styles.off : null,
        ]}
      >
        {children}
      </Pressable>
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

/**
 * The six cells of a code from an e-mail (spec 7.3). One input behind six boxes: the phone's own
 * one-time-code autofill wants a single field, and six separate ones each steal the caret from the
 * last.
 *
 * `error` marks all six at once, because the code is one value and not six — and the screen clears
 * it, which is what puts the caret back in the first cell.
 */
export function CodeField({
  label,
  value,
  onChangeText,
  length = 6,
  state,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  length?: number;
  state?: FieldState;
  hint?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.field}>
      <Text role="eyebrow">{label.toUpperCase()}</Text>
      <View style={styles.code}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              {
                borderColor:
                  state === 'error'
                    ? theme.color.dangerText
                    : focused && i === Math.min(value.length, length - 1)
                      ? theme.color.accent
                      : theme.color.line,
              },
            ]}
          >
            <Text style={styles.cellDigit}>{value[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          value={value}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[StyleSheet.absoluteFill, styles.codeInput]}
        />
      </View>
      {hint ? <Hint tone={state === 'error' ? 'danger' : 'muted'}>{hint}</Hint> : null}
    </View>
  );
}

/**
 * The long-text box (spec 7.3): 240 tall, never dragged bigger by hand, with a hint on the left
 * under it and a counter on the right. Past 90% of the limit the counter turns dangerous, and
 * nothing types past the limit at all — the counter is a warning, not an epitaph.
 */
export function TextArea({
  label,
  labelHidden,
  hint,
  limit,
  value,
  onChangeText,
  ...input
}: TextInputProps & {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  limit: number;
  value: string;
  onChangeText: (next: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const near = value.length >= limit * 0.9;

  return (
    <View style={styles.field}>
      {labelHidden ? null : <Text role="eyebrow">{label.toUpperCase()}</Text>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.color.faint}
        multiline
        textAlignVertical="top"
        maxLength={limit}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
        style={[
          styles.area,
          type.body,
          {
            color: theme.color.paper,
            backgroundColor: theme.color.surface,
            borderColor: focused ? theme.color.accent : theme.color.line,
          },
        ]}
      />
      <View style={styles.between}>
        {hint ? (
          <Text role="meta" tone="faint">
            {hint}
          </Text>
        ) : (
          <View />
        )}
        <Text role="meta" tone={near ? 'danger' : 'muted'}>
          {value.length} / {limit}
        </Text>
      </View>
    </View>
  );
}

/**
 * The border of a field. The answer stands above the focus: a field in error keeps its error border
 * while it is being fixed, because the border is the answer and the ring is the focus.
 */
function borderColor(
  { color }: Theme,
  state: FieldState | undefined,
  focused: boolean,
): string {
  if (state === 'error') return color.dangerText;
  if (state === 'ok') return color.spark;
  if (focused) return color.accent;
  return color.line;
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    field: { alignSelf: 'stretch', gap: space.s2 },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      borderWidth: 1,
    },
    // Spec 2.5 — the focus ring, on the box rather than on the input, so it rings the whole field.
    boxFocus: { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' },
    off: { opacity: 0.45 },
    input: { flex: 1, minWidth: 0, paddingVertical: space.s2 },
    between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s3 },
    tick: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: { flexDirection: 'row', gap: space.s2 },
    cell: {
      flex: 1,
      height: height.code,
      borderRadius: radius.cell,
      borderWidth: 1,
      backgroundColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellDigit: { fontFamily: type.title.fontFamily, fontSize: 22, color: color.paper },
    // The real input lies over the six boxes, invisible, so the caret and the phone's own autofill
    // have somewhere to land.
    codeInput: { opacity: 0, color: 'transparent' },
    area: {
      height: 240,
      borderWidth: 1,
      borderRadius: radius.section,
      paddingHorizontal: space.s4,
      paddingVertical: space.s4,
    },
  }),
);
