import { Check, Tag } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { height, night, radius, space, themed, type, useTheme, type Theme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { Text } from './text';

/**
 * Spec 7.3 — everything a person types into or picks from. The state of a field is never decoration:
 * `ok` is a name the server has just said is free, `error` is a line that says what is wrong and
 * what to do about it, and neither is ever guessed from the text on screen.
 */
export type FieldState = 'ok' | 'error';

/**
 * The seven fields the layout draws, which differ by height and by the face the text is typed in
 * (spec 7.3):
 *
 * - `name` — 56, Unbounded: the memory's name is typed in the face it will be printed in on the cover;
 * - `email` — 60;
 * - `username` — 60, Unbounded, with an `@` in front;
 * - `handle` — 54, with an `@` in front: the same thing inside a sheet;
 * - `search` — 52, a magnifier and an `@`;
 * - `labelName` — 52, a label's name with its colour square in front of it;
 * - `wish` — 44, the one field that lives inside another block: what to do with the music.
 */
export type FieldVariant =
  | 'name'
  | 'email'
  | 'username'
  | 'handle'
  | 'search'
  | 'labelName'
  | 'wish';

const BOX: Record<FieldVariant, { minHeight: number; borderRadius: number }> = {
  name: { minHeight: height.primary, borderRadius: radius.field },
  email: { minHeight: height.fieldTall, borderRadius: radius.section },
  username: { minHeight: height.fieldTall, borderRadius: radius.section },
  handle: { minHeight: 54, borderRadius: radius.field },
  search: { minHeight: height.field, borderRadius: radius.cell },
  labelName: { minHeight: height.field, borderRadius: radius.cell },
  wish: { minHeight: height.small, borderRadius: radius.strip },
};

const FACE: Record<FieldVariant, TextStyle> = {
  name: type.subtitleDisplay,
  email: type.subtitle,
  username: { ...type.title, fontSize: 19 },
  handle: { ...type.body, fontSize: 16 },
  search: type.body,
  labelName: { ...type.row, fontSize: 16 },
  wish: { ...type.label, fontSize: 13 },
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
  swatch,
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
  /** The magnifier on the search field, the pencil on the wish line. */
  icon?: IconComponent;
  /**
   * Spec 7.3 — the leading sign a label's name is typed behind: a 28 square of the label's own
   * colour with a tag in it. It is the colour being picked, drawn where it will be seen, so it moves
   * with the palette under the field.
   */
  swatch?: string;
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
          variant === 'wish' ? styles.boxTight : null,
          {
            borderColor: borderColor(theme, variant, state, focused),
            backgroundColor: disabled
              ? theme.color.raise
              : onSurface || variant === 'wish'
                ? theme.color.ink
                : theme.color.surface,
          },
          focused && !state ? styles.boxFocus : null,
        ]}
      >
        {swatch ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.swatch, { backgroundColor: swatch }]}
          >
            <Icon icon={Tag} size={15} color={night.ink} />
          </View>
        ) : null}
        {icon ? (
          <Icon
            icon={icon}
            size={variant === 'wish' ? 16 : 18}
            color={variant === 'wish' ? theme.color.faint : theme.color.muted}
          />
        ) : null}
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
 * The long-text box (spec 7.3): 280 tall, never dragged bigger by hand, scrolling inside itself, and
 * wearing the accent border at rest — it is the one thing a step of the wizard asks for, and the
 * border says so before the caret arrives.
 *
 * No counter under it any more. A story told to a director is not a form field with a quota, and the
 * limit — which is still enforced, because the api has one — is not something anybody should be
 * writing against.
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
  /** The line under the box. Not a count — what the box is for. */
  hint?: string;
  /** How much the api will take. Held silently: nothing types past it, and nothing counts down to it. */
  limit?: number;
  value: string;
  onChangeText: (next: string) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();

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
        {...input}
        style={[
          styles.area,
          type.body,
          {
            color: theme.color.paper,
            backgroundColor: theme.color.surface,
            borderColor: theme.color.accent,
          },
        ]}
      />
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

/**
 * The border of a field. The answer stands above the focus: a field in error keeps its error border
 * while it is being fixed, because the border is the answer and the ring is the focus.
 */
function borderColor(
  { color }: Theme,
  variant: FieldVariant,
  state: FieldState | undefined,
  focused: boolean,
): string {
  if (state === 'error') return color.dangerText;
  if (state === 'ok') return color.spark;
  if (focused) return color.accent;
  // Spec 7.3: the label's name wears the accent border whether or not the caret is in it — the
  // sheet it stands in is opened to type in that one box, and nothing else on it is a field.
  if (variant === 'labelName') return color.accent;
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
    // The wish line stands inside a block that already has its own 16 of air around it.
    boxTight: { paddingHorizontal: space.s3, gap: space.s2 },
    // Spec 2.5 — the focus ring, on the box rather than on the input, so it rings the whole field.
    boxFocus: { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: { flex: 1, minWidth: 0, paddingVertical: space.s2 },
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
      height: 280,
      borderWidth: 1,
      borderRadius: radius.section,
      paddingHorizontal: space.s4,
      paddingVertical: space.s4,
    },
  }),
);
