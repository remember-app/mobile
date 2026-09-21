import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { Films } from '@/memory/films';
import { type Face } from '@/memory/head';
import { Frames } from '@/memory/frames';
import { themed } from '@/theme';

/**
 * One memory — one screen with two faces: «не два экрана с одним именем, а один экран с двумя
 * лицами: имя стоит в шапке, лицо выбирают переключателем под ней». The frames and the movies used
 * to be routes of their own; there was a third face, «Люди», until TASK-209 moved who is in a memory
 * into its settings (`memory/[id]/settings`) along with the event itself.
 *
 * Everything that is the same for both lives here: which face is on, and the memory itself — its
 * name in the appbar, its days, the caller's level. Read once and handed down, so switching a face
 * does not blink the name. Everything else belongs to the face that draws it and is read when that
 * face comes on.
 *
 * The face can be asked for on the way in (`?face=films`), which is how a tapped «ролик готов» push
 * lands on the movies; without one, the frames are what a memory opens on, the way the kit's map
 * draws it.
 */
export default function MemoryScreen() {
  const { id, face: wanted } = useLocalSearchParams<{ id: string; face?: Face }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  // Held here and not in the url: switching a face is not a place one goes back to, and a `replace`
  // per press would spend a navigation on a segmented control. The link's own answer is the seed.
  const [face, setFace] = useState<Face>(wanted ?? 'frames');

  // And the seed again whenever it changes under a screen that is already up. A push mounts a fresh
  // one and never needs this, but a link followed onto the memory somebody is already reading only
  // hands the open screen new params — without this it stayed on the face they were on, which is
  // what a `?face=people` link did on the simulator. Pressing the switch does not move `wanted`, so
  // this cannot fight the hand.
  useEffect(() => {
    if (wanted) setFace(wanted);
  }, [wanted]);
  // null means «not read yet» — the appbar stands under the one shared fallback word until it is.
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The listing the home screen already reads answers everything this screen needs off the memory
    // itself, and it works however the screen was reached — a tapped push and a cold deep link
    // included, neither of which carries a title along. One read for all three faces.
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [token, id]);

  // On focus, the way the home screen does it: the title, the days and the level all change while
  // whoever is reading them is off uploading or being made an organizer.
  useFocusEffect(load);

  const head = { memory, error, reload: load, face, onFace: setFace };

  // The native header is off for the whole app, so the screen wears the kit's own appbar — drawn by
  // the face, which is what knows whether there is an icon in the corner — and takes the phone's top
  // inset itself.
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {face === 'films' ? <Films id={id} head={head} /> : <Frames id={id} head={head} />}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink },
  }),
);
