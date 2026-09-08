import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Memory } from '@/api';
import { AppBar, Banner, Button, IconButton, Segment } from '@/kit';
import { useStrings } from '@/language';
import { space } from '@/theme';

/**
 * A memory is one screen with three faces — frames, movies, people (kit, «Экраны» 4–6). The name
 * stands in the appbar and the face is picked in the row under it: «Воспоминание — не три экрана с
 * одним именем, а один экран с тремя лицами».
 */
export type Face = 'frames' | 'films' | 'people';

/** What the route knows and all three faces draw the same: the memory itself, and which face is on. */
export type Head = {
  /** null until the listing answers — the appbar stands under one shared word until it does. */
  memory: Memory | null;
  /** The memory could not be read. The face's own list has its own line for its own failure. */
  error: string | null;
  reload: () => void;
  face: Face;
  onFace: (face: Face) => void;
};

/**
 * The top of all three faces: the memory's name, the way back out of it, the switch between the
 * faces, and — on the right — at most one icon, which is the face's own business and comes in as
 * `right`. The kit gives that corner to exactly one face (the frames' «Скачать всю галерею»); the
 * other two leave it empty, because moving between faces is what the switch is for and an icon that
 * did it too would be a second way to say the same thing.
 *
 * Drawn by each face rather than by the route around them, so the icon in that corner belongs to the
 * same component as the errand it starts, and nothing has to be passed back up a level.
 */
export function MemoryHead({
  memory,
  error,
  reload,
  face,
  onFace,
  right,
}: Head & { right?: ReactNode }) {
  const router = useRouter();
  const s = useStrings();

  return (
    <View style={styles.head}>
      <AppBar
        title={memory?.title ?? s.memory.fallbackTitle}
        // No subtitle any more: the switch below says which face is open, and it says it in words
        // that can be pressed (TASK-101 — three screens under three captions became one screen).
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            // A tapped push and a followed invite both open this screen with nothing behind it.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
        right={right}
      />
      <Segment
        wide
        // The row is titled by the screen it stands under; the name is only spoken.
        hideLabel
        label={s.memory.whatToShow}
        value={face}
        onChange={onFace}
        options={[
          { value: 'frames', label: s.memory.framesPlain },
          { value: 'films', label: s.montage.title },
          { value: 'people', label: s.members.title },
        ]}
        style={styles.faces}
      />
      {error === null ? null : (
        <Banner tone="error" text={error} style={styles.faces}>
          <Button sm variant="quiet" label={s.action.retry} onPress={reload} />
        </Banner>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The kit's `.screen__head`: 16 at the sides, and it does not scroll away with the face below it.
  head: { paddingHorizontal: space.s4 },
  // `.screen__head .segment-wide{margin-bottom:var(--s4)}` — the 12 above it is the appbar's own.
  faces: { marginBottom: space.s4 },
});
