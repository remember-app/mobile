import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadLabels, loadMembers } from '@/functionality';
import type { LabelId, ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { LabelMark } from '@/ui/components/common/label';
import { LoadError } from '@/ui/components/feedback/load-error';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen, useGalleryScreen } from '@/ui/components/media/gallery-screen';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { useGallerySelection } from '@/ui/gallery-selection';
import { useAccount, useAvatar, useGallery, useLabels, useMembers } from '@/ui/hooks';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { HeaderTitle } from '@/ui/kit/chrome/header-title';
import { BackButton } from '@/ui/kit/controls/button';
import { Missing } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function LabelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, labelId } = useLocalSearchParams<{ id: string; labelId: string }>();
  const projectId = id as ProjectId;
  const labelKey = labelId as LabelId;
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const gallery = useGallery(projectId);
  const avatar = useAvatar();
  const account = useAccount();
  const label = labels.labels.find((entry) => entry.id === labelKey);
  const selection = useGallerySelection<string>();
  const { filters, setFilters } = useGalleryFilters({ labelIds: [labelKey] });

  useEffect(() => {
    void loadLabels(projectId);
    void loadGallery(projectId);
    void loadMembers(projectId).catch(() => undefined);
  }, [projectId]);

  const filtered = useMemo(() => filterItems(gallery.items, filters), [gallery.items, filters]);
  const photos = useMemo<Photo[]>(
    () => filtered.map((item) => ({ ...tileOf(item), selected: selection.has(item.id) })),
    [filtered, selection],
  );
  const viewerPhotos = useMemo(() => filtered.map(viewerOf), [filtered]);
  const galleryScreen = useGalleryScreen(photos, viewerPhotos, selection);
  const labelShown = filters.labelIds.includes(labelKey);

  if (!label) {
    return <Missing title={t('labels.title')} message={t('labels.notFound')} />;
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: galleryScreen.viewer === null }} />
      <GalleryScreen
        photos={photos}
        viewerPhotos={viewerPhotos}
        viewer={galleryScreen.viewer}
        onOpen={galleryScreen.onOpen}
        onClose={galleryScreen.close}
        onIndex={galleryScreen.onIndex}
        measureRef={galleryScreen.measureTile}
        selection={selection}
        hud={{
          primary: {
            kind: 'single',
            label: labelShown ? t('labels.showAll') : t('labels.showLabel'),
            onPress: () =>
              setFilters((was) => ({
                ...was,
                labelIds: labelShown ? [] : [labelKey],
              })),
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
          gallery.status === 'error' ? (
            <LoadError onRetry={() => void loadGallery(projectId, true)} />
          ) : null
        }
        author={account?.name ?? undefined}
        authorAvatarUrl={avatar.url}
        info={(index) => {
          const photo = photos[index];
          if (!photo) return null;
          const item = gallery.items.find((entry) => entry.id === photo.id);
          return item ? <MediaInfo key={item.id} projectId={projectId} item={item} /> : null;
        }}
        header={
          <BlurBar edge="top" style={styles.top}>
            <View style={styles.side}>
              <BackButton label={t('action.back')} onPress={() => goBack(router)} />
            </View>
            <View style={styles.headCentre}>
              <HeaderTitle
                title={label.name}
                icon={<LabelMark tint={label.color} size={30} />}
                minWidth={0}
                surface
              />
            </View>
            <View style={styles.side} />
          </BlurBar>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s4,
    minHeight: 52,
  },
  side: {
    width: 44,
  },
  headCentre: {
    flex: 1,
    alignItems: 'center',
  },
});
