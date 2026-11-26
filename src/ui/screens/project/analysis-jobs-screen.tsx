import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loadAnalysisJobs, loadGallery, watchAnalysisJobs } from '@/functionality';
import { itemThumb } from '@/models';
import type { ProjectId } from '@/types/id';
import { LoadError } from '@/ui/components/feedback/load-error';
import { AnalysisRow } from '@/ui/components/media/analysis-row';
import { analysisStatus } from '@/ui/components/media/analysis-status';
import { useAnalysisJobs, useGallery } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { BackBar } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function AnalysisJobsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const gallery = useGallery(projectId);
  const state = useAnalysisJobs(projectId);
  const jobs = state.items;
  const loading = state.status === 'idle' || state.status === 'loading';

  useEffect(() => {
    void loadGallery(projectId);
    return watchAnalysisJobs(projectId);
  }, [projectId]);

  return (
    <View style={styles.root}>
      <Board bar={<BackBar title={t('montage.analysisTitle')} />} body={pageBody}>
        {loading ? (
          <View style={styles.centre}>
            <CircularSpinner size={32} />
          </View>
        ) : state.status === 'error' ? (
          <LoadError onRetry={() => void loadAnalysisJobs(projectId)} />
        ) : jobs.length === 0 ? null : (
          jobs.map((job) => {
            const item = gallery.items.find((entry) => entry.id === job.itemId);
            return (
              <AnalysisRow
                key={job.itemId}
                source={item ? itemThumb(item) : null}
                group={item?.projectId}
                analysis={job.analysis}
                status={analysisStatus(job)}
                error={job.error}
              />
            );
          })
        )}
      </Board>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centre: {
    alignItems: 'center',
    paddingVertical: space.s7,
  },
});
