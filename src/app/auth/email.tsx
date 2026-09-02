import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError, errorMessage, verifyEmailToken } from '@/api';
import { useAuth } from '@/auth';

/**
 * Where `remember://auth/email?token=…` lands. The link token is only ever handed straight
 * back to the api — it is never rendered, stored or otherwise interpreted here.
 */
export default function EmailLinkScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // A repeated query key arrives as an array; the api takes one string.
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  useEffect(() => {
    if (!token) {
      setError('This link has no token in it — request a new one.');
      return;
    }
    let live = true;
    verifyEmailToken(token)
      .then((session) => signIn(session.token))
      .catch((e) => {
        if (!live) return;
        setError(
          e instanceof ApiError && e.status === 401
            ? 'This link expired — request a new one.'
            : errorMessage(e),
        );
      });
    return () => {
      live = false;
    };
  }, [token, signIn]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        {/* replace, not push: a spent link must not sit in the back stack. */}
        <Link href="/login" replace style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.hint}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  hint: { fontSize: 16, opacity: 0.7 },
  error: { fontSize: 16, color: '#C0392B', textAlign: 'center' },
  link: { fontSize: 16, color: '#208AEF' },
});
