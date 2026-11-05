import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoGrid, type Rect } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { Text } from '@/ui/kit/text';
import { mockPhotos } from '@/ui/mocks/photos';
import { MOCK_PROJECTS } from '@/ui/mocks/projects';
import { space, useTheme } from '@/ui/theme';

export default function ProjectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = MOCK_PROJECTS.find((entry) => entry.project.id === id);
  const [columns, setColumns] = useState(3);
  const [open, setOpen] = useState<{ index: number; rect?: Rect } | null>(null);
  const photos = useMemo(() => mockPhotos(64).reverse(), []);

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
    <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
      <PhotoGrid
        photos={photos}
        columns={columns}
        onColumns={setColumns}
        onOpen={(index, rect) => setOpen({ index, rect })}
        padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
        startAtEnd
      />
      <BlurBar edge="top" style={styles.top}>
        <BackButton label="Назад" onPress={() => router.back()} />
        <Text role="barTitle" numberOfLines={1} style={styles.title}>
          {project.project.title}
        </Text>
        <IconButton
          icon={Users}
          label="Участники"
          tone="surface"
          size={40}
          onPress={() => undefined}
        />
      </BlurBar>
      <View
        pointerEvents="box-none"
        style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
      >
        <Button label="Добавить" variant="primary" icon={Plus} onPress={() => undefined} />
      </View>
      {open === null ? null : (
        <PhotoViewer
          photos={photos}
          initialIndex={open.index}
          origin={open.rect}
          onClose={() => setOpen(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    minHeight: 44,
  },
  title: {
    flex: 1,
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
