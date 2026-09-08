import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  signInWithApple,
  signInWithGoogle,
  startEmailSignIn,
  verifyEmailToken,
} from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, Empty, Field, RailH, Text } from '@/kit';
import { useStrings } from '@/language';
import { type Strings } from '@/strings';
import { space, themed } from '@/theme';

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
  const styles = useStyles();
  // The native header is off for the whole app, so the screen owes the status bar its own room.
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState(false);
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
      const { link } = await startEmailSignIn(email.trim());
      // Every install that can post the letter answers with the bare `ok`, and there is nothing
      // left to do here but say where to look for it. A link in the answer means the api had no
      // mail to post it with (TASK-97) and handed the token straight back — so the screen walks it
      // in itself, the same trade `auth/email.tsx` makes when a real link is opened.
      if (!link) {
        setSent(true);
        return;
      }
      setDevLink(true);
      const token = new URL(link).searchParams.get('token');
      if (!token) {
        setDevLink(false);
        setError(s.link.noToken);
        return;
      }
      const session = await verifyEmailToken(token);
      await signIn(session.token);
    } catch (e) {
      setDevLink(false);
      // Both of these carry api wording written for whoever runs the server, so the screen answers
      // in its own words instead of passing the server's along: 503 is the api saying it has no
      // mail keys, 401 that the link it just handed back is already spent.
      const status = e instanceof ApiError ? e.status : null;
      if (status === 503) setError(s.login.mailDown);
      else if (status === 401) setError(s.link.expired);
      else setError(errorMessage(e));
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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <RailH />
        <View style={styles.middle}>
          <Text role="display">{s.login.sentTitle}</Text>
          <Empty icon={Mail} text={s.login.sentText(email.trim())}>
            <Button
              variant="quiet"
              label={s.login.otherAddress}
              onPress={() => setSent(false)}
            />
          </Empty>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* This is where a person lands with nothing else on screen to tell them where they are, so
          the top of it says so: the kit's perforation in the second of the two places it is
          allowed, and the product's own name under it as the screen's one heading. The name is the
          product's own and is the same word in both languages — the one heading here never turns. */}
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
          {/* `busy` already blocks the press, so the button only goes out when there is nothing
              to send. */}
          <Button
            variant="quiet"
            wide
            label={s.login.sendLink}
            onPress={sendLink}
            busy={busy}
            disabled={email.trim() === ''}
          />
        </View>

        {/* Not a way in anybody was meant to have — the plain banner says so while the trade runs,
            so this is never mistaken for the sign-in a person on a phone gets. */}
        {devLink ? <Banner text={s.login.devLink} /> : null}
        {error ? <Banner tone="error" text={error} /> : null}
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // No native header anywhere in the app, so the perforation is what the status bar sits above.
    screen: { flex: 1, paddingHorizontal: space.s6, backgroundColor: color.ink },
    // Everything the screen asks for, held in the middle under the name.
    middle: { flex: 1, justifyContent: 'center', gap: space.s6, paddingBottom: space.s6 },
    // One way in, held together: the buttons of a group stand closer to each other than to the next.
    group: { gap: space.s3 },
  }),
);
