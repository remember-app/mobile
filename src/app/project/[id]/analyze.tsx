import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentToken, refreshGalleryAll } from '@/functionality';
import { analyzeItems } from '@/integrations/api';
import type { ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import { type Photo, PhotoGrid } from '@/ui/components/media/photo-grid';
import { duration } from '@/ui/format';
import { useGallery } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

export default function AnalyzeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const gallery = useGallery(projectId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(gallery.items.length === 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(gallery.items.length === 0);
    void refreshGalleryAll(projectId)
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [projectId]);

  const order = useMemo(() => {
    const map = new Map<string, number>();
    [...selected].forEach((itemId, index) => {
      map.set(itemId, index + 1);
    });
    return map;
  }, [selected]);

  const photos = useMemo<Photo[]>(
    () =>
      gallery.items.map((item) => ({
        id: item.id,
        source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
        video: item.kind === 'video',
        note:
          item.kind === 'video' && item.media.duration !== null
            ? duration(item.media.duration)
            : undefined,
        select: order.get(item.id) ?? null,
      })),
    [gallery.items, order],
  );

  const toggle = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    setSelected((was) => {
      const next = new Set(was);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };

  const run = async () => {
    if (selected.size === 0 || busy) return;
    const token = currentToken();
    if (!token) return;
    setBusy(true);
    try {
      const result = await analyzeItems(token, projectId, [...selected] as ProjectItemId[]);
      Alert.alert(
        t('montage.analysisStarted'),
        t('montage.analysisQueued', { count: result.queued }),
        [{ text: t('action.close'), onPress: () => goBack(router) }],
      );
    } catch {
      Alert.alert(t('montage.analysisFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
      {loading ? (
        <View style={styles.centre}>
          <CircularSpinner size={32} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.centre}>
          <Empty sign="dashed" title={t('montage.analysisEmpty')} />
        </View>
      ) : (
        <PhotoGrid
          photos={photos}
          onOpen={() => undefined}
          onSelect={toggle}
          tapSelects
          mark="check"
          padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
        />
      )}
      <BlurBar edge="top" style={styles.top}>
        <BackButton label={t('action.back')} onPress={() => goBack(router)} />
        <View style={styles.headCentre}>
          <Text role="barTitle" numberOfLines={1}>
            {t('montage.analysisTitle')}
          </Text>
        </View>
        <View style={styles.side} />
      </BlurBar>
      <ActionBar>
        <Button
          label={
            selected.size > 0
              ? t('montage.analyzeCount', { count: selected.size })
              : t('montage.analyze')
          }
          variant="primary"
          disabled={selected.size === 0 || busy}
          onPress={() => void run()}
        />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s3,
    minHeight: 52,
  },
  headCentre: {
    flex: 1,
    alignItems: 'center',
  },
  side: {
    width: 44,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
