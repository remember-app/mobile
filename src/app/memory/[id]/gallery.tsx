import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ApiError,
  deleteMedia,
  errorMessage,
  listMedia,
  listMemories,
  mayContribute,
  type MediaItem,
  type MemberRole,
} from '@/api';
import { useAuth } from '@/auth';

/** What a tile says while there is no derivative to draw. A `ready` record always has one. */
const WAITING: Record<MediaItem['status'], string> = {
  processing: 'Preparing…',
  failed: 'Could not be prepared',
  ready: 'Nothing to show',
};

/**
 * What everybody put in, as everybody sees it — a viewer included (architecture.md, «Проверка
 * прав»). Derivatives only: the grid draws thumbnails, tapping one opens it big, and a video plays
 * its 720p preview straight from R2 rather than downloading first. Originals are m-6.
 */
export default function GalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  // null means «not loaded yet», the distinction the other screens draw: a reload after a delete
  // keeps the grid on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The record the viewer is showing, held by id so a reload hands it a fresh signed url. */
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setLoading(true);
    // The gallery carries no role, and this screen needs the caller's own to know who may delete
    // what. The same road the other two screens take, and it works however this one was reached.
    Promise.all([listMedia(token, id), listMemories(token)])
      .then(
        ([media, memories]) => {
          setItems(media);
          setRole(memories.find((one) => one.id === id)?.role ?? null);
        },
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setLoading(false));
  }, [token, id]);

  useEffect(load, [load]);

  // Ownership and not role: a viewer may delete what they brought, a contributor may not delete a
  // neighbour's. The api is the authority — this only decides whether to draw the button.
  const mayDelete = (item: MediaItem) => item.uploaded_by === user?.id || role === 'organizer';
  // Material goes in during the event and long after the montage was made (doc-02); the only thing
  // in the way is the level, which is the same one the memory screen gates its button on.
  const mayUpload = mayContribute(role);
  const shown = items?.find((item) => item.id === open) ?? null;

  async function remove(item: MediaItem) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteMedia(token, id, item.id);
    } catch (e) {
      // 404 is «it is already gone» — somebody else got there first, which is what was wanted
      // anyway. Everything else stays on screen with a reason.
      if (!(e instanceof ApiError && e.status === 404)) {
        setNotice(
          e instanceof ApiError && e.status === 403
            ? 'Only the organizer can delete what somebody else brought.'
            : errorMessage(e),
        );
        return;
      }
    } finally {
      setBusy(false);
    }
    setItems((have) => have?.filter((one) => one.id !== item.id) ?? null);
    setOpen(null);
  }

  /** Irreversible, and the api takes the bytes with it — worth one question first. */
  function confirmRemove(item: MediaItem) {
    Alert.alert(
      `Delete this ${item.kind}?`,
      'It goes from the memory for good. A montage already made keeps it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(item) },
      ],
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Try again" onPress={load} />
      </View>
    );
  }

  if (items === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        // The signed links live about fifteen minutes and a record turns `ready` while this screen
        // is open — one pull answers both, and there is nothing here to poll for.
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={styles.hint}>Nothing here yet — whatever anyone adds shows up here.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.cell}
            onPress={() => setOpen(item.id)}
            accessibilityRole="button"
            accessibilityLabel={
              item.status === 'ready' ? item.kind : `${item.kind}, ${WAITING[item.status]}`
            }
          >
            {item.thumbnail_url === null ? (
              <View style={[styles.thumb, styles.blank]}>
                <Text style={styles.placeholder}>{WAITING[item.status]}</Text>
              </View>
            ) : (
              <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
            )}
            {item.kind === 'video' ? <Text style={styles.kind}>Video</Text> : null}
          </Pressable>
        )}
      />

      {mayUpload ? (
        <View style={styles.footer}>
          {/* «Добавить ещё», and never gated on anything but the level: the same screen the memory
              screen sends people to, reachable with the material already in front of them. */}
          <Button
            title="Add more"
            onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
          />
        </View>
      ) : null}

      <Modal
        visible={shown !== null}
        animationType="fade"
        onRequestClose={() => setOpen(null)}
        // Landscape too: a video shot sideways is worth turning the phone for, and the rest of
        // the app is portrait-only.
        supportedOrientations={['portrait', 'landscape']}
      >
        {shown === null ? null : (
          <View style={styles.viewer}>
            {shown.kind === 'video' && shown.preview_url !== null ? (
              <Playing url={shown.preview_url} />
            ) : shown.thumbnail_url !== null ? (
              <Image source={{ uri: shown.thumbnail_url }} style={styles.big} resizeMode="contain" />
            ) : (
              // Nothing was ever made for this one. Said here as well as on the tile, because this
              // is the screen the delete button is on — a failed record is one somebody may want
              // rid of rather than looked at.
              <Text style={styles.explain}>{WAITING[shown.status]}</Text>
            )}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <View style={styles.bar}>
              <Button title="Close" onPress={() => setOpen(null)} disabled={busy} />
              {mayDelete(shown) ? (
                <Button
                  title="Delete"
                  color="#C0392B"
                  onPress={() => confirmRemove(shown)}
                  disabled={busy}
                />
              ) : null}
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

/**
 * The 720p preview, played where it lies: `expo-video` streams from the signed url and the file
 * was written with its index at the front, so playback starts before the whole thing is down
 * (architecture.md, «Видео в галерее»). Its own component because the player is a hook, and this
 * one is mounted only while a video is on screen — leaving it releases the player.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  grid: { flexGrow: 1, padding: 2, gap: 2 },
  gridRow: { gap: 2 },
  // A third of the row and not `flex: 1`, for the reason the upload grid gives: a last row with
  // one tile in it must leave it a third of the width.
  cell: { flex: 1 / 3, aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#EEE' },
  blank: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  placeholder: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
  kind: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    fontSize: 11,
    color: '#FFF',
    // No icon set in this app; a shadow is what keeps the word readable over a bright frame.
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEE' },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  big: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  explain: { fontSize: 16, color: '#FFF', textAlign: 'center' },
  hint: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  notice: { fontSize: 15, color: '#FFF', textAlign: 'center', paddingHorizontal: 16 },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
