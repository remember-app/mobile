// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Images, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatEventDates, formatRuntime } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  DayMark,
  Empty,
  ICO_S,
  IconButton,
  SHEET_GAP,
  Spinner,
  Text,
  Tile,
  Upload,
} from '@/kit';
import { useStrings } from '@/language';
import { assetsByDay, type ShootingDay } from '@/media-window';
import { space, themed } from '@/theme';
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

/** One line of the sheet: a day of the roll, or up to three of the frames shot on it. */
type Row =
  | { key: string; day: ShootingDay<MediaLibrary.Asset>; frames?: undefined }
  | { key: string; frames: MediaLibrary.Asset[]; day?: undefined };

/**
 * Putting material into a memory: consent, the camera roll, «select all from that date», a
 * selection to trim, and the sending itself — which is handed to `@/uploads` and carries on
 * without this screen. Nothing here asks what the memory's status is: material goes in during the
 * event and long after the montage was made (doc-02).
 */
export default function UploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  /**
   * One column of the contact sheet, measured instead of flexed — the gallery's sheet carries the
   * long version of why. Short of it: `flex: 1/3` divides what a row has left after its gaps, and a
   * last row of one frame has no gaps to leave, so that frame came out 2pt wider than the rest.
   * This sheet stands inside the screen's own padding, which is what comes off the window here.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - SHEET_GAP * 2) / 3 };
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

  /**
   * The roll as the kit lays it out: the day it was shot on, then that day's frames three to a row,
   * then the next day — the event's days first. Flat, and three to a row by hand, because that is
   * what `numColumns` does to a list underneath and a list cannot do it around the days standing
   * between the strips. A day holding its own frames would read better and would mount a wedding —
   * six hundred frames on one day, the day this screen floats to the top — in a single item.
   *
   * Held across renders: every tap on a frame is a render, and the cut runs over the whole camera
   * roll, which is thousands of rows on a phone that has had one a while.
   */
  const rows = useMemo(
    () =>
      assetsByDay(memory, gallery).flatMap((day): Row[] => [
        { key: `day-${day.at}`, day },
        ...Array.from({ length: Math.ceil(day.assets.length / 3) }, (_, i) => ({
          key: day.assets[i * 3].id,
          frames: day.assets.slice(i * 3, i * 3 + 3),
        })),
      ]),
    [memory, gallery],
  );

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
        // the days are cut out of what is in hand, and an event two months back sits behind however
        // many photos were taken since — an unread tail would leave the event's own days off the
        // top of the screen without saying so.
        // ponytail: a huge camera roll spends a few seconds on this. If that ever bites, page only
        // until the window is passed — but the window belongs to `@/media-window`, so that stop
        // condition has to come from there and not from a second copy of the day maths here.
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
        if (live) setGalleryError(s.upload.cannotRead);
      } finally {
        if (live) setReading(false);
      }
    })();

    return () => {
      live = false;
    };
    // `s` is deliberately out of it: re-running this would read the whole camera roll again to
    // re-word one line, and on a big library that is seconds of paging.
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
   * The button doc-02 is built around, «выбрать все за эту дату» — and the date it means is the one
   * on the strip it stands over, never the whole screen. It only ever adds: what is already picked
   * on another day stays picked, and the way anything leaves the selection is the one above.
   */
  function pickDay(day: ShootingDay<MediaLibrary.Asset>) {
    setPicked((have) => new Set([...have, ...day.assets.map((asset) => asset.id)]));
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
  }

  const title = memory?.title ?? s.memory.fallbackTitle;

  if (galleryError !== null) {
    return (
      <Screen title={title}>
        <Banner tone="error" text={galleryError}>
          <Button sm variant="quiet" label={s.action.retry} onPress={retry} />
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
        <Banner text={access.canAskAgain ? s.upload.explain : s.upload.refused}>
          {access.canAskAgain ? (
            <Button sm label={s.upload.allow} onPress={() => void ask()} />
          ) : (
            <Button sm label={s.action.openSettings} onPress={() => void Linking.openSettings()} />
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

      {/* Said, not shown as a dead end: without the api there is no event window, so the roll is
          cut into its days all the same but none of them is lifted to the top as the event's.
          Picking — by hand or by the day — and queueing both still work. */}
      {apiError !== null ? (
        <Banner tone="error" text={apiError}>
          <Button sm variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : null}

      {/* iOS and Android 14 both let someone hand over a handful of photos instead of the roll.
          Said out loud, because otherwise a day comes up counting three frames out of the sixty
          that were shot on it, and the grant is the only thing that would explain it. */}
      {access.accessPrivileges === 'limited' ? (
        <Banner text={s.upload.limited}>
          <Button sm label={s.upload.chooseMore} onPress={() => void chooseMore()} />
        </Banner>
      ) : null}

      {reading ? <Text role="meta">{s.upload.reading}</Text> : null}

      {/* The kit's contact sheet, section 8, cut into days: three columns almost flush, because
          there has to be visibly a lot of material, and over each strip the day it was shot on
          carrying that day's own «выбрать все». Every frame here is one the phone already holds, so
          `ready` is the only state this sheet ever draws — the other two belong to the gallery,
          where a file is still being turned into a derivative. */}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.sheet}
        ListEmptyComponent={
          // The line above already says what the wait is for, so the sheet only spins.
          reading ? (
            <View style={styles.waiting}>
              <Spinner />
            </View>
          ) : (
            <Empty icon={Images} text={s.upload.emptyGallery} />
          )
        }
        renderItem={({ item: row }) =>
          row.day ? (
            <DayMark label={s.upload.shotOn(formatDay(new Date(row.day.at)))}>
              {/* The action belongs to this day and says how much of it there is — the kit's
                  «Выбрать все 61», quiet, because the glow on this screen is the sending. */}
              <Button
                sm
                variant="quiet"
                label={s.upload.selectDay(row.day.assets.length)}
                onPress={() => pickDay(row.day)}
              />
            </DayMark>
          ) : (
            <View style={styles.sheetRow}>
              {row.frames.map((item) => (
                <Tile
                  key={item.id}
                  state="ready"
                  uri={item.uri}
                  selected={picked.has(item.id)}
                  // The kit marks a video by how long it runs rather than by the word «video».
                  length={item.mediaType === 'video' ? formatRuntime(item.duration) : undefined}
                  // The filename is the phone's own and is never translated.
                  label={`${item.mediaType === 'video' ? s.media.video : s.media.photo} ${item.filename}`}
                  onPress={() => toggle(item.id)}
                  style={cell}
                />
              ))}
            </View>
          )
        }
      />

      {queued.length > 0 ? (
        <View style={styles.queue}>
          {/* One bar for the lot: it stands at whatever the file going up right now has sent, and
              the count beside it is what is still owed to this memory. */}
          <Upload
            title={s.state.sending}
            meta={s.upload.stillToSend(queued.length)}
            value={sending ? progress(sending) : 0}
            hint={s.upload.carriesOn}
          />
          {/* One line for the lot: they park for the same reason, and it is nearly always the
              network. It retries by itself — on a timer and on coming back to the app — so this
              button is for the person who would rather not wait for either. */}
          {parked !== undefined ? (
            <Banner tone="error" text={parked}>
              <Button sm variant="quiet" label={s.action.retry} onPress={wake} />
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
                    label={s.upload.dropFile(file.filename)}
                    onPress={() => drop(file.memoryId, file.assetId)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {/* The total is only worth saying once the whole roll is in hand — half a count is a lie. */}
      <Text role="meta">
        {reading ? s.upload.picked(picked.size) : s.upload.pickedOf(picked.size, gallery.length)}
      </Text>
      <ActionBar>
        <Button
          variant="quiet"
          label={s.upload.clear}
          onPress={() => setPicked(new Set())}
          disabled={picked.size === 0}
        />
        <Button
          variant="primary"
          wide
          // The count rides in the label, the kit's «Отправить 4 файла» — it is what the button is
          // about to take with it. With nothing picked the button is off and says the bare verb:
          // «Отправить 0 файлов» reads as a button that would send nothing if only it worked.
          label={picked.size === 0 ? s.action.send : s.upload.send(picked.size)}
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
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AppBar
        title={title}
        // Four screens of this memory carry its name; this is the line that says which one is open.
        // Said in every one of this screen's states, the way the way back is.
        subtitle={s.upload.title}
        left={
          // A cross and not an arrow: this screen comes up over the frames as an errand of its own,
          // not as a step deeper into them, and an errand is closed rather than backed out of. What
          // it does is unchanged — reached by a tapped push there is nothing behind this screen,
          // and the way create answers that is the way this one does.
          <IconButton
            icon={X}
            label={s.action.close}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />
      {children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink, paddingHorizontal: space.s4, gap: space.s3 },
    waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // The kit's sheet: 3px between frames, and nothing else — the material is the picture here.
    // The column itself is measured out above; this only holds the gutters between them. Between
    // one day's strip and the next it is the daymark's own padding that opens the gap.
    sheet: { flexGrow: 1, gap: SHEET_GAP },
    sheetRow: { flexDirection: 'row', gap: SHEET_GAP },
    queue: { gap: space.s3 },
    parked: { maxHeight: 132 },
    parkedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s2,
    },
    parkedName: { flexShrink: 1 },
  }),
);
