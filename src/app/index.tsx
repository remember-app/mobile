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
import { useStrings } from '@/language';
import { type Strings } from '@/strings';
import { space, themed } from '@/theme';

/** The main screen doc-01 asks for: every memory this account organizes or was invited to. */
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
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
        title={s.home.title}
        right={
          <>
            <IconButton icon={Info} label={s.home.about} onPress={() => router.push('/about')} />
            <IconButton icon={User} label={s.home.profile} onPress={() => router.push('/profile')} />
          </>
        }
      />

      {/* Waiting and failing both hold the place of the list rather than blinking over it, so
          the shape of the screen never changes under the person reading it. */}
      {error !== null ? (
        <View style={styles.place}>
          <Banner tone="error" text={error}>
            <Button label={s.action.retry} variant="quiet" sm onPress={load} />
          </Banner>
        </View>
      ) : memories === null ? (
        <View style={styles.place}>
          <Empty busy text={s.state.gathering} />
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(memory) => memory.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Empty icon={Camera} text={s.home.empty} />}
          renderItem={({ item }) => {
            // `?? []` and not a bare read: the app ships over the air and the api deploys on its
            // own, so a build that knows this field can meet one that does not. Every other new
            // field degrades quietly under that skew — this one would throw inside the list
            // renderer and take the main screen down with it.
            const thumbs = item.recent_thumbnail_urls ?? [];

            return (
              <CardMemory
                title={item.title}
                meta={facts(item, s)}
                // The frames the listing signed for this memory, drawn as they come: the card shows
                // what is inside instead of counting it, so nothing here says how much is left over.
                thumbs={thumbs}
                // Two different silences, and they must not be worded the same. A memory with
                // nothing in it is waiting for the first frame. A memory that has a hundred but
                // signed no thumbnail — the worker has not made them yet, the api has no bucket,
                // or the build is older than the field — is not empty, and telling that person to
                // add the first ones would be a lie the meta line beside it contradicts.
                blank={item.media_count === 0 ? s.home.noFrames : s.state.preparing}
                // Straight to the material: what a memory is for is the photos in it, so the card
                // opens the gallery. Who is in it lives one icon away, in that screen's appbar.
                onPress={() =>
                  router.push({ pathname: '/memory/[id]/gallery', params: { id: item.id } })
                }
              />
            );
          }}
        />
      )}

      <ActionBar>
        <Button
          label={s.home.create}
          variant="primary"
          icon={Plus}
          wide
          onPress={() => router.push('/create')}
        />
      </ActionBar>
    </View>
  );
}

/**
 * The line under the title: when it was, and how much is in it. An empty memory says nothing here —
 * the card draws that on the film itself, and saying it twice on one card is saying it twice.
 */
function facts(memory: Memory, s: Strings): string[] {
  const dates = formatEventDates(memory.event_start, memory.event_end);

  return memory.media_count === 0 ? [dates] : [dates, s.memory.frames(memory.media_count)];
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink, paddingHorizontal: space.s4 },
    // Cards a 12 gap apart, and the list keeps the full height so its empty state has room.
    list: { flexGrow: 1, gap: space.s3, paddingBottom: space.s4 },
    place: { flex: 1 },
  }),
);
