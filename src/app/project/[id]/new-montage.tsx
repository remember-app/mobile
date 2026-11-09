import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { createMontage, loadGallery, loadProjects } from '@/functionality';
import { isApiError } from '@/integrations/api';
import type { ProjectId } from '@/types/id';
import { useGallery, useProjectCard, useSession } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

const SECONDS = 60;

export default function NewMontageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const gallery = useGallery(projectId);
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProjects();
    void loadGallery(projectId);
  }, [projectId]);

  const items = gallery.items;
  const size = items.find((item) => item.media.dimensions)?.media.dimensions ?? null;
  const wide = size ? size.width > size.height : false;
  const dimensions = wide ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const projectFree = project
    ? project.consumables.tokens.tokens - project.consumables.tokens.spend
    : 0;
  const userFree = account
    ? account.consumables.tokens.tokens - account.consumables.tokens.spend
    : 0;
  const payFrom = projectFree > 0 ? 'project' : 'user';
  const funded = projectFree > 0 || userFree > 0;
  const canOrder = items.length > 0 && !busy && funded;

  const submit = async () => {
    if (!canOrder) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createMontage(projectId, {
        payFrom,
        config: {
          targetSeconds: SECONDS,
          prompt: null,
          dimensions,
          musicIds: [],
          includeItemIds: items.map((item) => item.id),
        },
      });
      router.replace({
        pathname: '/project/[id]/montage/[montageId]',
        params: { id: projectId, montageId: created.id },
      });
    } catch (failure) {
      const code = isApiError(failure) ? failure.code : null;
      const status = isApiError(failure) ? failure.status : null;
      setError(
        status === 429
          ? t('montage.order.tooMany')
          : code === 'capacity_exceeded'
            ? t('montage.order.tokens')
            : t('montage.order.error'),
      );
      setBusy(false);
    }
  };

  return (
    <Board
      bar={
        <AppBar
          boxed
          title={t('montage.order.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
        />
      }
      body={pageBody}
    >
      {items.length === 0 ? (
        <Empty sign="dashed" title={t('montage.order.noItems')} />
      ) : (
        <>
          <Card style={styles.card}>
            <Text role="row">{t('montage.order.frames', { count: items.length })}</Text>
            <Text role="row">{t('montage.order.seconds', { count: SECONDS })}</Text>
            <Text role="row" tone="muted">
              {wide ? t('montage.order.horizontal') : t('montage.order.vertical')}
            </Text>
          </Card>
          {error ? (
            <Text role="body" tone="danger">
              {error}
            </Text>
          ) : !funded ? (
            <Text role="body" tone="danger">
              {t('montage.order.tokens')}
            </Text>
          ) : null}
          <Button
            label={t('montage.order.submit')}
            variant="primary"
            disabled={!canOrder}
            onPress={submit}
          />
        </>
      )}
    </Board>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.s4,
    gap: space.s3,
  },
});
