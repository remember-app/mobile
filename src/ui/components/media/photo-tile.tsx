import { Image, type ImageSource } from 'expo-image';
import { CircleX } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { CircularProgress } from '@/ui/kit/circular-progress';
import { Text } from '@/ui/kit/text';
import { radius, useTheme } from '@/ui/theme';

export type TileUpload = {
  progress: number;
  failed: boolean;
};

type Props = {
  id: string;
  source: ImageSource | string | null;
  upload?: TileUpload;
  select?: number | null;
  accent?: boolean;
  note?: string;
  onPress: () => void;
  onSelect?: () => void;
};

export function PhotoTile({ id, source, upload, select, accent, note, onPress, onSelect }: Props) {
  const theme = useTheme();
  const chosen = typeof select === 'number';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, accent ? { borderWidth: 2, borderColor: theme.color.accent } : null]}
    >
      {source ? (
        <Image
          source={source}
          style={[styles.fill, upload?.failed || chosen ? styles.dim : null]}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={id}
        />
      ) : (
        <View style={[styles.fill, styles.placeholder, { backgroundColor: theme.color.raise }]} />
      )}
      {note ? (
        <View style={styles.note} pointerEvents="none">
          <Text role="metaSm" tone="onFill">
            {note}
          </Text>
        </View>
      ) : null}
      {select !== undefined ? (
        <Pressable
          onPress={onSelect}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: chosen }}
          style={[
            styles.check,
            chosen
              ? { backgroundColor: theme.color.accent, borderColor: theme.color.accent }
              : styles.checkOff,
          ]}
        >
          {chosen ? (
            <Text role="chipXs" tone="onFill">
              {select}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
      {upload ? (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.badge}>
            {upload.failed ? (
              <CircleX size={24} color={theme.color.danger} />
            ) : (
              <CircularProgress
                value={upload.progress}
                size={30}
                stroke={3}
                color={theme.color.onFill}
                track="rgba(255,255,255,0.28)"
              />
            )}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.tile,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  dim: {
    opacity: 0.55,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    borderColor: 'rgba(255,255,255,0.8)',
  },
  note: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    alignItems: 'center',
  },
});
