import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, errorMessage, signInWithApple, signInWithGoogle, startEmailSignIn } from '@/api';
import { useAuth } from '@/auth';

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

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your link</Text>
        <Text style={styles.hint}>
          Open the link we sent to {email.trim()}. In dev it is printed in the API log.
        </Text>
        <Button title="Use a different address" onPress={() => setSent(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!busy}
      />
      <Button title="Send me a link" onPress={sendLink} disabled={busy || email.trim() === ''} />

      <Text style={styles.divider}>or</Text>

      {/* ponytail: plain button; App Store review wants AppleAuthenticationButton before shipping. */}
      <Button title="Continue with Apple" onPress={withApple} disabled={!appleAvailable} />
      {appleAvailable ? null : (
        <Text style={styles.hint}>Apple sign-in is not available on this device.</Text>
      )}
      <Button title="Continue with Google" onPress={withGoogle} disabled={!googleRequest} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '600', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, fontSize: 16 },
  divider: { textAlign: 'center', opacity: 0.5 },
  hint: { fontSize: 15, textAlign: 'center', opacity: 0.7 },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
