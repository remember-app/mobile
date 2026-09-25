import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, startEmailSignIn, verifyEmailCode } from '@/api';
import { ActionBar, BackButton, Banner, Board, Button, CodeField, Text } from '@/kit';
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
    <Board
      footer={
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
              <Text role="note" style={styles.grow}>
                {s.login.sentTo(email)}
              </Text>
              {/* Quiet, and beside the line it belongs to: another code is a repair, never the
                  thing this screen is for. The layout draws it in the line's own size and in
                  `paper`, its words flush with the edge of the column. */}
              <Button
                variant="quiet"
                labelRole="label"
                labelTone="paper"
                label={s.login.again}
                busyLabel={s.state.sending}
                onPress={again}
                busy={sending}
                disabled={busy}
                style={styles.again}
              />
            </View>

            <Button
              variant="primary"
              wide
              label={s.login.confirm}
              busyLabel={s.state.signingIn}
              onPress={confirm}
              busy={busy}
              // Not before all six, though the layout draws it lit at four: the api answers any
              // shorter code with the 401 that empties the cells.
              disabled={code.length < 6 || email === '' || sending}
            />
          </View>
        </ActionBar>
      }
    >
      <View style={styles.back}>
        <BackButton label={s.action.back} onPress={() => router.back()} />
      </View>

      <OnboardingHead />

      <View style={styles.room}>
        {note ? <Banner tone="done" text={note} /> : null}
        {error ? <Banner tone="error" text={error} /> : null}
      </View>
    </Board>
  );
}

const styles = StyleSheet.create({
  // Spec 8, `LoginCode`: the way back floats 10 off the edge of the board — there is no bar here to
  // pull it into.
  back: { position: 'absolute', left: 10, top: 0, zIndex: 2 },
  room: { flexGrow: 1, justifyContent: 'flex-end', gap: space.s2, paddingHorizontal: space.s4 },
  column: { flex: 1, gap: space.s3 },
  // The address on the left, the way to ask again on the right — one line, so neither of them
  // reads as the action of the screen. Under it, when the address and the button do not both fit:
  // the address is never cut, it is where the letter went. The address steps 4 in, as the label
  // over the cells does.
  sent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s3,
    paddingLeft: space.s1,
  },
  grow: { flexGrow: 1 },
  // The quiet button's own 14 a side, pulled out by all of it, so the words end on the column's edge.
  again: { marginRight: -14 },
});
