// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Images, X } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FlatList, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  Empty,
  ICO_S,
  IconButton,
  Spinner,
  Text,
  Tile,
  Upload,
} from '@/kit';
import { assetsInEventWindow } from '@/media-window';
import { color, space } from '@/theme';
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

/** Said before the phone's own dialog, because the dialog cannot say why it is being asked. */
const EXPLAIN =
  'Remember cannot see a thing in your gallery until you say so — and what you pick stays on this phone until you send it.';

/** The one answer this screen cannot work around, and the one worth pointing somewhere. */
const REFUSED =
  'The phone only asks once, and the answer was no. Turning it back on is in Settings, under Remember.';

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

  // This memory's share of the queue: the one going up right now, and the ones parked. One bar for
  // the whole sending and not thirty-four (kit, section 9) — the parked ones are named one by one
  // because each of them can be let go of.
  const queued = uploads.filter((file) => file.memoryId === id);
  const sending = queued.find((file) => file.error === undefined);
  const stuck = queued.filter((file) => file.error !== undefined);
  // What stopped them, in the words the queue parked the first one with.
  const parked = stuck[0]?.error;

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

  const title = memory?.title ?? 'Upload';

  if (galleryError !== null) {
    return (
      <Screen title={title}>
        <Banner tone="error" text={galleryError}>
          <Button sm variant="quiet" label="Try again" onPress={retry} />
        </Banner>
      </Screen>
    );
  }

  if (access === null) {
    return (
      <Screen title={title}>
        <View style={styles.waiting}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (!granted) {
    return (
      <Screen title={title}>
        {/* The kit says a message lives in the flow of the screen and carries what can be done
            about it — here that is the phone's own dialog while it is still worth asking, and
            Settings once the phone has stopped asking. */}
        <Banner text={access.canAskAgain ? EXPLAIN : REFUSED}>
          {access.canAskAgain ? (
            <Button sm label="Allow access" onPress={() => void ask()} />
          ) : (
            <Button sm label="Open settings" onPress={() => void Linking.openSettings()} />
          )}
        </Banner>
      </Screen>
    );
  }

  return (
    <Screen title={title}>
      {memory ? (
        <Text role="meta">{formatEventDates(memory.event_start, memory.event_end)}</Text>
      ) : null}

      {/* Said, not shown as a dead end: without the api there are no event dates and so no
          «select all from that date», but picking by hand and queueing both still work. */}
      {apiError !== null ? (
        <Banner tone="error" text={apiError}>
          <Button sm variant="quiet" label="Try again" onPress={load} />
        </Banner>
      ) : null}

      {/* iOS and Android 14 both let someone hand over a handful of photos instead of the roll.
          Said out loud, because otherwise «select all from that date» comes up short and the
          button looks broken when it is the grant that is narrow. */}
      {access.accessPrivileges === 'limited' ? (
        <Banner text="Only the photos you handed to Remember are here — the rest of the gallery is invisible to this screen, «select all from that date» included.">
          <Button sm label="Choose more" onPress={() => void chooseMore()} />
        </Banner>
      ) : null}

      <Button
        label="Select all from that date"
        wide
        onPress={pickTheEvent}
        disabled={memory === null || reading}
      />
      {notice ? <Banner text={notice} /> : null}
      {reading ? <Text role="meta">Still reading the gallery…</Text> : null}

      {/* The kit's contact sheet, section 8: three columns almost flush, because there has to be
          visibly a lot of material. Every frame here is one the phone already holds, so `ready` is
          the only state this sheet ever draws — the other two belong to the gallery, where a file
          is still being turned into a derivative. */}
      <FlatList
        data={gallery}
        keyExtractor={(asset) => asset.id}
        numColumns={3}
        columnWrapperStyle={styles.sheetRow}
        contentContainerStyle={styles.sheet}
        ListEmptyComponent={
          // The line above already says what the wait is for, so the sheet only spins.
          reading ? (
            <View style={styles.waiting}>
              <Spinner />
            </View>
          ) : (
            <Empty icon={Images} text="Nothing to pick — this phone's gallery is empty." />
          )
        }
        renderItem={({ item }) => (
          <Tile
            state="ready"
            uri={item.uri}
            selected={picked.has(item.id)}
            // The kit marks a video by how long it runs rather than by the word «video».
            length={item.mediaType === 'video' ? runtime(item.duration) : undefined}
            label={`${item.mediaType === 'video' ? 'Video' : 'Photo'} ${item.filename}`}
            onPress={() => toggle(item.id)}
            style={styles.cell}
          />
        )}
      />

      {queued.length > 0 ? (
        <View style={styles.queue}>
          {/* One bar for the lot: it stands at whatever the file going up right now has sent, and
              the count beside it is what is still owed to this memory. */}
          <Upload
            title="Sending"
            meta={`${queued.length} still to send`}
            value={sending ? progress(sending) : 0}
            hint="The app can be put away — sending carries on."
          />
          {/* One line for the lot: they park for the same reason, and it is nearly always the
              network. It retries by itself — on a timer and on coming back to the app — so this
              button is for the person who would rather not wait for either. */}
          {parked !== undefined ? (
            <Banner tone="error" text={parked}>
              <Button sm variant="quiet" label="Try again" onPress={wake} />
            </Banner>
          ) : null}
          {/* Named one by one only where a name is needed: the file somebody would rather not send
              after all. Scrolls rather than grows — a whole day of an event is hundreds of files. */}
          {stuck.length > 0 ? (
            <ScrollView style={styles.parked}>
              {stuck.map((file) => (
                <View key={file.assetId} style={styles.parkedRow}>
                  <Text role="meta" numberOfLines={1} style={styles.parkedName}>
                    {file.filename}
                  </Text>
                  <IconButton
                    icon={X}
                    size={ICO_S}
                    label={`Drop ${file.filename} from the queue`}
                    onPress={() => drop(file.memoryId, file.assetId)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <Text role="meta">
        {picked.size} selected
        {reading ? '' : ` of ${gallery.length}`}
      </Text>
      <ActionBar>
        <Button
          variant="quiet"
          label="Clear"
          onPress={() => setPicked(new Set())}
          disabled={picked.size === 0}
        />
        <Button
          variant="primary"
          wide
          label="Send"
          onPress={send}
          disabled={picked.size === 0}
        />
      </ActionBar>
    </Screen>
  );
}

/**
 * The screen's frame, drawn the same in every one of its states. The native header is off across
 * the app (`_layout`), so the kit's own appbar is what carries the way back — and a screen that
 * cannot open the gallery needs it as much as one that can.
 */
function Screen({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AppBar
        title={title}
        left={
          <IconButton
            icon={ChevronLeft}
            label="Back"
            // Reached by a tapped push there is nothing behind this screen, and the way create
            // answers that is the way this one does.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />
      {children}
    </View>
  );
}

/** A video's length as the kit writes it on the frame — `0:42`, `1:07`. */
function runtime(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink, paddingHorizontal: space.s4, gap: space.s3 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The kit's sheet: 3px between frames, and nothing else — the material is the picture here.
  sheet: { flexGrow: 1, gap: 3 },
  sheetRow: { gap: 3 },
  // A third of the row and not `flex: 1`: a last row holding one photo must leave it a third of
  // the width, not stretch it across the screen. The tile brings its own square.
  cell: { flex: 1 / 3 },
  queue: { gap: space.s3 },
  parked: { maxHeight: 132 },
  parkedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2 },
  parkedName: { flexShrink: 1 },
});
