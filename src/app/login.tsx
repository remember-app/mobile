import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
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
import { ActionBar, Banner, Button, Empty, Field, RailH, Text } from '@/kit';
import { useStrings } from '@/language';
import { type Strings } from '@/strings';
import { space, themed } from '@/theme';

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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  // The native header is off for the whole app, so the screen owes the status bar its own room.
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  // Which of the two the footer is holding: the ways in, or the one that was asked for by name. The
  // kit brings the field in *on the place of* the buttons (screen 1, «Края») — a way in that is
  // there for whoever has no provider account, and not a fourth thing to read past for everyone else.
  const [byMail, setByMail] = useState(false);
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
        <RailH style={styles.belt} />
        <View style={[styles.belt, styles.middle]}>
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
    // The field below stands at the bottom edge, which is exactly where the keyboard comes up.
    // Android resizes the window itself; iOS needs telling, the same way the kit's sheet does.
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* This is where a person lands with nothing else on screen to tell them where they are, so
          the top of it says so: the kit's perforation in the second of the two places it is
          allowed, and the product's own name under it as the screen's one heading. The name is the
          product's own and is the same word in both languages — the one heading here never turns. */}
      <RailH style={styles.belt} />

      {/* The kit's screen 1: the name in `hero`, one line of what this is for, and then nothing
          until the bottom of the screen — «тёмная комната перед тем, как включат свет». Whatever
          else could be said here is said better by the first screen after the way in. */}
      <View style={[styles.belt, styles.middle]}>
        <Text accessibilityRole="header" role="hero">
          Remember
        </Text>
        <Text>{s.login.promise}</Text>
      </View>

      {/* Both of these belong to the buttons under them, so the kit stands them over the footer and
          in the flow — never in the middle of the screen, and never over the thing they are about. */}
      <View style={[styles.belt, styles.notes]}>
        {/* Not a way in anybody was meant to have — the plain banner says so while the trade runs,
            so this is never mistaken for the sign-in a person on a phone gets. */}
        {devLink ? <Banner text={s.login.devLink} /> : null}
        {error ? <Banner tone="error" text={error} /> : null}
      </View>

      {/* The kit's `.actionbar-col`: the ways in are stacked at the bottom edge, under the thumb.
          No ember while a provider stands here — the choice between them is an even one, and
          lighting one of them would be a lie. The field's focus border is the one lit thing then. */}
      <ActionBar style={[styles.belt, styles.column]}>
        {byMail ? (
          <>
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
              variant="quiet"
              wide
              label={s.login.sendLink}
              onPress={sendLink}
              busy={busy}
              disabled={email.trim() === ''}
            />
            {/* The screen has no way back of its own, so this state needs one: whoever opened the
                field by mistake gets the two providers back instead of a dead end. */}
            <Button
              variant="quiet"
              wide
              label={s.action.back}
              onPress={() => setByMail(false)}
              disabled={busy}
            />
          </>
        ) : (
          <>
            {/* A way in that cannot be walked is not offered at all — a button standing there
                switched off, or one that opens nothing when pressed, only asks a person to work out
                which of the three is the real one. Off Apple hardware, and in a build with no
                Google client id, this bottom edge is the mail line alone.
                ponytail: plain button; App Store review wants AppleAuthenticationButton before
                shipping — and that is where the provider's own mark comes from too. */}
            {appleAvailable ? (
              <Button variant="provider" label={s.login.withApple} onPress={withApple} />
            ) : null}
            {GOOGLE_CLIENT_ID ? (
              <Button
                variant="provider"
                label={s.login.withGoogle}
                onPress={withGoogle}
                disabled={!googleRequest}
              />
            ) : null}
            {/* Quiet, and last, while there is something above it: it is the way in for whoever has
                neither account, and asking for it is what brings the field up in their place. Alone
                at the bottom it stops being the third choice and becomes the screen's one action —
                so it takes the ember the kit gives that, rather than hanging there as a grey line
                under an empty room. */}
            <Button
              variant={appleAvailable || GOOGLE_CLIENT_ID ? 'quiet' : 'primary'}
              wide
              label={s.login.withEmail}
              onPress={() => setByMail(true)}
            />
          </>
        )}
      </ActionBar>
    </KeyboardAvoidingView>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // No native header anywhere in the app, so the perforation is what the status bar sits above.
    screen: { flex: 1, backgroundColor: color.ink },
    // The kit's side inset, 16, held by each belt rather than by the screen around them — held
    // once around all three, the footer's hairline would stop short of either edge instead of
    // running the full width, which is what the kit says out loud about it.
    belt: { paddingHorizontal: space.s4 },
    // The kit's `.screen__body-mid` with its `.stack-4`: nothing here scrolls, so what little there
    // is stands in the middle of the room.
    middle: { flex: 1, justifyContent: 'center', gap: space.s4 },
    // Empty until something has to be said, and then a `.stack-2` of it above the footer.
    notes: { gap: space.s2 },
    // `.actionbar-col`: the ways in are a column, and a tighter one than a row of them would be.
    column: { flexDirection: 'column', gap: space.s2 },
  }),
);
