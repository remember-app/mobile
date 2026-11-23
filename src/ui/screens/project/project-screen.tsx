import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CopySlash, Tag } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
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
  nearDuplicateExtras,
  onUploaded,
  progressOf,
  removeItem,
  removeItems,
  removeProjectUploads,
  removeUpload,
  retryUpload,
  saveItemsToPhone,
  shareItem,
  shareText,
} from '@/functionality';
import { canCreateMontage, itemDate } from '@/models';
import type { LabelId, ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import { LoadError } from '@/ui/components/feedback/load-error';
import { GallerySkeleton } from '@/ui/components/feedback/skeletons';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { LabelMenu } from '@/ui/components/gallery/label-menu';
import { SelectionActions } from '@/ui/components/gallery/selection-actions';
import { SelectionBar } from '@/ui/components/gallery/selection-bar';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen } from '@/ui/components/media/gallery-screen';
import { useGalleryViewer } from '@/ui/components/media/gallery-viewer';
import { useMediaInfo } from '@/ui/components/media/info/media-info';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf } from '@/ui/components/media/photo-item';
import { ProjectHeader } from '@/ui/components/project/project-header';
import { confirmAction } from '@/ui/confirm';
import { duration } from '@/ui/format';
import { useGallerySelection } from '@/ui/gallery-selection';
import {
  useAccount,
  useAvatar,
  useGallery,
  useLabels,
  useMembers,
  useMontages,
  useProjectCard,
  useProjects,
  useUploads,
} from '@/ui/hooks';
import { ScreenLogoButton } from '@/ui/kit/chrome/backdrop';
import { NoticeBanner } from '@/ui/kit/chrome/banner';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { IconButton } from '@/ui/kit/controls/button';
import { Missing } from '@/ui/screens/chrome';
import { space } from '@/ui/theme';

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
  const mediaInfo = useMediaInfo(projectId, gallery.items);
  const labels = useLabels(projectId);
  const members = useMembers(projectId);
  const montages = useMontages(projectId);
  const uploads = useUploads();
  const avatar = useAvatar();
  const account = useAccount();
  const {
    viewer: open,
    setViewer: setOpen,
    measureTile,
    onIndex: onViewerIndex,
  } = useGalleryViewer();
  const [selecting, setSelecting] = useState(false);
  const { filters, setFilters } = useGalleryFilters();
  const [labelMode, setLabelMode] = useState(false);
  const [labelMenu, setLabelMenu] = useState(false);
  const [activeLabelId, setActiveLabelId] = useState<LabelId | null>(null);
  const selection = useGallerySelection<string>();
  const card = (width - space.s4 * 2 - space.s2 * 4) / 3;
  const progress = useSharedValue(1);

  useEffect(() => {
    void loadProjects();
    void loadGallery(projectId);
    void loadLabels(projectId).catch(() => undefined);
    void loadMembers(projectId).catch(() => undefined);
    void loadMontages(projectId, true).catch(() => undefined);
    void loadMovies(projectId, true).catch(() => undefined);
    return onUploaded(async (upload, project) => {
      if (project !== projectId || upload.itemId === null) return;
      await loadItem(projectId, upload.itemId);
    });
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(0, { duration: 320 });
    }, 60);
    return () => clearTimeout(timer);
  }, [progress]);

  const pending = useMemo(
    () => uploads.items.filter((upload) => upload.projectId === projectId),
    [uploads.items, projectId],
  );
  const failed = useMemo(() => pending.filter((upload) => upload.status === 'failed'), [pending]);

  const visibleItems = useMemo(() => filterItems(gallery.items, filters), [filters, gallery.items]);

  // Загрузка и кадр — это одна запись списка: пока загрузка жива, она показывает свой кадр,
  // поэтому место не меняется ни по ходу отправки, ни после неё.
  const photos = useMemo<Photo[]>(() => {
    const labelColors = new Map(labels.labels.map((label) => [label.id, label.color]));
    const filePhoto = (item: (typeof visibleItems)[number]): Photo => {
      const tile = tileOf(item);
      return {
        ...tile,
        source: localPreviewOf(item.id) ?? tile.source,
        preview: localPreviewOf(item.id) ?? tile.preview,
        original: item.kind === 'photo' ? (cachedOriginal(item) ?? tile.original) : null,
        playbackUrl: item.kind === 'video' ? tile.playbackUrl : null,
        selected: selecting ? selection.has(item.id) : undefined,
        author:
          filters.uploaderIds.length > 0
            ? item.uploader?.name?.trim() || item.uploader?.username || null
            : null,
        authorAvatarUrl: filters.uploaderIds.length > 0 ? (item.uploader?.avatarUrl ?? null) : null,
        labelColors:
          filters.labelIds.length > 0 || labelMode
            ? item.labelIds.flatMap((labelId) => {
                const tint = labelColors.get(labelId);
                return tint ? [tint] : [];
              })
            : undefined,
      } satisfies Photo;
    };
    const sendingPhoto = (upload: (typeof pending)[number], id: string): Photo => {
      const progress = progressOf(upload);
      const poster = upload.posterUri;
      return {
        id,
        source: poster,
        preview: poster,
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
        capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
      } satisfies Photo;
    };

    const loaded = new Map(visibleItems.map((item) => [item.id, item] as const));
    const existing = new Set(gallery.items.map((item) => item.id));
    const occupied = new Set<string>();
    const entries: { at: number; photo: Photo }[] = [];
    for (const upload of pending) {
      const item = upload.itemId === null ? undefined : loaded.get(upload.itemId);
      if (item) {
        occupied.add(item.id);
        // Пока обработка не назвала настоящую дату, кадр стоит там, где стояла загрузка.
        const date =
          item.media.meta.at === null && upload.capturedAt
            ? new Date(upload.capturedAt)
            : itemDate(item);
        entries.push({ at: date.getTime(), photo: filePhoto(item) });
        continue;
      }
      if (upload.itemId !== null) {
        occupied.add(upload.itemId);
        if (existing.has(upload.itemId)) continue;
      }
      const captured = upload.capturedAt ? new Date(upload.capturedAt) : null;
      entries.push({
        at: (captured ?? new Date()).getTime(),
        photo: sendingPhoto(upload, upload.itemId ?? upload.localId),
      });
    }
    for (const item of visibleItems) {
      if (occupied.has(item.id)) continue;
      entries.push({ at: itemDate(item).getTime(), photo: filePhoto(item) });
    }
    return entries
      .sort((left, right) => (filters.sort === 'new' ? right.at - left.at : left.at - right.at))
      .map((entry) => entry.photo);
  }, [
    filters,
    gallery.items,
    visibleItems,
    labelMode,
    labels.labels,
    pending,
    selecting,
    selection,
  ]);

  const viewerPhotos = useMemo<Photo[]>(
    () => photos.map((photo) => ({ ...photo, source: photo.preview ?? photo.source })),
    [photos],
  );

  if (!project && projects.status !== 'loading') {
    return <Missing title={t('project.title')} message={t('project.notFound')} />;
  }

  const title = project?.title ?? t('project.title');
  const loading = !project || (gallery.status === 'loading' && gallery.items.length === 0);
  const empty =
    !loading &&
    gallery.status !== 'error' &&
    photos.length === 0 &&
    Math.max(project?.itemCount ?? 0, gallery.items.length) === 0;
  const banner = montages.items.length > 0;
  const top = insets.top + space.s2 + 44 + (banner ? card + space.s2 * 2 + 2 : 0) + space.s2;
  const edge = insets.top + space.s2 + 44 + space.s2;
  const bottom = insets.bottom + 76;
  const toggle = (id: string) => {
    selection.toggle(id);
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
  const selectDuplicates = () => {
    selection.replace(nearDuplicateExtras(visibleItems));
  };
  const chosen = () => gallery.items.filter((item) => selection.has(item.id));
  const saveSelected = async () => {
    const items = chosen();
    if (items.length === 0) return;
    const result = await saveItemsToPhone(items);
    selection.clear();
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
        selection.clear();
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
    selection.clear();
    setSelecting(false);
  };
  const pick = () => router.navigate({ pathname: '/project/[id]/pick', params: { id: projectId } });
  const create = () =>
    router.navigate({ pathname: '/project/[id]/new-montage', params: { id: projectId } });
  const canCreate = canCreateMontage(project);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null && !selecting }} />
      <View style={styles.root}>
        <GalleryScreen
          photos={photos}
          viewerPhotos={viewerPhotos}
          viewer={open}
          onOpen={(index, rect) => {
            const photo = photos[index];
            if (!photo) return;
            if (photo.upload?.failed) {
              retryUpload(photo.id);
              return;
            }
            setOpen({ index, rect });
          }}
          onClose={() => setOpen(null)}
          onIndex={onViewerIndex}
          measureRef={measureTile}
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
          onLoadMore={() => void loadMoreGallery(projectId)}
          padding={{ top: edge, bottom }}
          selection={selection}
          hud={{
            primary: {
              kind: 'single',
              label: canCreate ? t('montage.create') : t('project.add'),
              onPress: canCreate ? create : pick,
            },
            canSelect: true,
            onSelectingChange: (next) => {
              setSelecting(next);
              if (!next) {
                selection.clear();
                setLabelMode(false);
                setLabelMenu(false);
              }
            },
            filters,
            onFiltersChange: setFilters,
            labels: labels.labels,
            members: members.members,
            bottom: insets.bottom + space.s3,
            selectionTools: (
              <>
                <IconButton
                  icon={CopySlash}
                  label={t('action.removeDuplicates')}
                  tone="surface"
                  size={52}
                  onPress={selectDuplicates}
                />
                <IconButton
                  icon={Tag}
                  label={t('labels.title')}
                  tone="surface"
                  size={52}
                  on={labelMode}
                  disabled={labels.labels.length === 0}
                  onPress={toggleLabels}
                />
              </>
            ),
            renderSelectionActions: (progress) =>
              labelMode ? null : (
                <SelectionActions
                  progress={progress}
                  bottom={insets.bottom + space.s3 + 52 + space.s2}
                  onSave={saveSelected}
                  onDelete={deleteSelected}
                  onShare={shareSelected}
                />
              ),
          }}
          author={account?.name ?? undefined}
          authorAvatarUrl={avatar.url}
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
          info={mediaInfo}
          header={
            <>
              <BlurBar edge="top">
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
              {failed.length > 2 ? (
                <NoticeBanner
                  top={top}
                  text={t('project.uploadsFailed', { count: failed.length })}
                  actions={[
                    {
                      label: t('project.cancelUploads'),
                      onPress: () => void removeProjectUploads(projectId),
                    },
                    {
                      label: t('project.retryUploads'),
                      onPress: () => {
                        for (const upload of failed) retryUpload(upload.localId);
                      },
                    },
                  ]}
                />
              ) : null}
              {selecting ? (
                <SelectionBar
                  top={insets.top + 52}
                  labelMode={labelMode}
                  activeLabel={activeLabel}
                  selectedCount={selection.ids.size}
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
            </>
          }
          loading={loading ? <GallerySkeleton top={top} bottom={bottom} /> : undefined}
          empty={
            gallery.status === 'error' ? (
              <LoadError onRetry={() => void loadGallery(projectId, true)} />
            ) : (
              <>
                <View style={[styles.emptyFill, { paddingTop: top, paddingBottom: bottom }]} />
                {empty ? <ScreenLogoButton label={t('project.add')} onPress={pick} /> : null}
              </>
            )
          }
        />
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
