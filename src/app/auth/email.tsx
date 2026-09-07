import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, verifyEmailToken } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, Empty } from '@/kit';
import { useStrings } from '@/language';
import { color, space } from '@/theme';

/**
 * Where `remember://auth/email?token=…` lands. The link token is only ever handed straight
 * back to the api — it is never rendered, stored or otherwise interpreted here.
 */
export default function EmailLinkScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const { signIn } = useAuth();
  const s = useStrings();
  const [error, setError] = useState<string | null>(null);

  // A repeated query key arrives as an array; the api takes one string.
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  // `s` is deliberately not a dependency: re-running this effect would send a spent link back to
  // the api. Nobody can switch language from here anyway — this screen stands before the sign-in.
  useEffect(() => {
    if (!token) {
      setError(s.link.noToken);
      return;
    }
    let live = true;
    verifyEmailToken(token)
      .then((session) => signIn(session.token))
      .catch((e) => {
        if (!live) return;
        setError(e instanceof ApiError && e.status === 401 ? s.link.expired : errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [token, signIn]);

  if (error) {
    return (
      <View style={styles.screen}>
        <Banner tone="error" text={error}>
          {/* replace, not push: a spent link must not sit in the back stack. */}
          <Button
            variant="quiet"
            sm
            label={s.link.backToSignIn}
            onPress={() => router.replace('/login')}
          />
        </Banner>
      </View>
    );
  }

  // Nothing to do but wait, and it is over in a moment — the kit's spinner holds the screen
  // rather than blinking a dialog over it.
  return (
    <View style={styles.screen}>
      <Empty busy text={s.state.signingIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: space.s6,
    backgroundColor: color.ink,
  },
});
