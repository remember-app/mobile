import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCheck, Tag, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  attachItems,
  cachedOriginal,
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
import { FilterControl } from '@/ui/components/gallery/filter-control';
import { LabelMenu } from '@/ui/components/gallery/label-menu';
import { SelectionActions } from '@/ui/components/gallery/selection-actions';
import { SelectionBar } from '@/ui/components/gallery/selection-bar';
import { type GalleryFiltersValue, isFiltered, NO_FILTERS } from '@/ui/components/gallery-filters';
import { MediaInfo } from '@/ui/components/media/info/media-info';
import {
  type MeasureTile,
  type Photo,
  PhotoGrid,
  type Rect,
} from '@/ui/components/media/photo-grid';
import { tileOf } from '@/ui/components/media/photo-item';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { ProjectHeader } from '@/ui/components/project-header';
import { GallerySkeleton } from '@/ui/components/skeletons';
import { confirmAction } from '@/ui/confirm';
import { duration } from '@/ui/format';
import {
  useAvatar,
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
import { BlurBar } from '@/ui/kit/blur-bar';
import { Button, IconButton } from '@/ui/kit/button';
import { Missing } from '@/ui/screens/chrome';
import { orderOf } from '@/ui/selection';
import { height, space } from '@/ui/theme';

export default function ProjectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const avatar = useAvatar();
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
    const order = orderOf(selected);
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
      .map((item) => {
        const tile = tileOf(item);
        return {
          at: (item.media.capturedAt ?? item.createdAt).getTime(),
          photo: {
            ...tile,
            source: localPreviewOf(item.id) ?? tile.source,
            original: item.kind === 'photo' ? (cachedOriginal(item) ?? tile.original) : null,
            playbackUrl:
              item.kind === 'video' ? (localPreviewOf(item.id) ?? tile.playbackUrl) : null,
            select: selecting ? (order.get(item.id) ?? null) : undefined,
            author:
              filters.uploaderIds.length > 0
                ? item.uploader?.name?.trim() || item.uploader?.username || null
                : null,
            authorAvatarUrl:
              filters.uploaderIds.length > 0 ? (item.uploader?.avatarUrl ?? null) : null,
            labelColors:
              filters.labelIds.length > 0 || labelMode
                ? item.labelIds.flatMap((labelId) => {
                    const tint = labelColors.get(labelId);
                    return tint ? [tint] : [];
                  })
                : undefined,
          } satisfies Photo,
        };
      });
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
            preview: upload.uri,
            original: null,
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

  const viewerPhotos = useMemo<Photo[]>(
    () => photos.map((photo) => ({ ...photo, source: photo.preview ?? photo.source })),
    [photos],
  );

  const actionStyle = useAnimatedStyle(() => ({
    opacity: 1 - chrome.value,
    transform: [{ translateY: chrome.value * 96 }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: chrome.value,
    transform: [{ translateX: (1 - chrome.value) * 72 }],
  }));
  const filtered = isFiltered(filters);
  const filterFull = width - space.s4 * 2;

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
    return <Missing title={t('project.title')} message={t('project.notFound')} />;
  }

  const title = project?.title ?? t('project.title');
  const loading = !project || (gallery.status === 'loading' && gallery.items.length === 0);
  const banner = montages.items.length > 0;
  const top = insets.top + space.s2 + 44 + (banner ? card + space.s2 * 2 + 2 : 0) + space.s2;
  const edge = insets.top + space.s2 + 44 + space.s2;
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
      <View style={styles.root}>
        {loading ? (
          <GallerySkeleton top={top} bottom={bottom} />
        ) : photos.length === 0 ? (
          <View style={[styles.emptyFill, { paddingTop: top, paddingBottom: bottom }]}>
            <Image
              source={require('../../../assets/logo/logo-dashes.png')}
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
            padding={{ top: edge, bottom }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
            mark="check"
            emptyMark={false}
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
            <FilterControl
              chrome={chrome}
              anim={filterAnim}
              filtering={filtering}
              full={filterFull}
              onToggle={() => setFiltering((was) => !was)}
              filters={filters}
              labels={labels.labels}
              members={members.members}
              onChange={setFilters}
            />
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
          <SelectionActions
            progress={actions}
            bottom={insets.bottom + space.s3 + 52 + space.s2}
            onSave={saveSelected}
            onDelete={deleteSelected}
            onShare={shareSelected}
          />
        ) : null}
        {selecting ? (
          <SelectionBar
            top={insets.top + 52}
            labelMode={labelMode}
            activeLabel={activeLabel}
            selectedCount={selected.size}
            onMenu={() => setLabelMenu((was) => !was)}
          />
        ) : null}
        {selecting && labelMode && labelMenu && activeLabel ? (
          <LabelMenu
            top={insets.top + 52 + 48}
            labels={labels.labels}
            activeLabel={activeLabel}
            onChoose={chooseLabel}
            onClose={() => setLabelMenu(false)}
          />
        ) : null}
        {open === null ? null : (
          <PhotoViewer
            photos={viewerPhotos}
            initialIndex={open.index}
            origin={open.rect}
            onClose={() => setOpen(null)}
            onIndex={(next) =>
              measureTile.current?.(next, (rect) =>
                setOpen((was) => (was === null ? was : { index: next, rect })),
              )
            }
            author={account?.name ?? undefined}
            authorAvatarUrl={avatar.url}
            selected={selecting ? selected.has(photos[open.index]?.id ?? '') : undefined}
            onSelect={
              selecting
                ? () => {
                    const photo = photos[open.index];
                    if (photo && !photo.upload) toggle(photo.id);
                  }
                : undefined
            }
            onDelete={
              selecting
                ? undefined
                : (photo) => {
                    setOpen(null);
                    if (pending.some((upload) => upload.localId === photo.id)) {
                      void removeUpload(photo.id);
                      return;
                    }
                    void removeItem(projectId, photo.id as ProjectItemId);
                  }
            }
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
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
});
