import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { MOCK_PROJECTS } from '@/ui/mocks/projects';
import { subscribeUploads, uploadsOf } from '@/ui/mocks/uploads';
import { space, useTheme } from '@/ui/theme';

export default function ProjectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = MOCK_PROJECTS.find((entry) => entry.project.id === id);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);
  const getUploads = useCallback(() => uploadsOf(id), [id]);
  const uploads = useSyncExternalStore(subscribeUploads, getUploads);
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const shots = useMemo(() => mockPhotos(64).reverse(), []);
  const upload = uploads.find((entry) => entry.id === uploadId) ?? null;
  const photos = useMemo(
    () => [
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
    ],
    [shots, uploads],
  );

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            title="Воспоминание"
            left={<BackButton label="Назад" onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title="Воспоминание не найдено" />
      </Board>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: open === null }} />
      <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
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
        <BlurBar edge="top" style={styles.top}>
          <BackButton label="Назад" size={52} onPress={() => router.back()} />
          <Text role="barTitle" numberOfLines={1} style={styles.title}>
            {project.project.title}
          </Text>
          <IconButton
            icon={Users}
            label="Участники"
            tone="ghost"
            size={48}
            onPress={() =>
              router.push({ pathname: '/project/[id]/info', params: { id: project.project.id } })
            }
          />
        </BlurBar>
        <View
          pointerEvents="box-none"
          style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
        >
          <Button
            label="Добавить"
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
