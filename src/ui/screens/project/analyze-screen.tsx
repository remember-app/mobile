import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  currentToken,
  loadLabels,
  loadMembers,
  refreshGalleryAll,
  refreshSession,
} from '@/functionality';
import { analyzeItems, previewAnalysis } from '@/integrations/api';
import type { ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen, useGalleryScreen } from '@/ui/components/media/gallery-screen';
import { useMediaInfo } from '@/ui/components/media/info/media-info';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { useGalleryMedia } from '@/ui/gallery-media';
import { useGallerySelection } from '@/ui/gallery-selection';
import { useGallery, useLabels, useMembers } from '@/ui/hooks';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { BackButton, IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { Text } from '@/ui/kit/primitives/text';
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
  const mediaInfo = useMediaInfo(projectId, gallery.items);
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const selection = useGallerySelection<string>();
  const { filters, setFilters } = useGalleryFilters();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(gallery.items.length === 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(gallery.items.length === 0);
    void loadLabels(projectId).catch(() => undefined);
    void loadMembers(projectId).catch(() => undefined);
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
      filterItems(
        gallery.items.filter((item) => item.analysis === null),
        filters,
      ),
    [filters, gallery.items],
  );

  const media = useGalleryMedia(items);
  const photos = useMemo<Photo[]>(
    () => items.map((item) => ({ ...tileOf(item, media), selected: selection.has(item.id) })),
    [items, media, selection],
  );
  const viewerPhotos = useMemo(() => items.map((item) => viewerOf(item, media)), [items, media]);
  const galleryScreen = useGalleryScreen(photos, viewerPhotos, selection);

  useEffect(() => {
    if (selection.ids.size === 0) {
      setQuote(null);
      return;
    }
    const token = currentToken();
    if (!token) return;
    let live = true;
    const timer = setTimeout(() => {
      void previewAnalysis(token, projectId, selection.list as ProjectItemId[])
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
  }, [projectId, selection]);

  const toggle = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    selection.toggle(photo.id);
  };

  const ids = () => selection.list as ProjectItemId[];

  const start = async (token: string) => {
    setBusy(true);
    try {
      await analyzeItems(token, projectId, ids());
      await refreshSession().catch(() => undefined);
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
    if (selection.ids.size === 0 || busy) return;
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
        t('montage.analysisConfirmText', { count: selection.ids.size, tokens: next.tokens }),
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
    <GalleryScreen
      photos={photos}
      viewerPhotos={viewerPhotos}
      viewer={galleryScreen.viewer}
      onOpen={galleryScreen.onOpen}
      onClose={galleryScreen.onClose}
      onIndex={galleryScreen.onIndex}
      measureRef={galleryScreen.measureTile}
      onSelect={toggle}
      selection={selection}
      info={mediaInfo}
      padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
      loading={
        loading ? (
          <View style={styles.centre}>
            <CircularSpinner size={32} />
          </View>
        ) : undefined
      }
      header={
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
      }
      hud={{
        primary: {
          kind: 'single',
          label:
            selection.ids.size > 0
              ? t('montage.analyzeCount', {
                  count: selection.ids.size,
                  tokens: quote?.tokens ?? 0,
                })
              : t('montage.order.selectAll'),
          onPress: () => {
            if (selection.ids.size > 0) {
              void confirm();
              return;
            }
            selection.replace(items.map((item) => item.id));
          },
          disabled: busy,
        },
        selectionDefault: true,
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
    />
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    minHeight: 44,
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
