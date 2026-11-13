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
  refreshSession,
} from '@/functionality';
import { isApiError } from '@/integrations/api';
import { itemSource, type MontageTemplate } from '@/models';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import type { Photo, Rect } from '@/ui/components/media/photo-grid';
import { tileOf, viewerOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
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
  STEPS,
  Start,
} from '@/ui/components/montage-order/wizard';
import {
  useGallery,
  useLibrarySongs,
  useProjectCard,
  useProjectSongs,
  useSession,
} from '@/ui/hooks';
import { BlurBar } from '@/ui/kit/blur-bar';
import { Text } from '@/ui/kit/text';
import { orderOf } from '@/ui/selection';
import { space } from '@/ui/theme';

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
  const [headHeight, setHeadHeight] = useState(0);
  const [templates, setTemplates] = useState<MontageTemplate[] | null>(null);
  const [preview, setPreview] = useState<{ problems: string[]; tokens: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payer, setPayer] = useState<'project' | 'user' | null>(null);
  const [director, setDirector] = useState(false);
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);
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

  const go = (next: number) => {
    const target = Math.max(0, Math.min(STEPS - 1, next));
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
      await refreshSession().catch(() => undefined);
      void loadProjects();
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

  const canNext = index < STEPS - 1 || !blocked;

  const emptyShots = index === 2 && draft.includeItemIds.length === 0;
  const selectAllShots = () => change({ includeItemIds: gallery.items.map((item) => item.id) });
  const next = () => {
    if (index === STEPS - 1) {
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
              top={headHeight}
              bottom={bottom}
              templates={templates}
              language={account?.language ?? 'ru'}
              chosenId={draft.templateId}
              covers={thumbnails}
              group={projectId}
              onChoose={pickTemplate}
            />
            <MetaPage
              width={width}
              height={height}
              top={headHeight}
              bottom={bottom}
              draft={draft}
              projectTitle={project?.title ?? ''}
              onChange={change}
            />
            <ShotsPage
              width={width}
              height={height}
              top={headHeight}
              bottom={insets.bottom + 72}
              photos={photos}
              blankIndex={viewer?.index ?? null}
              onOpen={(index, rect) => setViewer({ index, rect })}
              onSelect={(index) => {
                const itemId = shotIds[index];
                if (itemId) toggleShot(itemId);
              }}
              onRequire={(index) => {
                const itemId = shotIds[index];
                if (itemId) toggleRequired(itemId);
              }}
            />
            <MusicPage
              width={width}
              height={height}
              top={headHeight}
              bottom={bottom}
              songs={songs}
              director={director}
              musicIds={draft.musicIds}
              onDirector={chooseDirector}
              onSelect={chooseSong}
            />
            <OrderPage width={width} height={height}>
              <OrderScroll top={headHeight} bottom={bottom}>
                <OrderSummary
                  title={draft.name.trim() || (project?.title ?? '')}
                  seconds={draft.targetSeconds}
                  orientation={draft.orientation}
                  shots={posterShots}
                  group={projectId}
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
      <BlurBar edge="top" fill>
        <View
          onLayout={(event) =>
            setHeadHeight(event.nativeEvent.layout.height + insets.top + space.s2)
          }
        >
          <OrderHead step={index + 1} />
        </View>
      </BlurBar>
      <OrderActions
        back={() => (index === 0 ? goBack(router) : go(index - 1))}
        next={next}
        label={
          index === STEPS - 1
            ? t('montage.order.start')
            : emptyShots
              ? t('montage.order.selectAll')
              : t('montage.order.next')
        }
        disabled={!canNext}
      />
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
          onIndex={(next) => setViewer((was) => (was === null ? was : { ...was, index: next }))}
          selected={selectedAt.has(shotIds[viewer.index] ?? '')}
          onSelect={() => {
            const itemId = shotIds[viewer.index];
            if (itemId) toggleShot(itemId);
          }}
          renderInfo={(index) => {
            const item = shots[index];
            return item ? <MediaInfo key={item.id} projectId={projectId} item={item} /> : null;
          }}
        />
      )}
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
