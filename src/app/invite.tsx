import { router, useLocalSearchParams } from 'expo-router';
import { Link2Off } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { acceptInvite, ApiError, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { ActionBar, Board, Button, Empty, Text, Waiting } from '@/kit';
import { useStrings } from '@/language';
import { clearInvite, peekInvite, stashInvite } from '@/push';
import { space } from '@/theme';

/**
 * Where `remember://invite?token=…` lands. There is no web page for an invite and no anonymous
 * path into a memory (decision-01): whoever follows a link already has an account, so this either
 * joins them straight away or sends them to sign in and picks the link back up afterwards.
 *
 * Two faces, spec 8 «Приглашение и края»: `InviteJoining` while it is being answered — the name of
 * the product and a spinner, no bar and no bottom layer, because there is nothing to press and
 * nowhere to go back to — and `InviteDead` when the answer is no.
 */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const { status, token: session } = useAuth();
  const s = useStrings();
  // The dead end, in the two lines it is made of: what happened, and — when it is the one failure
  // this screen has a name for — the heading that says it is not the person's doing.
  const [stop, setStop] = useState<{ title?: string; text: string } | null>(null);

  // A repeated query key arrives as an array; the api takes one string. With no token in the
  // url at all this is the second visit — the one `usePush` reopens once a session exists — and
  // the token is waiting in the module where the first visit left it.
  const fromLink = Array.isArray(params.token) ? params.token[0] : params.token;
  const invite = fromLink ?? peekInvite();

  // `s` is deliberately out of the dependencies below: re-running this effect would send a spent
  // invite back to the api. The words are read on the pass that actually sets one.
  useEffect(() => {
    if (!invite) {
      setStop({ text: s.join.noToken });
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
        // replace, not push: a link that has been spent must not sit in the back stack. Onto the
        // memory itself — it is one screen now (TASK-207), and whoever just joined is shown what
        // they joined; who else is in it is one press away, on the capsule at the top of the feed.
        router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
      },
      (e: unknown) => {
        if (!live) return;
        const dead = e instanceof ApiError && e.status === 404;
        // A dead link is answered too — keeping it would send the next sign-in back here.
        if (dead) clearInvite();
        // Only the revoked link gets a heading: everything else is the api saying what went wrong
        // in its own words, and a heading over it would be this screen guessing.
        setStop(dead ? { title: s.join.deadTitle, text: s.join.dead } : { text: errorMessage(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [invite, status, session]);

  // `InviteJoining`: the name of the product, the spinner the spec turns at 34 for a link being
  // walked in, and the line saying what is being waited for. It lives a second and leads inward.
  if (!stop) {
    return (
      <Board style={styles.joining}>
        <Text accessibilityRole="header" role="heroNarrow">
          Remember
        </Text>
        <Waiting text={s.state.joining} size={34} />
      </Board>
    );
  }

  // `InviteDead`: an empty state with the sign of a link pulled apart, and the way out standing in
  // the bottom layer — «replace», like every other exit from here, because a spent invite must not
  // sit in the back stack.
  return (
    <Board>
      <View style={styles.body}>
        <Empty sign="line" icon={Link2Off} title={stop.title} text={stop.text} />
      </View>
      <ActionBar>
        <Button variant="primary" label={s.join.home} onPress={() => router.replace('/')} />
      </ActionBar>
    </Board>
  );
}

const styles = StyleSheet.create({
  // Nothing is above or below it, so the whole board is the block: the spec's 26 between the three
  // pieces, and margins wide enough that the word never runs to the edges.
  joining: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.s6,
    paddingHorizontal: space.s7,
  },
  // The body is what is left above the bottom layer, and the empty state stands in the middle of it.
  body: { flex: 1, justifyContent: 'center' },
});
