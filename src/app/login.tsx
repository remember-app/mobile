import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, signInWithApple, signInWithGoogle, startEmailSignIn } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, Empty, Field, Text } from '@/kit';
import { useStrings } from '@/language';
import { type Strings } from '@/strings';
import { color, space } from '@/theme';

// Closes the auth browser tab once Google redirects back.
WebBrowser.maybeCompleteAuthSession();

// No Google credentials exist yet. The provider hook throws when the client id is undefined,
// so it gets a placeholder and the button answers before ever opening a browser.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

/** «Apple» and «Google» are names and stay themselves; only the sentence around them turns. */
function providerError(s: Strings, provider: string, error: unknown): string {
  if (error instanceof ApiError && error.status === 501) {
    return s.login.providerUnavailable(provider);
  }
  return errorMessage(error);
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // False on Android and on any build without the Sign in with Apple entitlement.
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID ?? 'unconfigured.apps.googleusercontent.com',
  });

  // `s` is deliberately out of the dependencies: this effect trades an identity token for a
  // session, and re-running it to re-word a line would send that token a second time.
  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError(s.login.noIdentityToken('Google'));
      return;
    }
    signInWithGoogle(idToken)
      .then((session) => signIn(session.token))
      .catch((e) => setError(providerError(s, 'Google', e)));
  }, [googleResponse, signIn]);

  async function sendLink() {
    setBusy(true);
    setError(null);
    try {
      await startEmailSignIn(email.trim());
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function withApple() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError(s.login.noIdentityToken('Apple'));
        return;
      }
      const session = await signInWithApple(credential.identityToken);
      await signIn(session.token);
    } catch (e) {
      // Backing out of the native sheet is not an error worth showing.
      if ((e as { code?: string } | null | undefined)?.code === 'ERR_REQUEST_CANCELED') return;
      setError(providerError(s, 'Apple', e));
    }
  }

  async function withGoogle() {
    setError(null);
    if (!GOOGLE_CLIENT_ID) {
      setError(s.login.providerUnavailable('Google'));
      return;
    }
    await promptGoogle();
  }

  // The link is out: the screen has nothing left to ask for, so it says where to look for it and
  // keeps only the way back — the kit's «waiting» shape, section 6.
  if (sent) {
    return (
      <View style={styles.screen}>
        <Text role="display">{s.login.sentTitle}</Text>
        <Empty icon={Mail} text={s.login.sentText(email.trim())}>
          <Text role="meta">{s.login.sentDevHint}</Text>
          <Button variant="quiet" label={s.login.otherAddress} onPress={() => setSent(false)} />
        </Empty>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text role="display">{s.login.title}</Text>

      {/* The kit's «Вход» demo, section 3: the providers first, carrying the dashed slot their own
          mark goes in, and the email link underneath as the quiet way in. No ember on this screen —
          the field's focus border is the one lit thing here. */}
      <View style={styles.group}>
        {/* ponytail: plain button; App Store review wants AppleAuthenticationButton before shipping. */}
        <Button
          variant="provider"
          label={s.login.withApple}
          onPress={withApple}
          disabled={!appleAvailable}
        />
        {appleAvailable ? null : <Text role="meta">{s.login.appleUnavailable}</Text>}
        <Button
          variant="provider"
          label={s.login.withGoogle}
          onPress={withGoogle}
          disabled={!googleRequest}
        />
      </View>

      <View style={styles.group}>
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
        />
        {/* `busy` already blocks the press, so the button only goes out when there is nothing to send. */}
        <Button
          variant="quiet"
          wide
          label={s.login.sendLink}
          onPress={sendLink}
          busy={busy}
          disabled={email.trim() === ''}
        />
      </View>

      {error ? <Banner tone="error" text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: space.s6,
    padding: space.s6,
    backgroundColor: color.ink,
  },
  // One way in, held together: the buttons of a group stand closer to each other than to the next.
  group: { gap: space.s3 },
});
