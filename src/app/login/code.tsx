import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, startEmailSignIn, verifyEmailCode } from '@/api';
import { ActionBar, Banner, Board, Button, CodeField, IconButton, Text } from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';

/** A repeated query key arrives as an array; everything here takes one string. */
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/**
 * `LoginCode` — the six digits from the letter (spec 8). The head stands where the two screens
 * before it had it; under it, the cells, the line saying where the letter went with a quiet way to
 * send another, and the screen's one main action.
 *
 * The address travels in the route rather than in a store: the code is only ever the secret *of an
 * address*, and the api is handed both together (`verifyEmailCode`).
 */
export default function LoginCodeScreen() {
  const params = useLocalSearchParams<{ email?: string | string[]; code?: string | string[] }>();
  const { signIn } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const email = one(params.email);
  // Filled in only where the api handed the code straight back — its development door, which has
  // no letter to read the digits out of. Everywhere else this opens empty, as it should.
  const [code, setCode] = useState(one(params.code));
  const [busy, setBusy] = useState(false);
  // Its own flag and not `busy`: asking for another code is not the trade, and a main button
  // spinning under «Входим…» while a letter is being posted says something that is not happening.
  const [sending, setSending] = useState(false);
  // Two different things and two different places for them: digits the api refused are answered
  // under the cells they were typed into, and a failure that has nothing to do with the code —
  // no connection, no mail keys — stands over the block as a line of its own.
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(one(params.code) === '' ? null : s.login.devCode);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const session = await verifyEmailCode(email, code);
      // The gate in `_layout` takes it from here: with a session the way-in screens stop existing
      // and whatever the account still owes — the agreement, a username — is what stands next.
      await signIn(session.token);
    } catch (e) {
      // The api answers 401 to every way six digits can fail, on purpose, so this side says one
      // thing back and clears the cells — which is what puts the caret in the first of them.
      if (e instanceof ApiError && e.status === 401) {
        setCode('');
        setBad(true);
      } else {
        setError(errorMessage(e));
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
      // A fresh code kills the one that was typed, whether or not anything was typed yet.
      setCode(handed ?? '');
      setNote(handed ? s.login.devCode : s.login.codeSent);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? s.login.mailDown : errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Board>
        <View style={styles.back}>
          <IconButton icon={ChevronLeft} label={s.action.back} onPress={() => router.back()} />
        </View>

        <OnboardingHead />

        <View style={styles.room}>
          {note ? <Banner tone="done" text={note} /> : null}
          {error ? <Banner tone="error" text={error} /> : null}
        </View>

        <ActionBar>
          <View style={styles.column}>
            <CodeField
              label={s.login.code}
              value={code}
              onChangeText={(next) => {
                setCode(next);
                setBad(false);
              }}
              state={bad ? 'error' : undefined}
              hint={bad ? s.login.codeBad : undefined}
              autoFocus
            />

            <View style={styles.sent}>
              <Text role="note" numberOfLines={1} style={styles.grow}>
                {s.login.sentTo(email)}
              </Text>
              {/* Quiet, and beside the line it belongs to: another code is a repair, never the
                  thing this screen is for. */}
              <Button
                variant="quiet"
                label={s.login.again}
                busyLabel={s.state.sending}
                onPress={again}
                busy={sending}
                disabled={busy}
              />
            </View>

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
      </Board>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { position: 'absolute', left: space.s4 - 10, top: 0, zIndex: 2 },
  room: { flex: 1, justifyContent: 'flex-end', gap: space.s2, paddingHorizontal: space.s4 },
  column: { flex: 1, gap: space.s3 },
  // The address on the left, the way to ask again on the right — one line, so neither of them
  // reads as the action of the screen.
  sent: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  grow: { flex: 1, minWidth: 0 },
});
