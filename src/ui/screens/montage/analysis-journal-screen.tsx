import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { loadGallery, loadMontages, watchAnalysisJobs } from '@/functionality';
import { itemThumb, montageItems, montageRunning } from '@/models';
import type { ProjectId } from '@/types/id';
import { AnalysisRow } from '@/ui/components/media/analysis-row';
import { analysisStatus } from '@/ui/components/media/analysis-status';
import { GalleryViewer, useGalleryViewer } from '@/ui/components/media/gallery-viewer';
import { useMediaInfo } from '@/ui/components/media/info/media-info';
import { viewerOf } from '@/ui/components/media/photo-item';
import { useGalleryMedia } from '@/ui/gallery-media';
import { useAnalysisJobs, useGallery, useMontagePolling, useMontages } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { BackBar } from '@/ui/screens/chrome';

export default function AnalysisJournalScreen() {
  const { t } = useTranslation();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const montages = useMontages(projectId);
  const gallery = useGallery(projectId);
  const mediaInfo = useMediaInfo(projectId, gallery.items);
  const montage = montages.items.find((entry) => entry.id === montageId);
  const jobs = useAnalysisJobs(projectId);
  const running = montageRunning(montage);
  const galleryViewer = useGalleryViewer();
  useMontagePolling(projectId, running);

  useEffect(() => {
    void loadMontages(projectId);
    void loadGallery(projectId);
  }, [projectId]);

  useEffect(() => watchAnalysisJobs(projectId, running), [projectId, running]);

  const items = useMemo(
    () => (montage ? montageItems(montage, gallery.items) : []),
    [gallery.items, montage],
  );
  const jobByItem = useMemo(
    () => new Map(jobs.items.map((job) => [job.itemId, job] as const)),
    [jobs.items],
  );
  const media = useGalleryMedia(items);

  const viewerPhotos = items.map((item) => viewerOf(item, media));

  return (
    <View style={styles.root}>
      <Board bar={<BackBar title={t('montage.journal.analysis')} />} body={pageBody}>
        {items.length === 0
          ? null
          : items.map((item, at) => {
              const job = jobByItem.get(item.id);
              return (
                <AnalysisRow
                  key={item.id}
                  source={itemThumb(item)}
                  group={item.projectId}
                  analysis={item.analysis ?? job?.analysis ?? null}
                  status={job ? analysisStatus(job) : t('montage.journal.noDescription')}
                  error={job?.error}
                  onPress={() => galleryViewer.open(at)}
                />
              );
            })}
      </Board>
      <GalleryViewer
        photos={viewerPhotos}
        viewer={galleryViewer.viewer}
        onClose={galleryViewer.close}
        info={mediaInfo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
