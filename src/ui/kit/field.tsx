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
} from '@/ui/theme';
import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFieldInBar } from './interaction';
import { Text, TYPE_MOST } from './text';
export type FieldState = 'ok' | 'error';
export type FieldVariant =
  | 'name'
  | 'email'
  | 'username'
  | 'handle'
  | 'search'
  | 'labelName'
  | 'wish'
  | 'comment';
const BOX: Record<
  FieldVariant,
  {
    minHeight: number;
    borderRadius: number;
  }
> = {
  name: { minHeight: height.primary, borderRadius: radius.field },
  email: { minHeight: height.fieldTall, borderRadius: radius.section },
  username: { minHeight: height.fieldTall, borderRadius: radius.section },
  handle: { minHeight: 54, borderRadius: radius.field },
  search: { minHeight: height.field, borderRadius: radius.cell },
  labelName: { minHeight: height.field, borderRadius: radius.cell },
  wish: { minHeight: height.small, borderRadius: radius.strip },
  comment: { minHeight: 48, borderRadius: radius.pill },
};
const WAY_IN = new Set<FieldVariant>(['email', 'username']);
const APART = String.fromCharCode(0x2002);
const FACE: Record<FieldVariant, TextStyle> = {
  name: type.subtitleDisplay,
  email: { ...type.subtitle, fontFamily: font.medium },
  username: { ...type.title, letterSpacing: -0.02 * type.title.fontSize },
  handle: { ...type.body, fontFamily: font.medium },
  search: { ...type.body, fontFamily: font.medium },
  labelName: { ...type.row, fontSize: 16 },
  wish: { ...type.label, fontSize: 13 },
  comment: { ...type.body, fontSize: 14 },
};
export function focusedField() {
  return TextInput.State.currentlyFocusedInput?.() ?? null;
}
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
  variant = 'email',
  hint,
  hintAfter,
  state,
  pending,
  prefix,
  icon,
  swatch,
  onSurface,
  trailing,
  style,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & {
  label: string;
  variant?: FieldVariant;
  hint?: string;
  hintAfter?: string;
  state?: FieldState;
  pending?: boolean;
  prefix?: string;
  icon?: IconComponent;
  swatch?: string;
  onSurface?: boolean;
  trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const disabled = input.editable === false;
  const wayIn = WAY_IN.has(variant);
  const tone = state === 'error' ? 'danger' : state === 'ok' ? 'spark' : 'muted';
  useFieldInBar();
  return (
    <View style={[styles.field, wayIn ? styles.fieldWayIn : null]}>
      <View
        style={[
          styles.box,
          BOX[variant],
          variant === 'wish' ? styles.boxTight : null,
          variant === 'search' ? styles.boxSearch : null,
          variant === 'comment' ? styles.boxComment : null,
          wayIn ? styles.boxWayIn : null,
          {
            borderColor: borderColor(theme, variant, state, focused),
            backgroundColor: disabled
              ? theme.color.raise
              : onSurface || variant === 'wish' || variant === 'comment'
                ? theme.color.ink
                : theme.color.surface,
          },
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
            stroke={variant === 'search' ? 1.9 : undefined}
            color={variant === 'wish' ? theme.color.faint : theme.color.muted}
          />
        ) : null}

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

        {pending ? (
          <Spinner size={spinner.tile} />
        ) : state === 'ok' ? (
          <View style={styles.tick}>
            <Icon icon={Check} size={13} color={theme.color.sparkInk} />
          </View>
        ) : null}
        {trailing}
      </View>
      {hint ? (
        <Hint
          tone={tone}
          style={[wayIn ? styles.inset : null, state === 'ok' ? styles.answer : null]}
        >
          {hint}

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
export function CodeField({
  label,
  value,
  onChangeText,
  length = 6,
  state,
  autoFocus,
}: {
  label: string;
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
const AREA = 280;
const AREA_LINE = 24;
const AREA_EDGE = 1 + space.s4;
export function areaSight(fontScale: number): number {
  return AREA_EDGE * 2 + 3 * AREA_LINE * Math.min(fontScale, TYPE_MOST);
}
export const AreaRoom = createContext<number | null>(null);
export function TextArea({
  label,
  hint,
  limit,
  state,
  value,
  onChangeText,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  limit?: number;
  state?: FieldState;
  value: string;
  onChangeText: (next: string) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const room = useContext(AreaRoom);
  useFieldInBar();
  return (
    <View style={styles.field}>
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
            borderColor: state === 'error' ? theme.color.dangerText : theme.color.accent,
          },
        ]}
      />
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}
function borderColor(
  { color }: Theme,
  variant: FieldVariant,
  state: FieldState | undefined,
  focused: boolean,
): string {
  if (state === 'error') return color.dangerText;
  if (state === 'ok') return color.spark;
  if (focused) return color.accent;
  if (variant === 'labelName') return color.accent;
  return color.line;
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    field: { alignSelf: 'stretch', gap: space.s2 },
    fieldWayIn: { gap: space.s3 },
    inset: { paddingLeft: space.s1 },
    answer: { fontFamily: font.semi },
    after: { fontFamily: font.regular },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      borderWidth: 1,
    },
    boxTight: { paddingHorizontal: space.s3, gap: space.s2 },
    boxWayIn: { paddingHorizontal: 18, gap: space.s1 },
    boxComment: { paddingLeft: space.s4, paddingRight: 6, gap: space.s2 },
    boxSearch: { paddingLeft: 14, gap: 10 },
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
      minHeight: height.code,
      borderRadius: radius.cell,
      borderWidth: 1,
      backgroundColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellDigit: {
      fontFamily: type.title.fontFamily,
      fontSize: 22,
      lineHeight: 28,
      color: color.paper,
    },
    codeInput: { color: 'transparent' },
    area: {
      borderWidth: 1,
      borderRadius: radius.section,
      paddingHorizontal: 18,
      paddingVertical: space.s4,
    },
    areaLine: { lineHeight: AREA_LINE },
  }),
);
