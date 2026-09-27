import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, startEmailSignIn, verifyEmailCode } from '@/api';
import { ActionBar, Banner, Board, Button, CodeField } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';

/** A repeated query key arrives as an array; everything here takes one string. */
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/** How long «Ещё раз» rests after a new letter went out (spec 8, `LoginCode`). */
const AGAIN_AFTER_MS = 60_000;

/** A zero-width space: a place a line may break, and nothing to see or to hear. */
const MAY_BREAK = String.fromCharCode(0x200b);

/**
 * The address the way it was typed, with room to break after «@» and after each dot: a long one
 * wraps there instead of being cut, or torn anywhere (spec, detail 80).
 */
const breakable = (address: string) => address.replace(/[@.]/g, `$&${MAY_BREAK}`);

/** Whole seconds until `until`, counted down once a second while there are any. */
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

/**
 * `LoginCode` — the six digits from the letter, step 3 of the way in (spec 8). The step's head, the
 * cells under it with where the letter went and a way to send another over them, and the screen's one
 * main action at the bottom edge.
 *
 * `LoginCodeKeys` is this same screen with the keyboard up, and not a route of its own: the cells
 * stand in the body and nothing stands under them, so the keyboard covers only the bottom and moves
 * only the button (spec 7.1, detail 76).
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
  // over the cells they were typed into, and a failure that has nothing to do with the code — no
  // connection, no mail keys — over the button, where the keyboard leaves it in sight.
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(one(params.code) === '' ? null : s.login.devCode);
  // A new letter just went out: «Ещё раз» counts the minute down instead of saying so in a line.
  const [rested, setRested] = useState(0);
  const wait = useSecondsTo(rested);

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
      if (handed) setNote(s.login.devCode);
      setRested(Date.now() + AGAIN_AFTER_MS);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? s.login.mailDown : errorMessage(e));
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
            {error ? <Banner tone="error" text={error} /> : null}
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
      <OnboardingHead step={3} back={() => router.back()}>
        <CodeField
          label={
            bad
              ? s.login.codeBad.toUpperCase()
              : `${s.login.codeTo.toUpperCase()} ${breakable(email)}`
          }
          tail={
            // Beside the address it belongs to, on `raise` and in `paper`: another code is a repair,
            // never the thing this screen is for (detail 80).
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
  // Detail 80: hung 8 past the column's edge.
  again: { marginRight: -space.s2 },
});
