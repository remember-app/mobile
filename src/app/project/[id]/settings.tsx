import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventDates } from '@/ui/components/event-dates';
import { confirmAction } from '@/ui/confirm';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Field } from '@/ui/kit/field';
import {
  deleteMockProject,
  projectsState,
  subscribeProjects,
  updateMockProject,
} from '@/ui/mocks/projects';
import { space } from '@/ui/theme';

export default function ProjectSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projects = useSyncExternalStore(subscribeProjects, projectsState);
  const project = projects.find((entry) => entry.project.id === id);
  const [title, setTitle] = useState(project?.project.title ?? '');
  const [from, setFrom] = useState<Date | null>(project?.project.eventStart ?? null);
  const [to, setTo] = useState<Date | null>(project?.project.eventEnd ?? null);

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            title={t('project.settings')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title={t('project.notFound')} />
      </Board>
    );
  }

  const save = () => {
    if (!title.trim() || !from) return;
    updateMockProject(id, { title: title.trim(), eventStart: from, eventEnd: to });
    router.back();
  };

  const remove = () => {
    deleteMockProject(id);
    router.dismissTo('/home');
  };

  return (
    <Board
      body={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      bar={
        <AppBar
          title={project.project.title}
          centerTitle
          left={<BackButton size={48} label={t('action.back')} onPress={() => router.back()} />}
          right={
            <IconButton
              icon={Trash2}
              label={t('project.delete')}
              tone="ghost"
              size={48}
              style={{ marginRight: -10 }}
              onPress={() =>
                confirmAction({
                  confirm: t('action.delete'),
                  destructive: true,
                  onConfirm: remove,
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
        onPress={save}
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
