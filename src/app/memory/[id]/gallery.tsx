import { File, Paths } from 'expo-file-system';
// `expo-media-library/legacy` for the reason the upload screen gives at length: the SDK 57 root
// throws from the calls this app was written against. Only `saveToLibraryAsync` is wanted here.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, ChevronLeft, Download, Plus, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Modal, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { formatRuntime } from '@/dates';
import { ActionBar, AppBar, Banner, Button, ConfirmSheet, Empty, IconButton, Tile } from '@/kit';
import { color, space } from '@/theme';

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
 * прав»). The grid is the kit's contact sheet (section 8), tapping one frame opens it big, and a
 * video plays its 720p preview straight from R2 rather than downloading first. Only «Download»
 * reaches past the derivatives: the original as it was sent, saved into the phone's gallery, one
 * file or the lot of them.
 */
export default function GalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // null means «not loaded yet», the distinction the other screens draw: a reload after a delete
  // keeps the grid on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The record the viewer is showing, held by id so a reload hands it a fresh signed url. */
  const [open, setOpen] = useState<string | null>(null);
  /** Whether the delete sheet is up over the viewer. What it asks about is the open record. */
  const [confirming, setConfirming] = useState(false);
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

  return (
    // The native header is off for the whole app, so the screen wears the kit's own appbar and
    // takes the phone's top inset itself.
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AppBar
        title="Gallery"
        style={styles.pad}
        left={
          <IconButton
            icon={ChevronLeft}
            label="Back"
            // Opened straight from a link there is nothing behind this screen, and the way the
            // memory and upload screens answer that is the way this one does.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />

      {error !== null ? (
        <View style={styles.centered}>
          <Banner tone="error" text={error}>
            <Button variant="quiet" sm label="Try again" onPress={load} />
          </Banner>
        </View>
      ) : items === null ? (
        <View style={styles.centered}>
          <Empty busy text="Loading…" />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            // The signed links live about fifteen minutes and a record turns `ready` while this
            // screen is open — one pull answers both, and there is nothing here to poll for.
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={load}
                tintColor={color.ember}
                colors={[color.ember]}
                progressBackgroundColor={color.surface}
              />
            }
            ListEmptyComponent={
              <Empty icon={Camera} text="Nothing here yet — whatever anyone adds shows up here." />
            }
            renderItem={({ item }) => (
              <Tile
                style={styles.cell}
                // The record's own status is the frame's state. A `ready` record with no
                // derivative has nothing to show either, so it wears the fallen frame rather than
                // sitting in the sheet as an empty square.
                state={
                  item.status === 'ready' && item.thumbnail_url === null ? 'failed' : item.status
                }
                uri={item.thumbnail_url ?? undefined}
                caption={WAITING[item.status]}
                // The kit marks a video by its length in the corner; a record that came without
                // one still says what it is, in the same place.
                length={
                  item.kind === 'video'
                    ? (formatRuntime(item.duration_seconds) ?? 'Video')
                    : undefined
                }
                label={
                  item.status === 'ready' ? item.kind : `${item.kind}, ${WAITING[item.status]}`
                }
                onPress={() => setOpen(item.id)}
              />
            )}
          />

          <View style={styles.pad}>
            {/* Where «X of N» is read while the lot comes down, and the summary after it. The open
                file has its own copy of this line — only one of the two is ever on screen. */}
            {notice ? <Banner text={notice} style={styles.notice} /> : null}
            <ActionBar>
              {/* Everyone's, a viewer included: taking the material home is what somebody who may
                  only look is in the memory for. Off while busy, and with nothing there to take.
                  While this bar is on screen the viewer is not, so `busy` here is this button's
                  own errand and the spinner belongs to it. */}
              <Button
                variant="secondary"
                wide
                icon={Download}
                label="Download all"
                busy={busy}
                disabled={busy || items.length === 0}
                onPress={() => void saveEverything()}
              />
              {/* «Добавить ещё», and never gated on anything but the level: the same screen the
                  memory screen sends people to, reachable with the material in front of them. */}
              {mayUpload ? (
                <Button
                  variant="primary"
                  wide
                  icon={Plus}
                  label="Add more"
                  onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
                />
              ) : null}
            </ActionBar>
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
                  <Image
                    source={{ uri: shown.thumbnail_url }}
                    style={styles.big}
                    resizeMode="contain"
                  />
                ) : (
                  // Nothing was ever made for this one. Said here as well as on the tile, because
                  // this is the screen the delete button is on — a failed record is one somebody
                  // may want rid of rather than looked at.
                  <View style={[styles.big, styles.blank]}>
                    <Empty icon={TriangleAlert} text={WAITING[shown.status]} />
                  </View>
                )}
                {notice ? <Banner text={notice} style={styles.viewerNotice} /> : null}
                <ActionBar style={styles.bar}>
                  <Button
                    variant="quiet"
                    label="Close"
                    onPress={() => setOpen(null)}
                    disabled={busy}
                  />
                  {/* Not gated on anything: a viewer may take home what they are looking at, and
                      the api says the same — the download route asks for membership and nothing
                      more. `busy` is the screen's one flag, so a delete lights this spinner too;
                      the download is the errand that lasts long enough to need it. */}
                  <Button
                    variant="primary"
                    icon={Download}
                    label="Download"
                    busy={busy}
                    disabled={busy}
                    onPress={() => void save(shown)}
                  />
                  {mayDelete(shown) ? (
                    <Button
                      variant="danger"
                      label="Delete"
                      onPress={() => setConfirming(true)}
                      disabled={busy}
                    />
                  ) : null}
                </ActionBar>

                {/* Irreversible, and the api takes the bytes with it — worth one question first,
                    asked on the kit's sheet (section 13) and not by the system dialog. Inside the
                    viewer because that is the only place the delete is offered from, and a modal
                    over a modal has to be its child. */}
                <ConfirmSheet
                  visible={confirming}
                  title={`Delete this ${shown.kind}?`}
                  text="It goes from the memory for good. A montage already made keeps it."
                  confirmLabel="Delete"
                  cancelLabel="Keep"
                  onConfirm={() => {
                    setConfirming(false);
                    void remove(shown);
                  }}
                  onCancel={() => setConfirming(false)}
                />
              </View>
            )}
          </Modal>
        </>
      )}
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
  screen: { flex: 1, backgroundColor: color.ink },
  // The appbar and the bottom action stand off the edge; the sheet between them does not.
  pad: { paddingHorizontal: space.s4 },
  centered: { flex: 1, justifyContent: 'center', padding: space.s4 },
  // The kit's contact sheet: a 3px gutter and nothing else, so the material reads as a lot of it.
  grid: { flexGrow: 1, gap: 3 },
  gridRow: { gap: 3 },
  // A third of the row and not `flex: 1`, for the reason the upload grid gives: a last row with
  // one tile in it must leave it a third of the width.
  cell: { flex: 1 / 3 },
  notice: { marginTop: space.s3 },
  viewer: { flex: 1, backgroundColor: color.ink, justifyContent: 'center' },
  viewerNotice: { marginHorizontal: space.s4 },
  bar: { justifyContent: 'space-between', paddingHorizontal: space.s4 },
  big: { flex: 1, width: '100%' },
  blank: { justifyContent: 'center' },
});
