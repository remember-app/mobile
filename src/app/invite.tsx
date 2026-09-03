import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { acceptInvite, ApiError, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { clearInvite, peekInvite, stashInvite } from '@/push';

/**
 * Where `remember://invite?token=…` lands. There is no web page for an invite and no anonymous
 * path into a memory (decision-01): whoever follows a link already has an account, so this either
 * joins them straight away or sends them to sign in and picks the link back up afterwards.
 */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const { status, token: session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // A repeated query key arrives as an array; the api takes one string. With no token in the
  // url at all this is the second visit — the one `usePush` reopens once a session exists — and
  // the token is waiting in the module where the first visit left it.
  const fromLink = Array.isArray(params.token) ? params.token[0] : params.token;
  const invite = fromLink ?? peekInvite();

  useEffect(() => {
    if (!invite) {
      setError('This link has no token in it — ask for a new one.');
      return;
    }
    // The stored session is still being checked; the splash is still up. Nothing to decide yet.
    if (status === 'loading') return;

    if (status !== 'ready' || session === null) {
      // Held in memory across the sign-in — `usePush` hands it back to this screen once the
      // session lands, so the link the person actually tapped is the one that gets accepted.
      stashInvite(invite);
      router.replace('/login');
      return;
    }

    let live = true;
    acceptInvite(session, invite).then(
      (memory) => {
        // Answered, so nothing is left waiting; cleared here and not on read, so a re-render
        // in the middle of the call cannot lose the token it is still working on.
        clearInvite();
        // replace, not push: a link that has been spent must not sit in the back stack.
        router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
      },
      (e: unknown) => {
        if (!live) return;
        const dead = e instanceof ApiError && e.status === 404;
        // A dead link is answered too — keeping it would send the next sign-in back here.
        if (dead) clearInvite();
        setError(
          dead
            ? 'This invite link is no longer valid — ask whoever sent it for a new one.'
            : errorMessage(e),
        );
      },
    );
    return () => {
      live = false;
    };
  }, [invite, status, session]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Link href="/" replace style={styles.link}>
          Go to my memories
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.hint}>Joining…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  hint: { fontSize: 16, opacity: 0.7 },
  error: { fontSize: 16, color: '#C0392B', textAlign: 'center' },
  link: { fontSize: 16, color: '#208AEF' },
});
