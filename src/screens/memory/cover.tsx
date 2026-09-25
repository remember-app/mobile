import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { MediaItem } from '@/api';
import { Button, GRID_GAP, Sheet, Tile } from '@/kit';
import { frameOf, mayPick, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';

/**
 * `SheetCover` (spec 10.8.3) — the wizard's own grid of frames inside a sheet, with exactly one of
 * them picked: a tap on another moves the pick rather than adding to it. Newest first, the way the
 * feed reads, and with no day gaps and no filters at all — here a picture is being chosen, not a day
 * looked for.
 *
 * A frame still developing carries no circle and cannot be taken: there is nothing to put on a card
 * yet, and the api refuses one anyway.
 */
export function CoverSheet({
  visible,
  onCancel,
  media,
  chosen,
  onChoose,
}: {
  visible: boolean;
  onCancel: () => void;
  media: readonly MediaItem[];
  /** What the screen is holding as the cover right now — where the pick starts from. */
  chosen: string | null;
  onChoose: (mediaId: string) => void;
}) {
  const s = useStrings();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState(chosen);

  // Each open starts from what the screen holds: the sheet is not a place edits accumulate, and a
  // pick abandoned by closing must not be the one the next open shows.
  useEffect(() => {
    if (visible) setPicked(chosen);
  }, [visible, chosen]);

  // Spec 10.8.3 — the wizard's grid: three columns, 3 between them, inside the sheet's own 16. The
  // sheet never grows past 420, so the column is worked out of whichever is narrower.
  const cell = { width: (Math.min(width, 420) - space.s4 * 2 - GRID_GAP * 2) / 3 };
  const newestFirst = [...media].sort((a, b) => shotAt(b) - shotAt(a));

  return (
    <Sheet
      visible={visible}
      onCancel={onCancel}
      title={s.edit.cover}
      footer={
        <Button
          variant="primary"
          label={s.edit.coverDo}
          disabled={picked === null}
          onPress={() => (picked === null ? undefined : onChoose(picked))}
        />
      }
    >
      <View style={styles.grid}>
        {newestFirst.map((item) => {
          const frame = frameOf(item);
          const takeable = mayPick(item);
          return (
            <View key={item.id} style={cell}>
              <Tile
                state={frame.state}
                uri={frame.uri ?? undefined}
                caption={frame.state === 'ready' ? undefined : s.gallery.waiting[frame.state]}
                // One pick and only one, so this is a radio and not a row of checkboxes: the circle
                // is the send queue's own (spec 7.4) and the ring goes with it.
                pick={takeable ? (picked === item.id ? 'send' : 'off') : undefined}
                ring
                label={s.media[item.kind]}
                onPress={takeable ? () => setPicked(item.id) : undefined}
              />
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});
