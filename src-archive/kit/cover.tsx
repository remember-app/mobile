import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { pictureKey } from '@/lib/picture-key';
import { radius, themed, useTheme } from '@/theme';
import { DashedFrame } from './bits';
import { Mosaic } from './filmstrip';
import { Icon } from './icon';
export function CoverSlot({
  uri,
  thumbs,
  size = 68,
}: {
  uri?: string | null;
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
    bare: { padding: 0 },
  }),
);
