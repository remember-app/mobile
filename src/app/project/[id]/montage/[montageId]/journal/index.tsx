import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, TriangleExclamationPoint } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loadGallery, loadMontages, loadProjects } from '@/functionality';
import { type MontageStage, montageItemIds, montageStage } from '@/models';
import type { ProjectId } from '@/types/id';
import { useGallery, useMontages, useProjectCard } from '@/ui/hooks';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

const ORDER: MontageStage[] = ['analysis', 'preparation', 'directing', 'editing'];
const STAGE = {
  analysis: 'montage.journal.analysis',
  preparation: 'montage.journal.preparation',
  directing: 'montage.journal.directing',
  editing: 'montage.journal.editing',
} as const;

type State = 'done' | 'active' | 'pending' | 'failed';

export default function JournalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const montages = useMontages(projectId);
  const gallery = useGallery(projectId);
  const montage = montages.items.find((entry) => entry.id === montageId);
  const running = montage && montage.status !== 'done' && montage.status !== 'failed';

  useEffect(() => {
    void loadProjects();
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

  const bar = (
    <AppBar
      boxed
      title={
        montage?.manifest.preparationConfig?.name?.trim() ||
        project?.title ||
        t('montage.journal.title')
      }
      left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
    />
  );

  if (!montage) {
    return (
      <Board bar={bar}>
        {montages.status === 'ready' ? <Empty sign="dashed" title={t('montage.notFound')} /> : null}
      </Board>
    );
  }

  const current = ORDER.indexOf(montageStage(montage));
  const stateOf = (stage: MontageStage): State => {
    const at = ORDER.indexOf(stage);
    if (montage.status === 'done') return 'done';
    if (at < current) return 'done';
    if (at > current) return 'pending';
    return montage.status === 'failed' ? 'failed' : 'active';
  };

  const ids = montageItemIds(montage);
  const items = ids.flatMap((itemId) =>
    gallery.items.filter((item) => item.id === itemId).slice(0, 1),
  );
  const directing = montage.journal.directing;

  const openAnalysis = () =>
    router.navigate({
      pathname: '/project/[id]/montage/[montageId]/journal/analysis',
      params: { id: projectId, montageId: montage.id },
    });
  const openDirecting = () =>
    router.navigate({
      pathname: '/project/[id]/montage/[montageId]/journal/directing',
      params: { id: projectId, montageId: montage.id },
    });

  return (
    <Board bar={bar} body={styles.body}>
      {ORDER.map((stage) => {
        const state = stateOf(stage);
        const clickable =
          (stage === 'analysis' && items.length > 0) ||
          (stage === 'directing' && Boolean(directing?.text));
        return (
          <Card
            key={stage}
            onPress={clickable ? (stage === 'analysis' ? openAnalysis : openDirecting) : undefined}
            label={t(STAGE[stage])}
            flat={!clickable}
            style={[styles.card, { backgroundColor: clickable ? color.surface : color.raise }]}
          >
            <Text role="row" accessibilityRole="header" style={styles.title} numberOfLines={2}>
              {t(STAGE[stage])}
            </Text>
            <View style={styles.middle}>
              {state === 'done' ? (
                <Check size={44} color={color.accent} strokeWidth={2.4} />
              ) : state === 'failed' ? (
                <TriangleExclamationPoint size={44} color={color.danger} strokeWidth={2.4} />
              ) : state === 'active' ? (
                <CircularSpinner size={44} stroke={3} />
              ) : (
                <Clock size={44} color={color.faint} strokeWidth={2.2} />
              )}
            </View>
          </Card>
        );
      })}
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
    paddingBottom: space.s4,
    gap: space.s3,
  },
  card: {
    flex: 1,
    padding: space.s4,
    alignItems: 'stretch',
  },
  title: {
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
