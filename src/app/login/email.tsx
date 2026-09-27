import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, startEmailSignIn } from '@/api';
import { ActionBar, Banner, Board, Button, Field } from '@/kit';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';

/**
 * `LoginEmail` — the address, step 2 of the way in (spec 8). The step's head, the field under it at
 * the head's own place, and the screen's one main action at the bottom edge.
 *
 * The keyboard moves nothing but that action (spec 7.1, detail 76): the field stands in the body and
 * not in the bottom layer, so it stays where it was drawn while the button rides the keyboard up, and
 * nothing stands under the field for the keyboard to cover — the answer about the address is beside
 * the field's label.
 */
export default function LoginEmailScreen() {
  const router = useRouter();
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Two different things and two different places for them: an address the api refused as not
  // being one (400) is answered at the field, and a failure that has nothing to do with what was
  // typed — no connection, no mail keys — over the button, where the keyboard leaves it in sight.
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const address = email.trim();
    setBusy(true);
    setBad(false);
    setError(null);
    try {
      const { code } = await startEmailSignIn(address);
      // `code` only ever comes back through the api's development door, and it is carried to the
      // next screen rather than traded here: the six cells are where a code is entered, whether a
      // person read it in a letter or the workbench filled it in for them.
      router.push({
        pathname: '/login/code',
        params: { email: address, ...(code ? { code } : {}) },
      });
    } catch (e) {
      // 503 is the api saying it has no mail keys, and its own wording for that is written for
      // whoever runs the server; 429 already comes back in the dictionary's words.
      if (e instanceof ApiError && e.status === 400) setBad(true);
      else setError(e instanceof ApiError && e.status === 503 ? s.login.mailDown : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Board
      footer={
        <ActionBar keyboardGap={space.s4}>
          <View style={styles.column}>
            {error ? <Banner tone="error" text={error} /> : null}
            {/* `busy` already blocks the press, so the button only goes out when there is nothing
                to send. */}
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
