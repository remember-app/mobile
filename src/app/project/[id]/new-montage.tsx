import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMontage,
  currentToken,
  loadGallery,
  loadLibrarySongs,
  loadMontageTemplates,
  loadProjectSongs,
  loadProjects,
  previewMontage,
} from '@/functionality';
import { isApiError } from '@/integrations/api';
import { itemSource, type MontageTemplate } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { MetaPage } from '@/ui/components/montage-order/meta';
import { MusicPage } from '@/ui/components/montage-order/music';
import { ShotsPage } from '@/ui/components/montage-order/shots';
import { OrderSummary } from '@/ui/components/montage-order/summary';
import { TemplatesPage } from '@/ui/components/montage-order/templates';
import {
  type Draft,
  dimensionsOf,
  OrderActions,
  OrderHead,
  OrderPage,
  OrderScroll,
  orientationOf,
  Start,
} from '@/ui/components/montage-order/wizard';
import {
  useGallery,
  useLibrarySongs,
  useProjectCard,
  useProjectSongs,
  useSession,
} from '@/ui/hooks';
import { Text } from '@/ui/kit/text';
import { orderOf } from '@/ui/selection';

export default function NewMontageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const gallery = useGallery(projectId);
  const projectSongs = useProjectSongs(projectId);
  const library = useLibrarySongs();

  const [draft, setDraft] = useState<Draft>(Start);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState(0);
  const [templates, setTemplates] = useState<MontageTemplate[] | null>(null);
  const [preview, setPreview] = useState<{ problems: string[]; tokens: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payer, setPayer] = useState<'project' | 'user' | null>(null);
  const [director, setDirector] = useState(false);
  const pager = useRef<ScrollViewInstance>(null);

  const change = (patch: Partial<Draft> | ((was: Draft) => Partial<Draft>)) =>
    setDraft((was) => ({ ...was, ...(typeof patch === 'function' ? patch(was) : patch) }));

  useEffect(() => {
    loadMontageTemplates(projectId).then(setTemplates, () => setTemplates([]));
    void loadProjects();
    void loadGallery(projectId);
    void loadProjectSongs(projectId);
    void loadLibrarySongs();
  }, [projectId]);

  const dimensions = dimensionsOf(draft.orientation);
  const prompt = draft.prompt.trim() || null;

  const thumbnails = useMemo(
    () => gallery.items.flatMap((item) => (item.links.thumbnail ? [item.links.thumbnail] : [])),
    [gallery.items],
  );

  useEffect(() => {
    if (draft.includeItemIds.length === 0) {
      setPreview(null);
      return;
    }
    let live = true;
    setPreviewFailed(false);
    previewMontage(projectId, {
      templateId: draft.templateId,
      config: {
        targetSeconds: draft.targetSeconds,
        prompt,
        dimensions: dimensionsOf(draft.orientation),
        musicIds: draft.musicIds,
        includeItemIds: draft.includeItemIds,
        requiredItemIds: draft.requiredItemIds,
      },
    }).then(
      (answer) => {
        if (live) setPreview(answer);
      },
      () => {
        if (live) setPreviewFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [
    draft.includeItemIds,
    draft.musicIds,
    draft.orientation,
    draft.requiredItemIds,
    draft.targetSeconds,
    draft.templateId,
    projectId,
    prompt,
  ]);

  const songs = useMemo(
    () =>
      [...projectSongs.items, ...library.items].filter(
        (song, at, all) => all.findIndex((one) => one.mediaId === song.mediaId) === at,
      ),
    [library.items, projectSongs.items],
  );
  const chosenSongs = songs.filter((song) => draft.musicIds.includes(song.mediaId));

  const selectedAt = useMemo(() => orderOf(draft.includeItemIds), [draft.includeItemIds]);

  const shots = useMemo(
    () =>
      [...gallery.items].sort(
        (left, right) =>
          (right.media.capturedAt ?? right.createdAt).getTime() -
          (left.media.capturedAt ?? left.createdAt).getTime(),
      ),
    [gallery.items],
  );

  const shotIds = useMemo(() => shots.map((item) => item.id), [shots]);

  const photos = useMemo<Photo[]>(
    () =>
      shots.map((item) => ({
        ...tileOf(item),
        select: selectedAt.get(item.id) ?? null,
        required: draft.requiredItemIds.includes(item.id),
      })),
    [draft.requiredItemIds, selectedAt, shots],
  );

  const viewerPhotos = useMemo(() => shots.map(viewerOf), [shots]);

  const posterShots = useMemo(() => {
    const chosen = shots.filter((item) => draft.includeItemIds.includes(item.id));
    const required = chosen.filter((item) => draft.requiredItemIds.includes(item.id));
    const rest = chosen.filter((item) => !draft.requiredItemIds.includes(item.id));
    return [...required, ...rest].slice(0, 3).flatMap((item) => {
      const uri = itemSource(item);
      return uri ? [uri] : [];
    });
  }, [draft.includeItemIds, draft.requiredItemIds, shots]);

  const projectFree = project
    ? project.consumables.tokens.tokens - project.consumables.tokens.spend
    : 0;
  const userFree = account
    ? account.consumables.tokens.tokens - account.consumables.tokens.spend
    : 0;
  const tokens = preview?.tokens ?? 0;
  const payFrom: 'project' | 'user' = payer ?? (projectFree >= tokens ? 'project' : 'user');
  const funded = (payFrom === 'project' ? projectFree : userFree) >= tokens;
  const blocked =
    preview === null || preview.problems.length > 0 || !funded || busy || photos.length === 0;

  const titles = [
    t('montage.order.templatesTitle'),
    t('montage.order.metaTitle'),
    t('montage.order.shotsTitle'),
    t('montage.order.musicTitle'),
    t('montage.order.summaryTitle'),
  ];

  const go = (next: number) => {
    const target = Math.max(0, Math.min(titles.length - 1, next));
    pager.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
  };

  const pickTemplate = (template: MontageTemplate | null) => {
    if (!template) {
      change({ templateId: null });
      return;
    }
    setDirector(false);
    change({
      templateId: template.id,
      targetSeconds: template.settings.targetSeconds,
      orientation: orientationOf(template.settings.dimensions),
      prompt: template.settings.prompt ?? '',
      musicIds: template.settings.musicIds,
    });
  };

  const chooseDirector = (on: boolean) => {
    setDirector(on);
    change({ musicIds: on ? songs.map((song) => song.mediaId) : [] });
  };

  const chooseSong = (mediaId: string) => {
    if (director) {
      setDirector(false);
      change({ musicIds: [mediaId] });
      return;
    }
    change((was) => ({
      musicIds: was.musicIds.includes(mediaId)
        ? was.musicIds.filter((entry) => entry !== mediaId)
        : [...was.musicIds, mediaId],
    }));
  };

  const toggleShot = (itemId: string) =>
    change((was) => {
      if (was.includeItemIds.includes(itemId)) {
        return {
          includeItemIds: was.includeItemIds.filter((entry) => entry !== itemId),
          requiredItemIds: was.requiredItemIds.filter((entry) => entry !== itemId),
        };
      }
      return { includeItemIds: [...was.includeItemIds, itemId] };
    });

  const toggleRequired = (itemId: string) =>
    change((was) => {
      if (was.requiredItemIds.includes(itemId)) {
        return { requiredItemIds: was.requiredItemIds.filter((entry) => entry !== itemId) };
      }
      return {
        includeItemIds: was.includeItemIds.includes(itemId)
          ? was.includeItemIds
          : [...was.includeItemIds, itemId],
        requiredItemIds: [...was.requiredItemIds, itemId],
      };
    });

  const submit = async () => {
    const token = currentToken();
    if (!token || busy || blocked) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createMontage(projectId, {
        templateId: draft.templateId,
        payFrom,
        config: {
          name: draft.name.trim() || null,
          targetSeconds: draft.targetSeconds,
          prompt,
          dimensions,
          musicIds: draft.musicIds,
          includeItemIds: draft.includeItemIds,
          requiredItemIds: draft.requiredItemIds,
        },
      });
      router.replace({
        pathname: '/project/[id]/montage/[montageId]',
        params: { id: projectId, montageId: made.id },
      });
    } catch (failure) {
      const code = isApiError(failure) ? failure.code : null;
      const status = isApiError(failure) ? failure.status : null;
      setError(
        status === 429
          ? t('montage.order.tooMany')
          : code === 'capacity_exceeded'
            ? t('montage.order.tokensError')
            : t('montage.order.error'),
      );
      setBusy(false);
    }
  };

  const canNext =
    index === 0 || index === 1 || index === 2 || index === 3 || (index === 4 && !blocked);

  const emptyShots = index === 2 && draft.includeItemIds.length === 0;
  const selectAllShots = () => change({ includeItemIds: gallery.items.map((item) => item.id) });
  const next = () => {
    if (index === titles.length - 1) {
      void submit();
      return;
    }
    if (emptyShots) {
      if (gallery.items.length > 0) selectAllShots();
      return;
    }
    go(index + 1);
  };

  const bottom = insets.bottom + 100;

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top }}>
        <OrderHead step={index + 1} title={titles[index] ?? ''} />
      </View>
      <View style={styles.pager} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {height > 0 ? (
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) =>
              setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
            }
          >
            <TemplatesPage
              width={width}
              height={height}
              bottom={bottom}
              templates={templates}
              language={account?.language ?? 'ru'}
              chosenId={draft.templateId}
              covers={thumbnails}
              onChoose={pickTemplate}
            />
            <MetaPage
              width={width}
              height={height}
              bottom={bottom}
              draft={draft}
              projectTitle={project?.title ?? ''}
              onChange={change}
            />
            <ShotsPage
              width={width}
              height={height}
              bottom={insets.bottom + 72}
              photos={photos}
              viewerPhotos={viewerPhotos}
              selectedAt={selectedAt}
              ids={shotIds}
              onToggle={toggleShot}
              onToggleRequired={toggleRequired}
            />
            <MusicPage
              width={width}
              height={height}
              bottom={bottom}
              songs={songs}
              director={director}
              musicIds={draft.musicIds}
              onDirector={chooseDirector}
              onSelect={chooseSong}
            />
            <OrderPage width={width} height={height}>
              <OrderScroll bottom={bottom}>
                <OrderSummary
                  title={draft.name.trim() || (project?.title ?? '')}
                  seconds={draft.targetSeconds}
                  orientation={draft.orientation}
                  shots={posterShots}
                  shotsCount={draft.includeItemIds.length}
                  requiredCount={draft.requiredItemIds.length}
                  songs={chosenSongs.map((song) => ({
                    name: song.name,
                    author: song.author,
                    coverUrl: song.coverUrl,
                  }))}
                  director={director}
                  prompt={prompt}
                  tokens={tokens}
                  payer={payFrom}
                  onPayer={setPayer}
                  projectFree={projectFree}
                  userFree={userFree}
                  loading={preview === null && !previewFailed}
                  failed={preview === null && previewFailed}
                  problems={preview?.problems ?? []}
                  funded={funded}
                />
                {error ? (
                  <Text role="body" tone="danger">
                    {error}
                  </Text>
                ) : null}
              </OrderScroll>
            </OrderPage>
          </ScrollView>
        ) : null}
      </View>
      <OrderActions
        back={() => (index === 0 ? goBack(router) : go(index - 1))}
        next={next}
        label={
          index === titles.length - 1
            ? t('montage.order.start')
            : emptyShots
              ? t('montage.order.selectAll')
              : t('montage.order.next')
        }
        disabled={!canNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
});
