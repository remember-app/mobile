import { Check, Music, Pause, Play, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  attachProjectSong,
  detachProjectSong,
  loadOwnSongs,
  loadProjectSongs,
} from '@/functionality';
import type { Song } from '@/models';
import type { ProjectId } from '@/types/id';
import { SwipeRow } from '@/ui/components/common/swipe-row';
import type { SongPlayer } from '@/ui/components/music/song-player';
import { confirmAction } from '@/ui/confirm';
import { useOwnSongs, useProjectSongs } from '@/ui/hooks';
import { BottomSheet } from '@/ui/kit/chrome/bottom-sheet';
import { IconButton } from '@/ui/kit/controls/button';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { AddRow } from '@/ui/kit/primitives/bits';
import { Card } from '@/ui/kit/primitives/card';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export function ProjectMusic({ projectId, player }: { projectId: ProjectId; player: SongPlayer }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const project = useProjectSongs(projectId);
  const own = useOwnSongs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadProjectSongs(projectId).catch(() => undefined);
    void loadOwnSongs().catch(() => undefined);
  }, [projectId]);

  useEffect(() => {
    if (open) void loadOwnSongs().catch(() => undefined);
  }, [open]);

  const attached = new Set(project.items.map((song) => song.id));

  const toggle = (song: Song) => {
    if (attached.has(song.id)) {
      void detachProjectSong(projectId, song.id).catch(() => undefined);
    } else {
      void attachProjectSong(projectId, song.id).catch(() => undefined);
    }
  };

  return (
    <>
      <Card clip>
        <AddRow label={t('music.add')} onPress={() => setOpen(true)} />
        {project.items.length === 0
          ? null
          : project.items.map((song) => (
              <SwipeRow
                key={song.id}
                tone="danger"
                icon={Trash2}
                onAction={() =>
                  confirmAction({
                    confirm: t('action.delete'),
                    destructive: true,
                    onConfirm: () =>
                      void detachProjectSong(projectId, song.id).catch(() => undefined),
                  })
                }
              >
                <Row song={song} player={player} />
              </SwipeRow>
            ))}
      </Card>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        {own.items.length === 0 ? null : (
          <View style={styles.sheetList}>
            {own.items.map((song) => (
              <Pressable
                key={song.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: attached.has(song.id) }}
                accessibilityLabel={song.name}
                onPress={() => toggle(song)}
              >
                <Row song={song} checked={attached.has(song.id)} />
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </>
  );
}

function Row({ song, checked, player }: { song: Song; checked?: boolean; player?: SongPlayer }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const current = player !== undefined && player.song?.id === song.id;
  return (
    <View style={styles.row}>
      <View style={styles.slot}>
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
      <View style={styles.slot}>
        {player ? (
          current && player.loading ? (
            <View style={styles.spinner}>
              <CircularSpinner size={18} />
            </View>
          ) : (
            <IconButton
              icon={current && player.playing ? Pause : Play}
              label={current && player.playing ? t('songs.pause') : t('songs.play')}
              tone="ghost"
              size={40}
              glyph={{ size: 18, filled: true }}
              onPress={() => void player.play(song)}
            />
          )
        ) : null}
        {checked === undefined ? null : (
          <View
            style={[
              styles.check,
              {
                borderColor: checked ? color.accent : color.line,
                backgroundColor: checked ? color.accent : 'transparent',
              },
            ]}
          >
            {checked ? <Check size={16} color={color.onFill} /> : null}
          </View>
        )}
      </View>
    </View>
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
    slot: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
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
    check: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spinner: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetList: {
      marginHorizontal: -space.s5,
      marginBottom: -space.s6,
    },
  }),
);
