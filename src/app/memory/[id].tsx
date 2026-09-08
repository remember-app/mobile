import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { Films } from '@/memory/films';
import { type Face } from '@/memory/head';
import { Frames } from '@/memory/frames';
import { People } from '@/memory/people';
import { themed } from '@/theme';

/**
 * One memory — one screen with three faces (kit, «Экраны» 4–6): «не три экрана с одним именем, а
 * один экран с тремя лицами: имя стоит в шапке, лицо выбирают переключателем под ней». The frames,
 * the movies and the people used to be three routes under three captions, reached by an unlabelled
 * corner icon; this is all three under one appbar, and the switch under it is how they are reached.
 *
 * Everything that is the same for all three lives here: which face is on, and the memory itself —
 * its name in the appbar, its days, the caller's level. Read once and handed down, so switching a
 * face does not blink the name. Everything else — the material, the montages, the roster — belongs
 * to the face that draws it and is read when that face comes on.
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
      {face === 'films' ? (
        <Films id={id} head={head} />
      ) : face === 'people' ? (
        <People id={id} head={head} />
      ) : (
        <Frames id={id} head={head} />
      )}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink },
  }),
);
