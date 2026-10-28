import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { pictureKey } from '@/lib/picture-key';
import { radius, themed, useTheme } from '@/theme';

import { DashedFrame } from './bits';
import { Mosaic } from './filmstrip';
import { Icon } from './icon';

/**
 * The cover of a memory as a square (spec 6): the chosen frame, else the first mosaic of four of the
 * memory's own frames, else the dashed frame. One chain, and the two memory cards in the list keep
 * the same one. 68 on the card of `MemorySettings` and `MemoryEdit`, 64 as the thing
 * `SheetConfirmMemory` asks about — the same 14 corner at both.
 *
 * A picture and never a button: the layout puts «Выбрать» / «Заменить» beside it, and a card with a
 * button nested inside another button is a card nobody can press cleanly.
 */
export function CoverSlot({
  uri,
  thumbs,
  size = 68,
}: {
  uri?: string | null;
  /** The tail of real frames the listing signed — what the mosaic is built out of. */
  thumbs?: readonly string[];
  size?: 64 | 68;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const shots = thumbs ?? [];
  const square = { width: size, height: size };

  if (uri) {
    return (
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={{ uri, cacheKey: pictureKey(uri) }}
        contentFit="cover"
        style={[styles.slot, square]}
      />
    );
  }

  return shots.length > 0 ? (
    <View style={[styles.slot, square]}>
      <Mosaic photos={shots} layout="strip" />
    </View>
  ) : (
    <DashedFrame style={[styles.slot, styles.bare, square]}>
      <Icon icon={ImageIcon} size={20} color={color.faint} />
    </DashedFrame>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    slot: { borderRadius: radius.strip, overflow: 'hidden', backgroundColor: color.surface },
    // The dashed frame brings its own padding, which a square this small has no room for.
    bare: { padding: 0 },
  }),
);
