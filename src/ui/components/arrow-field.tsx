import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, type TextInputProps, View } from 'react-native';

import { Field } from '@/ui/kit/field';
import { height, radius, useTheme } from '@/ui/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  valid: boolean;
  onSubmit: () => void;
  prefix?: string;
  inputMode?: TextInputProps['inputMode'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoFocus?: boolean;
};

export function ArrowField({
  label,
  value,
  onChangeText,
  placeholder,
  valid,
  onSubmit,
  prefix,
  inputMode,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  autoFocus,
}: Props) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = focused ? color.accent : color.line;

  return (
    <View style={styles.wrap}>
      <Field
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
        style={value.length > 0 ? { paddingRight: height.fieldTall } : undefined}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Продолжить"
          disabled={!valid}
          onPress={onSubmit}
          style={[
            styles.arrow,
            {
              backgroundColor: valid ? color.accent : color.raise,
              borderTopColor: border,
              borderBottomColor: border,
              borderRightColor: border,
              borderLeftColor: valid ? color.accent : border,
            },
          ]}
        >
          <ArrowRight size={20} color={valid ? color.onFill : color.faint} />
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
