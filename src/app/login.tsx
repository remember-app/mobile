import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, errorMessage, signInWithApple, signInWithGoogle, startEmailSignIn } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, Empty, Field, RailH, Text } from '@/kit';
import { color, space } from '@/theme';

// Closes the auth browser tab once Google redirects back.
WebBrowser.maybeCompleteAuthSession();

// No Google credentials exist yet. The provider hook throws when the client id is undefined,
// so it gets a placeholder and the button answers before ever opening a browser.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

function providerError(provider: string, error: unknown): string {
  if (error instanceof ApiError && error.status === 501) {
    return `${provider} sign-in isn't available yet.`;
  }
  return errorMessage(error);
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  // The native header is off for the whole app, so the screen owes the status bar its own room.
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError('Google did not return an identity token.');
      return;
    }
    signInWithGoogle(idToken)
      .then((session) => signIn(session.token))
      .catch((e) => setError(providerError('Google', e)));
  }, [googleResponse, signIn]);

  async function sendLink() {
    setBusy(true);
    setError(null);
    try {
      await startEmailSignIn(email.trim());
      setSent(true);
    } catch (e) {
      // 503 is the api saying it has no mail keys; its own wording for that is written for whoever
      // runs it, so the screen answers in its own words instead of passing the server's along.
      setError(
        e instanceof ApiError && e.status === 503
          ? "We can't send sign-in links right now — try again later."
          : errorMessage(e),
      );
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
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const session = await signInWithApple(credential.identityToken);
      await signIn(session.token);
    } catch (e) {
      // Backing out of the native sheet is not an error worth showing.
      if ((e as { code?: string } | null | undefined)?.code === 'ERR_REQUEST_CANCELED') return;
      setError(providerError('Apple', e));
    }
  }

  async function withGoogle() {
    setError(null);
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in isn't available yet.");
      return;
    }
    await promptGoogle();
  }

  // The link is out: the screen has nothing left to ask for, so it says where to look for it and
  // keeps only the way back — the kit's «waiting» shape, section 6.
  if (sent) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <RailH />
        <View style={styles.middle}>
          <Text role="display">Check your link</Text>
          <Empty
            icon={Mail}
            text={`Open the link we sent to ${email.trim()} — it signs you in here.`}
          >
            <Button variant="quiet" label="Use a different address" onPress={() => setSent(false)} />
          </Empty>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* This is where a person lands with nothing else on screen to tell them where they are, so
          the top of it says so: the kit's perforation in the second of the two places it is
          allowed, and the product's own name under it as the screen's one heading. */}
      <RailH />
      <View style={styles.middle}>
        <Text accessibilityRole="header" role="display">
          Remember
        </Text>

        {/* The kit's «Вход» demo, section 3: the providers first, the email link underneath as the
            quiet way in. No ember on this screen — the field's focus border is the one lit thing
            here. */}
        <View style={styles.group}>
          {/* ponytail: plain button; App Store review wants AppleAuthenticationButton before
              shipping — and that is where the provider's own mark comes from too. */}
          <Button
            variant="provider"
            label="Continue with Apple"
            onPress={withApple}
            disabled={!appleAvailable}
          />
          {appleAvailable ? null : (
            <Text role="meta">Apple sign-in is not available on this device.</Text>
          )}
          <Button
            variant="provider"
            label="Continue with Google"
            onPress={withGoogle}
            disabled={!googleRequest}
          />
        </View>

        <View style={styles.group}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!busy}
          />
          {/* `busy` already blocks the press, so the button only goes out when there is nothing
              to send. */}
          <Button
            variant="quiet"
            wide
            label="Send me a link"
            onPress={sendLink}
            busy={busy}
            disabled={email.trim() === ''}
          />
        </View>

        {error ? <Banner tone="error" text={error} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No native header anywhere in the app, so the perforation is what the status bar sits above.
  screen: { flex: 1, paddingHorizontal: space.s6, backgroundColor: color.ink },
  // Everything the screen asks for, held in the middle under the name.
  middle: { flex: 1, justifyContent: 'center', gap: space.s6, paddingBottom: space.s6 },
  // One way in, held together: the buttons of a group stand closer to each other than to the next.
  group: { gap: space.s3 },
});
