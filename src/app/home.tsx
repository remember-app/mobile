import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { OnboardingFinal } from '@/ui/components/onboarding/final';
import { ProjectCard } from '@/ui/components/project-card';
import { ActionBar, AppBar, Board } from '@/ui/kit/bars';
import { Button, IconButton } from '@/ui/kit/button';
import { MOCK_PROJECTS } from '@/ui/mocks/projects';
import { space } from '@/ui/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { celebrate } = useLocalSearchParams<{ celebrate?: string }>();

  return (
    <>
      <Board
        body={styles.body}
        bar={
          <AppBar
            variant="root"
            title="Воспоминания"
            right={
              <IconButton
                icon={User}
                label="Профиль"
                tone="surface"
                onPress={() => router.push('/profile')}
              />
            }
          />
        }
        footer={
          <ActionBar>
            <Button
              label="Новое воспоминание"
              variant="primary"
              icon={Plus}
              onPress={() => router.push('/create')}
            />
          </ActionBar>
        }
      >
        {MOCK_PROJECTS.map(({ project, cover, people }) => (
          <ProjectCard
            key={project.id}
            project={project}
            cover={cover}
            people={people}
            onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
          />
        ))}
      </Board>
      {celebrate ? (
        <OnboardingFinal
          name={celebrate}
          onDone={() => router.setParams({ celebrate: undefined })}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s6,
    gap: space.s4,
  },
});
