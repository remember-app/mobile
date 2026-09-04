import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { acceptInvite, ApiError, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, Empty } from '@/kit';
import { clearInvite, peekInvite, stashInvite } from '@/push';
import { color, space } from '@/theme';

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

  // Says what it is busy with and holds the middle of the screen, rather than blinking over it:
  // there is nothing else on this screen to hold place for.
  if (!error) {
    return (
      <View style={styles.screen}>
        <Empty busy text="Joining…" />
      </View>
    );
  }

  // A spent link is a dead end, so the way out is the screen's one action — and «replace», like
  // every other exit from here, because a used invite must not sit in the back stack.
  return (
    <View style={styles.screen}>
      <View style={styles.dead}>
        <Banner tone="error" text={error} />
        <Button label="Go to my memories" wide onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: color.ink },
  // Capped where the kit caps a sheet, so the bar does not run the width of a tablet.
  dead: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: space.s4,
    paddingHorizontal: space.s5,
  },
});
