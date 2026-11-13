import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { ProjectId } from '@/types/id';
import { useGallery, useMovies, useProjects } from '@/ui/hooks';
import { useTheme } from '@/ui/theme';

import { wallpaperFor } from './wallpaper';

const CANVAS_W = 2160;
const CANVAS_H = 4680;
const LOGO_BOX = 800;

export function Backdrop() {
  const { name } = useTheme();
  const pathname = usePathname();
  const projects = useProjects();
  const { width, height } = useWindowDimensions();
  const [, section, id] = pathname.split('/');
  const projectId = section === 'project' && id ? (id as ProjectId) : undefined;
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);

  if (name !== 'dark') return null;

  const { base, state } = wallpaperFor(
    pathname,
    projects.cards,
    movies.items,
    gallery.items.length,
  );
  // логотип занимает ту же долю полотна, что и на запечённых фонах
  const logo = LOGO_BOX * Math.max(width / CANVAS_W, height / CANVAS_H);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={base}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory"
        allowDownscaling={false}
      />
      {state === null ? null : (
        <Image
          source={state}
          style={{
            position: 'absolute',
            left: (width - logo) / 2,
            top: (height - logo) / 2,
            width: logo,
            height: logo,
          }}
          contentFit="contain"
          cachePolicy="memory"
        />
      )}
    </View>
  );
}
