import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabelMark } from '@/ui/components/label';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import { type MeasureTile, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { labelUsage, photosForLabel, subscribeLabels } from '@/ui/mocks/labels';
import { mockPhotoMeta } from '@/ui/mocks/media-info';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { space, useTheme } from '@/ui/theme';

export default function LabelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { labelId } = useLocalSearchParams<{ id: string; labelId: string }>();
  const getPhotos = useCallback(() => photosForLabel(labelId), [labelId]);
  const photos = useSyncExternalStore(subscribeLabels, getPhotos);
  const labels = useSyncExternalStore(subscribeLabels, labelUsage);
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const label = labels.find((entry) => entry.id === labelId);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);

  if (!label) {
    return (
      <Board
        bar={
          <AppBar title="Лейбл" left={<BackButton label="Назад" onPress={() => router.back()} />} />
        }
      >
        <Empty sign="dashed" title="Лейбл не найден" />
      </Board>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
      <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
        {photos.length === 0 ? (
          <Empty sign="dashed" title="Нет файлов" />
        ) : (
          <PhotoGrid
            photos={photos}
            onOpen={(index, rect) => setOpen({ index, rect })}
            padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
          />
        )}
        <BlurBar edge="top" style={styles.top}>
          <View style={styles.head}>
            <LabelMark tint={label.color} size={30} />
            <Text role="barTitle" numberOfLines={1} style={styles.title}>
              {label.name}
            </Text>
          </View>
        </BlurBar>
        <View
          pointerEvents="box-none"
          style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
        >
          <Button
            label="Назад"
            variant="primary"
            icon={ChevronLeft}
            onPress={() => router.back()}
          />
        </View>
        {open === null ? null : (
          <PhotoViewer
            photos={photos}
            initialIndex={open.index}
            origin={open.rect}
            onClose={() => setOpen(null)}
            onIndex={(next) =>
              measureTile.current?.(next, (rect) =>
                setOpen((was) => (was === null ? was : { index: next, rect })),
              )
            }
            author={profile.name}
            renderInfo={(index) => {
              const photo = photos[index];
              return photo ? (
                <MediaInfo key={photo.id} photoId={photo.id} meta={mockPhotoMeta(photo, index)} />
              ) : null;
            }}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s4,
    minHeight: 52,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    flexShrink: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
  },
});
