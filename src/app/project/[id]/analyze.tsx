import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentToken, refreshGalleryAll } from '@/functionality';
import { analyzeItems, previewAnalysis } from '@/integrations/api';
import type { ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import {
  type MeasureTile,
  type Photo,
  PhotoGrid,
  type Rect,
} from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useGallery } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { orderOf } from '@/ui/selection';
import { radius, space, useTheme } from '@/ui/theme';

type Quote = { queued: number; tokens: number };

export default function AnalyzeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const gallery = useGallery(projectId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(gallery.items.length === 0);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);

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

  const items = useMemo(
    () =>
      gallery.items
        .filter((item) => item.analysis === null)
        .sort(
          (left, right) =>
            (left.media.capturedAt ?? left.createdAt).getTime() -
            (right.media.capturedAt ?? right.createdAt).getTime(),
        ),
    [gallery.items],
  );

  const order = useMemo(() => orderOf(selected), [selected]);

  const photos = useMemo<Photo[]>(
    () => items.map((item) => ({ ...tileOf(item), select: order.get(item.id) ?? null })),
    [items, order],
  );
  const viewerPhotos = useMemo(() => items.map(viewerOf), [items]);

  useEffect(() => {
    if (selected.size === 0) {
      setQuote(null);
      return;
    }
    const token = currentToken();
    if (!token) return;
    let live = true;
    const timer = setTimeout(() => {
      void previewAnalysis(token, projectId, [...selected] as ProjectItemId[])
        .then((next) => {
          if (live) setQuote(next);
        })
        .catch(() => {
          if (live) setQuote(null);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [projectId, selected]);

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

  const ids = () => [...selected] as ProjectItemId[];

  const start = async (token: string) => {
    setBusy(true);
    try {
      await analyzeItems(token, projectId, ids());
      router.replace({
        pathname: '/project/[id]/analysis-jobs',
        params: { id: projectId },
      });
    } catch {
      Alert.alert(t('montage.analysisFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (selected.size === 0 || busy) return;
    const token = currentToken();
    if (!token) return;
    setBusy(true);
    try {
      const next = await previewAnalysis(token, projectId, ids());
      if (next.queued === 0) {
        Alert.alert(t('montage.analysisNothing'));
        return;
      }
      Alert.alert(
        t('montage.analysisConfirmTitle'),
        t('montage.analysisConfirmText', { count: selected.size, tokens: next.tokens }),
        [
          { text: t('action.cancel'), style: 'cancel' },
          { text: t('montage.analyze'), onPress: () => void start(token) },
        ],
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
          <Empty
            sign="dashed"
            title={
              gallery.items.length > 0 ? t('montage.analysisNothing') : t('montage.analysisEmpty')
            }
          />
        </View>
      ) : (
        <PhotoGrid
          photos={photos}
          onOpen={(index, rect) => setViewer({ index, rect })}
          onSelect={toggle}
          mark="check"
          padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
          blankIndex={viewer?.index ?? null}
          measureRef={measureTile}
        />
      )}
      <BlurBar edge="top" style={styles.top}>
        <BackButton label={t('action.back')} onPress={() => goBack(router)} />
        <View style={styles.headCentre}>
          <View
            style={[
              styles.titleBox,
              { backgroundColor: theme.color.surface, borderColor: theme.color.line },
            ]}
          >
            <Text role="barTitle" numberOfLines={1}>
              {t('montage.analysisTitle')}
            </Text>
          </View>
        </View>
        <IconButton
          icon={ListChecks}
          label={t('montage.journal.analysis')}
          tone="surface"
          size={44}
          onPress={() =>
            router.navigate({
              pathname: '/project/[id]/analysis-jobs',
              params: { id: projectId },
            })
          }
        />
      </BlurBar>
      <ActionBar>
        <Button
          label={
            selected.size > 0
              ? t('montage.analyzeCount', {
                  count: selected.size,
                  tokens: quote?.tokens ?? 0,
                })
              : t('montage.analyze')
          }
          variant="primary"
          disabled={selected.size === 0 || busy}
          onPress={() => void confirm()}
        />
      </ActionBar>
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
          onIndex={(index) =>
            measureTile.current?.(index, (rect) =>
              setViewer((was) => (was === null ? was : { index, rect })),
            )
          }
          selected={selected.has(photos[viewer.index]?.id ?? '')}
          onSelect={() => toggle(viewer.index)}
        />
      )}
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
  titleBox: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
