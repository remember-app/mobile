// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import { assetsInEventWindow } from '@/media-window';
import { progress } from '@/upload-queue';
import { drop, enqueue, useUploads, wake } from '@/uploads';

/**
 * Photos and videos, and nothing else — the same list twice on purpose. It is what the grid asks
 * the library for, and on Android 13+ it is also what the phone asks the person for, so this app
 * never turns up wanting their voice recordings. `app.json` declares the matching pair.
 */
const WANTED = ['photo', 'video'] as const;

/** Big enough that the first page fills the screen, small enough that it arrives quickly. */
const PAGE = 500;

/**
 * Putting material into a memory: consent, the camera roll, «select all from that date», a
 * selection to trim, and the sending itself — which is handed to `@/uploads` and carries on
 * without this screen. Nothing here asks what the memory's status is: material goes in during the
 * event and long after the montage was made (doc-02).
 */
export default function UploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  // The whole app's queue; the rows below are this memory's share of it.
  const uploads = useUploads();
  // Checked on mount, asked for only on the button — that is the difference between knowing
  // whether we may look and looking. Nothing below runs until `granted`.
  const [access, ask] = MediaLibrary.usePermissions({ granularPermissions: [...WANTED] });
  const [memory, setMemory] = useState<Memory | null>(null);
  const [gallery, setGallery] = useState<MediaLibrary.Asset[]>([]);
  const [reading, setReading] = useState(true);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  // Bumped whenever the library must be read from the top again: a retry, or a wider grant.
  const [rereads, setRereads] = useState(0);
  // Two of them, because they cost different things. A gallery that will not open leaves nothing
  // to put on the screen; an api that cannot be reached only costs the event dates — picking and
  // queueing carry on, which is the whole point of a queue that waits for the network.
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setApiError(null);
    // The same road the memory screen takes, and for the same reason: the event window lives on
    // the memory, this list already hands it out, and it works however the screen was reached —
    // a tapped push included, which arrives with nothing but an id.
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setApiError(errorMessage(e)),
    );
  }, [token, id]);

  useEffect(load, [load]);

  const granted = access?.granted ?? false;

  useEffect(() => {
    if (!granted) return;
    let live = true;
    setGallery([]);
    setGalleryError(null);
    setReading(true);

    void (async () => {
      try {
        let after: string | undefined;
        // The whole library, newest first, one page at a time. All of it and not the first page:
        // «select all from that date» runs over what is in hand, and an event two months back sits
        // behind however many photos were taken since — an unread tail would drop straight out of
        // the pick without saying so.
        // ponytail: a huge camera roll spends a few seconds on this. If that ever bites, page only
        // until the window is passed — but the window belongs to `assetsInEventWindow`, so that
        // stop condition has to come from there and not from a second copy of the day maths here.
        do {
          const page = await MediaLibrary.getAssetsAsync({
            first: PAGE,
            after,
            mediaType: [...WANTED],
            sortBy: ['creationTime'],
          });
          if (!live) return;
          setGallery((have) => have.concat(page.assets));
          after = page.hasNextPage ? page.endCursor : undefined;
        } while (after !== undefined);
      } catch {
        // Not `errorMessage`: that one is worded for the api and would blame the network for a
        // phone that would not open its own gallery.
        if (live) setGalleryError('Cannot read the gallery on this phone.');
      } finally {
        if (live) setReading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [granted, rereads]);

  function retry() {
    load();
    setRereads((n) => n + 1);
  }

  // This memory's share of the queue, and the first file parked in it — one wording for all of
  // them, since they stop for the same reason and it is nearly always the network.
  const queued = uploads.filter((file) => file.memoryId === id);
  const stuck = queued.find((file) => file.error !== undefined);

  /** Tap to take, tap again to put back — which is also how anything leaves the selection. */
  const toggle = (assetId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(assetId)) next.add(assetId);
      return next;
    });

  /**
   * The button doc-02 is built around. What it picks is `assetsInEventWindow` and nothing else:
   * the event window is a span of *local* days, and that module is the one place that says so —
   * the same maths behind the dates printed above this button.
   */
  function pickTheEvent() {
    if (!memory) return;
    const shotThen = assetsInEventWindow(memory, gallery);
    setPicked(new Set(shotThen.map((asset) => asset.id)));
    // Silence would read as a broken button; this is the one outcome that needs explaining.
    setNotice(shotThen.length === 0 ? 'Nothing in the gallery was shot on those days.' : null);
  }

  /** Widen a `limited` grant. Whatever it changed, the library is read again from the top. */
  async function chooseMore() {
    await MediaLibrary.presentPermissionsPickerAsync([...WANTED]).catch(() => {});
    setRereads((n) => n + 1);
  }

  /**
   * Where the picking ends and the sending starts. The selection is handed to the queue and this
   * screen is done with it: the queue holds it on disk, sends it part by part, and picks up again
   * by itself if the network or the app goes away mid-file. Offline is not a refusal here — the
   * files wait in the queue exactly as they do when a tunnel swallows them halfway.
   */
  function send() {
    enqueue(id, gallery.filter((asset) => picked.has(asset.id)));
    setPicked(new Set());
    setNotice(null);
  }

  if (galleryError !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{galleryError}</Text>
        <Button title="Try again" onPress={retry} />
      </View>
    );
  }

  if (access === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.explain}>
          Remember cannot see a thing in your gallery until you say so — and what you pick stays on
          this phone until you send it.
        </Text>
        {access.canAskAgain ? (
          <Button title="Allow access" onPress={() => void ask()} />
        ) : (
          <>
            <Text style={styles.hint}>
              The phone only asks once, and the answer was no. Turning it back on is in Settings,
              under Remember.
            </Text>
            <Button title="Open settings" onPress={() => void Linking.openSettings()} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {memory ? (
          <>
            <Text style={styles.title}>{memory.title}</Text>
            <Text style={styles.hint}>{formatEventDates(memory.event_start, memory.event_end)}</Text>
          </>
        ) : null}
        {/* Said, not shown as a dead end: without the api there are no event dates and so no
            «select all from that date», but picking by hand and queueing both still work. */}
        {apiError !== null ? (
          <>
            <Text style={styles.error}>{apiError}</Text>
            <Button title="Try again" onPress={load} />
          </>
        ) : null}
        <Button
          title="Select all from that date"
          onPress={pickTheEvent}
          disabled={memory === null || reading}
        />
        {reading ? <Text style={styles.hint}>Still reading the gallery…</Text> : null}
        {/* iOS and Android 14 both let someone hand over a handful of photos instead of the roll.
            Said out loud, because otherwise «select all from that date» comes up short and the
            button looks broken when it is the grant that is narrow. */}
        {access.accessPrivileges === 'limited' ? (
          <>
            <Text style={styles.hint}>
              Only the photos you handed to Remember are here — the rest of the gallery is invisible
              to this screen, «select all from that date» included.
            </Text>
            <Button title="Choose more photos" onPress={() => void chooseMore()} />
          </>
        ) : null}
      </View>

      <FlatList
        data={gallery}
        keyExtractor={(asset) => asset.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          reading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.hint}>Nothing to pick — this phone's gallery is empty.</Text>
          )
        }
        renderItem={({ item }) => {
          const chosen = picked.has(item.id);
          return (
            <Pressable
              style={styles.cell}
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'} ${item.filename}`}
            >
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {item.mediaType === 'video' ? <Text style={styles.kind}>Video</Text> : null}
              <View style={[styles.mark, chosen && styles.marked]}>
                {chosen ? <Text style={styles.tick}>✓</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {queued.length > 0 ? (
          <>
            <Text style={styles.count}>{queued.length} still to send</Text>
            {/* Every file with its own line, because every file has its own answer: a percentage
                while it is going up, and what stopped it when it is not. Scrolls rather than
                grows — a whole day of an event is hundreds of files. */}
            <ScrollView style={styles.queue}>
              {queued.map((file) => (
                <View key={file.assetId} style={styles.queueRow}>
                  <Text style={styles.queueName} numberOfLines={1}>
                    {file.filename}
                  </Text>
                  {file.error === undefined ? (
                    <Text style={styles.hint}>{Math.round(progress(file) * 100)}%</Text>
                  ) : (
                    <Pressable
                      onPress={() => drop(file.assetId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Drop ${file.filename} from the queue`}
                    >
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
            {/* One line for the lot: they park for the same reason, and it is nearly always the
                network. It retries by itself — on a timer and on coming back to the app — so this
                button is for the person who would rather not wait for either. */}
            {stuck !== undefined ? (
              <>
                <Text style={styles.error}>{stuck.error}</Text>
                <Button title="Try uploads again" onPress={wake} />
              </>
            ) : null}
          </>
        ) : null}
        <Text style={styles.count}>
          {picked.size} selected
          {reading ? '' : ` of ${gallery.length}`}
        </Text>
        <View style={styles.actions}>
          <Button title="Clear" onPress={() => setPicked(new Set())} disabled={picked.size === 0} />
          <Button title="Send" onPress={send} disabled={picked.size === 0} />
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 22, fontWeight: '600' },
  grid: { flexGrow: 1, padding: 2, gap: 2 },
  gridRow: { gap: 2 },
  // A third of the row and not `flex: 1`: a last row holding one photo must leave it a third of
  // the width, not stretch it across the screen.
  cell: { flex: 1 / 3, aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#EEE' },
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
  mark: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FFF',
    backgroundColor: '#0006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marked: { backgroundColor: '#208AEF' },
  tick: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  footer: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  count: { fontSize: 16, fontWeight: '600' },
  queue: { maxHeight: 132 },
  queueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  queueName: { flexShrink: 1, fontSize: 14 },
  remove: { fontSize: 15, color: '#C0392B' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  explain: { fontSize: 16, textAlign: 'center' },
  hint: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  notice: { fontSize: 15 },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
