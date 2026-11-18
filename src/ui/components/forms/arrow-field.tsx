import { ArrowRight } from 'lucide-react-native';
import { type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, type TextInputProps, View } from 'react-native';
import { Field, type TextInputRef } from '@/ui/kit/controls/field';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { height, radius, useTheme } from '@/ui/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  valid: boolean;
  busy?: boolean;
  onSubmit: () => void;
  prefix?: string;
  inputMode?: TextInputProps['inputMode'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<TextInputRef>;
};

export function ArrowField({
  label,
  value,
  onChangeText,
  placeholder,
  valid,
  busy = false,
  onSubmit,
  prefix,
  inputMode,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  autoFocus,
  inputRef,
}: Props) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = focused ? color.accent : color.line;

  return (
    <View style={styles.wrap}>
      <Field
        inputRef={inputRef}
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        prefix={prefix}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (valid && !busy) onSubmit();
        }}
        style={value.length > 0 ? { paddingRight: height.fieldTall } : undefined}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('action.continue')}
          disabled={!valid || busy}
          onPress={onSubmit}
          style={[
            styles.arrow,
            {
              backgroundColor: valid && !busy ? color.accent : color.raise,
              borderTopColor: border,
              borderBottomColor: border,
              borderRightColor: border,
              borderLeftColor: valid && !busy ? color.accent : border,
            },
          ]}
        >
          {busy ? (
            <CircularSpinner size={20} />
          ) : (
            <ArrowRight size={20} color={valid ? color.onFill : color.faint} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  arrow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: height.fieldTall,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderTopRightRadius: radius.section,
    borderBottomRightRadius: radius.section,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
