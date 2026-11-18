import { useLocalSearchParams, useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMontages, loadMovies, loadProjects } from '@/functionality';
import { canCreateMontage, movieOfMontage } from '@/models';
import type { ProjectId } from '@/types/id';
import { LoadError } from '@/ui/components/feedback/load-error';
import { MontageCard, openMontage } from '@/ui/components/montage/montage-card';
import { useMontages, useMovies, useProjectCard } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { ActionBar } from '@/ui/kit/controls/action-bar';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
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
  const canCreate = canCreateMontage(project);

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
          montages.status === 'error' ? (
            <LoadError onRetry={() => void loadMontages(projectId, true)} />
          ) : null
        ) : (
          montages.items.map((montage) => {
            const movie = movieOfMontage(movies.items, montage.id);
            return (
              <MontageCard
                key={montage.id}
                montage={montage}
                movie={movie}
                wide
                onPress={() => openMontage(router, projectId, montage, movie)}
              />
            );
          })
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
