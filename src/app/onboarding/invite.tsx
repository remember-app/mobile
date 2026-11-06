import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseInvite, readText, stashInvite } from '@/functionality';
import { ArrowField } from '@/ui/components/arrow-field';
import { Button } from '@/ui/kit/button';
import type { TextInputRef } from '@/ui/kit/field';
import { KeyboardBar } from '@/ui/kit/keyboard';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { color } = useTheme();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const field = useRef<TextInputRef>(null);

  useEffect(() => {
    const timer = setTimeout(() => field.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const token = parseInvite(code);

  const submit = () => {
    if (!token) {
      setBad(true);
      return;
    }
    stashInvite(token);
    router.push({ pathname: '/onboarding/code', params: email ? { email } : {} });
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
    field.current?.focus();
  };

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <Pressable style={styles.space} onPress={() => field.current?.focus()}>
        <View style={[styles.top, { paddingTop: insets.top + space.s7 }]}>
          <Text role="displaySm">По приглашению</Text>
          <Text role="body" tone="muted" style={styles.lead}>
            Remember сейчас открыт для друзей. Если вас позвали в воспоминание, вставьте ссылку из
            приглашения или введите код.
          </Text>
        </View>
      </Pressable>
      <KeyboardBar style={styles.footer}>
        <View style={styles.column}>
          {bad ? (
            <Text role="hint" tone="danger">
              Не нашли код в буфере
            </Text>
          ) : null}
          <ArrowField
            inputRef={field}
            label="Приглашение"
            value={code}
            onChangeText={(next) => {
              setCode(next);
              setBad(false);
            }}
            placeholder="Код или ссылка"
            valid={token !== null}
            onSubmit={submit}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <Button label="Вставить" variant="link" onPress={() => void paste()} />
        </View>
      </KeyboardBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
    gap: space.s3,
  },
  lead: {
    maxWidth: 340,
  },
  space: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
  column: {
    gap: space.s2,
  },
});
