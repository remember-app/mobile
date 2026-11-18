import { Camera, Clipboard, Music, Pause, Play, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  createOwnSong,
  deleteOwnSong,
  loadOwnSongs,
  pickFiles,
  rememberSongDuration,
  requireToken,
  updateOwnSong,
  uploadFileOnce,
} from '@/functionality';
import { pickImage } from '@/integrations/media-library/pick-image';
import type { Song } from '@/models';
import type { MediaId, SongId } from '@/types/id';
import { LinkBanner, useLinkImage } from '@/ui/components/common/link-image';
import { SwipeRow } from '@/ui/components/common/swipe-row';
import { LoadError } from '@/ui/components/feedback/load-error';
import { MiniPlayer, useSongPlayer } from '@/ui/components/music/song-player';
import { confirmAction } from '@/ui/confirm';
import { duration as clock } from '@/ui/format';
import { useOwnSongs } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { BottomSheet } from '@/ui/kit/chrome/bottom-sheet';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { Field } from '@/ui/kit/controls/field';
import { CircularSpinner } from '@/ui/kit/display/circular-spinner';
import { Card } from '@/ui/kit/primitives/card';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar } from '@/ui/screens/chrome';
import { radius, space, themed, useTheme } from '@/ui/theme';

type Draft = {
  id: SongId | null;
  mediaId: MediaId | null;
  audioUri: string | null;
  name: string;
  author: string;
  coverId: MediaId | null;
  coverUri: string | null;
};

const baseName = (fileName: string): string => fileName.replace(/\.[^.]+$/, '') || fileName;

export default function SongsScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const songs = useOwnSongs();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useSongPlayer({ onDuration: rememberSongDuration });
  const link = useLinkImage((mediaId, uri) =>
    setDraft((current) => (current ? { ...current, coverId: mediaId, coverUri: uri } : current)),
  );

  useEffect(() => {
    void loadOwnSongs().catch(() => undefined);
  }, []);

  const close = () => {
    setSheetOpen(false);
    setDraft(null);
    setUploading(false);
    setCoverBusy(false);
    setSaving(false);
    setError(null);
    link.clear();
  };

  const uploadAudio = async (file: { uri: string; fileName: string }) => {
    setError(null);
    setUploading(true);
    try {
      const mediaId = await uploadFileOnce(requireToken(), 'audio', file.uri, file.fileName);
      setDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              mediaId,
              audioUri: file.uri,
              name: current.name || baseName(file.fileName),
            },
      );
    } catch {
      setError(t('songs.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    setError(null);
    let file: Awaited<ReturnType<typeof pickFiles>>[number] | undefined;
    try {
      [file] = await pickFiles();
    } catch {
      return;
    }
    if (!file) return;
    setDraft({
      id: null,
      mediaId: null,
      audioUri: null,
      name: baseName(file.fileName),
      author: '',
      coverId: null,
      coverUri: null,
    });
    setSheetOpen(true);
    await uploadAudio(file);
  };

  const open = (song: Song) => {
    setError(null);
    setSheetOpen(true);
    setDraft({
      id: song.id,
      mediaId: song.mediaId,
      audioUri: null,
      name: song.name,
      author: song.author ?? '',
      coverId: song.coverId,
      coverUri: song.coverUrl,
    });
  };

  const remove = (song: Song) => {
    confirmAction({
      confirm: t('action.delete'),
      destructive: true,
      onConfirm: () => void deleteOwnSong(song.id).catch(() => undefined),
    });
  };

  const pickCover = async () => {
    const image = await pickImage('cover');
    if (!image) return;
    setError(null);
    setCoverBusy(true);
    try {
      const mediaId = await uploadFileOnce(requireToken(), 'photo', image.uri, image.fileName);
      setDraft((current) =>
        current === null ? current : { ...current, coverId: mediaId, coverUri: image.uri },
      );
    } catch {
      setError(t('songs.uploadFailed'));
    } finally {
      setCoverBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const author = draft.author.trim() || null;
    if (!name) return;
    setError(null);
    setSaving(true);
    try {
      if (draft.id !== null) {
        await updateOwnSong(draft.id, { name, author, coverId: draft.coverId });
      } else if (draft.mediaId !== null) {
        await createOwnSong({ name, author, mediaId: draft.mediaId, coverId: draft.coverId });
      } else {
        return;
      }
      close();
    } catch {
      setError(t('songs.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    draft !== null &&
    draft.name.trim().length > 0 &&
    !saving &&
    !coverBusy &&
    (draft.id !== null || draft.mediaId !== null);

  return (
    <View style={styles.root}>
      <Board
        body={player.song ? [pageBody, styles.bodyLifted] : pageBody}
        bar={
          <BackBar
            title={t('songs.title')}
            right={
              <IconButton
                icon={Plus}
                label={t('songs.add')}
                tone="surface"
                size={44}
                onPress={() => void add()}
              />
            }
          />
        }
      >
        {songs.status === 'error' && songs.items.length === 0 ? (
          <LoadError onRetry={() => void loadOwnSongs(true)} />
        ) : songs.items.length > 0 ? (
          <Card clip style={styles.card}>
            <View style={styles.list}>
              {songs.items.map((song) => (
                <SwipeRow key={song.id} tone="danger" icon={Trash2} onAction={() => remove(song)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={song.name}
                    onPress={() => open(song)}
                    style={styles.row}
                  >
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
                      <Text role="meta" tone="muted" numberOfLines={1}>
                        {song.author}
                      </Text>
                    </View>
                    {song.duration != null && Number.isFinite(song.duration) ? (
                      <Text role="meta" tone="muted">
                        {clock(song.duration)}
                      </Text>
                    ) : null}
                    {player.song?.id === song.id && player.loading ? (
                      <View style={styles.spinner}>
                        <CircularSpinner size={18} />
                      </View>
                    ) : (
                      <IconButton
                        icon={player.song?.id === song.id && player.playing ? Pause : Play}
                        label={
                          player.song?.id === song.id && player.playing
                            ? t('songs.pause')
                            : t('songs.play')
                        }
                        tone="ghost"
                        size={40}
                        glyph={{ size: 18, filled: true }}
                        onPress={() => void player.play(song)}
                      />
                    )}
                  </Pressable>
                </SwipeRow>
              ))}
            </View>
          </Card>
        ) : null}

        <BottomSheet visible={sheetOpen} onClose={close}>
          {uploading ? (
            <View style={styles.uploading}>
              <CircularSpinner size={20} />
              <Text role="row" tone="muted">
                {t('songs.uploading')}
              </Text>
            </View>
          ) : draft ? (
            <>
              {link.failed !== null ? <LinkBanner link={link.failed} /> : null}
              <View style={styles.coverWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('songs.changeCover')}
                  onPress={() => void pickCover()}
                  style={styles.coverEdit}
                >
                  {draft.coverUri ? (
                    <Image
                      source={draft.coverUri}
                      scope="music"
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Music size={28} color={color.muted} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('songs.changeCover')}
                  onPress={() => void pickCover()}
                  style={[
                    styles.coverBadge,
                    styles.coverBadgeRight,
                    { backgroundColor: color.paper, borderColor: color.surface },
                  ]}
                >
                  {coverBusy ? (
                    <CircularSpinner size={14} />
                  ) : (
                    <Camera size={14} color={color.ink} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('songs.pasteImage')}
                  onPress={() => void link.paste()}
                  style={[
                    styles.coverBadge,
                    styles.coverBadgeLeft,
                    { backgroundColor: color.paper, borderColor: color.surface },
                  ]}
                >
                  {link.busy ? (
                    <CircularSpinner size={14} />
                  ) : (
                    <Clipboard size={14} color={color.ink} />
                  )}
                </Pressable>
              </View>
              <View style={styles.form}>
                <Field
                  label={t('songs.name')}
                  value={draft.name}
                  onChangeText={(name) =>
                    setDraft((current) => (current ? { ...current, name } : current))
                  }
                  placeholder={t('songs.name')}
                  autoCapitalize="sentences"
                />
                <Field
                  label={t('songs.author')}
                  value={draft.author}
                  onChangeText={(author) =>
                    setDraft((current) => (current ? { ...current, author } : current))
                  }
                  placeholder={t('songs.author')}
                  autoCapitalize="words"
                />
                {error ? (
                  <Text role="meta" tone="danger">
                    {error}
                  </Text>
                ) : null}
                <Button
                  label={t('action.save')}
                  variant="primary"
                  disabled={!canSave}
                  onPress={() => void save()}
                />
              </View>
            </>
          ) : null}
        </BottomSheet>
      </Board>

      <MiniPlayer player={player} />
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    bodyLifted: {
      paddingBottom: 120,
    },
    card: {
      padding: space.s4,
    },
    list: {
      gap: space.s2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      backgroundColor: color.surface,
    },
    art: {
      width: 44,
      height: 44,
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
    spinner: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      gap: space.s4,
    },
    coverWrap: {
      alignSelf: 'center',
      position: 'relative',
      width: 72,
      height: 72,
    },
    coverEdit: {
      width: 72,
      height: 72,
      borderRadius: radius.cell,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    coverBadge: {
      position: 'absolute',
      bottom: -6,
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverBadgeRight: {
      right: -6,
    },
    coverBadgeLeft: {
      left: -6,
    },
    uploading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s5,
      justifyContent: 'center',
    },
  }),
);
