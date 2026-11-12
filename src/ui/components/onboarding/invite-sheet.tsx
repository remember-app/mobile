import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { checkInvite, parseInvite, readText, stashInvite } from '@/functionality';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

import { CodeInput, type CodeOutcome } from '../code-input';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void;
};

export function InviteSheet({ visible, onClose, onAccepted }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<'paste' | 'server' | null>(null);
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);
  const [checking, setChecking] = useState(false);
  const latest = useRef('');

  const verify = async (value: string) => {
    if (checking) return;
    setChecking(true);
    try {
      await checkInvite(value);
      if (latest.current !== value) return;
      stashInvite(value);
      setOutcome('ok');
    } catch {
      if (latest.current !== value) return;
      setError('server');
      setOutcome('error');
    } finally {
      setChecking(false);
    }
  };

  const change = (next: string) => {
    latest.current = next;
    setCode(next);
    setError(null);
    setOutcome(null);
    if (next.length === 6) void verify(next);
  };

  const settle = (result: CodeOutcome) => {
    if (result === 'ok') {
      onAccepted();
      return;
    }
    setCode('');
    setOutcome(null);
  };

  const paste = async () => {
    const text = await readText();
    const parsed = text ? parseInvite(text) : null;
    if (!parsed) {
      setError('paste');
      return;
    }
    setError(null);
    latest.current = parsed;
    setCode(parsed);
    setOutcome(null);
    void verify(parsed);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} size="full">
      <View style={styles.root}>
        <View style={styles.top}>
          <CodeInput
            label={t('onboarding.invite.code')}
            value={code}
            onChangeText={change}
            outcome={outcome}
            state={error ? 'error' : undefined}
            onSettled={settle}
            alnum
          />
          {error ? (
            <Text role="hint" tone="danger" style={styles.hint}>
              {error === 'paste' ? t('onboarding.invite.notFound') : t('onboarding.invite.invalid')}
            </Text>
          ) : null}
        </View>
        <Pressable style={styles.space} onPress={Keyboard.dismiss}>
          <View style={styles.centre}>
            <Text role="body" tone="muted" style={styles.lead}>
              {t('onboarding.invite.title')}
            </Text>
          </View>
        </Pressable>
        <View style={styles.footer}>
          <Button
            label={t('onboarding.invite.paste')}
            variant="primary"
            onPress={() => void paste()}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    gap: space.s2,
  },
  hint: {
    textAlign: 'center',
  },
  space: {
    flex: 1,
  },
  centre: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.s6,
  },
  lead: {
    textAlign: 'center',
  },
  footer: {
    paddingTop: space.s2,
  },
});
