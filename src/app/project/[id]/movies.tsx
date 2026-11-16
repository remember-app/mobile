import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clapperboard, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMontages, loadMovies, loadProjects } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { MontageCard, openMontage } from '@/ui/components/montage-card';
import { useMontages, useMovies, useProjectCard } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { Board, pageBody } from '@/ui/kit/bars';
import { Button, IconButton } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
import { BackBar } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function MoviesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const montages = useMontages(projectId);
  const movies = useMovies(projectId);
  const admin = project?.myRole === 'admin';
  const canCreate = admin || project?.myRole === 'contributor';

  useEffect(() => {
    void loadProjects();
    void loadMontages(projectId, true).catch(() => undefined);
    void loadMovies(projectId, true).catch(() => undefined);
  }, [projectId]);

  const create = () =>
    router.navigate({ pathname: '/project/[id]/new-montage', params: { id: projectId } });
  const loading = montages.status === 'loading' && montages.items.length === 0;

  return (
    <View style={styles.root}>
      <Board
        bar={
          <BackBar
            tight
            title={t('montage.title')}
            right={
              admin ? (
                <IconButton
                  icon={Sparkles}
                  label={t('montage.analyze')}
                  tone="surface"
                  size={44}
                  onPress={() =>
                    router.navigate({
                      pathname: '/project/[id]/analyze',
                      params: { id: projectId },
                    })
                  }
                />
              ) : undefined
            }
          />
        }
        body={[pageBody, canCreate ? { paddingBottom: insets.bottom + 100 } : null]}
      >
        {loading ? (
          <View style={{ paddingVertical: space.s7, alignItems: 'center' }}>
            <CircularSpinner size={32} />
          </View>
        ) : montages.items.length === 0 ? (
          <Empty
            sign="dashed"
            icon={Clapperboard}
            title={t('montage.emptyTitle')}
            text={t('montage.emptyText')}
          />
        ) : (
          montages.items.map((montage) => (
            <MontageCard
              key={montage.id}
              montage={montage}
              movie={movies.items.find((movie) => movie.montageId === montage.id)}
              wide
              onPress={() =>
                openMontage(
                  router,
                  projectId,
                  montage,
                  movies.items.find((movie) => movie.montageId === montage.id),
                )
              }
            />
          ))
        )}
      </Board>
      {canCreate ? (
        <ActionBar>
          <Button label={t('montage.create')} variant="primary" onPress={create} />
        </ActionBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
