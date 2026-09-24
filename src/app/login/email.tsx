import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, startEmailSignIn } from '@/api';
import { ActionBar, Banner, Board, Button, Field, IconButton } from '@/kit';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { space } from '@/theme';

/**
 * `LoginEmail` — the address (spec 8). The head does not move from where `Login` had it; the only
 * thing that changed is the block at the bottom, where the three doors gave way to one field and
 * the screen's one main action.
 *
 * The way back floats over the head instead of standing in a bar of its own: a header row here
 * would push the name down 44 and break the one promise these four screens make together.
 */
export default function LoginEmailScreen() {
  const router = useRouter();
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const address = email.trim();
    setBusy(true);
    setError(null);
    try {
      const { code } = await startEmailSignIn(address);
      // `code` only ever comes back through the api's development door, and it is carried to the
      // next screen rather than traded here: the six cells are where a code is entered, whether a
      // person read it in a letter or the workbench filled it in for them.
      router.push({ pathname: '/login/code', params: { email: address, ...(code ? { code } : {}) } });
    } catch (e) {
      // 503 is the api saying it has no mail keys, and its own wording for that is written for
      // whoever runs the server; 429 already comes back in the dictionary's words.
      setError(e instanceof ApiError && e.status === 503 ? s.login.mailDown : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    // The field stands at the bottom edge, which is exactly where the keyboard comes up. Android
    // resizes the window itself; iOS needs telling, the same way the kit's sheet does.
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Board>
        <View style={styles.back}>
          <IconButton icon={ChevronLeft} label={s.action.back} onPress={() => router.back()} />
        </View>

        <OnboardingHead />

        <View style={styles.room}>{error ? <Banner tone="error" text={error} /> : null}</View>

        <ActionBar>
          <View style={styles.column}>
            <Field
              label={s.login.email}
              value={email}
              onChangeText={setEmail}
              placeholder={s.login.emailPlaceholder}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
              autoFocus
            />
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
      </Board>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Spec 7.1, the inner bar: a 44 button pulled 10 out of the screen's own 16 margin. Absolute, so
  // it lies over the head rather than moving it.
  back: { position: 'absolute', left: space.s4 - 10, top: 0, zIndex: 2 },
  room: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.s4 },
  column: { flex: 1, gap: space.s3 },
});
