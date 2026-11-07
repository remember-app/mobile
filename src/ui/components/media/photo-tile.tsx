import { Image, type ImageSource } from 'expo-image';
import { AlertCircle, Play } from 'lucide-react-native';
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
  video?: boolean;
  upload?: TileUpload;
  select?: number | null;
  note?: string;
  onPress: () => void;
  onSelect?: () => void;
};

export function PhotoTile({ id, source, video, upload, select, note, onPress, onSelect }: Props) {
  const theme = useTheme();
  const chosen = typeof select === 'number';
  return (
    <Pressable onPress={onPress} style={styles.tile}>
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
        <View style={[styles.fill, styles.placeholder, { backgroundColor: theme.color.raise }]}>
          {video ? <Play size={24} color={theme.color.muted} fill={theme.color.muted} /> : null}
        </View>
      )}
      {(video && source) || note ? (
        <View style={styles.note} pointerEvents="none">
          {video ? <Play size={9} color={theme.color.onFill} fill={theme.color.onFill} /> : null}
          {note ? (
            <Text role="metaSm" tone="onFill">
              {note}
            </Text>
          ) : null}
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
              <AlertCircle size={24} color={theme.color.danger} />
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
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
