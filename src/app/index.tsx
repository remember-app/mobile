import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';

/** The main screen doc-01 asks for: every memory this account organizes or was invited to. */
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
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

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Try again" onPress={load} />
      </View>
    );
  }

  if (memories === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={memories}
        keyExtractor={(memory) => memory.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.hint}>
            No memories yet. Create one for your next event and the photos will land here.
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={`/memory/${item.id}`} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDates}>{formatEventDates(item.event_start, item.event_end)}</Text>
            </Pressable>
          </Link>
        )}
      />

      <View style={styles.footer}>
        <Button title="New memory" onPress={() => router.push('/create')} />
        <View style={styles.links}>
          <Link href="/profile" style={styles.link}>
            Profile
          </Link>
          <Link href="/about" style={styles.link}>
            About
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  list: { flexGrow: 1, padding: 16, gap: 12 },
  row: { borderWidth: 1, borderColor: '#E1E1E1', borderRadius: 10, padding: 16, gap: 4 },
  rowTitle: { fontSize: 18, fontWeight: '600' },
  rowDates: { fontSize: 14, opacity: 0.6 },
  footer: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  link: { fontSize: 15, color: '#208AEF' },
  hint: { fontSize: 16, opacity: 0.6, textAlign: 'center' },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
