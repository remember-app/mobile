import { useLocalSearchParams } from 'expo-router';
import { Check, Music } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loadLibrarySongs, loadMovies, loadProjectSongs } from '@/functionality';
import { songPool } from '@/models';
import type { ProjectId } from '@/types/id';
import { useLibrarySongs, useMovies, useProjectSongs } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { Card } from '@/ui/kit/primitives/card';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar } from '@/ui/screens/chrome';
import { radius, space, themed, useTheme } from '@/ui/theme';

export default function MovieMusicScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const { id, movieId } = useLocalSearchParams<{ id: string; movieId: string }>();
  const projectId = id as ProjectId;
  const movies = useMovies(projectId);
  const songs = useProjectSongs(projectId);
  const library = useLibrarySongs();
  const movie = movies.items.find((entry) => entry.id === movieId);
  const used = new Set(movie?.montage?.manifest.preparationConfig?.musicIds ?? []);
  const pool = useMemo(() => songPool(songs.items, library.items), [songs.items, library.items]);

  useEffect(() => {
    void loadMovies(projectId);
    void loadProjectSongs(projectId).catch(() => undefined);
    void loadLibrarySongs().catch(() => undefined);
  }, [projectId]);

  return (
    <Board bar={<BackBar title={t('montage.order.musicTitle')} />} body={pageBody}>
      {pool.length === 0 ? null : (
        <Card clip>
          {pool.map((song) => (
            <View key={song.id} style={styles.row}>
              <View style={styles.art}>
                {song.coverUrl ? (
                  <Image
                    source={song.coverUrl}
                    scope="music"
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Music size={18} color={color.muted} />
                )}
              </View>
              <View style={styles.words}>
                <Text role="row" numberOfLines={1}>
                  {song.name}
                </Text>
                {song.author ? (
                  <Text role="meta" tone="muted" numberOfLines={1}>
                    {song.author}
                  </Text>
                ) : null}
              </View>
              {used.has(song.originalId) ? <Check size={18} color={color.accent} /> : null}
            </View>
          ))}
        </Card>
      )}
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
    },
    art: {
      width: 40,
      height: 40,
      borderRadius: radius.queue,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    words: {
      flex: 1,
      gap: 2,
    },
  }),
);
