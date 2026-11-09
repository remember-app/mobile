import { useLocalSearchParams, useRouter } from 'expo-router';
import { TriangleExclamationPoint } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loadMontages } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { useMontages } from '@/ui/hooks';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space, themed } from '@/ui/theme';

const STAGE = {
  analysis: 'montage.stage.analysis',
  preparation: 'montage.stage.preparation',
  directing: 'montage.stage.directing',
  editing: 'montage.stage.editing',
} as const;

export default function MontageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const projectId = id as ProjectId;
  const styles = useStyles();
  const montages = useMontages(projectId);
  const montage = montages.items.find((entry) => entry.id === montageId);
  const running = montage && montage.status !== 'done' && montage.status !== 'failed';

  useEffect(() => {
    void loadMontages(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void loadMontages(projectId, true).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [projectId, running]);

  const movieId = montage?.status === 'done' ? montage.movieId : null;

  useEffect(() => {
    if (!movieId) return;
    router.replace({
      pathname: '/project/[id]/movie/[movieId]',
      params: { id: projectId, movieId },
    });
  }, [movieId, projectId, router]);

  const bar = (
    <AppBar
      boxed
      title={t('montage.waiting')}
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

  if (montage.status === 'failed') {
    return (
      <Board bar={bar}>
        <Empty
          sign="dashed"
          icon={TriangleExclamationPoint}
          title={t('montage.failed')}
          text={montage.error ?? undefined}
        />
        <View style={styles.bottom}>
          <Button label={t('action.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      </Board>
    );
  }

  return (
    <Board bar={bar} body={styles.centre}>
      <CircularSpinner size={56} stroke={3} />
      <Text role="title" style={styles.stage}>
        {t(STAGE[montage.stage])}
      </Text>
      <Text role="body" tone="muted" style={styles.hint}>
        {t('montage.waitingText')}
      </Text>
    </Board>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    centre: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s4,
      paddingHorizontal: space.s6,
    },
    stage: { textAlign: 'center' },
    hint: { textAlign: 'center' },
    bottom: { paddingHorizontal: space.s5, paddingTop: space.s4 },
  }),
);
