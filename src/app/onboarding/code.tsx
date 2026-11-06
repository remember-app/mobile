import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readText } from '@/functionality';
import { CodeInput, type CodeOutcome } from '@/ui/components/code-input';
import { StepDots } from '@/ui/components/onboarding/steps';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { font, space, useTheme } from '@/ui/theme';

export default function CodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);

  const change = (next: string) => {
    setCode(next);
    setOutcome(next.length === 6 ? 'ok' : null);
  };

  const paste = async () => {
    const text = await readText();
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    setCode(digits);
    setOutcome(digits.length === 6 ? 'ok' : null);
  };

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
        <StepDots step={2} total={3} />
        <Text role="bodySm" tone="muted">
          {email ? (
            <>
              Код отправлен на{' '}
              <Text role="bodySm" tone="accent" style={styles.email}>
                {email}
              </Text>
            </>
          ) : (
            'Код отправлен на почту'
          )}
        </Text>
      </View>
      <View style={styles.body}>
        <CodeInput
          label="Код"
          value={code}
          onChangeText={change}
          outcome={outcome}
          onSettled={(result) => {
            if (result === 'ok') router.push('/onboarding/username');
          }}
          autoFocus
          highlight
        />
        <Button
          label="Отправить ещё раз"
          variant="link"
          onPress={() => undefined}
          style={styles.resend}
        />
      </View>
      <View style={styles.space} />
      <KeyboardStickyView
        offset={{ closed: -insets.bottom, opened: -space.s2 }}
        style={styles.footer}
      >
        <Button label="Вставить" variant="primary" onPress={() => void paste()} />
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
    gap: space.s4,
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
  },
  email: {
    fontFamily: font.semi,
  },
  resend: {
    alignSelf: 'flex-start',
    marginTop: space.s2,
  },
  space: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
});
