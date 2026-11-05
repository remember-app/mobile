import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readText } from '@/functionality';
import { StepDots } from '@/ui/components/onboarding/steps';
import { Button } from '@/ui/kit/button';
import { CodeField } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { font, space, useTheme } from '@/ui/theme';

export default function CodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (code.length === 6) router.replace('/onboarding/username');
  }, [code, router]);

  const paste = async () => {
    const text = await readText();
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (digits) setCode(digits);
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
        <CodeField label="Код" value={code} onChangeText={setCode} autoFocus />
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
