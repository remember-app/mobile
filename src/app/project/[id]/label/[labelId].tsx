import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadGallery, loadLabels } from '@/functionality';
import type { LabelId, ProjectId } from '@/types/id';
import { LabelMark } from '@/ui/components/label';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import {
  type MeasureTile,
  type Photo,
  PhotoGrid,
  type Rect,
} from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useGallery, useLabels, useSession } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

export default function LabelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id, labelId } = useLocalSearchParams<{ id: string; labelId: string }>();
  const projectId = id as ProjectId;
  const labelKey = labelId as LabelId;
  const labels = useLabels(projectId);
  const gallery = useGallery(projectId);
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const label = labels.labels.find((entry) => entry.id === labelKey);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);

  useEffect(() => {
    void loadLabels(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  const photos = useMemo<Photo[]>(
    () =>
      gallery.items
        .filter((item) => item.labelIds.includes(labelKey))
        .map((item) => ({
          id: item.id,
          source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
          video: item.kind === 'video',
          width: item.media.dimensions?.width,
          height: item.media.dimensions?.height,
          capturedAt: item.media.capturedAt,
        })),
    [gallery.items, labelKey],
  );

  if (!label) {
    return (
      <Board
        bar={
          <AppBar
            boxed
            title={t('labels.title')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title={t('labels.notFound')} />
      </Board>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
      <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
        {photos.length === 0 ? (
          <Empty sign="dashed" title={t('labels.empty')} />
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
        <ActionBar>
          <Button
            label={t('action.back')}
            variant="primary"
            icon={ChevronLeft}
            onPress={() => router.back()}
          />
        </ActionBar>
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
            author={account?.name ?? undefined}
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
});
