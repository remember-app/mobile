import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronRight, Music, Pause, Play, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { confirmAction } from '@/ui/confirm';
import { useOwnSongs } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/bars';
import { Rows } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button, IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Empty } from '@/ui/kit/empty';
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
  const [uploading, setUploading] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState(false);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    void loadOwnSongs().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(false);
  }, [status.didJustFinish]);

  useEffect(() => {
    if (draft === null) {
      player.pause();
      setPlaying(false);
    }
  }, [draft, player]);

  const close = () => {
    setDraft(null);
    setUploading(false);
    setCoverBusy(false);
    setSaving(false);
    setError(null);
  };

  const chooseFile = async () => {
    setError(null);
    setUploading(true);
    try {
      const [file] = await pickFiles(['audio/*']);
      if (!file || draftRef.current === null) return;
      const mediaId = await uploadFileOnce(token(), 'audio', file.uri, file.fileName);
      setDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              mediaId,
              audioUri: file.uri,
              name: baseName(file.fileName),
            },
      );
    } catch {
      setError(t('songs.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const add = () => {
    setError(null);
    setDraft({
      id: null,
      mediaId: null,
      audioUri: null,
      name: '',
      author: '',
      coverId: null,
      coverUri: null,
    });
    // the system picker cannot be presented while the sheet is still animating in
    setTimeout(() => {
      if (draftRef.current !== null) void chooseFile();
    }, 400);
  };

  const open = (song: Song) => {
    setError(null);
    setDraft({
      id: song.id,
      mediaId: song.mediaId,
      audioUri: null,
      name: song.name,
      author: song.author,
      coverId: song.coverId,
      coverUri: song.coverUrl,
    });
  };

  const toggle = async () => {
    if (!draft) return;
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    try {
      const url = draft.audioUri ?? (draft.id === null ? null : await songUrl(draft.id));
      if (!url) return;
      player.replace(url);
      player.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
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
    const author = draft.author.trim();
    if (!name || !author) return;
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

  const remove = () => {
    if (!draft?.id) return;
    const songId = draft.id;
    confirmAction({
      title: draft.name,
      confirm: t('songs.delete'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteOwnSong(songId);
            close();
          } catch {
            setError(t('songs.saveFailed'));
          }
        })();
      },
    });
  };

  const canSave =
    draft !== null &&
    draft.name.trim().length > 0 &&
    draft.author.trim().length > 0 &&
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
      {songs.items.length === 0 && songs.status === 'ready' ? (
        <Empty
          sign="dashed"
          icon={Music}
          title={t('songs.emptyTitle')}
          text={t('songs.emptyText')}
        />
      ) : null}

      {songs.items.length > 0 ? (
        <Card style={styles.card}>
          <Rows items={songs.items} keyOf={(song) => song.id}>
            {(song) => (
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
                <ChevronRight size={18} color={color.muted} />
              </Pressable>
            )}
          </Rows>
        </Card>
      ) : null}

      <BottomSheet
        visible={draft !== null}
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
        ) : draft && draft.mediaId === null && draft.id === null ? (
          <View style={styles.form}>
            <Button
              label={t('songs.chooseFile')}
              variant="primary"
              onPress={() => void chooseFile()}
            />
            {error ? (
              <Text role="meta" tone="danger">
                {error}
              </Text>
            ) : null}
          </View>
        ) : draft ? (
          <View style={styles.form}>
            <View style={styles.head}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('songs.changeCover')}
                onPress={() => void pickCover()}
                style={styles.cover}
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
                    styles.badge,
                    { backgroundColor: color.paper, borderColor: color.surface },
                  ]}
                >
                  {coverBusy ? (
                    <CircularSpinner size={14} />
                  ) : (
                    <Camera size={14} color={color.ink} />
                  )}
                </View>
              </Pressable>
              <View style={styles.headWords}>
                <Text role="row" numberOfLines={1}>
                  {draft.name.trim() || t('songs.title')}
                </Text>
                <Text role="meta" tone="muted" numberOfLines={1}>
                  {draft.author.trim() || '—'}
                </Text>
              </View>
              <IconButton
                icon={playing ? Pause : Play}
                label={playing ? t('songs.pause') : t('songs.play')}
                tone="surface"
                size={44}
                onPress={() => void toggle()}
              />
            </View>
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
            {draft.id ? (
              <Button label={t('songs.delete')} variant="danger" onPress={remove} />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      padding: space.s4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: 52,
    },
    art: {
      width: 44,
      height: 44,
      borderRadius: radius.thumb,
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
      gap: space.s3,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
    },
    headWords: {
      flex: 1,
      gap: 2,
    },
    cover: {
      width: 72,
      height: 72,
      borderRadius: radius.cover,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    badge: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1,
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
