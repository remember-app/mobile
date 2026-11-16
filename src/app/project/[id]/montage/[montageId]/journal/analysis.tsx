import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { loadGallery, loadMontages, watchAnalysisJobs } from '@/functionality';
import type { AnalysisJob } from '@/integrations/api';
import { itemSource, montageItems } from '@/models';
import type { ProjectId } from '@/types/id';
import { AnalysisRow } from '@/ui/components/media/analysis-row';
import { viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { useAnalysisJobs, useGallery, useMontages } from '@/ui/hooks';
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
  const jobs = useAnalysisJobs(projectId);
  const running = montage && montage.status !== 'done' && montage.status !== 'failed';
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    void loadMontages(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void loadMontages(projectId, true).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [projectId, running]);

  useEffect(() => watchAnalysisJobs(projectId, Boolean(running)), [projectId, running]);

  const items = useMemo(
    () => (montage ? montageItems(montage, gallery.items) : []),
    [gallery.items, montage],
  );
  const jobByItem = useMemo(
    () => new Map(jobs.items.map((job) => [job.itemId, job] as const)),
    [jobs.items],
  );

  const statusOf = (job: AnalysisJob): string => {
    if (job.status === 'running') return t('montage.analysisRunning');
    if (job.status === 'queued') return t('montage.analysisWaiting');
    if (job.status === 'failed') return t('montage.analysisFailedState');
    return t('montage.journal.noDescription');
  };

  const viewerPhotos = items.map(viewerOf);

  return (
    <View style={styles.root}>
      <Board bar={<BackBar title={t('montage.journal.analysis')} />} body={pageBody}>
        {items.length === 0 ? (
          <Empty sign="dashed" title={t('montage.order.noItems')} />
        ) : (
          items.map((item, at) => {
            const job = jobByItem.get(item.id);
            return (
              <AnalysisRow
                key={item.id}
                source={itemSource(item)}
                group={item.projectId}
                analysis={item.analysis ?? job?.analysis ?? null}
                status={job ? statusOf(job) : t('montage.journal.noDescription')}
                error={job?.error}
                onPress={() => setViewer(at)}
              />
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
});
