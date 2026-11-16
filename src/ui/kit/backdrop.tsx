import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { ProjectId } from '@/types/id';
import { useGallery, useMovies, useProjects } from '@/ui/hooks';
import { useTheme } from '@/ui/theme';

import { wallpaperFor } from './wallpaper';

const CANVAS_W = 2160;
const CANVAS_H = 4680;
const LOGO_BOX = 800;

/**
 * Фон конкретного экрана: лежит внутри экрана, поэтому при переходе уезжает
 * вместе с ним, а не меняется под ним.
 */
export function ScreenSkin({
  routeName,
  projectId,
  children,
}: {
  routeName: string;
  projectId?: ProjectId;
  children: ReactNode;
}) {
  const { name } = useTheme();
  const projects = useProjects();
  const { width, height } = useWindowDimensions();
  const movies = useMovies(projectId);
  const gallery = useGallery(projectId);
  const { base, state } = wallpaperFor(
    routeName,
    projectId,
    projects.cards,
    movies.items,
    gallery.items.length,
  );
  // логотип занимает ту же долю полотна, что и на запечённых фонах
  const logo = LOGO_BOX * Math.max(width / CANVAS_W, height / CANVAS_H);

  return (
    <View style={styles.skin}>
      {name === 'dark' && base !== null ? (
        <Image
          source={base}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory"
          allowDownscaling={false}
          pointerEvents="none"
        />
      ) : null}
      {name === 'dark' && state !== null ? (
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
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  skin: { flex: 1 },
});
