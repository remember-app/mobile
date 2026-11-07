import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { parseInvite, readText, stashInvite } from '@/functionality';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

import { CodeInput, type CodeOutcome } from '../code-input';

const VOWEL = /^[aeiouy]/i;

// ponytail: mock accept rule — replace with the server's answer once invites are wired
function lucky(code: string): boolean {
  const first = code[0] ?? '';
  if (/^[0-9]$/.test(first)) return Number(first) % 2 === 0;
  return VOWEL.test(first);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void;
};

export function InviteSheet({ visible, onClose, onAccepted }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);

  const change = (next: string) => {
    setCode(next);
    setBad(false);
    setOutcome(next.length === 6 ? (lucky(next) ? 'ok' : 'error') : null);
  };

  const settle = (result: CodeOutcome) => {
    if (result === 'ok') {
      stashInvite(code);
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
      setBad(true);
      return;
    }
    setBad(false);
    setCode(parsed);
    setOutcome(lucky(parsed) ? 'ok' : 'error');
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
            state={bad ? 'error' : undefined}
            onSettled={settle}
            alnum
          />
          {bad ? (
            <Text role="hint" tone="danger" style={styles.hint}>
              {t('onboarding.invite.notFound')}
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
