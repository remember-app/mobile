import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteProject, loadProjects, updateProject } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { DescriptionField } from '@/ui/components/forms/description-field';
import { EventDates } from '@/ui/components/forms/event-dates';
import { confirmAction } from '@/ui/confirm';
import { useProjectCard } from '@/ui/hooks';
import { Board } from '@/ui/kit/chrome/bars';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { Field } from '@/ui/kit/controls/field';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar, Missing } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

export default function ProjectSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [from, setFrom] = useState<Date | null>(project?.eventStart ?? null);
  const [to, setTo] = useState<Date | null>(project?.eventEnd ?? null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description);
    setFrom(project.eventStart);
    setTo(project.eventEnd);
  }, [project?.id]);

  if (!project) {
    return <Missing title={t('project.settings')} message={t('project.notFound')} />;
  }

  const save = async () => {
    if (!title.trim() || !from || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await updateProject(projectId, {
        title: title.trim(),
        description: description.trim(),
        eventStart: from.toISOString(),
        eventEnd: to?.toISOString() ?? null,
      });
      goBack(router);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await deleteProject(projectId);
    router.dismissTo('/home');
  };

  return (
    <Board
      body={[styles.body, { paddingBottom: insets.bottom + space.s4 }]}
      bar={
        <BackBar
          title={project.title}
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
      <DescriptionField value={description} onChangeText={setDescription} />
      <EventDates
        from={from}
        to={to}
        onChange={(nextFrom, nextTo) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }}
      />
      {failed ? (
        <Text role="hint" tone="danger">
          {t('common.saveFailed')}
        </Text>
      ) : null}
      <Button
        label={t('project.save')}
        variant="primary"
        disabled={!title.trim() || !from || saving}
        onPress={() => void save()}
      />
    </Board>
  );
}

const styles = StyleSheet.create({
  note: {
    textAlignVertical: 'top',
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s5,
  },
});
