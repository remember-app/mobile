import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { currentToken, loadGallery } from '@/functionality';
import { type AnalysisJob, listAnalysisJobs } from '@/integrations/api';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { scoreColor } from '@/ui/format';
import { useGallery } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { BackButton } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { radius, space } from '@/ui/theme';

export default function AnalysisJobsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
      <Board
        bar={
          <AppBar
            boxed
            title={t('montage.analysisTitle')}
            left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
          />
        }
        body={pageBody}
      >
        {loading ? (
          <View style={styles.centre}>
            <CircularSpinner size={32} />
          </View>
        ) : jobs.length === 0 ? (
          <Empty sign="dashed" title={t('montage.analysisNone')} />
        ) : (
          jobs.map((job) => {
            const item = gallery.items.find((entry) => entry.id === job.itemId);
            const source = item?.links.thumbnail ?? item?.links.preview ?? item?.links.original;
            const analysis = job.analysis;
            return (
              <View key={job.itemId} style={styles.row}>
                <View style={styles.file}>
                  {source ? (
                    <Image
                      source={source}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.emptyThumb]} />
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
                      {statusOf(job)}
                    </Text>
                  )}
                  {!analysis && job.error ? (
                    <Text role="hint" tone="danger">
                      {job.error}
                    </Text>
                  ) : null}
                </View>
              </View>
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
  emptyThumb: {
    backgroundColor: 'rgba(128,128,128,0.18)',
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
