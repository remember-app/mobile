import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clapperboard, RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  songUrl,
} from '@/functionality';
import { isApiError } from '@/integrations/api';
import type { MontageTemplate, Song } from '@/models';
import type { ProjectId, SongId } from '@/types/id';
import { goBack } from '@/ui/back';
import { type Photo, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { OrderSummary } from '@/ui/components/montage-order/summary';
import {
  type Draft,
  dimensionsOf,
  OrderActions,
  OrderHead,
  type Orientation,
  orientationOf,
  Start,
} from '@/ui/components/montage-order/wizard';
import { duration } from '@/ui/format';
import {
  useGallery,
  useLibrarySongs,
  useProjectCard,
  useProjectSongs,
  useSession,
} from '@/ui/hooks';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Field } from '@/ui/kit/field';
import { Segment } from '@/ui/kit/segment';
import { Slider } from '@/ui/kit/slider';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

const PAD = space.s5;
const ON_PHOTO = '#ffffff';
const ON_PHOTO_QUIET = 'rgba(255,255,255,0.78)';
const SONG_COVER = require('../../../../assets/images/song-cover.jpg');
const WAVE = [0.45, 0.75, 1, 0.7, 0.55];

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
  const [payer, setPayer] = useState<'project' | 'user' | null>(null);
  const pager = useRef<ScrollViewInstance>(null);
  const [viewer, setViewer] = useState<{ index: number; rect?: Rect } | null>(null);
  const [director, setDirector] = useState(false);
  const [described, setDescribed] = useState<MontageTemplate | null>(null);
  const [playingId, setPlayingId] = useState<SongId | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const togglePlay = async (song: Song) => {
    if (playingId === song.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = await songUrl(song.id);
      player.replace(url);
      player.play();
      setPlayingId(song.id);
    } catch {
      setPlayingId(null);
    }
  };

  useEffect(() => {
    if (playingId && status.didJustFinish) setPlayingId(null);
  }, [playingId, status.didJustFinish]);

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
  const thumbOf = (id: string): string | null => {
    if (thumbnails.length === 0) return null;
    let hash = 2166136261;
    for (const character of id) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return thumbnails[(hash >>> 0) % thumbnails.length] ?? null;
  };

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

  const selectedAt = useMemo(() => {
    const map = new Map<string, number>();
    draft.includeItemIds.forEach((itemId, at) => {
      map.set(itemId, at + 1);
    });
    return map;
  }, [draft.includeItemIds]);

  const shots = useMemo(
    () =>
      [...gallery.items].sort(
        (left, right) =>
          (right.media.capturedAt ?? right.createdAt).getTime() -
          (left.media.capturedAt ?? left.createdAt).getTime(),
      ),
    [gallery.items],
  );

  const photos = useMemo<Photo[]>(
    () =>
      shots.map((item) => ({
        id: item.id,
        source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
        video: item.kind === 'video',
        playbackUrl: item.kind === 'video' ? (item.links.preview ?? item.links.original) : null,
        note:
          item.kind === 'video' && item.media.duration !== null
            ? duration(item.media.duration)
            : undefined,
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        select: selectedAt.get(item.id) ?? null,
        required: draft.requiredItemIds.includes(item.id),
        capturedAt: item.media.capturedAt,
      })),
    [draft.requiredItemIds, selectedAt, shots],
  );

  const viewerPhotos = useMemo(
    () =>
      shots.map((item) => ({
        id: item.id,
        source: item.links.preview ?? item.links.original ?? item.links.thumbnail,
        video: item.kind === 'video',
        playbackUrl: item.kind === 'video' ? (item.links.preview ?? item.links.original) : null,
        width: item.media.dimensions?.width,
        height: item.media.dimensions?.height,
        capturedAt: item.media.capturedAt,
      })),
    [shots],
  );

  const posterShots = useMemo(() => {
    const chosen = shots.filter((item) => draft.includeItemIds.includes(item.id));
    const required = chosen.filter((item) => draft.requiredItemIds.includes(item.id));
    const rest = chosen.filter((item) => !draft.requiredItemIds.includes(item.id));
    return [...required, ...rest].slice(0, 3).flatMap((item) => {
      const uri = item.links.thumbnail ?? item.links.preview ?? item.links.original;
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
                  <View style={styles.templateGrid}>
                    {templates.map((template) => {
                      const text = template.about[account?.language ?? 'ru'];
                      const chosenTemplate = draft.templateId === template.id;
                      const cover = template.coverUrl ?? thumbOf(template.id);
                      return (
                        <Card
                          key={template.id}
                          clip
                          onPress={() => {
                            if (chosenTemplate) {
                              change({ templateId: null });
                              return;
                            }
                            setDirector(false);
                            applyTemplate(template, change);
                          }}
                          label={text.name}
                          style={styles.template}
                        >
                          {cover ? (
                            <Image
                              source={cover}
                              style={[StyleSheet.absoluteFill, styles.templatePhoto]}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View style={[StyleSheet.absoluteFill, styles.templateEmpty]}>
                              <Clapperboard size={28} color={color.muted} />
                            </View>
                          )}
                          <View
                            pointerEvents="none"
                            style={[StyleSheet.absoluteFill, styles.templateScrim]}
                          />
                          <View style={styles.templateTop}>
                            <View style={styles.templateSign}>
                              {orientationOf(template.settings.dimensions) === 'portrait' ? (
                                <RectangleVertical size={16} color={ON_PHOTO} />
                              ) : (
                                <RectangleHorizontal size={16} color={ON_PHOTO} />
                              )}
                            </View>
                            <View style={styles.templateSpec}>
                              <Text role="metaSm" style={styles.onPhoto}>
                                {duration(template.settings.targetSeconds)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.templateFoot}>
                            <Text role="row" numberOfLines={1} style={styles.onPhoto}>
                              {text.name}
                            </Text>
                            <TemplateDescription
                              text={text.description}
                              onOpen={() => setDescribed(template)}
                            />
                          </View>
                          {chosenTemplate ? (
                            <View
                              pointerEvents="none"
                              style={[
                                StyleSheet.absoluteFill,
                                styles.templateFrame,
                                { borderColor: color.accent },
                              ]}
                            />
                          ) : null}
                        </Card>
                      );
                    })}
                  </View>
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
                  hideLabel
                  options={[
                    {
                      value: 'portrait',
                      label: t('montage.order.vertical'),
                      icon: RectangleVertical,
                    },
                    {
                      value: 'landscape',
                      label: t('montage.order.horizontal'),
                      icon: RectangleHorizontal,
                    },
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
                  const item = shots[at];
                  if (item) toggleShot(item.id);
                }}
                onRequire={(at) => {
                  const item = shots[at];
                  if (item) toggleRequired(item.id);
                }}
                padding={{ top: space.s2, bottom: insets.bottom + 72 }}
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
                        playing={playingId === song.id}
                        onPlay={() => void togglePlay(song)}
                        onSelect={() => {
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
              </ScrollView>
            </Page>
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
      {viewer === null ? null : (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewer.index}
          origin={viewer.rect}
          onClose={() => setViewer(null)}
          onIndex={(next) => setViewer((was) => (was === null ? was : { ...was, index: next }))}
          selected={selectedAt.has(shots[viewer.index]?.id ?? '')}
          onSelect={() => {
            const item = shots[viewer.index];
            if (item) toggleShot(item.id);
          }}
        />
      )}
      <BottomSheet
        visible={described !== null}
        onClose={() => setDescribed(null)}
        title={described ? described.about[account?.language ?? 'ru'].name : ''}
      >
        <Text role="body">
          {described ? described.about[account?.language ?? 'ru'].description : ''}
        </Text>
      </BottomSheet>
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

function TrackRow({
  song,
  on,
  playing,
  onPlay,
  onSelect,
}: {
  song: Song;
  on: boolean;
  playing: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={song.name}
        onPress={onPlay}
        style={styles.trackMain}
      >
        <View style={styles.art}>
          <Image
            source={song.coverUrl ?? SONG_COVER}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {playing ? (
            <>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.artShade]} />
              <Waveform />
            </>
          ) : null}
        </View>
        <View style={styles.trackWords}>
          <Text role="row" numberOfLines={1} style={playing ? { color: color.accentText } : null}>
            {song.name}
          </Text>
          <Text role="meta" tone="muted" numberOfLines={1}>
            {song.author}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={song.name}
        hitSlop={20}
        onPress={onSelect}
        style={styles.checkHit}
      >
        <CheckMark on={on} />
      </Pressable>
    </View>
  );
}

function Waveform() {
  const { color } = useTheme();
  return (
    <View pointerEvents="none" style={styles.wave}>
      {WAVE.map((height, index) => (
        <Bar
          key={index}
          height={height}
          tint={index === 2 ? color.accent : ON_PHOTO}
          delay={index * 90}
        />
      ))}
    </View>
  );
}

function Bar({ height, tint, delay }: { height: number; tint: string; delay: number }) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, value]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.35 + value.value * 0.65 }],
  }));
  return (
    <Animated.View style={[styles.bar, { height: 24 * height, backgroundColor: tint }, style]} />
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

function TemplateDescription({ text, onOpen }: { text: string; onOpen: () => void }) {
  const [width, setWidth] = useState(0);
  const [lines, setLines] = useState(0);
  const truncated = lines > 2;
  return (
    <View onLayout={(event) => setWidth(Math.ceil(event.nativeEvent.layout.width))}>
      <Pressable
        accessibilityRole={truncated ? 'button' : undefined}
        accessibilityLabel={truncated ? text : undefined}
        disabled={!truncated}
        onPress={truncated ? onOpen : undefined}
      >
        <Text role="metaSm" numberOfLines={2} style={styles.onPhotoQuiet}>
          {text}
        </Text>
      </Pressable>
      {width > 0 ? (
        <Text
          role="metaSm"
          pointerEvents="none"
          style={[styles.onPhotoQuiet, styles.measure, { width }]}
          onTextLayout={(event) => {
            const count = event.nativeEvent.lines.length;
            setLines((was) => (was === count ? was : count));
          }}
        >
          {text}
        </Text>
      ) : null}
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
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  template: {
    flexGrow: 1,
    flexBasis: '45%',
    height: 150,
    padding: 0,
  },
  templatePhoto: {
    opacity: 0.65,
  },
  templateEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateScrim: {
    experimental_backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.05))`,
  },
  templateTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s2,
    padding: space.s2,
  },
  templateSign: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateSpec: {
    marginLeft: 'auto',
    paddingVertical: 3,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  templateFrame: {
    borderWidth: 2,
    borderRadius: radius.card,
  },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  templateFoot: {
    marginTop: 'auto',
    padding: space.s3,
    gap: space.s1,
  },
  onPhoto: {
    color: ON_PHOTO,
  },
  onPhotoQuiet: {
    color: ON_PHOTO_QUIET,
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
    paddingVertical: space.s1,
    paddingHorizontal: space.s2,
    borderRadius: radius.card,
  },
  trackMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  artShade: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  trackWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkHit: {
    padding: space.s1,
  },
  director: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
