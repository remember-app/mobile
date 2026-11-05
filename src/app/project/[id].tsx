import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PhotoGrid } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { ActionBar, AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';
import { mockPhotos } from '@/ui/mocks/photos';
import { MOCK_PROJECTS } from '@/ui/mocks/projects';
import { useTheme } from '@/ui/theme';

export default function ProjectScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = MOCK_PROJECTS.find((entry) => entry.project.id === id);
  const [columns, setColumns] = useState(3);
  const [open, setOpen] = useState<number | null>(null);
  const photos = mockPhotos(64);

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
      <Board
        bar={
          <AppBar
            title={project.project.title}
            left={<BackButton label="Назад" onPress={() => router.back()} />}
            right={
              <IconButton icon={Users} label="Участники" tone="surface" onPress={() => undefined} />
            }
          />
        }
        footer={
          <ActionBar>
            <Button label="Добавить" variant="primary" icon={Plus} onPress={() => undefined} />
          </ActionBar>
        }
        list={() => (
          <PhotoGrid photos={photos} columns={columns} onColumns={setColumns} onOpen={setOpen} />
        )}
      />
      {open === null ? null : (
        <PhotoViewer photos={photos} initialIndex={open} onClose={() => setOpen(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
