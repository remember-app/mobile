import { type ComponentRef, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardBar } from '@/ui/kit/keyboard';
import { space, useTheme } from '@/ui/theme';

import { ArrowField } from '../arrow-field';
import { StepDots } from './steps';

type Props = {
  step: number;
  total?: number;
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

export function OnboardingInput({
  step,
  total = 3,
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
  autoFocus = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const keeper = useRef<ComponentRef<typeof TextInput>>(null);

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <Pressable style={styles.space} onPress={() => keeper.current?.focus()}>
        <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
          <StepDots step={step} total={total} />
        </View>
      </Pressable>
      <TextInput
        ref={keeper}
        style={styles.keeper}
        keyboardType={inputMode === 'email' ? 'email-address' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        caretHidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <KeyboardBar style={styles.footer}>
        <ArrowField
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          valid={valid}
          onSubmit={onSubmit}
          prefix={prefix}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
        />
      </KeyboardBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  space: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
  keeper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
