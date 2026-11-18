import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGallery, loadLabels } from '@/functionality';
import type { LabelId, ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { LabelMark } from '@/ui/components/common/label';
import { LoadError } from '@/ui/components/feedback/load-error';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import { type Photo, PhotoGrid } from '@/ui/components/media/photo-grid';
import { tileOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { usePhotoViewer } from '@/ui/components/media/use-photo-viewer';
import { useAccount, useAvatar, useGallery, useLabels } from '@/ui/hooks';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { BackButton } from '@/ui/kit/controls/button';
import { Text } from '@/ui/kit/primitives/text';
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
  const gallery = useGallery(projectId);
  const avatar = useAvatar();
  const account = useAccount();
  const label = labels.labels.find((entry) => entry.id === labelKey);
  const { viewer: open, setViewer: setOpen, measureTile, onIndex } = usePhotoViewer();

  useEffect(() => {
    void loadLabels(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  const photos = useMemo<Photo[]>(
    () => gallery.items.filter((item) => item.labelIds.includes(labelKey)).map(tileOf),
    [gallery.items, labelKey],
  );

  if (!label) {
    return <Missing title={t('labels.title')} message={t('labels.notFound')} />;
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
      <View style={styles.root}>
        {photos.length === 0 ? (
          gallery.status === 'error' ? (
            <LoadError onRetry={() => void loadGallery(projectId, true)} />
          ) : null
        ) : (
          <PhotoGrid
            photos={photos}
            onOpen={(index, rect) => setOpen({ index, rect })}
            padding={{ top: insets.top + 60, bottom: insets.bottom + space.s4 }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
          />
        )}
        <BlurBar edge="top" style={styles.top}>
          <View style={styles.side}>
            <BackButton label={t('action.back')} onPress={() => goBack(router)} />
          </View>
          <View style={styles.head}>
            <LabelMark tint={label.color} size={30} />
            <Text role="barTitle" numberOfLines={1} style={styles.title}>
              {label.name}
            </Text>
          </View>
          <View style={styles.side} />
        </BlurBar>
        {open === null ? null : (
          <PhotoViewer
            photos={photos}
            initialIndex={open.index}
            origin={open.rect}
            onClose={() => setOpen(null)}
            onIndex={onIndex}
            author={account?.name ?? undefined}
            authorAvatarUrl={avatar.url}
            renderInfo={(index) => {
              const photo = photos[index];
              if (!photo) return null;
              const item = gallery.items.find((entry) => entry.id === photo.id);
              return item ? <MediaInfo key={item.id} projectId={projectId} item={item} /> : null;
            }}
          />
        )}
      </View>
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
  head: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    flexShrink: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
  },
});
