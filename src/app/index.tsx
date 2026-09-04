import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Info, Plus, User } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  CardMemory,
  Empty,
  IconButton,
  RailH,
} from '@/kit';
import { color, space } from '@/theme';

/** The main screen doc-01 asks for: every memory this account organizes or was invited to. */
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  // No native header anywhere, so the screen owes the status bar its own room.
  const insets = useSafeAreaInsets();
  // null means «not loaded yet», which is what tells a first load from a refetch: a
  // refetch keeps the list on screen instead of flashing the spinner over it.
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listMemories(token).then(setMemories, (e: unknown) => setError(errorMessage(e)));
  }, [token]);

  // On focus rather than on mount, so coming back from /create shows the memory that
  // was just made without this screen having to know that anything happened.
  useFocusEffect(load);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* The kit's one loud move, in the second of the two places it is allowed. */}
      <RailH />
      <AppBar
        title="Memories"
        right={
          <>
            <IconButton icon={Info} label="About" onPress={() => router.push('/about')} />
            <IconButton icon={User} label="Profile" onPress={() => router.push('/profile')} />
          </>
        }
      />

      {/* Waiting and failing both hold the place of the list rather than blinking over it, so
          the shape of the screen never changes under the person reading it. */}
      {error !== null ? (
        <View style={styles.place}>
          <Banner tone="error" text={error}>
            <Button label="Try again" variant="quiet" sm onPress={load} />
          </Banner>
        </View>
      ) : memories === null ? (
        <View style={styles.place}>
          <Empty busy text="Gathering your memories…" />
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(memory) => memory.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Empty
              icon={Camera}
              text="No memories yet. Start one for your next event and the photos will land here from everyone."
            />
          }
          renderItem={({ item }) => (
            <CardMemory
              title={item.title}
              meta={facts(item)}
              // The tail wants the last few frames; the memories list carries counts and no
              // preview urls, so it counts what is inside instead of pretending to show it.
              // ponytail: pass `thumbs` here the day /memories hands out previews.
              more={item.media_count || undefined}
              onPress={() => router.push(`/memory/${item.id}`)}
            />
          )}
        />
      )}

      <ActionBar>
        <Button
          label="New memory"
          variant="primary"
          icon={Plus}
          wide
          onPress={() => router.push('/create')}
        />
      </ActionBar>
    </View>
  );
}

/** The line under the title: when it was, and what is in it. Nobody has added anything — say so. */
function facts(memory: Memory): string[] {
  return [
    formatEventDates(memory.event_start, memory.event_end),
    memory.media_count === 0
      ? 'nothing yet'
      : `${memory.media_count} frame${memory.media_count === 1 ? '' : 's'}`,
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink, paddingHorizontal: space.s4 },
  // Cards a 12 gap apart, and the list keeps the full height so its empty state has room.
  list: { flexGrow: 1, gap: space.s3, paddingBottom: space.s4 },
  place: { flex: 1 },
});
