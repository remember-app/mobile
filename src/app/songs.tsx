import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Music, Pause, Play, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  createOwnSong,
  currentToken,
  deleteOwnSong,
  loadOwnSongs,
  pickFiles,
  songUrl,
  updateOwnSong,
  uploadFileOnce,
} from '@/functionality';
import type { Song } from '@/models';
import type { MediaId, SongId } from '@/types/id';
import { SwipeRow } from '@/ui/components/swipe-row';
import { useOwnSongs } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/bars';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button, IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Field } from '@/ui/kit/field';
import { Image } from '@/ui/kit/image';
import { Text } from '@/ui/kit/text';
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

const token = (): string => {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
};

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
  const [source, setSource] = useState<string | null>(null);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<SongId | null>(null);

  useEffect(() => {
    void loadOwnSongs().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (playingId !== null && status.isLoaded) player.play();
  }, [playingId, status.isLoaded, player]);

  useEffect(() => {
    if (status.didJustFinish) setPlayingId(null);
  }, [status.didJustFinish]);

  const close = () => {
    setSheetOpen(false);
    setDraft(null);
    setUploading(false);
    setCoverBusy(false);
    setSaving(false);
    setError(null);
  };

  const uploadAudio = async (file: { uri: string; fileName: string }) => {
    setError(null);
    setUploading(true);
    try {
      const mediaId = await uploadFileOnce(token(), 'audio', file.uri, file.fileName);
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

  const toggle = async (song: Song) => {
    if (playingId === song.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = await songUrl(song.id);
      if (source === url) {
        void player.seekTo(0);
        setPlayingId(song.id);
        return;
      }
      setSource(url);
      setPlayingId(song.id);
    } catch {
      setPlayingId(null);
    }
  };

  const remove = (song: Song) => {
    void deleteOwnSong(song.id).catch(() => undefined);
  };

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setError(null);
    setCoverBusy(true);
    try {
      const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
      const mediaId = await uploadFileOnce(
        token(),
        'photo',
        asset.uri,
        asset.fileName ?? `cover.${extension}`,
      );
      setDraft((current) =>
        current === null ? current : { ...current, coverId: mediaId, coverUri: asset.uri },
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
    <Board
      body={pageBody}
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
      {songs.items.length > 0 ? (
        <Card clip>
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
                <IconButton
                  icon={playingId === song.id ? Pause : Play}
                  label={playingId === song.id ? t('songs.pause') : t('songs.play')}
                  tone="ghost"
                  size={40}
                  glyph={{ size: 18, filled: true }}
                  onPress={() => void toggle(song)}
                />
              </Pressable>
            </SwipeRow>
          ))}
        </Card>
      ) : null}

      <BottomSheet
        visible={sheetOpen}
        onClose={close}
        title={draft?.id ? t('songs.edit') : t('songs.add')}
      >
        {uploading ? (
          <View style={styles.uploading}>
            <CircularSpinner size={20} />
            <Text role="row" tone="muted">
              {t('songs.uploading')}
            </Text>
          </View>
        ) : draft ? (
          <>
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
              <View
                pointerEvents="none"
                style={[
                  styles.coverBadge,
                  { backgroundColor: color.paper, borderColor: color.surface },
                ]}
              >
                {coverBusy ? <CircularSpinner size={14} /> : <Camera size={14} color={color.ink} />}
              </View>
            </Pressable>
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
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
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
    form: {
      gap: space.s4,
    },
    coverEdit: {
      alignSelf: 'center',
      position: 'relative',
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
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
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
