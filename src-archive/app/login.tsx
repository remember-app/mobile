import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type AuthMethods, fetchAuthMethods, signInWithApple, signInWithGoogle } from '@/api';
import { ActionBar, Banner, Board, Button } from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure, said, saying } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import type { Strings } from '@/strings';
import { space } from '@/theme';

WebBrowser.maybeCompleteAuthSession();
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
function providerError(s: Strings, provider: string, error: unknown): Failure {
  return failure(error, { 501: { text: saying(s.login.providerUnavailable(provider)) } });
}
export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const [error, setError] = useState<Failure | null>(null);
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);
  const [offered, setOffered] = useState<AuthMethods | null>(null);
  useEffect(() => {
    fetchAuthMethods().then(setOffered, () => {});
  }, []);
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID ?? 'unconfigured.apps.googleusercontent.com',
  });
  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError(said(s.login.noIdentityToken('Google')));
      return;
    }
    signInWithGoogle(idToken)
      .then((session) => signIn(session.token))
      .catch((e) => setError(providerError(s, 'Google', e)));
  }, [googleResponse, signIn]);
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
        setError(said(s.login.noIdentityToken('Apple')));
        return;
      }
      const session = await signInWithApple(credential.identityToken);
      await signIn(session.token);
    } catch (e) {
      if (
        (
          e as
            | {
                code?: string;
              }
            | null
            | undefined
        )?.code === 'ERR_REQUEST_CANCELED'
      )
        return;
      setError(providerError(s, 'Apple', e));
    }
  }
  async function withGoogle() {
    setError(null);
    if (!GOOGLE_CLIENT_ID) {
      setError(said(s.login.providerUnavailable('Google')));
      return;
    }
    await promptGoogle();
  }
  return (
    <Board
      footer={
        <ActionBar>
          <View style={styles.doors}>
            {appleAvailable && offered?.apple === true ? (
              <Button variant="paper" label={s.login.withApple} onPress={withApple} />
            ) : null}
            {GOOGLE_CLIENT_ID && offered?.google === true ? (
              <Button
                variant="secondary"
                label={s.login.withGoogle}
                onPress={withGoogle}
                disabled={!googleRequest}
              />
            ) : null}

            <Button
              variant="secondary"
              icon={Mail}
              glyph={{ size: 18, stroke: 1.8 }}
              label={s.login.withEmail}
              onPress={() => router.push('/login/email')}
            />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead step={1} />

      <View style={styles.room}>{error ? <Banner tone="error" failure={error} /> : null}</View>
    </Board>
  );
}
const styles = StyleSheet.create({
  room: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: space.s4 },
  doors: { flex: 1, gap: 10 },
});
