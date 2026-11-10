import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
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
  loadProjectSongs,
  loadProjects,
} from '@/functionality';
import { isApiError, listMontageTemplates, previewMontage } from '@/integrations/api';
import type { MontageTemplate, Song } from '@/models';
import type { ProjectId } from '@/types/id';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import {
  type Draft,
  dimensionsOf,
  OrderActions,
  OrderHead,
  type Orientation,
  orientationOf,
  Start,
} from '@/ui/components/montage-order/wizard';
import { MontageConfigCard, VideoDetailsCard } from '@/ui/components/movie-blocks';
import { duration } from '@/ui/format';
import {
  useGallery,
  useLibrarySongs,
  useProjectCard,
  useProjectSongs,
  useSession,
} from '@/ui/hooks';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Field } from '@/ui/kit/field';
import { Segment } from '@/ui/kit/segment';
import { Slider } from '@/ui/kit/slider';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

const MIN_SHOTS = 3;
const PAD = space.s5;

export default function NewMontageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
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
  const pager = useRef<ScrollViewInstance>(null);
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);
  const [director, setDirector] = useState(false);

  const change = (patch: Partial<Draft> | ((was: Draft) => Partial<Draft>)) =>
    setDraft((was) => ({ ...was, ...(typeof patch === 'function' ? patch(was) : patch) }));

  useEffect(() => {
    const token = currentToken();
    if (token) listMontageTemplates(token, projectId).then(setTemplates, () => setTemplates([]));
    void loadProjects();
    void loadGallery(projectId);
    void loadProjectSongs(projectId);
    void loadLibrarySongs();
  }, [projectId]);

  const dimensions = dimensionsOf(draft.orientation);
  const prompt = draft.prompt.trim() || null;

  useEffect(() => {
    const token = currentToken();
    if (!token || draft.includeItemIds.length === 0) {
      setPreview(null);
      return;
    }
    let live = true;
    setPreviewFailed(false);
    previewMontage(token, projectId, {
      templateId: draft.templateId,
      config: {
        targetSeconds: draft.targetSeconds,
        prompt,
        dimensions: dimensionsOf(draft.orientation),
        musicIds: draft.musicIds,
        includeItemIds: draft.includeItemIds,
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

  const selectedAt = useMemo(() => {
    const map = new Map<string, number>();
    draft.includeItemIds.forEach((itemId, at) => {
      map.set(itemId, at + 1);
    });
    return map;
  }, [draft.includeItemIds]);

  const photos = useMemo<Photo[]>(
    () =>
      gallery.items.map((item) => ({
        id: item.id,
        source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
        video: item.kind === 'video',
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        select: selectedAt.get(item.id) ?? null,
        capturedAt: item.media.capturedAt,
      })),
    [gallery.items, selectedAt],
  );

  const viewerPhotos = useMemo(
    () =>
      gallery.items.map((item) => ({
        id: item.id,
        source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
        video: item.kind === 'video',
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
      })),
    [gallery.items],
  );

  const projectFree = project
    ? project.consumables.tokens.tokens - project.consumables.tokens.spend
    : 0;
  const userFree = account
    ? account.consumables.tokens.tokens - account.consumables.tokens.spend
    : 0;
  const tokens = preview?.tokens ?? 0;
  const payFrom = projectFree >= tokens ? 'project' : 'user';
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

  const toggleShot = (itemId: string) =>
    change((was) => ({
      includeItemIds: was.includeItemIds.includes(itemId)
        ? was.includeItemIds.filter((entry) => entry !== itemId)
        : [...was.includeItemIds, itemId],
    }));

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
    index === 0 ||
    index === 1 ||
    (index === 2 && draft.includeItemIds.length >= MIN_SHOTS) ||
    index === 3 ||
    (index === 4 && !blocked);

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
            <Page width={width} height={height}>
              <ScrollView
                contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 100 }]}
              >
                {templates === null ? (
                  <View style={styles.centre}>
                    <CircularSpinner size={32} />
                  </View>
                ) : (
                  templates.map((template) => (
                    <Card
                      key={template.id}
                      onPress={() => {
                        setDirector(false);
                        applyTemplate(template, change);
                      }}
                      label={template.name}
                      style={[
                        styles.card,
                        draft.templateId === template.id ? { borderColor: color.accent } : null,
                      ]}
                    >
                      <Text role="row">{template.name}</Text>
                      <Text role="meta" tone="muted">
                        {duration(template.settings.targetSeconds)} ·{' '}
                        {orientationOf(template.settings.dimensions) === 'portrait'
                          ? t('montage.order.vertical')
                          : t('montage.order.horizontal')}
                      </Text>
                    </Card>
                  ))
                )}
              </ScrollView>
            </Page>

            <Page width={width} height={height}>
              <ScrollView
                contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 100 }]}
              >
                <Field
                  label={t('montage.order.movieName')}
                  value={draft.name}
                  onChangeText={(name) => change({ name })}
                  placeholder={project?.title ?? ''}
                  maxLength={200}
                />
                <Field
                  label={t('montage.order.promptTitle')}
                  value={draft.prompt}
                  onChangeText={(next) => change({ prompt: next })}
                  placeholder={t('montage.order.promptPlaceholder')}
                  multiline
                  maxLength={4000}
                  style={styles.area}
                />
                <Slider
                  label={t('montage.order.duration')}
                  value={draft.targetSeconds}
                  onChange={(next) => change({ targetSeconds: next })}
                  min={10}
                  max={180}
                  valueLabel={duration(draft.targetSeconds)}
                  minLabel={duration(10)}
                  maxLabel={duration(180)}
                />
                <Segment<Orientation>
                  label={t('montage.order.orientation')}
                  options={[
                    { value: 'portrait', label: t('montage.order.vertical') },
                    { value: 'landscape', label: t('montage.order.horizontal') },
                  ]}
                  value={draft.orientation}
                  onChange={(next) => change({ orientation: next })}
                />
              </ScrollView>
            </Page>

            <Page width={width} height={height}>
              <PhotoGrid
                photos={photos}
                onOpen={(at, rect) => setViewer({ index: at, rect })}
                onSelect={(at) => {
                  const item = gallery.items[at];
                  if (item) toggleShot(item.id);
                }}
                padding={{ top: space.s2, bottom: insets.bottom + 100 }}
                blankIndex={viewer?.index ?? null}
              />
            </Page>

            <Page width={width} height={height}>
              <ScrollView
                contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 100 }]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: director }}
                  onPress={() => {
                    if (director) {
                      setDirector(false);
                      change({ musicIds: [] });
                      return;
                    }
                    setDirector(true);
                    change({ musicIds: songs.map((one) => one.mediaId) });
                  }}
                >
                  <Card style={[styles.card, director ? { borderColor: color.accent } : null]}>
                    <View style={styles.director}>
                      <Text role="row">{t('montage.order.directorChoice')}</Text>
                      <CheckMark on={director} />
                    </View>
                  </Card>
                </Pressable>
                <Card style={styles.card}>
                  {songs.length === 0 ? (
                    <Text role="meta" tone="muted">
                      {t('montage.order.noMusicChoice')}
                    </Text>
                  ) : (
                    songs.map((song) => (
                      <TrackRow
                        key={song.mediaId}
                        song={song}
                        on={!director && draft.musicIds.includes(song.mediaId)}
                        onPress={() => {
                          if (director) {
                            setDirector(false);
                            change({ musicIds: [song.mediaId] });
                            return;
                          }
                          change((was) => ({
                            musicIds: was.musicIds.includes(song.mediaId)
                              ? was.musicIds.filter((entry) => entry !== song.mediaId)
                              : [...was.musicIds, song.mediaId],
                          }));
                        }}
                      />
                    ))
                  )}
                </Card>
              </ScrollView>
            </Page>

            <Page width={width} height={height}>
              <ScrollView
                contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 100 }]}
              >
                <VideoDetailsCard
                  title={draft.name.trim() || (project?.title ?? '')}
                  durationSeconds={draft.targetSeconds}
                  chips={[
                    {
                      text:
                        draft.orientation === 'portrait'
                          ? t('montage.order.vertical')
                          : t('montage.order.horizontal'),
                    },
                    {
                      text: `${t('montage.order.shotsTitle')}: ${draft.includeItemIds.length}`,
                    },
                  ]}
                />
                <MontageConfigCard
                  prompt={prompt}
                  items={gallery.items.filter((item) => draft.includeItemIds.includes(item.id))}
                  music={
                    director
                      ? []
                      : chosenSongs.map((song) => ({
                          id: song.mediaId,
                          name: song.name,
                          author: song.author,
                        }))
                  }
                  director={director}
                  onFrames={() => go(2)}
                >
                  {preview === null ? (
                    previewFailed ? (
                      <Text role="body" tone="danger">
                        {t('montage.order.error')}
                      </Text>
                    ) : (
                      <View style={styles.centre}>
                        <CircularSpinner size={24} />
                      </View>
                    )
                  ) : preview.problems.length > 0 ? (
                    preview.problems.map((problem) => (
                      <Text key={problem} role="meta" tone="danger">
                        {problem}
                      </Text>
                    ))
                  ) : (
                    <Row label={t('montage.order.tokens')} value={String(tokens)} />
                  )}
                </MontageConfigCard>
                {error ? (
                  <Text role="body" tone="danger">
                    {error}
                  </Text>
                ) : !funded && tokens > 0 ? (
                  <Text role="body" tone="danger">
                    {t('montage.order.tokensError')}
                  </Text>
                ) : null}
              </ScrollView>
            </Page>
          </ScrollView>
        ) : null}
      </View>
      <OrderActions
        back={() => (index === 0 ? router.back() : go(index - 1))}
        next={() => (index === titles.length - 1 ? void submit() : go(index + 1))}
        label={index === titles.length - 1 ? t('montage.order.start') : t('montage.order.next')}
        disabled={!canNext}
      />
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
        />
      )}
    </View>
  );
}

function applyTemplate(
  template: MontageTemplate,
  change: (patch: Partial<Draft> | ((was: Draft) => Partial<Draft>)) => void,
) {
  change({
    templateId: template.id,
    targetSeconds: template.settings.targetSeconds,
    orientation: orientationOf(template.settings.dimensions),
    prompt: template.settings.prompt ?? '',
    musicIds: template.settings.musicIds,
  });
}

function Page({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return <View style={{ width, height }}>{children}</View>;
}

function TrackRow({ song, on, onPress }: { song: Song; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.words}>
        <Text role="row">{song.name}</Text>
        <Text role="meta" tone="muted">
          {song.author}
        </Text>
      </View>
      <CheckMark on={on} />
    </Pressable>
  );
}

function CheckMark({ on }: { on: boolean }) {
  const { color } = useTheme();
  return (
    <View
      style={[
        styles.check,
        {
          borderColor: on ? color.accent : color.line,
          backgroundColor: on ? color.accent : 'transparent',
        },
      ]}
    >
      {on ? <Check size={16} color={color.onFill} /> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text role="rowPlain" tone="muted" style={styles.label}>
        {label}
      </Text>
      <Text role="rowPlain" style={styles.value}>
        {value}
      </Text>
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
  page: {
    paddingHorizontal: PAD,
    paddingTop: space.s4,
    gap: space.s4,
  },
  card: {
    padding: space.s4,
    gap: space.s3,
  },
  area: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: space.s3,
  },
  centre: {
    alignItems: 'center',
    paddingVertical: space.s5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  director: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  words: {
    flexShrink: 1,
    gap: space.s1,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: space.s3,
  },
  label: {
    width: 130,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
