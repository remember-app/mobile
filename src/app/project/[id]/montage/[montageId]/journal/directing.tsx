import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadMontages } from '@/functionality';
import { montageItemIds } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { duration } from '@/ui/format';
import { useGallery, useMontages } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

export default function DirectingJournalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const montages = useMontages(projectId);
  const gallery = useGallery(projectId);
  const montage = montages.items.find((entry) => entry.id === montageId);
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);

  useEffect(() => {
    void loadMontages(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  const items = useMemo(() => {
    const ids = montage ? montageItemIds(montage) : [];
    return ids.flatMap((itemId) => gallery.items.filter((item) => item.id === itemId).slice(0, 1));
  }, [gallery.items, montage]);

  const used = new Set(montage?.journal.directing?.usedItemIds ?? []);
  const text = montage?.journal.directing?.text ?? '';

  const photos = useMemo<Photo[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
        video: item.kind === 'video',
        playbackUrl: item.kind === 'video' ? (item.links.preview ?? item.links.original) : null,
        note:
          item.kind === 'video' && item.media.duration !== null
            ? duration(item.media.duration)
            : undefined,
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
        accent: used.has(item.id),
      })),
    [items, used],
  );

  const viewerPhotos = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
        video: item.kind === 'video',
        playbackUrl: item.kind === 'video' ? (item.links.preview ?? item.links.original) : null,
        note:
          item.kind === 'video' && item.media.duration !== null
            ? duration(item.media.duration)
            : undefined,
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
      })),
    [items],
  );

  const bar = (
    <AppBar
      boxed
      title={t('montage.journal.directing')}
      left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
    />
  );

  if (items.length === 0) {
    return (
      <Board bar={bar}>
        <Empty sign="dashed" title={t('montage.order.noItems')} />
      </Board>
    );
  }

  return (
    <View style={styles.root}>
      <PhotoGrid
        photos={photos}
        onOpen={(index, rect) => setViewer({ index, rect })}
        padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
        blankIndex={viewer?.index ?? null}
      />
      <BlurBar edge="top" style={styles.head}>
        {bar}
      </BlurBar>
      <ActionBar>
        <Button
          label={t('montage.journal.directingText')}
          variant="primary"
          disabled={text.length === 0}
          onPress={() => setOpen(true)}
        />
      </ActionBar>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('montage.journal.directing')}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
          <View style={{ paddingHorizontal: space.s4 }}>
            <Text role="body">{text}</Text>
          </View>
        </ScrollView>
      </BottomSheet>
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  head: {
    paddingHorizontal: 0,
  },
});
