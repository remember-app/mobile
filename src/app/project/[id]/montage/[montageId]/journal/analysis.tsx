import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { loadGallery, loadMontages } from '@/functionality';
import { montageItemIds } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { scoreColor } from '@/ui/format';
import { useGallery, useMontages } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { BackButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { radius, space } from '@/ui/theme';

export default function AnalysisJournalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const montages = useMontages(projectId);
  const gallery = useGallery(projectId);
  const montage = montages.items.find((entry) => entry.id === montageId);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    void loadMontages(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  const items = useMemo(() => {
    const ids = montage ? montageItemIds(montage) : [];
    return ids.flatMap((itemId) => gallery.items.filter((item) => item.id === itemId).slice(0, 1));
  }, [gallery.items, montage]);

  const viewerPhotos = items.map((item) => ({
    id: item.id,
    source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
    video: item.kind === 'video',
    playbackUrl: item.kind === 'video' ? (item.links.preview ?? item.links.original) : null,
    width: item.media.dimensions?.width,
    height: item.media.dimensions?.height,
    capturedAt: item.media.capturedAt,
  }));

  return (
    <View style={styles.root}>
      <Board
        bar={
          <AppBar
            boxed
            title={t('montage.journal.analysis')}
            left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
          />
        }
        body={pageBody}
      >
        {items.length === 0 ? (
          <Empty sign="dashed" title={t('montage.order.noItems')} />
        ) : (
          items.map((item, at) => {
            const analysis = item.analysis;
            const source = item.links.thumbnail ?? item.links.preview ?? item.links.original;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setViewer(at)}
                style={styles.row}
              >
                <View style={styles.file}>
                  {source ? (
                    <Image
                      source={source}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={styles.thumb} />
                  )}
                  {analysis ? (
                    <Text role="noteSm" style={{ color: scoreColor(analysis.score) }}>
                      {analysis.score.toFixed(2)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.words}>
                  {analysis ? (
                    <Text role="body">{analysis.description}</Text>
                  ) : (
                    <Text role="body" tone="muted">
                      {t('montage.journal.noDescription')}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </Board>
      {viewer === null ? null : (
        <PhotoViewer photos={viewerPhotos} initialIndex={viewer} onClose={() => setViewer(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s2,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.tile,
  },
  file: {
    alignItems: 'center',
    gap: 2,
  },
  words: {
    flex: 1,
    minWidth: 0,
  },
});
