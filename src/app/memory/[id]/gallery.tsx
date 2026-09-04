import { File, Paths } from 'expo-file-system';
// `expo-media-library/legacy` for the reason the upload screen gives at length: the SDK 57 root
// throws from the calls this app was written against. Only `saveToLibraryAsync` is wanted here.
import * as MediaLibrary from 'expo-media-library/legacy';
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
  downloadAllMedia,
  downloadMedia,
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

/** The one answer nothing on this screen can work around, and the one worth pointing somewhere. */
const REFUSED = 'Remember may not add to this phone’s gallery — that is turned on in Settings.';

/** An original to save, as both download routes hand it out — the whole-gallery one row for row. */
type Original = { id: string; kind: MediaItem['kind']; url: string };

/**
 * One original onto the phone: down into the cache, over into the phone's own gallery, and out of
 * the cache again — the copy that stays is the one the gallery app holds.
 *
 * ponytail: the local name is the record's id and an extension guessed from `kind` — every photo
 * lands as `.jpg` and every video as `.mp4`, because neither `media_items` nor `original_key`
 * carries the name the file had. The upgrade path is the upload sending the real filename, and
 * this reading it back from the record.
 */
async function saveToPhone(file: Original) {
  const target = new File(Paths.cache, `${file.id}.${file.kind === 'video' ? 'mp4' : 'jpg'}`);
  // `idempotent`, because the same file downloaded twice must not fail on the leftover of the
  // first go — the cache is swept by the system whenever it likes, but not reliably.
  const saved = await File.downloadFileAsync(file.url, target, { idempotent: true });
  try {
    await MediaLibrary.saveToLibraryAsync(saved.uri);
  } finally {
    // Two copies of a video on a phone is what fills it up; the gallery's is the one that counts.
    saved.delete();
  }
}

/**
 * What everybody put in, as everybody sees it — a viewer included (architecture.md, «Проверка
 * прав»). The grid draws thumbnails, tapping one opens it big, and a video plays its 720p preview
 * straight from R2 rather than downloading first. Only «Download» reaches past the derivatives:
 * the original as it was sent, saved into the phone's gallery, one file or the lot of them.
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

  /**
   * The one grant this screen needs, asked for at the moment it is needed: adding to the gallery,
   * not reading it — a different question from the one the upload screen asks, and the phone only
   * puts it once. Already answered means no dialog and a straight answer.
   */
  async function maySave(): Promise<boolean> {
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) setNotice(REFUSED);
    return granted;
  }

  /** The open file, kept. The link is asked for here and not held: it dies in a quarter hour. */
  async function save(item: MediaItem) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const { url } = await downloadMedia(token, id, item.id);
      await saveToPhone({ id: item.id, kind: item.kind, url });
      setNotice('Saved to your gallery.');
    } catch (e) {
      // The api's own wording when it is the one refusing; past that it is the download or the
      // phone's gallery, and neither is worth blaming the api for.
      setNotice(e instanceof ApiError ? e.message : 'Could not save this one to your gallery.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * The whole gallery, one file after another. One ask for all the links, then a save each — and a
   * file that will not come down is counted rather than fatal, because the person wanting all of
   * it wants the rest of it too. The count is the only progress there is: a save is atomic here.
   */
  async function saveEverything() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const files = await downloadAllMedia(token, id);
      let failed = 0;
      for (const [index, file] of files.entries()) {
        setNotice(`Saving ${index + 1} of ${files.length}…`);
        try {
          await saveToPhone(file);
        } catch {
          // ponytail: the links are signed in one go and live about fifteen minutes, so a gallery
          // too big to save inside that window loses its tail to this counter. Re-signing per file
          // is the upgrade, and the summary already tells the person to tap again.
          failed += 1;
        }
      }
      setNotice(
        failed === 0
          ? `Saved ${files.length} to your gallery.`
          : `Saved ${files.length - failed} of ${files.length} — try again for what is missing.`,
      );
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Could not save this gallery to your phone.');
    } finally {
      setBusy(false);
    }
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

      <View style={styles.footer}>
        {/* Where «X of N» is read while the lot comes down, and the summary after it. The open
            file has its own copy of this line — only one of the two is ever on screen. */}
        {notice ? <Text style={styles.report}>{notice}</Text> : null}
        <View style={styles.actions}>
          {/* Everyone's, a viewer included: taking the material home is what somebody who may
              only look is in the memory for. Grey while busy, and with nothing there to take. */}
          <Button
            title="Download all"
            onPress={() => void saveEverything()}
            disabled={busy || items.length === 0}
          />
          {/* «Добавить ещё», and never gated on anything but the level: the same screen the memory
              screen sends people to, reachable with the material already in front of them. */}
          {mayUpload ? (
            <Button
              title="Add more"
              onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
            />
          ) : null}
        </View>
      </View>

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
              {/* Not gated on anything: a viewer may take home what they are looking at, and the
                  api says the same — the download route asks for membership and nothing more. */}
              <Button title="Download" onPress={() => void save(shown)} disabled={busy} />
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
  footer: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: '#EEE' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  big: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  explain: { fontSize: 16, color: '#FFF', textAlign: 'center' },
  hint: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  notice: { fontSize: 15, color: '#FFF', textAlign: 'center', paddingHorizontal: 16 },
  report: { fontSize: 15, textAlign: 'center' },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
