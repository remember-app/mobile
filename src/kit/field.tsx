import { Check, Tag } from 'lucide-react-native';
import { createContext, type ReactNode, useContext, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
} from 'react-native';

import {
  font,
  height,
  night,
  radius,
  space,
  spinner,
  type Theme,
  themed,
  type,
  useTheme,
} from '@/theme';

import { BlockHead } from './block-head';
import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFieldInBar } from './interaction';
import { Text, TYPE_MOST } from './text';

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
 * - `wish` — 44, the one field that lives inside another block: what to do with one chosen track,
 *   unfolded under its row in «Выбрано».
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

/**
 * The two 60s of the way in (spec 8, `LoginEmail`, `Username`, and the name on a sheet): the label
 * and the line under the box step 4 in from its edge, and what is typed starts 18 inside it, the `@`
 * 4 before the name. Under a line of their own they stand 12 apart; with the answer in the label's
 * row (`hintAbove`) and nothing under the box, 8. Every other field keeps the form's own 8 and its
 * edge.
 */
const WAY_IN = new Set<FieldVariant>(['email', 'username']);

/** The layout sets the two phrases of a hint 8 apart; an en space is 6.5 of that at 13. */
const APART = String.fromCharCode(0x2002);

/**
 * What is typed, and the `@` in front of it (spec 7.3, detail 12): the name 17 in Unbounded, the
 * address 17 / 500, the username 19 in Unbounded — the card's name a hair looser, −0.02em
 * (`Username.json` e11: −0.38) — the handle and the search 16 / 500.
 */
const FACE: Record<FieldVariant, TextStyle> = {
  name: type.subtitleDisplay,
  email: { ...type.subtitle, fontFamily: font.medium },
  username: { ...type.title, letterSpacing: -0.02 * type.title.fontSize },
  handle: { ...type.body, fontFamily: font.medium },
  search: { ...type.body, fontFamily: font.medium },
  labelName: { ...type.row, fontSize: 16 },
  wish: { ...type.label, fontSize: 13 },
};

/**
 * The field the keyboard is up for, wherever it stands, or null — asked here, where every input of
 * the app is: the board brings it into sight when the keyboard takes the room it stood in.
 */
export function focusedField() {
  return TextInput.State.currentlyFocusedInput?.() ?? null;
}

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
    <Text role="hint" tone={tone} style={style}>
      {children}
    </Text>
  );
}

export function Field({
  label,
  labelHidden,
  variant = 'email',
  hint,
  hintAfter,
  hintAbove,
  state,
  pending,
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
  /**
   * A second phrase after the hint, in `muted` and plain: what the answer is for — «По нему вас
   * найдут в воспоминании.» after «Ник свободен.» (spec 8, `Username`).
   */
  hintAfter?: string;
  /**
   * The way in (spec 7.3, detail 12): the hint is one word of status in the label's row — «СВОБОДЕН»
   * in `spark`, «ЗАНЯТ» and «ПРОВЕРЬТЕ АДРЕС» in `dangerText` (detail 80) — and nothing stands under
   * the box, where the keyboard comes up to the button.
   */
  hintAbove?: boolean;
  state?: FieldState;
  /** The server is being asked about what is typed: a 16 spinner where the tick would stand. */
  pending?: boolean;
  /** The `@` the layout puts in front of every username. */
  prefix?: string;
  /** The magnifier on the search field, the pencil on a track's wish. */
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
  const wayIn = WAY_IN.has(variant);
  const tone = state === 'error' ? 'danger' : state === 'ok' ? 'spark' : 'muted';
  useFieldInBar();

  return (
    <View style={[styles.field, wayIn && !hintAbove ? styles.fieldWayIn : null]}>
      {labelHidden ? null : hintAbove ? (
        <View style={wayIn ? styles.inset : null}>
          <BlockHead label={label.toUpperCase()}>
            {hint ? (
              <Text role="eyebrow" tone={tone} style={styles.status}>
                {hint.toUpperCase()}
              </Text>
            ) : null}
          </BlockHead>
        </View>
      ) : (
        <Text role="eyebrow" tone="muted" style={wayIn ? styles.inset : null}>
          {label.toUpperCase()}
        </Text>
      )}
      <View
        style={[
          styles.box,
          BOX[variant],
          variant === 'wish' ? styles.boxTight : null,
          variant === 'search' ? styles.boxSearch : null,
          wayIn ? styles.boxWayIn : null,
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
            // Spec 7.3: the magnifier is 18 at 1.9.
            stroke={variant === 'search' ? 1.9 : undefined}
            color={variant === 'wish' ? theme.color.faint : theme.color.muted}
          />
        ) : null}
        {/* The `@` is decoration in front of a name, and reads `faint` (spec 8, `Username`,
            `SheetInvite`) — except in the search, where it is the one hint of what to type there
            (`Contacts`). */}
        {prefix ? (
          <Text tone={variant === 'search' ? 'muted' : 'faint'} style={FACE[variant]}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hintAfter ? `${hint} ${hintAfter}` : hint}
          placeholderTextColor={theme.color.faint}
          maxFontSizeMultiplier={TYPE_MOST}
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
        {/* Spec 7.3 — «проверено»: a 22 spark circle inside the field, beside the name it approves;
            while the server is still being asked, a 16 spinner in its place (spec 8, `Username`). */}
        {pending ? (
          <Spinner size={spinner.tile} />
        ) : state === 'ok' ? (
          <View style={styles.tick}>
            <Icon icon={Check} size={13} color={theme.color.sparkInk} />
          </View>
        ) : null}
      </View>
      {hint && !hintAbove ? (
        <Hint
          tone={tone}
          style={[wayIn ? styles.inset : null, state === 'ok' ? styles.answer : null]}
        >
          {hint}
          {/* One line of words and not a row of two, so it breaks between them like any sentence
              on a narrow phone or large type. */}
          {hintAfter ? (
            <Text role="hint" tone="muted" style={styles.after}>
              {APART + hintAfter}
            </Text>
          ) : null}
        </Hint>
      ) : null}
    </View>
  );
}

/**
 * The six cells of a code from an e-mail (spec 7.3, detail 13). One input behind six boxes: the
 * phone's own one-time-code autofill wants a single field, and six separate ones each steal the caret
 * from the last.
 *
 * Over the cells, 8 up, the head of the block (detail 80) — where the letter went and the way to ask
 * for another — and under them nothing: the keyboard comes up to the button (27 September).
 *
 * `error` marks all six at once, because the code is one value and not six — and the screen clears
 * it, which is what puts the caret back in the first cell. The head then says so in `dangerText`.
 */
export function CodeField({
  label,
  tail,
  value,
  onChangeText,
  length = 6,
  state,
  autoFocus,
}: {
  /**
   * The head's words, the caller's case and all — «КОД НА liza@example.com»: the address as it was
   * typed, never in capitals — and «КОД НЕ ПОДОШЁЛ» once the api refused the digits.
   */
  label: string;
  /** What stands at the right of the head — «Ещё раз». */
  tail?: ReactNode;
  value: string;
  onChangeText: (next: string) => void;
  length?: number;
  state?: FieldState;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  useFieldInBar();

  return (
    <View style={styles.field}>
      <View style={styles.inset}>
        <BlockHead label={label} tone={state === 'error' ? 'danger' : 'muted'}>
          {tail}
        </BlockHead>
      </View>
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
          value={value}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          maxFontSizeMultiplier={TYPE_MOST}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          selectionColor="transparent"
          style={[StyleSheet.absoluteFill, styles.codeInput]}
        />
      </View>
    </View>
  );
}

/** Spec 7.3, detail 14: the long-text box is 280 tall, and its line is 24 — not the body's 23. */
const AREA = 280;
const AREA_LINE = 24;
/** Its border and the 16 of air on either side of its lines. */
const AREA_EDGE = 1 + space.s4;

/**
 * The smallest long-text box a person can write in: three lines, at the size its words grow to, and
 * its edges. What a board leaves under its heading while the keyboard is up is measured by this
 * (`Board`).
 */
export function areaSight(fontScale: number): number {
  return AREA_EDGE * 2 + 3 * AREA_LINE * Math.min(fontScale, TYPE_MOST);
}

/**
 * How much of the body a board has on the screen for a long-text box — null off a board, or before
 * it has been measured. The box scrolls inside itself and keeps its caret in its own frame, so a box
 * taller than what the board shows of it — the keyboard up, a small phone, large type — kept the
 * caret out of sight, behind «Дальше» and the keyboard.
 */
export const AreaRoom = createContext<number | null>(null);

/**
 * The long-text box (spec 7.3): 280 tall, never dragged bigger by hand, scrolling inside itself, and
 * wearing the accent border at rest — it is the one thing a step of the wizard asks for, and the
 * border says so before the caret arrives. Where the board shows less of the body than that, the
 * box is as tall as what it shows ({@link AreaRoom}), whole in sight with its caret.
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
  const room = useContext(AreaRoom);
  useFieldInBar();

  return (
    <View style={styles.field}>
      {labelHidden ? null : (
        <Text role="eyebrow" tone="muted">
          {label.toUpperCase()}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.color.faint}
        maxFontSizeMultiplier={TYPE_MOST}
        multiline
        textAlignVertical="top"
        maxLength={limit}
        value={value}
        onChangeText={onChangeText}
        {...input}
        style={[
          styles.area,
          type.body,
          styles.areaLine,
          {
            height: room === null ? AREA : Math.min(AREA, room),
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
    fieldWayIn: { gap: space.s3 },
    inset: { paddingLeft: space.s1 },
    // Detail 80: the status is the eyebrow's 12 / 700 in capitals, tracked a little closer — 0.06em.
    status: { letterSpacing: 0.72 },
    // Spec 8, `Username`: the answer the server gave is the loud half of the line, what it is for
    // the quiet one.
    answer: { fontFamily: font.semi },
    after: { fontFamily: font.regular },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      borderWidth: 1,
    },
    // The wish line stands inside a block that already has its own 16 of air around it.
    boxTight: { paddingHorizontal: space.s3, gap: space.s2 },
    boxWayIn: { paddingHorizontal: 18, gap: space.s1 },
    // `Contacts.json` e7…e9: the magnifier 15 in from the edge, the `@` and the words 10 after it.
    boxSearch: { paddingLeft: 14, gap: 10 },
    // Spec 2.5 — the focus ring, on the box rather than on the input, so it rings the whole field.
    boxFocus: {
      outlineWidth: 2,
      outlineColor: color.accent,
      outlineOffset: 2,
      outlineStyle: 'solid',
    },
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
    // A floor and not a height: the digit grows with the system's type, and the cell with it.
    cell: {
      flex: 1,
      minHeight: height.code,
      borderRadius: radius.cell,
      borderWidth: 1,
      backgroundColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // A line of its own, no shorter than the face's own at 22 (27.3). Left to the body's 23, iOS cuts
    // the line from the top and the digits sit 3 above the middle of the cell (`LoginCode`).
    cellDigit: {
      fontFamily: type.title.fontFamily,
      fontSize: 22,
      lineHeight: 28,
      color: color.paper,
    },
    // The real input lies over the six boxes, so the caret and the phone's own autofill have
    // somewhere to land. Its words are see-through and not the input itself: iOS neither lets a
    // finger reach a view at opacity 0 nor shows it to a screen reader, and a tap on the cells is
    // how the keyboard comes back once it has been put away (TASK-377).
    codeInput: { color: 'transparent' },
    // Spec 7.3, detail 14: 16 over and under the words and 18 beside them, on a line of 24 — not the
    // body's 23.
    area: {
      borderWidth: 1,
      borderRadius: radius.section,
      paddingHorizontal: 18,
      paddingVertical: space.s4,
    },
    areaLine: { lineHeight: AREA_LINE },
  }),
);
