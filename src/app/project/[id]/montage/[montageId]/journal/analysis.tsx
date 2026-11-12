import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { loadGallery, loadMontages } from '@/functionality';
import { itemSource, montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { AnalysisRow } from '@/ui/components/media/analysis-row';
import { viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useGallery, useMontages } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/bars';
import { Empty } from '@/ui/kit/empty';
import { BackBar } from '@/ui/screens/chrome';

export default function AnalysisJournalScreen() {
  const { t } = useTranslation();
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

  const items = useMemo(
    () => (montage ? montageItems(montage, gallery.items) : []),
    [gallery.items, montage],
  );

  const viewerPhotos = items.map(viewerOf);

  return (
    <View style={styles.root}>
      <Board bar={<BackBar boxed title={t('montage.journal.analysis')} />} body={pageBody}>
        {items.length === 0 ? (
          <Empty sign="dashed" title={t('montage.order.noItems')} />
        ) : (
          items.map((item, at) => (
            <AnalysisRow
              key={item.id}
              source={itemSource(item)}
              analysis={item.analysis}
              status={t('montage.journal.noDescription')}
              onPress={() => setViewer(at)}
            />
          ))
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
});
