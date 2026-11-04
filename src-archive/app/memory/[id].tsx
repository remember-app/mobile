import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { listMemories, type Memory } from '@/api';
import { useAuth } from '@/lib/auth';
import { type Failure, failure } from '@/lib/failure';
import { Frames } from '@/screens/memory/frames';
import { themed } from '@/theme';
export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const { token } = useAuth();
  const styles = useStyles();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(failure(e)),
    );
  }, [token, id]);
  useFocusEffect(load);
  return (
    <View style={styles.screen}>
      <Frames id={id} head={{ memory, error, reload: load }} />
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink },
  }),
);
