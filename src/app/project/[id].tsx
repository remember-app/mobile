import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Users } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaInfo } from '@/ui/components/media/info/media-info';
import { type MeasureTile, PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { UploadSheet } from '@/ui/components/upload-sheet';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { mockPhotoMeta } from '@/ui/mocks/media-info';
import { mockPhotos } from '@/ui/mocks/photos';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { projectsState, subscribeProjects } from '@/ui/mocks/projects';
import { subscribeUploads, uploadsOf } from '@/ui/mocks/uploads';
import { space, useTheme } from '@/ui/theme';

export default function ProjectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projects = useSyncExternalStore(subscribeProjects, projectsState);
  const project = projects.find((entry) => entry.project.id === id);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const measureTile = useRef<MeasureTile | null>(null);
  const getUploads = useCallback(() => uploadsOf(id), [id]);
  const uploads = useSyncExternalStore(subscribeUploads, getUploads);
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const seeded = !id.startsWith('project-');
  const shots = useMemo(
    () =>
      seeded
        ? mockPhotos(64)
            .reverse()
            .filter((photo) => !removed.has(photo.id))
        : [],
    [removed, seeded],
  );
  const upload = uploads.find((entry) => entry.id === uploadId) ?? null;
  const photos = useMemo(() => {
    const base = [
      ...uploads.map((entry) => ({
        id: entry.id,
        source: entry.source,
        video: entry.video,
        assetId: entry.assetId ?? undefined,
        width: entry.width ?? undefined,
        height: entry.height ?? undefined,
        upload:
          entry.status === 'done'
            ? undefined
            : { progress: entry.progress, failed: entry.status === 'failed' },
      })),
      ...shots,
    ];
    return base.map((photo, index) => ({
      ...photo,
      capturedAt: mockPhotoMeta(photo, index).capturedAt,
    }));
  }, [shots, uploads]);

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            title={t('project.title')}
            left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title={t('project.notFound')} />
      </Board>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
      <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
        {photos.length === 0 ? (
          <View
            style={[
              styles.emptyFill,
              { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 76 },
            ]}
          >
            <Empty
              sign="dashed"
              icon={Camera}
              title={t('project.emptyTitle')}
              text={t('project.emptyText')}
            />
          </View>
        ) : (
          <PhotoGrid
            photos={photos}
            onOpen={(index, rect) => {
              if (photos[index]?.upload) {
                setUploadId(photos[index]?.id ?? null);
                return;
              }
              setOpen({ index, rect });
            }}
            padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
            blankIndex={open?.index ?? null}
            measureRef={measureTile}
            endKey={uploads[0]?.id}
          />
        )}
        <BlurBar edge="top" style={styles.top}>
          <BackButton label={t('action.back')} size={52} onPress={() => router.back()} />
          <Text
            role="barTitle"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={styles.title}
          >
            {project.project.title}
          </Text>
          <IconButton
            icon={Users}
            label={t('project.members')}
            tone="ghost"
            size={52}
            onPress={() =>
              router.navigate({
                pathname: '/project/[id]/info',
                params: { id: project.project.id },
              })
            }
          />
        </BlurBar>
        <View
          pointerEvents="box-none"
          style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
        >
          <Button
            label={t('project.add')}
            variant="primary"
            onPress={() =>
              router.navigate({
                pathname: '/project/[id]/pick',
                params: { id: project.project.id },
              })
            }
          />
        </View>
        <UploadSheet
          projectId={project.project.id}
          upload={upload}
          onClose={() => setUploadId(null)}
        />
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
            author={profile.name}
            onDelete={(photo) => {
              setRemoved((was) => new Set(was).add(photo.id));
              setOpen(null);
            }}
            renderInfo={(index) => {
              const photo = photos[index];
              return photo ? (
                <MediaInfo key={photo.id} photoId={photo.id} meta={mockPhotoMeta(photo, index)} />
              ) : null;
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    minHeight: 52,
  },
  title: {
    flex: 1,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
  },
});
