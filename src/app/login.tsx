import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ApiError,
  type AuthMethods,
  errorMessage,
  fetchAuthMethods,
  signInWithApple,
  signInWithGoogle,
} from '@/api';
import { ActionBar, Banner, Board, Button } from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import type { Strings } from '@/strings';
import { space } from '@/theme';

// Closes the auth browser tab once Google redirects back.
WebBrowser.maybeCompleteAuthSession();

// No Google credentials exist yet, and without them there is no Google button on the screen at all.
// The hook below still has to be called — hooks cannot stand under a condition — and it throws on an
// undefined client id, so it gets a placeholder to hold onto that nothing is ever pressed into.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

/** «Apple» and «Google» are names and stay themselves; only the sentence around them turns. */
function providerError(s: Strings, provider: string, error: unknown): string {
  if (error instanceof ApiError && error.status === 501) {
    return s.login.providerUnavailable(provider);
  }
  return errorMessage(error);
}

/**
 * `Login` — the three doors (spec 8, «Онбординг»). Three buttons of one size at the bottom edge and
 * the shared head above them; no way back, because this is the beginning.
 *
 * None of the three is the main action: there is no `accent` on this screen at all. Which door a
 * person owns is not for the app to have an opinion about, and lighting one of them would be one.
 */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const [error, setError] = useState<string | null>(null);
  // `null` until the phone has answered — which is a third thing from «yes» and «no», and the
  // reason it is not seeded `false`. The answer is a native round trip, so a screen that assumed
  // «no» would draw the doors one way on the first paint and rearrange them a frame later.
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);

  // False on Android and on any build without the Sign in with Apple entitlement.
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  // What the api has switched on — a door it holds no keys for ends in 501 however able the phone
  // is. `null` until it answers, and for good if it never does: the mail door stands either way, so
  // the other two only ever join it, never drawn and taken back.
  const [offered, setOffered] = useState<AuthMethods | null>(null);
  useEffect(() => {
    fetchAuthMethods().then(setOffered, () => {});
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

  return (
    <Board
      footer={
        <ActionBar>
          <View style={styles.doors}>
            {/* A way in that cannot be walked is not offered at all — a button standing there
                switched off, or one that opens nothing when pressed, only asks a person to work out
                which of the three is the real one. Off Apple hardware, in a build with no Google
                client id, and wherever the api has not switched a provider on, this bottom edge is
                the mail door alone. `=== true` because only a plain yes opens a door: a body that
                is not the api's — a proxy's page, a stray string — says nothing.
                ponytail: plain button; App Store review wants AppleAuthenticationButton before
                shipping — and that is where the provider's own mark comes from too. */}
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
            {/* The one door every build has, and it wears the same outline as Google's however
                many stand above it: the screen that asks for an address is a screen, not a fourth
                thing to read past here. */}
            <Button
              variant="secondary"
              icon={Mail}
              label={s.login.withEmail}
              onPress={() => router.push('/login/email')}
            />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead />

      {/* The room between the head and the doors. Anything that has to be said stands at the foot
          of it — over the buttons it is about, never over the name. */}
      <View style={styles.room}>{error ? <Banner tone="error" text={error} /> : null}</View>
    </Board>
  );
}

const styles = StyleSheet.create({
  // The kit's side inset, held by the belt rather than by the board around it — held once around
  // everything, the footer's gradient would stop short of either edge.
  room: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: space.s4 },
  // Spec 8: three buttons of one size, stacked. The bottom layer lays its children in a row, so
  // the column is this one child of it.
  doors: { flex: 1, gap: space.s2 },
});
