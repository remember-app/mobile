import { router, useLocalSearchParams } from 'expo-router';
import { Link2Off } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, acceptInvite, errorMessage } from '@/api';
import { ActionBar, Board, Button, Empty, Spinner, Text, useFooterOverhang } from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { clearInvite, peekInvite, stashInvite } from '@/lib/push';
import { space, spinner } from '@/theme';
export default function InviteScreen() {
  const params = useLocalSearchParams<{
    token?: string | string[];
  }>();
  const { status, token: session } = useAuth();
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const overhang = useFooterOverhang();
  const [stop, setStop] = useState<{
    title?: string;
    text: string;
  } | null>(null);
  const fromLink = Array.isArray(params.token) ? params.token[0] : params.token;
  const invite = fromLink ?? peekInvite();
  useEffect(() => {
    if (!invite) {
      setStop({ text: s.join.noToken });
      return;
    }
    if (status === 'loading') return;
    if (status !== 'ready' || session === null) {
      stashInvite(invite);
      router.replace('/login');
      return;
    }
    let live = true;
    acceptInvite(session, invite).then(
      (memory) => {
        clearInvite();
        router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
      },
      (e: unknown) => {
        if (!live) return;
        const dead = e instanceof ApiError && e.status === 404;
        if (dead) clearInvite();
        setStop(dead ? { title: s.join.deadTitle, text: s.join.dead } : { text: errorMessage(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [invite, status, session]);
  if (!stop) {
    return (
      <Board body={[styles.joining, { paddingBottom: insets.top }]}>
        <Text accessibilityRole="header" role="heroSm">
          Remember
        </Text>
        <Spinner size={spinner.join} />
        <Text role="rowPlain" tone="muted" style={styles.centred}>
          {s.state.joining}
        </Text>
      </Board>
    );
  }
  return (
    <Board
      body={[styles.body, { paddingBottom: insets.top + overhang }]}
      footer={
        <ActionBar>
          <Button variant="primary" label={s.join.home} onPress={() => router.replace('/')} />
        </ActionBar>
      }
    >
      <Empty sign="line" icon={Link2Off} title={stop.title} text={stop.text} />
    </Board>
  );
}
const styles = StyleSheet.create({
  joining: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 26,
    paddingHorizontal: space.s7,
  },
  centred: { textAlign: 'center' },
  body: { justifyContent: 'center', paddingHorizontal: space.s4 },
});
