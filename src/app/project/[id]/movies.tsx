import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clapperboard } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadMontages, loadMovies, loadProjects } from '@/functionality';
import type { Montage } from '@/models';
import type { ProjectId } from '@/types/id';
import { MontageCard } from '@/ui/components/montage-card';
import { useMontages, useMovies, useProjectCard } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
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

  useEffect(() => {
    void loadProjects();
    void loadMontages(projectId, true).catch(() => undefined);
    void loadMovies(projectId, true).catch(() => undefined);
  }, [projectId]);

  const open = (montage: Montage) => {
    const movie = movies.items.find((entry) => entry.montageId === montage.id);
    if (montage.status === 'done' && movie) {
      router.navigate({
        pathname: '/project/[id]/movie/[movieId]',
        params: { id: projectId, movieId: movie.id },
      });
      return;
    }
    router.navigate({
      pathname: '/project/[id]/montage/[montageId]',
      params: { id: projectId, montageId: montage.id },
    });
  };

  const create = () =>
    router.navigate({ pathname: '/project/[id]/new-montage', params: { id: projectId } });
  const loading = montages.status === 'loading' && montages.items.length === 0;

  return (
    <View style={styles.root}>
      <Board
        bar={
          <AppBar
            boxed
            title={t('montage.title')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
        body={[pageBody, admin ? { paddingBottom: insets.bottom + 100 } : null]}
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
              onPress={() => open(montage)}
            />
          ))
        )}
      </Board>
      {admin ? (
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
