import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, startEmailSignIn, verifyEmailCode } from '@/api';
import { ActionBar, Banner, Board, Button, CodeField } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { type Failure, failure, saying } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const AGAIN_AFTER_MS = 60000;
const MAY_BREAK = String.fromCharCode(0x200b);
const breakable = (address: string) => address.replace(/[@.]/g, `$&${MAY_BREAK}`);
function useSecondsTo(until: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
export default function LoginCodeScreen() {
  const params = useLocalSearchParams<{
    email?: string | string[];
    code?: string | string[];
  }>();
  const { signIn } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const email = one(params.email);
  const [code, setCode] = useState(one(params.code));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [note, setNote] = useState<string | null>(one(params.code) === '' ? null : s.login.devCode);
  const [rested, setRested] = useState(0);
  const wait = useSecondsTo(rested);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const session = await verifyEmailCode(email, code);
      await signIn(session.token);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setCode('');
        setBad(true);
      } else {
        setError(failure(e));
      }
    } finally {
      setBusy(false);
    }
  }
  async function again() {
    setSending(true);
    setBad(false);
    setError(null);
    setNote(null);
    try {
      const { code: handed } = await startEmailSignIn(email);
      setCode(handed ?? '');
      if (handed) setNote(s.login.devCode);
      setRested(Date.now() + AGAIN_AFTER_MS);
    } catch (e) {
      setError(failure(e, { 503: { text: saying(s.login.mailDown) } }));
    } finally {
      setSending(false);
    }
  }
  return (
    <Board
      footer={
        <ActionBar keyboardGap={space.s4}>
          <View style={styles.column}>
            {note ? <Banner tone="done" text={note} /> : null}
            {error ? <Banner tone="error" failure={error} /> : null}
            <Button
              variant="primary"
              wide
              label={s.login.confirm}
              busyLabel={s.state.signingIn}
              onPress={confirm}
              busy={busy}
              disabled={code.length < 6 || email === '' || sending}
            />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead step={3} back={() => router.back()}>
        <CodeField
          label={
            bad
              ? s.login.codeBad.toUpperCase()
              : `${s.login.codeTo.toUpperCase()} ${breakable(email)}`
          }
          tail={
            <Button
              variant="raise"
              size="xxs"
              labelRole="chipXs"
              labelTone="paper"
              label={wait > 0 ? s.login.againIn(formatRuntime(wait) ?? '') : s.login.again}
              busyLabel={s.state.sending}
              onPress={again}
              busy={sending}
              disabled={busy || wait > 0}
              style={styles.again}
            />
          }
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setBad(false);
          }}
          state={bad ? 'error' : undefined}
          autoFocus
        />
      </OnboardingHead>
    </Board>
  );
}
const styles = StyleSheet.create({
  column: { flex: 1, gap: space.s3 },
  again: { marginRight: -space.s2 },
});
