import { Keyboard, Pressable, StyleSheet, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

import { ArrowField } from '../arrow-field';
import { StepDots } from './steps';

type Props = {
  step: number;
  total?: number;
  caption: string;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  valid: boolean;
  onSubmit: () => void;
  error?: string;
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
  caption,
  label,
  value,
  onChangeText,
  placeholder,
  valid,
  onSubmit,
  error,
  prefix,
  inputMode,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  autoFocus = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
        <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
          <StepDots step={step} total={total} />
        </View>
        <View style={styles.body}>
          <Text role="bodySm" tone="muted">
            {caption}
          </Text>
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
          {error ? (
            <Text role="hint" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
    gap: space.s4,
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s6,
    gap: space.s3,
  },
});
