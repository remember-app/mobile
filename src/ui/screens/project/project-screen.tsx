import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CopySlash } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cachedDetail,
  downloadItems,
  keepVariant,
  loadGallery,
  loadItem,
  loadLabels,
  loadMembers,
  loadMontages,
  loadMoreGallery,
  loadMovies,
  loadProjects,
  localPlaybackOf,
  localPreviewOf,
  nearDuplicateExtras,
  onUploaded,
  previewLink,
  progressOf,
  refreshGalleryAll,
  refreshItem,
  removeItem,
  removeItems,
  removeProjectUploads,
  removeUpload,
  retryUpload,
  saveItemsToPhone,
  shareItem,
  shareText,
} from '@/functionality';
import { canCreateMontage, displayName, itemDate } from '@/models';
import type { ProjectId, ProjectItemId } from '@/types/id';
import { goBack } from '@/ui/back';
import { LoadError } from '@/ui/components/feedback/load-error';
import { GallerySkeleton } from '@/ui/components/feedback/skeletons';
import { filterItems } from '@/ui/components/gallery/gallery-filters';
import { SelectionActions } from '@/ui/components/gallery/selection-actions';
import { SelectionBar } from '@/ui/components/gallery/selection-bar';
import { useGalleryFilters } from '@/ui/components/gallery/use-gallery-filters';
import { GalleryScreen } from '@/ui/components/media/gallery-screen';
import { useGalleryViewer } from '@/ui/components/media/gallery-viewer';
import { useMediaInfo } from '@/ui/components/media/info/media-info';
import type { Photo } from '@/ui/components/media/photo-grid';
import { tileOf } from '@/ui/components/media/photo-item';
import { useViewerMedia } from '@/ui/components/media/use-viewer-media';
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
  const [duplicatesOn, setDuplicatesOn] = useState(false);
  const { filters, setFilters } = useGalleryFilters();
  const [details, setDetails] = useState<Record<string, string>>({});
  const selection = useGallerySelection<string>();
  const card = (width - space.s4 * 2 - space.s2 * 4) / 3;

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
        viewerSource: previewLink(item, 'middle') ?? previewLink(item, 'small'),
        detail: item.kind === 'photo' ? (details[item.id] ?? cachedDetail(item)) : null,
        playbackUrl: item.kind === 'video' ? (localPlaybackOf(item.id) ?? null) : null,
        selected: selecting ? selection.has(item.id) : undefined,
        author:
          filters.uploaderIds.length > 0
            ? displayName(item.uploader?.name, item.uploader?.username) || null
            : null,
        authorAvatarUrl: filters.uploaderIds.length > 0 ? (item.uploader?.avatarUrl ?? null) : null,
        labelColors:
          filters.labelIds.length > 0
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
        detail: null,
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
  }, [filters, gallery.items, details, visibleItems, labels.labels, pending, selecting, selection]);

  const viewerPhotos = useMemo<Photo[]>(
    () =>
      photos.map((photo) => ({
        ...photo,
        source: photo.viewerSource ?? photo.preview ?? photo.source,
      })),
    [photos],
  );

  const resolvedViewerPhotos = useViewerMedia(viewerPhotos, open?.index);

  const showDetail = (photo: { id: string }) => {
    const item = gallery.items.find((candidate) => candidate.id === photo.id);
    if (!item || item.kind !== 'photo') return;
    void keepVariant(item, 'detail').then((local) => {
      if (local) setDetails((was) => ({ ...was, [photo.id]: local }));
    });
  };

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
  const duplicateIds = nearDuplicateExtras(visibleItems);
  const allSelected =
    gallery.items.length > 0 && gallery.items.every((item) => selection.has(item.id));

  const toggleDuplicates = () => {
    if (duplicatesOn) {
      setDuplicatesOn(false);
      selection.clear();
      return;
    }
    setDuplicatesOn(true);
    selection.replace(duplicateIds);
  };
  const toggleAll = () => {
    setDuplicatesOn(false);
    if (allSelected) {
      selection.clear();
      return;
    }
    void refreshGalleryAll(projectId).then((items) => {
      selection.replace(items.map((item) => item.id));
    });
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
      const issued = await downloadItems(
        projectId,
        items.map((item) => item.id),
      );
      const links = issued.map((link) => link.url);
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
          viewerPhotos={resolvedViewerPhotos}
          viewer={open}
          onOpen={async (index, rect) => {
            const photo = photos[index];
            if (!photo) return;
            if (photo.upload?.failed) {
              retryUpload(photo.id);
              return;
            }
            if (
              photo.video &&
              photo.upload === undefined &&
              localPlaybackOf(photo.id) === undefined
            ) {
              await refreshItem(projectId, photo.id as ProjectItemId).catch(() => undefined);
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
            rightButtons: 3,
            canSelect: true,
            onSelectingChange: (next) => {
              setSelecting(next);
              if (!next) {
                selection.clear();
                setDuplicatesOn(false);
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
                  icon={Check}
                  label={t('picker.selectAll')}
                  tone="surface"
                  size={52}
                  on={allSelected}
                  onPress={toggleAll}
                />
                <IconButton
                  icon={CopySlash}
                  label={t('action.removeDuplicates')}
                  tone="surface"
                  size={52}
                  on={duplicatesOn}
                  onPress={toggleDuplicates}
                />
              </>
            ),
            renderSelectionActions: (progress) => (
              <SelectionActions
                progress={progress}
                bottom={insets.bottom + space.s3 + 52 + space.s2}
                onSave={saveSelected}
                onDelete={deleteSelected}
                onShare={shareSelected}
              />
            ),
          }}
          author={displayName(account?.name, account?.username) || undefined}
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
          onDetail={showDetail}
          info={mediaInfo}
          header={(chrome) => (
            <>
              <BlurBar edge="top">
                <ProjectHeader
                  projectId={projectId}
                  title={title}
                  card={card}
                  progress={chrome}
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
                <SelectionBar top={insets.top + 52} selectedCount={selection.ids.size} />
              ) : null}
            </>
          )}
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
