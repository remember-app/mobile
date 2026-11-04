import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, startEmailSignIn } from '@/api';
import { ActionBar, Banner, Board, Button, Field } from '@/kit';
import { type Failure, failure, saying } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';
export default function LoginEmailScreen() {
  const router = useRouter();
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  async function send() {
    const address = email.trim();
    setBusy(true);
    setBad(false);
    setError(null);
    try {
      const { code } = await startEmailSignIn(address);
      router.push({
        pathname: '/login/code',
        params: { email: address, ...(code ? { code } : {}) },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setBad(true);
      else setError(failure(e, { 503: { text: saying(s.login.mailDown) } }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Board
      footer={
        <ActionBar keyboardGap={space.s4}>
          <View style={styles.column}>
            {error ? <Banner tone="error" failure={error} /> : null}

            <Button
              variant="primary"
              wide
              label={s.login.sendCode}
              busyLabel={s.state.sending}
              onPress={send}
              busy={busy}
              disabled={email.trim() === ''}
            />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead step={2} back={() => router.back()}>
        <Field
          label={s.login.email}
          hintAbove
          hint={bad ? s.login.checkAddress : undefined}
          state={bad ? 'error' : undefined}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setBad(false);
          }}
          placeholder={s.login.emailPlaceholder}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!busy}
          autoFocus
        />
      </OnboardingHead>
    </Board>
  );
}
const styles = StyleSheet.create({
  column: { flex: 1, gap: space.s3 },
});
