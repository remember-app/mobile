import { type ComponentRef, createContext, type Ref, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { font, height, radius, space, themed, type, useTheme } from '@/ui/theme';
import { useFieldInBar } from './interaction';
import { Text, TYPE_MOST } from './text';

export type FieldState = 'ok' | 'error';
export type TextInputRef = ComponentRef<typeof TextInput>;

export function focusedField() {
  return TextInput.State.currentlyFocusedInput?.() ?? null;
}

const FACE = { ...type.subtitle, fontFamily: font.medium };

export function Field({
  label,
  prefix,
  style,
  onFocus,
  onBlur,
  inputRef,
  ...input
}: TextInputProps & {
  label: string;
  prefix?: string;
  inputRef?: Ref<TextInputRef>;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const disabled = input.editable === false;
  useFieldInBar();
  return (
    <View style={styles.field}>
      <View
        style={[
          styles.box,
          {
            borderColor: focused ? theme.color.accent : theme.color.line,
            backgroundColor: disabled ? theme.color.raise : theme.color.surface,
          },
        ]}
      >
        {prefix ? (
          <Text tone="faint" style={FACE}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={theme.color.faint}
          maxFontSizeMultiplier={TYPE_MOST}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            FACE,
            { color: disabled ? theme.color.faint : theme.color.paper },
            style,
          ]}
        />
      </View>
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
  alnum,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  length?: number;
  state?: FieldState;
  autoFocus?: boolean;
  alnum?: boolean;
  inputRef?: Ref<TextInputRef>;
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
                    : state === 'ok'
                      ? theme.color.accent
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
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={(next) =>
            onChangeText(
              (alnum ? next.replace(/[^0-9A-Za-z]/g, '') : next.replace(/\D/g, '')).slice(
                0,
                length,
              ),
            )
          }
          keyboardType={alnum ? 'default' : 'number-pad'}
          maxLength={length}
          {...(alnum
            ? { autoCapitalize: 'none' as const, autoCorrect: false }
            : { textContentType: 'oneTimeCode' as const, autoComplete: 'one-time-code' as const })}
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

const AREA_LINE = 24;
const AREA_EDGE = 1 + space.s4;

export function areaSight(fontScale: number): number {
  return AREA_EDGE * 2 + 3 * AREA_LINE * Math.min(fontScale, TYPE_MOST);
}

export const AreaRoom = createContext<number | null>(null);

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    field: { alignSelf: 'stretch', gap: space.s3 },
    box: {
      minHeight: height.fieldTall,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      paddingHorizontal: 18,
      borderRadius: radius.section,
      borderWidth: 1,
    },
    input: { flex: 1, minWidth: 0, paddingVertical: space.s2 },
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
  }),
);
