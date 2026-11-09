import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteProject, loadProjects, updateProject } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { EventDates } from '@/ui/components/event-dates';
import { confirmAction } from '@/ui/confirm';
import { useProjectCard } from '@/ui/hooks';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Field } from '@/ui/kit/field';
import { space } from '@/ui/theme';

export default function ProjectSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const [title, setTitle] = useState(project?.title ?? '');
  const [from, setFrom] = useState<Date | null>(project?.eventStart ?? null);
  const [to, setTo] = useState<Date | null>(project?.eventEnd ?? null);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setFrom(project.eventStart);
    setTo(project.eventEnd);
  }, [project?.id]);

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            boxed
            title={t('project.settings')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title={t('project.notFound')} />
      </Board>
    );
  }

  const save = async () => {
    if (!title.trim() || !from) return;
    await updateProject(projectId, {
      title: title.trim(),
      eventStart: from.toISOString(),
      eventEnd: to?.toISOString() ?? null,
    });
    router.back();
  };

  const remove = async () => {
    await deleteProject(projectId);
    router.dismissTo('/home');
  };

  return (
    <Board
      body={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      bar={
        <AppBar
          boxed
          title={project.title}
          left={<BackButton size={44} label={t('action.back')} onPress={() => router.back()} />}
          right={
            <IconButton
              icon={Trash2}
              label={t('project.delete')}
              tone="surface"
              size={44}
              style={{ marginRight: -10 }}
              onPress={() =>
                confirmAction({
                  confirm: t('action.delete'),
                  destructive: true,
                  onConfirm: () => void remove(),
                })
              }
            />
          }
        />
      }
    >
      <Field
        label={t('project.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('project.name')}
        maxLength={30}
      />
      <EventDates
        from={from}
        to={to}
        onChange={(nextFrom, nextTo) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }}
      />
      <Button
        label={t('project.save')}
        variant="primary"
        disabled={!title.trim() || !from}
        onPress={() => void save()}
      />
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s5,
  },
});
