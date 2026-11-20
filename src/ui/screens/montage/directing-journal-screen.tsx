import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadLabels, loadMembers, loadMontages } from '@/functionality';
import { montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen, useGalleryScreen } from '@/ui/components/media/gallery-screen';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { useGallerySelection } from '@/ui/gallery-selection';
import { useGallery, useLabels, useMembers, useMontages } from '@/ui/hooks';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { BottomSheet } from '@/ui/kit/chrome/bottom-sheet';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar, Missing } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function DirectingJournalScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const montages = useMontages(projectId);
  const gallery = useGallery(projectId);
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const selection = useGallerySelection<string>();
  const { filters, setFilters } = useGalleryFilters();
  const montage = montages.items.find((entry) => entry.id === montageId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadMontages(projectId);
    void loadGallery(projectId);
    void loadLabels(projectId).catch(() => undefined);
    void loadMembers(projectId).catch(() => undefined);
  }, [projectId]);

  const items = useMemo(
    () => (montage ? filterItems(montageItems(montage, gallery.items), filters) : []),
    [filters, gallery.items, montage],
  );

  const used = new Set(montage?.journal.directing?.usedItemIds ?? []);
  const text = montage?.journal.directing?.text ?? '';

  const photos = useMemo<Photo[]>(
    () =>
      items.map((item) => ({
        ...tileOf(item),
        accent: used.has(item.id),
        selected: selection.has(item.id),
      })),
    [items, selection, used],
  );

  const viewerPhotos = useMemo(() => items.map(viewerOf), [items]);
  const galleryScreen = useGalleryScreen(photos, viewerPhotos, selection);

  const bar = <BackBar title={t('montage.journal.directing')} />;

  if (items.length === 0) {
    return <Missing title={t('montage.journal.directing')} message={t('montage.order.noItems')} />;
  }

  return (
    <>
      <GalleryScreen
        photos={photos}
        viewerPhotos={viewerPhotos}
        viewer={galleryScreen.viewer}
        onOpen={galleryScreen.onOpen}
        onClose={galleryScreen.onClose}
        onIndex={galleryScreen.onIndex}
        measureRef={galleryScreen.measureTile}
        selection={selection}
        hud={{
          primary: {
            kind: 'single',
            label: t('montage.journal.directingText'),
            disabled: text.length === 0,
            onPress: () => setOpen(true),
          },
          canSelect: true,
          onSelectingChange: (next) => {
            if (!next) selection.clear();
          },
          filters,
          onFiltersChange: setFilters,
          labels: labels.labels,
          members: members.members,
          bottom: insets.bottom + space.s3,
        }}
        padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
        empty={
          <Missing title={t('montage.journal.directing')} message={t('montage.order.noItems')} />
        }
        header={
          <BlurBar edge="top" style={styles.head}>
            {bar}
          </BlurBar>
        }
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
          <View style={{ paddingHorizontal: space.s4 }}>
            <Text role="body">{text}</Text>
          </View>
        </ScrollView>
      </BottomSheet>
    </>
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
