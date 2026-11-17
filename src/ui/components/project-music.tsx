import { Check, Music, Trash2 } from 'lucide-react-native';
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
import { SwipeRow } from '@/ui/components/swipe-row';
import { useOwnSongs, useProjectSongs } from '@/ui/hooks';
import { Rows } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Card } from '@/ui/kit/card';
import { Image } from '@/ui/kit/image';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export function ProjectMusic({ projectId }: { projectId: ProjectId }) {
  const { t } = useTranslation();
  const { color } = useTheme();
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
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.add}>
          <Text role="row" tone="accent">
            {t('music.add')}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        {project.items.length === 0 ? (
          <Text role="noteSm" tone="muted" style={styles.empty}>
            {t('music.none')}
          </Text>
        ) : (
          <Rows items={project.items} keyOf={(song) => song.id}>
            {(song) => (
              <SwipeRow
                tone="danger"
                icon={Trash2}
                onAction={() => void detachProjectSong(projectId, song.id).catch(() => undefined)}
              >
                <Row song={song} />
              </SwipeRow>
            )}
          </Rows>
        )}
      </Card>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('music.new')}>
        {own.items.length === 0 ? (
          <Text role="noteSm" tone="muted" style={styles.empty}>
            {t('music.empty')}
          </Text>
        ) : (
          <Rows items={own.items} keyOf={(song) => song.id}>
            {(song) => (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: attached.has(song.id) }}
                accessibilityLabel={song.name}
                onPress={() => toggle(song)}
              >
                <Row song={song} checked={attached.has(song.id)} />
              </Pressable>
            )}
          </Rows>
        )}
      </BottomSheet>
    </>
  );
}

function Row({ song, checked }: { song: Song; checked?: boolean }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
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
    check: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    empty: {
      padding: space.s4,
    },
    add: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
