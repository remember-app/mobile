import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptInvite, confirmCode, pendingInvite, readText, sessionState } from '@/functionality';
import { CodeInput, type CodeOutcome } from '@/ui/components/code-input';
import { StepDots } from '@/ui/components/onboarding/steps';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { font, space, useTheme } from '@/ui/theme';

export default function CodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await confirmCode(email ?? '', value);
      const invite = pendingInvite();
      if (invite) await acceptInvite(invite).catch(() => undefined);
      setOutcome('ok');
    } catch {
      setOutcome('error');
    } finally {
      setBusy(false);
    }
  };

  const change = (next: string) => {
    setCode(next);
    setOutcome(null);
    if (next.length === 6) void verify(next);
  };

  const paste = async () => {
    const text = await readText();
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    setCode(digits);
    setOutcome(null);
    if (digits.length === 6) void verify(digits);
  };

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
        <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
          <StepDots step={2} total={3} />
        </View>
        <View style={styles.body}>
          <Text role="bodySm" tone="muted">
            {email ? (
              <>
                {t('onboarding.code.sentTo')}{' '}
                <Text role="bodySm" tone="accent" style={styles.email}>
                  {email}
                </Text>
              </>
            ) : (
              t('onboarding.code.sentPlain')
            )}
          </Text>
          <CodeInput
            label={t('onboarding.code.label')}
            value={code}
            onChangeText={change}
            outcome={outcome}
            onSettled={(result) => {
              if (result === 'ok') {
                router.replace(
                  sessionState().status === 'signed-in' ? '/home' : '/onboarding/username',
                );
                return;
              }
              setCode('');
              setOutcome(null);
            }}
          />
          <Button
            label={t('onboarding.code.resend')}
            variant="link"
            onPress={() => undefined}
            style={styles.resend}
          />
        </View>
        <View style={styles.space} />
      </Pressable>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button label={t('onboarding.code.paste')} variant="primary" onPress={() => void paste()} />
      </View>
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
  email: {
    fontFamily: font.semi,
  },
  resend: {
    alignSelf: 'flex-end',
  },
  space: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
});
