import { RefreshCw, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import {
  currentToken,
  loadAnalysisJobs,
  refreshSession,
  setItemAnalyses,
  watchAnalysisJobs,
} from '@/functionality';
import { analyzeItems, previewAnalysis } from '@/integrations/api';
import type { Item } from '@/models';
import type { ProjectId, ProjectItemId } from '@/types/id';
import { scoreColor } from '@/ui/format';
import { useAnalysisJobs } from '@/ui/hooks';
import { IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { space, themed, useTheme } from '@/ui/theme';

export function AnalysisBlock({ projectId, item }: { projectId: ProjectId; item: Item }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const jobs = useAnalysisJobs(projectId);
  const itemId = item.id as ProjectItemId;
  const job = jobs.items.find((entry) => entry.itemId === item.id);
  const analysis = item.analysis ?? job?.analysis ?? null;
  const live = job?.status === 'queued' || job?.status === 'running';
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchAnalysisJobs(projectId, watching), [projectId, watching]);

  useEffect(() => {
    if (watching && (job?.status === 'done' || job?.status === 'failed')) setWatching(false);
  }, [job?.status, watching]);

  const run = async (token: string) => {
    setBusy(true);
    try {
      const result = await analyzeItems(token, projectId, [itemId], true);
      await refreshSession().catch(() => undefined);
      if (result.queued === 0) {
        Alert.alert(t('photo.analysis'), t('photo.analysisBusy'));
        return;
      }
      setItemAnalyses(projectId, [{ itemId, analysis: null }]);
      await loadAnalysisJobs(projectId);
      setWatching(true);
    } catch {
      Alert.alert(t('montage.analysisFailed'));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (busy || live) return;
    const token = currentToken();
    if (!token) return;
    setBusy(true);
    try {
      const quote = await previewAnalysis(token, projectId, [itemId], true);
      if (quote.queued === 0) {
        Alert.alert(t('photo.analysis'), t('photo.analysisAlready'));
        return;
      }
      Alert.alert(t('photo.analyzeTitle'), t('photo.analyzeCost', { tokens: quote.tokens }), [
        { text: t('action.cancel'), style: 'cancel' },
        { text: t('montage.analyze'), onPress: () => void run(token) },
      ]);
    } catch {
      Alert.alert(t('montage.analysisFailed'));
    } finally {
      setBusy(false);
    }
  };

  const status =
    job?.status === 'queued'
      ? t('montage.analysisWaiting')
      : job?.status === 'running'
        ? t('montage.analysisRunning')
        : job?.status === 'failed'
          ? t('montage.analysisFailedState')
          : null;

  return (
    <Card clip flat>
      <View style={styles.row}>
        <Sparkles size={18} color={color.accent} />
        <Text role="row" style={styles.paper}>
          {t('photo.analysis')}
        </Text>
        <IconButton
          icon={RefreshCw}
          label={t('montage.analyze')}
          tone="ghost"
          size={30}
          disabled={busy || live}
          onPress={() => void start()}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.body}>
        {analysis &&
        (analysis.scoreImportance !== undefined || analysis.scoreQuality !== undefined) ? (
          <View style={styles.scores}>
            {analysis.scoreImportance !== undefined ? (
              <View style={styles.score}>
                <Text role="meta" style={styles.muted}>
                  {t('photo.importance')}
                </Text>
                <Text role="row" style={{ color: scoreColor(analysis.scoreImportance) }}>
                  {analysis.scoreImportance.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {analysis.scoreQuality !== undefined ? (
              <View style={styles.score}>
                <Text role="meta" style={styles.muted}>
                  {t('photo.quality')}
                </Text>
                <Text role="row" style={{ color: scoreColor(analysis.scoreQuality) }}>
                  {analysis.scoreQuality.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {analysis?.summary ? (
          <Text role="bodySm" style={styles.paper}>
            {analysis.summary}
          </Text>
        ) : status ? (
          <Text role="bodySm" tone={job?.status === 'failed' ? 'danger' : 'muted'}>
            {status}
          </Text>
        ) : (
          <Text role="bodySm" tone="muted">
            {t('photo.analysisEmpty')}
          </Text>
        )}
        {!analysis && job?.error ? (
          <Text role="hint" tone="danger">
            {job.error}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
    },
    scores: {
      flexDirection: 'row',
      gap: space.s4,
    },
    score: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    body: {
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
      gap: space.s2,
    },
    paper: {
      color: color.paper,
    },
    muted: {
      color: color.muted,
    },
  }),
);
