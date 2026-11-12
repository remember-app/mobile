import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { currentToken, loadGallery } from '@/functionality';
import { type AnalysisJob, listAnalysisJobs } from '@/integrations/api';
import { itemSource } from '@/models';
import type { ProjectId } from '@/types/id';
import { AnalysisRow } from '@/ui/components/media/analysis-row';
import { useGallery } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/bars';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { BackBar } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function AnalysisJobsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const gallery = useGallery(projectId);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = currentToken();
    if (!token) return;
    const answer = await listAnalysisJobs(token, projectId);
    setJobs(answer.items);
  }, [projectId]);

  useEffect(() => {
    void loadGallery(projectId);
    void load()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [load, projectId]);

  const live = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      void load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [live, load]);

  const statusOf = (job: AnalysisJob): string => {
    if (job.status === 'running') return t('montage.analysisRunning');
    if (job.status === 'queued') return t('montage.analysisWaiting');
    if (job.status === 'failed') return t('montage.analysisFailedState');
    return t('montage.journal.noDescription');
  };

  return (
    <View style={styles.root}>
      <Board bar={<BackBar boxed title={t('montage.analysisTitle')} />} body={pageBody}>
        {loading ? (
          <View style={styles.centre}>
            <CircularSpinner size={32} />
          </View>
        ) : jobs.length === 0 ? (
          <Empty sign="dashed" title={t('montage.analysisNone')} />
        ) : (
          jobs.map((job) => {
            const item = gallery.items.find((entry) => entry.id === job.itemId);
            return (
              <AnalysisRow
                key={job.itemId}
                source={item ? itemSource(item) : null}
                analysis={job.analysis}
                status={statusOf(job)}
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
