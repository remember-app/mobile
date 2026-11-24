import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';
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

type BackGuard = {
  addListener: (
    event: 'beforeRemove',
    listener: (event: { preventDefault: () => void; data: { action: unknown } }) => void,
  ) => () => void;
  dispatch: (action: unknown) => void;
};

type Snapshot = {
  title: string;
  description: string;
  from: Date | null;
  to: Date | null;
};

export default function ProjectSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation() as unknown as BackGuard;
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
  const [baseline, setBaseline] = useState<Snapshot>(() => ({
    title: project?.title ?? '',
    description: project?.description ?? '',
    from: project?.eventStart ?? null,
    to: project?.eventEnd ?? null,
  }));

  const dirty =
    title.trim() !== baseline.title.trim() ||
    description.trim() !== baseline.description.trim() ||
    from?.getTime() !== baseline.from?.getTime() ||
    to?.getTime() !== baseline.to?.getTime();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const baselineRef = useRef(baseline);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!project) return;
    const next = {
      title: project.title,
      description: project.description,
      from: project.eventStart,
      to: project.eventEnd,
    };
    setTitle(next.title);
    setDescription(next.description);
    setFrom(next.from);
    setTo(next.to);
    setBaseline(next);
    baselineRef.current = next;
  }, [project?.id]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirtyRef.current) return;
        event.preventDefault();
        Alert.alert(t('project.unsavedTitle'), t('project.unsavedMessage'), [
          { text: t('action.cancel'), style: 'cancel' },
          {
            text: t('project.discard'),
            style: 'destructive',
            onPress: () => {
              dirtyRef.current = false;
              navigation.dispatch(event.data.action);
            },
          },
        ]);
      }),
    [navigation, t],
  );

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
      const next = { title: title.trim(), description: description.trim(), from, to };
      baselineRef.current = next;
      setBaseline(next);
      dirtyRef.current = false;
      goBack(router);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    dirtyRef.current = false;
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
