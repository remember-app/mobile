import { ArrowRight } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/ui/kit/field';
import { height, radius, space, useTheme } from '@/ui/theme';

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
  const [focused, setFocused] = useState(false);
  const keeper = useRef<ComponentRef<typeof TextInput>>(null);
  const border = focused ? color.accent : color.line;

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
      <KeyboardStickyView
        offset={{ closed: -insets.bottom, opened: -space.s2 }}
        style={styles.footer}
      >
        <View style={styles.fieldWrap}>
          <Field
            label={label}
            labelHidden
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
      </KeyboardStickyView>
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
  fieldWrap: {
    position: 'relative',
  },
  keeper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
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
