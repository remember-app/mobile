import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listMemories, type Memory } from '@/api';
import { useAuth } from '@/lib/auth';
import { type Failure, failure } from '@/lib/failure';
import { Frames } from '@/screens/memory/frames';
import { themed } from '@/theme';

/**
 * A memory — one screen and no tabs (spec 8, `MemoryFrames`): the feed of frames runs the width and
 * the height of the phone, the films stand first on it, and everything else floats over it. What
 * used to be three faces under a switch is one surface now: the people moved to the memory's own
 * settings, reached by the capsule in the glass bar, and the films became the first block of the
 * feed.
 *
 * All this route holds is the memory itself — its name, its days, the caller's level, how many
 * people are in it — read once here rather than by the screen, so nothing about it blinks while the
 * feed underneath moves. Everything else is read by whatever draws it.
 */
export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const styles = useStyles();
  // null means «not read yet» — the capsule stands under the one shared fallback word until it is.
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The listing the home screen already reads answers everything this screen needs off the memory
    // itself, and it works however the screen was reached — a tapped push and a cold deep link
    // included, neither of which carries a title along.
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(failure(e)),
    );
  }, [token, id]);

  // On focus, the way the home screen does it: the title, the days and the level all change while
  // whoever is reading them is off uploading, editing the memory or being made an organizer.
  useFocusEffect(load);

  // The native header is off for the whole app, and here even the screen's own bar floats over the
  // frames — so the board is the ink behind them and the top inset belongs to the glass bar itself.
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
