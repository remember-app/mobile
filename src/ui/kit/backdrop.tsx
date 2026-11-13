import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';

import type { ProjectId } from '@/types/id';
import { useGallery, useMovies, useProjects } from '@/ui/hooks';
import { useTheme } from '@/ui/theme';

import { wallpaperFor } from './wallpaper';

export function Backdrop() {
  const { name } = useTheme();
  const pathname = usePathname();
  const projects = useProjects();
  const [, section, id] = pathname.split('/');
  const projectId = section === 'project' && id ? (id as ProjectId) : undefined;
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);

  if (name !== 'dark') return null;

  return (
    <Image
      source={wallpaperFor(pathname, projects.cards, movies.items, gallery.items.length)}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory"
      allowDownscaling={false}
      pointerEvents="none"
    />
  );
}
