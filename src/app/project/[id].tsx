import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  loadGallery,
  loadMontages,
  loadMoreGallery,
  loadMovies,
  loadProjects,
  onUploaded,
  progressOf,
  removeItem,
  removeUpload,
  retryUpload,
} from '@/functionality';
import type { ProjectId, ProjectItemId } from '@/types/id';
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
import {
  useGallery,
  useMontages,
  useProjectCard,
  useProjects,
  useSession,
  useUploads,
} from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { space, useTheme } from '@/ui/theme';

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
  const montages = useMontages(projectId);
  const uploads = useUploads();
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);
  const opening = useRef(true);
  const turning = useRef<'none' | 'open' | 'close'>('none');
  const card = (width - space.s4 * 2 - space.s2 * 4) / 3;
  const progress = useSharedValue(1);

  useEffect(() => {
    void loadProjects();
    void loadGallery(projectId);
    void loadMontages(projectId, true).catch(() => undefined);
    void loadMovies(projectId, true).catch(() => undefined);
    return onUploaded((_upload, project) => {
      if (project === projectId) void loadGallery(projectId, true);
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
    const files = gallery.items.map((item) => ({
      id: item.id,
      source: item.links.thumbnail ?? item.links.preview ?? item.links.original,
      video: item.kind === 'video',
      width: item.media.dimensions?.width,
      height: item.media.dimensions?.height,
      capturedAt: item.media.capturedAt,
    }));
    const sending = pending.map((upload) => {
      const progress = progressOf(upload);
      return {
        id: upload.localId,
        source: upload.uri,
        video: upload.kind === 'video',
        upload: {
          progress: progress.total > 0 ? progress.done / progress.total : 0,
          failed: upload.status === 'failed',
        },
        capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
      };
    });
    return [...files, ...sending];
  }, [gallery.items, pending]);

  if (!project && projects.status !== 'loading') {
    return (
      <Board
        bar={
          <AppBar
            boxed
            title={t('project.title')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
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
  const scrolled = (offset: number) => {
    if (opening.current) return;
    const next = offset > 1 ? 'close' : 'open';
    if (turning.current === next) return;
    turning.current = next;
    progress.value = withTiming(next === 'close' ? 1 : 0, { duration: 260 });
  };
  const pick = () => router.navigate({ pathname: '/project/[id]/pick', params: { id: projectId } });

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
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
              if (photo?.upload?.failed) {
                retryUpload(photo.id);
                return;
              }
              setOpen({ index, rect });
            }}
            padding={{ top, bottom }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
            endKey={pending[0]?.localId}
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
            onBack={() => router.back()}
            onMembers={() =>
              router.navigate({ pathname: '/project/[id]/info', params: { id: projectId } })
            }
          />
        </BlurBar>
        <ActionBar>
          <Button label={t('project.add')} variant="primary" onPress={pick} />
        </ActionBar>
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
});
