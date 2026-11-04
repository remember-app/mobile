import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { MediaItem } from '@/api';
import { Button, GRID_GAP, Sheet, Tile } from '@/kit';
import { frameOf, mayPick, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';
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
  chosen: string | null;
  onChoose: (mediaId: string) => void;
}) {
  const s = useStrings();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState(chosen);
  useEffect(() => {
    if (visible) setPicked(chosen);
  }, [visible, chosen]);
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
                cacheKey={frame.key}
                caption={frame.state === 'ready' ? undefined : s.gallery.waiting[frame.state]}
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
