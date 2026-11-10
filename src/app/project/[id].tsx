import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  ListFilter,
  Send,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  attachItems,
  detachItems,
  loadGallery,
  loadItem,
  loadLabels,
  loadMembers,
  loadMontages,
  loadMoreGallery,
  loadMovies,
  loadProjects,
  localPreviewOf,
  onUploaded,
  progressOf,
  removeItem,
  removeItems,
  removeUpload,
  retryUpload,
  saveItemsToPhone,
  shareItem,
  shareText,
} from '@/functionality';
import type { LabelId, ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import {
  GalleryFiltersPanel,
  type GalleryFiltersValue,
  isFiltered,
  NO_FILTERS,
} from '@/ui/components/gallery-filters';
import { LabelMark } from '@/ui/components/label';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import {
  type MeasureTile,
  type Photo,
  PhotoGrid,
  type Rect,
} from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { ProjectHeader } from '@/ui/components/project-header';
import { GallerySkeleton } from '@/ui/components/skeletons';
import { confirmAction } from '@/ui/confirm';
import { duration } from '@/ui/format';
import {
  useGallery,
  useLabels,
  useMembers,
  useMontages,
  useProjectCard,
  useProjects,
  useSession,
  useUploads,
} from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Icon, type IconComponent } from '@/ui/kit/icon';
import { Text } from '@/ui/kit/text';
import { height, radius, space, useTheme } from '@/ui/theme';

const FILTER_HEIGHT = 288;

export default function ProjectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const projects = useProjects();
  const project = useProjectCard(projectId);
  const gallery = useGallery(projectId);
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const montages = useMontages(projectId);
  const uploads = useUploads();
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [filters, setFilters] = useState<GalleryFiltersValue>(NO_FILTERS);
  const [labelMode, setLabelMode] = useState(false);
  const [labelMenu, setLabelMenu] = useState(false);
  const [activeLabelId, setActiveLabelId] = useState<LabelId | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const chrome = useSharedValue(0);
  const actions = useSharedValue(0);
  const filterAnim = useSharedValue(0);
  const chromeOn = useRef(false);
  const measureTile = useRef<MeasureTile | null>(null);
  const replacedUploads = useRef(new Set<string>());
  const opening = useRef(true);
  const turning = useRef<'none' | 'open' | 'close'>('none');
  const card = (width - space.s4 * 2 - space.s2 * 4) / 3;
  const progress = useSharedValue(1);

  useEffect(() => {
    void loadProjects();
    void loadGallery(projectId);
    void loadLabels(projectId).catch(() => undefined);
    void loadMembers(projectId).catch(() => undefined);
    void loadMontages(projectId, true).catch(() => undefined);
    void loadMovies(projectId, true).catch(() => undefined);
    return onUploaded(async (upload, project, localId) => {
      if (project !== projectId) return;
      replacedUploads.current.add(localId);
      await loadItem(projectId, upload.itemId);
    });
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      opening.current = false;
      progress.value = withTiming(0, { duration: 320 });
    }, 60);
    return () => clearTimeout(timer);
  }, [progress]);

  const pending = useMemo(
    () => uploads.items.filter((upload) => upload.projectId === projectId),
    [uploads.items, projectId],
  );

  const photos = useMemo<Photo[]>(() => {
    const order = new Map<string, number>();
    for (const id of selected) order.set(id, order.size + 1);
    const labelColors = new Map(labels.labels.map((label) => [label.id, label.color]));
    const files = gallery.items
      .filter((item) => {
        if (filters.kinds.length > 0 && !filters.kinds.includes(item.kind)) return false;
        const size = item.media.dimensions;
        if (size && filters.orientations.length > 0) {
          const vertical = size.height >= size.width;
          if (!filters.orientations.includes(vertical ? 'vertical' : 'horizontal')) return false;
        }
        if (
          filters.labelIds.length > 0 &&
          !item.labelIds.some((labelId) => filters.labelIds.includes(labelId))
        ) {
          return false;
        }
        if (
          filters.uploaderIds.length > 0 &&
          (!item.media.uploadedBy || !filters.uploaderIds.includes(item.media.uploadedBy))
        ) {
          return false;
        }
        return true;
      })
      .map((item) => ({
        at: (item.media.capturedAt ?? item.createdAt).getTime(),
        photo: {
          id: item.id,
          source:
            localPreviewOf(item.id) ??
            item.links.thumbnail ??
            item.links.preview ??
            item.links.original,
          video: item.kind === 'video',
          playbackUrl:
            item.kind === 'video'
              ? (localPreviewOf(item.id) ?? item.links.preview ?? item.links.original)
              : null,
          note:
            item.kind === 'video' && item.media.duration !== null
              ? duration(item.media.duration)
              : undefined,
          width: item.media.dimensions?.width,
          height: item.media.dimensions?.height,
          capturedAt: item.media.capturedAt,
          select: selecting ? (order.get(item.id) ?? null) : undefined,
          author:
            filters.uploaderIds.length > 0
              ? item.uploader?.name?.trim() || item.uploader?.username || null
              : null,
          labelColors:
            filters.labelIds.length > 0 || labelMode
              ? item.labelIds.flatMap((labelId) => {
                  const tint = labelColors.get(labelId);
                  return tint ? [tint] : [];
                })
              : undefined,
        } satisfies Photo,
      }));
    const sending = pending
      .filter((upload) => !replacedUploads.current.has(upload.localId))
      .map((upload) => {
        const progress = progressOf(upload);
        const captured = upload.capturedAt ? new Date(upload.capturedAt) : null;
        return {
          at: (captured ?? new Date()).getTime(),
          photo: {
            id: upload.localId,
            source: upload.uri,
            video: upload.kind === 'video',
            playbackUrl: upload.kind === 'video' ? upload.uri : null,
            note:
              upload.kind === 'video' && upload.durationSeconds !== null
                ? duration(upload.durationSeconds)
                : undefined,
            upload: {
              progress: progress.total > 0 ? progress.done / progress.total : 0,
              failed: upload.status === 'failed',
            },
            capturedAt: captured,
          } satisfies Photo,
        };
      });
    return [...files, ...sending]
      .sort((left, right) => (filters.sort === 'new' ? right.at - left.at : left.at - right.at))
      .map((entry) => entry.photo);
  }, [filters, gallery.items, labelMode, labels.labels, pending, selecting, selected]);

  const actionStyle = useAnimatedStyle(() => ({
    opacity: 1 - chrome.value,
    transform: [{ translateY: chrome.value * 96 }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: chrome.value,
    transform: [{ translateX: (1 - chrome.value) * -72 }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: chrome.value,
    transform: [{ translateX: (1 - chrome.value) * 72 }],
  }));
  const filtered = isFiltered(filters);
  const filterFull = width - space.s4 * 2;
  const filterStyle = useAnimatedStyle(() => ({
    width: 52 + (filterFull - 52) * filterAnim.value,
    height: 52 + (FILTER_HEIGHT - 52) * filterAnim.value,
  }));
  const filterIcon = useAnimatedStyle(() => ({ opacity: 1 - filterAnim.value }));
  const filterContent = useAnimatedStyle(() => ({ opacity: filterAnim.value }));

  useEffect(() => {
    chrome.value = withTiming(scrolling || selecting || filtering || filtered ? 1 : 0, {
      duration: 220,
    });
  }, [chrome, scrolling, selecting, filtering, filtered]);

  useEffect(() => {
    actions.value = withTiming(selecting ? 1 : 0, { duration: 220 });
  }, [actions, selecting]);

  useEffect(() => {
    filterAnim.value = withTiming(filtering ? 1 : 0, { duration: 260 });
  }, [filterAnim, filtering]);

  if (!project && projects.status !== 'loading') {
    return (
      <Board
        bar={
          <AppBar
            boxed
            title={t('project.title')}
            left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
          />
        }
      >
        <Empty sign="dashed" title={t('project.notFound')} />
      </Board>
    );
  }

  const title = project?.title ?? t('project.title');
  const loading = !project || (gallery.status === 'loading' && gallery.items.length === 0);
  const banner = montages.items.length > 0;
  const top = insets.top + space.s2 + 44 + (banner ? card + space.s2 * 2 + 2 : 0) + space.s2;
  const bottom = insets.bottom + 76;
  const hideAfter = height.primary + space.s2 + insets.bottom;
  const scrolled = (offset: number) => {
    if (opening.current) return;
    const moving = offset > hideAfter;
    const next = moving ? 'close' : 'open';
    if (turning.current === next) return;
    turning.current = next;
    progress.value = withTiming(next === 'close' ? 1 : 0, { duration: 260 });
    if (chromeOn.current !== moving) {
      chromeOn.current = moving;
      setScrolling(moving);
    }
  };
  const toggle = (id: string) => {
    setSelected((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggledSelection = () => {
    if (selecting) setSelected(new Set());
    setLabelMode(false);
    setLabelMenu(false);
    setSelecting(!selecting);
  };
  const activeLabel = labels.labels.find((label) => label.id === activeLabelId) ?? labels.labels[0];
  const toggleLabels = () => {
    if (labelMode) {
      setLabelMode(false);
      setLabelMenu(false);
      return;
    }
    if (labels.labels.length === 0) return;
    setActiveLabelId((was) => was ?? labels.labels[0]?.id ?? null);
    setLabelMode(true);
  };
  const chooseLabel = (labelId: LabelId) => {
    setActiveLabelId(labelId);
    setLabelMenu(false);
  };
  const toggleLabel = (itemId: ProjectItemId, labelId: LabelId) => {
    const item = gallery.items.find((entry) => entry.id === itemId);
    const has = item?.labelIds.includes(labelId) ?? false;
    void (has
      ? detachItems(projectId, labelId, [itemId])
      : attachItems(projectId, labelId, [itemId]));
  };
  const chosen = () => gallery.items.filter((item) => selected.has(item.id));
  const saveSelected = async () => {
    const items = chosen();
    if (items.length === 0) return;
    const result = await saveItemsToPhone(items);
    setSelected(new Set());
    setSelecting(false);
    Alert.alert(t('action.save'), t('project.saved', { count: result.saved }));
  };
  const deleteSelected = () => {
    const items = chosen();
    if (items.length === 0) return;
    confirmAction({
      confirm: t('action.delete'),
      destructive: true,
      onConfirm: () => {
        setSelected(new Set());
        setSelecting(false);
        void removeItems(
          projectId,
          items.map((item) => item.id),
        ).then(({ failed }) => {
          if (failed > 0) Alert.alert(t('action.delete'), t('project.deleteFailed', { failed }));
        });
      },
    });
  };
  const shareSelected = async () => {
    const items = chosen();
    if (items.length === 0) return;
    if (items.length === 1) {
      const [one] = items;
      if (one) await shareItem(one);
    } else {
      const links = items.map((item) => item.links.original).filter((link) => link !== null);
      if (links.length > 0) await shareText(links.join('\n'));
    }
    setSelected(new Set());
    setSelecting(false);
  };
  const pick = () => router.navigate({ pathname: '/project/[id]/pick', params: { id: projectId } });

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null && !selecting }} />
      <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
        {loading ? (
          <GallerySkeleton top={top} bottom={bottom} />
        ) : photos.length === 0 ? (
          <View style={[styles.emptyFill, { paddingTop: top, paddingBottom: bottom }]}>
            <Image
              source={require('../../../assets/images/memory-empty.png')}
              style={styles.emptyArt}
              contentFit="contain"
            />
          </View>
        ) : (
          <PhotoGrid
            photos={photos}
            onOpen={(index, rect) => {
              const photo = photos[index];
              if (!photo) return;
              if (selecting) {
                if (!photo.upload) toggle(photo.id);
                return;
              }
              if (photo.upload?.failed) {
                retryUpload(photo.id);
                return;
              }
              setOpen({ index, rect });
            }}
            onSelect={
              selecting
                ? (index) => {
                    const photo = photos[index];
                    if (!photo || photo.upload) return;
                    if (labelMode && activeLabel) {
                      toggleLabel(photo.id as ProjectItemId, activeLabel.id);
                      return;
                    }
                    toggle(photo.id);
                  }
                : undefined
            }
            padding={{ top, bottom }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
            mark="check"
            emptyMark={false}
            tapSelects={selecting}
            onLoadOlder={() => void loadMoreGallery(projectId)}
            onScroll={scrolled}
          />
        )}
        <BlurBar edge="top" style={styles.top}>
          <ProjectHeader
            projectId={projectId}
            title={title}
            card={card}
            progress={progress}
            onBack={() => goBack(router)}
            onMembers={() =>
              router.navigate({ pathname: '/project/[id]/info', params: { id: projectId } })
            }
          />
        </BlurBar>
        <ActionBar>
          <Animated.View
            style={actionStyle}
            pointerEvents={scrolling || selecting ? 'none' : 'auto'}
          >
            <Button label={t('project.add')} variant="primary" onPress={pick} />
          </Animated.View>
        </ActionBar>
        {filtering ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('action.close')}
            onPress={() => setFiltering(false)}
            style={[styles.filterBackdrop, { top: insets.top + 52 }]}
          />
        ) : null}
        {open === null ? (
          <View
            pointerEvents={scrolling || selecting || filtering || filtered ? 'box-none' : 'none'}
            style={[styles.sideBar, { bottom: insets.bottom + space.s3 }]}
          >
            <Animated.View style={[leftStyle, styles.filterLayer]}>
              <Animated.View
                style={[
                  styles.filterBlock,
                  filterStyle,
                  { backgroundColor: theme.color.surface, borderColor: theme.color.line },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('project.filter')}
                  hitSlop={8}
                  pointerEvents={filtering ? 'none' : 'auto'}
                  onPress={() => setFiltering((was) => !was)}
                  style={styles.filterHit}
                >
                  <Animated.View style={filterIcon}>
                    <Icon icon={ListFilter} size={26} color={theme.color.paper} />
                  </Animated.View>
                </Pressable>
                {filtering ? (
                  <Animated.View style={[styles.filterContentWrap, filterContent]}>
                    <GalleryFiltersPanel
                      value={filters}
                      labels={labels.labels}
                      members={members.members}
                      onChange={setFilters}
                    />
                  </Animated.View>
                ) : null}
              </Animated.View>
            </Animated.View>
            <Animated.View style={[rightStyle, styles.rightButtons]}>
              {selecting ? (
                <IconButton
                  icon={Tag}
                  label={t('labels.title')}
                  tone="surface"
                  size={52}
                  on={labelMode}
                  disabled={labels.labels.length === 0}
                  onPress={toggleLabels}
                />
              ) : null}
              <IconButton
                icon={selecting ? X : CheckCheck}
                label={selecting ? t('action.done') : t('project.select')}
                tone="surface"
                size={52}
                on={selecting}
                onPress={toggledSelection}
              />
            </Animated.View>
          </View>
        ) : null}
        {selecting && !labelMode ? (
          <View style={[styles.actions, { bottom: insets.bottom + space.s3 + 52 + space.s2 }]}>
            <RisingAction
              progress={actions}
              index={2}
              icon={Download}
              label={t('action.save')}
              onPress={saveSelected}
            />
            <RisingAction
              progress={actions}
              index={1}
              icon={Trash2}
              label={t('action.delete')}
              onPress={deleteSelected}
            />
            <RisingAction
              progress={actions}
              index={0}
              icon={Send}
              label={t('action.share')}
              onPress={shareSelected}
            />
          </View>
        ) : null}
        {selecting ? (
          <View style={[styles.selectionBar, { top: insets.top + 52 }]}>
            {labelMode && activeLabel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={activeLabel.name}
                onPress={() => setLabelMenu((was) => !was)}
                style={[
                  styles.labelPill,
                  { backgroundColor: theme.color.surface, borderColor: theme.color.line },
                ]}
              >
                <LabelMark tint={activeLabel.color} size={18} />
                <Text role="row" numberOfLines={1} style={styles.labelName}>
                  {activeLabel.name}
                </Text>
                <ChevronDown size={16} color={theme.color.muted} />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.selectionPill,
                  { backgroundColor: theme.color.surface, borderColor: theme.color.line },
                ]}
              >
                <Text role="row">{t('project.selected', { count: selected.size })}</Text>
              </View>
            )}
          </View>
        ) : null}
        {selecting && labelMode && labelMenu && activeLabel ? (
          <>
            <Pressable style={styles.labelBackdrop} onPress={() => setLabelMenu(false)} />
            <View style={[styles.labelMenuWrap, { top: insets.top + 52 + 48 }]}>
              <View
                style={[
                  styles.labelMenu,
                  { backgroundColor: theme.color.surface, borderColor: theme.color.line },
                ]}
              >
                {labels.labels.map((label) => (
                  <Pressable
                    key={label.id}
                    accessibilityRole="button"
                    accessibilityLabel={label.name}
                    onPress={() => void chooseLabel(label.id)}
                    style={styles.labelOption}
                  >
                    <LabelMark tint={label.color} size={18} />
                    <Text role="row" numberOfLines={1} style={styles.labelName}>
                      {label.name}
                    </Text>
                    {label.id === activeLabel.id ? (
                      <Check size={16} color={theme.color.accent} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}
        {open === null ? null : (
          <PhotoViewer
            photos={photos}
            initialIndex={open.index}
            origin={open.rect}
            onClose={() => setOpen(null)}
            onIndex={(next) =>
              measureTile.current?.(next, (rect) =>
                setOpen((was) => (was === null ? was : { index: next, rect })),
              )
            }
            author={account?.name ?? undefined}
            onDelete={(photo) => {
              setOpen(null);
              if (pending.some((upload) => upload.localId === photo.id)) {
                void removeUpload(photo.id);
                return;
              }
              void removeItem(projectId, photo.id as ProjectItemId);
            }}
            renderInfo={(index) => {
              const photo = photos[index];
              if (!photo) return null;
              const item = gallery.items.find((entry) => entry.id === photo.id);
              return item ? <MediaInfo key={item.id} projectId={projectId} item={item} /> : null;
            }}
          />
        )}
      </View>
    </>
  );
}

function RisingAction({
  progress,
  index,
  icon,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  index: number;
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * index * (52 + space.s2) }],
  }));
  return (
    <Animated.View style={style}>
      <IconButton icon={icon} label={label} tone="surface" size={52} onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyFill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.s6,
  },
  emptyArt: {
    width: 300,
    height: 225,
    alignSelf: 'center',
  },
  top: {
    paddingHorizontal: space.s4,
  },
  sideBar: {
    position: 'absolute',
    left: space.s4,
    right: space.s4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  filterLayer: {
    width: 52,
    height: 52,
    zIndex: 2,
  },
  filterBlock: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContentWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  labelPill: {
    maxWidth: '60%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  labelName: {
    flexShrink: 1,
  },
  labelBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  labelMenuWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  labelMenu: {
    width: 260,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.s1,
  },
  labelOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
  },
  actions: {
    position: 'absolute',
    right: space.s4,
    alignItems: 'flex-end',
    gap: space.s2,
  },
  selectionPill: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
});
