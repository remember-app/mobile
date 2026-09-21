// `expo-image` and not React Native's own, here as in the kit's tile: a frame picked out of the
// phone's gallery is named by a `ph://` reference to the photo library, which React Native has no
// loader for at all — that is the red «No suitable image URL loader» screen.
import { Image } from 'expo-image';
// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  CircleCheckBig,
  ImageIcon,
  Info,
  Smartphone,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatEventDates, formatRuntime } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Board,
  Button,
  CardMessage,
  DashedFrame,
  DayMark,
  Empty,
  FEED_GAP,
  GlassBar,
  HintNote,
  Icon,
  IconButton,
  RowStuck,
  Sheet,
  Text,
  Tile,
  Upload,
  Waiting,
} from '@/kit';
import { useStrings } from '@/language';
import { assetsByDay, type ShootingDay } from '@/media-window';
import { board, height, radius, space, themed, themes, ThemePin, useTheme } from '@/theme';
import { failureText, progress, type QueuedFile, type UploadFailure } from '@/upload-queue';
import { answerAskAll, drop, enqueue, useAskAll, useUploads, wake } from '@/uploads';

/**
 * Photos and videos, and nothing else — the same list twice on purpose. It is what the grid asks
 * the library for, and on Android 13+ it is also what the phone asks the person for, so this app
 * never turns up wanting their voice recordings. `app.json` declares the matching pair.
 */
const WANTED = ['photo', 'video'] as const;

/** Big enough that the first page fills the screen, small enough that it arrives quickly. */
const PAGE = 500;

/**
 * A frame opened full screen stays a dark room whatever the app's theme is (spec 2, and the kit's
 * one deliberate pin): around a photograph there must be nothing brighter than the photograph.
 */
const room = themes.dark.color;

/**
 * One line of the feed: a day of the roll, up to three of the frames shot on it, or — under a
 * partial grant — the plate saying the rest of that day is not ours to show.
 */
type Row =
  | { key: string; day: ShootingDay<MediaLibrary.Asset>; frames?: undefined; unseen?: undefined }
  | { key: string; frames: MediaLibrary.Asset[]; day?: undefined; unseen?: undefined }
  | { key: string; unseen: true; day?: undefined; frames?: undefined };

/**
 * Putting material into a memory: consent, the camera roll drawn the way a memory's own feed is —
 * three to a row, edge to edge, the date standing between one day and the next — the selection to
 * trim, the sending itself (handed to `@/uploads`, which carries on without this screen) and the
 * one question doc-06 asks afterwards. Nothing here asks what the memory's status is: material goes
 * in during the event and long after the montage was made (doc-02).
 *
 * Spec «Экраны»: `Upload`, and its four other faces — `UploadAccess`, `UploadLimited`,
 * `UploadQueue`, `UploadEmpty` — plus the sheet `SheetAskAll`. All of them are this one file, and
 * what tells them apart is whether there are photographs to stand under: with a feed the screen
 * wears the glass bar that floats over it, and with a message or an empty gallery instead — the
 * plain bar with the memory named under the heading, which is what the layout draws.
 */
export default function UploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { color } = useTheme();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  /**
   * One column of the feed, measured instead of flexed — the gallery's own feed carries the long
   * version of why. Short of it: `flex: 1/3` divides what a row has left after its gaps, and a last
   * row of one frame has no gaps to leave, so that frame came out 2pt wider than the rest. This
   * feed runs the whole width of the window, so nothing comes off it but the two gutters.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - FEED_GAP * 2) / 3 };
  // The whole app's queue; the rows below are this memory's share of it.
  const uploads = useUploads();
  // Checked on mount, asked for only on the button — that is the difference between knowing
  // whether we may look and looking. Nothing below runs until `granted`.
  const [access, ask] = MediaLibrary.usePermissions({ granularPermissions: [...WANTED] });
  const [memory, setMemory] = useState<Memory | null>(null);
  const [gallery, setGallery] = useState<MediaLibrary.Asset[]>([]);
  const [reading, setReading] = useState(true);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * Picking is on from the first moment (spec, `Upload`): this screen exists to hand material over,
   * and a mode that has to be turned on first would make every visit start with the same tap.
   * Turned off, the circles go and the feed is just a feed — a tap opens the frame instead.
   */
  const [picking, setPicking] = useState(true);
  /** The frame being looked at full screen, which is what a tap does once picking is off. */
  const [open, setOpen] = useState<MediaLibrary.Asset | null>(null);
  // What this visit has handed to the queue — the number the «Это всё?» sheet counts out loud.
  const [sent, setSent] = useState(0);
  // Bumped whenever the library must be read from the top again: a retry, or a wider grant.
  const [rereads, setRereads] = useState(0);
  // Two of them, because they cost different things. A gallery that will not open leaves nothing
  // to put on the screen; an api that cannot be reached only costs the event dates — picking and
  // queueing carry on, which is the whole point of a queue that waits for the network.
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const granted = access?.granted ?? false;
  // iOS and Android 14 both let somebody hand over a handful of photos instead of the roll. Said
  // out loud (`UploadLimited`), because otherwise a day comes up counting three frames out of the
  // sixty that were shot on it, and the grant is the only thing that would explain it.
  const limited = access?.accessPrivileges === 'limited';

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
        // What a partial grant leaves out is said under the strip it is missing from, and nowhere
        // else: a day of three frames out of sixty otherwise reads as a day when nobody shot.
        ...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),
      ]),
    [memory, gallery, limited],
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
  // the whole sending and not thirty-four (spec 7.6) — the parked ones are named one by one under
  // «НЕ УШЛИ», because each of them carries its own reason and can be let go of.
  const queued = uploads.filter((file) => file.memoryId === id);
  const sending = queued.find((file) => file.error === undefined);
  const stuck = queued.filter(
    (file): file is QueuedFile & { error: UploadFailure } => file.error !== undefined,
  );

  /**
   * doc-06, and the layout's `SheetAskAll`: asked once, and only once everything this visit sent is
   * actually in — «блок отправки уступает место листу „Это всё?“». The api decides *whether* to ask
   * (`@/uploads`), this decides *when*, and the count beside the question is what went.
   *
   * A question raised while somebody was on another screen waits in the queue's own state until the
   * next time they send something from here, which is the next moment the sheet can count anything.
   */
  const asking = useAskAll() === id && sent > 0 && queued.length === 0;

  /** Tap to take, tap again to put back — which is also how anything leaves the selection. */
  const toggle = (assetId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(assetId)) next.add(assetId);
      return next;
    });

  /**
   * The day's own seam, which the layout made a button (spec 7.8): one tap takes the whole day,
   * the next puts it back — the circle in front of the date is which of the two it is now. Only
   * this day, never the screen: what is picked on another day is nobody's business here.
   */
  function toggleDay(day: ShootingDay<MediaLibrary.Asset>) {
    setPicked((have) => {
      const next = new Set(have);
      const whole = day.assets.every((asset) => have.has(asset.id));
      for (const asset of day.assets) {
        if (whole) next.delete(asset.id);
        else next.add(asset.id);
      }
      return next;
    });
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
    const chosen = gallery.filter((asset) => picked.has(asset.id));
    enqueue(id, chosen);
    setSent((n) => n + chosen.length);
    setPicked(new Set());
  }

  /** The way out. Reached by a tapped push there is nothing behind it, so the list is the answer. */
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** What a frame is called out as — the phone's own filename, which is never translated. */
  const nameOf = (asset: MediaLibrary.Asset) =>
    `${asset.mediaType === 'video' ? s.media.video : s.media.photo} ${asset.filename}`;

  // Everything the sending and the grant have to say. It stands over the feed and scrolls away with
  // it, and on a screen with no feed at all — an empty gallery with a queue still going — it stands
  // over whatever is being said instead.
  const said =
    apiError !== null ||
    queued.length > 0 ||
    stuck.length > 0 ||
    limited ||
    (reading && rows.length > 0);

  function blocks() {
    return (
      <>
        {/* Said, not shown as a dead end: without the api there is no event window, so the roll
            is cut into its days all the same but none of them is lifted to the top as the
            event's. Picking — by hand or by the day — and queueing both still work. */}
        {apiError !== null ? (
          <Banner tone="error" text={apiError}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : null}

        {/* `UploadQueue`. One bar for the lot: it stands at whatever the file going up right now
            has sent, and the count beside it is what is still owed to this memory. */}
        {queued.length > 0 ? (
          <Upload
            title={s.state.sending}
            meta={s.upload.stillToSend(queued.length)}
            value={sending ? progress(sending) : 0}
            hint={s.upload.carriesOn}
          />
        ) : null}

        {/* Named one by one, because each of them carries its own reason and because one of them
            is the file somebody would rather not send after all. The queue retries by itself —
            on a timer and on coming back to the app — so the button is for whoever would rather
            not wait for either. */}
        {stuck.length > 0 ? (
          <View style={styles.parked}>
            <View style={styles.parkedHead}>
              <Text role="eyebrow" tone="muted">
                {s.upload.notSent.toUpperCase()}
              </Text>
              <Button size="xs" variant="quiet" label={s.action.retry} onPress={wake} />
            </View>
            {stuck.map((file) => (
              <RowStuck
                key={file.assetId}
                name={file.filename}
                // The queue keeps the reason and not the sentence, so the words are picked here,
                // in the language this render is in — a language switched while they sit parked
                // turns these lines with the rest of the screen (TASK-93).
                reason={failureText(s, file.error, file.filename)}
                // The roll is in hand, so the parked file can show itself. A file the phone no
                // longer has is not in it, and the kit draws a glyph square instead.
                // ponytail: a scan of the roll per parked file per render. Hundreds parked at
                // once — a whole event that went out on no signal — is the day this becomes an
                // id→uri map cut beside `rows`.
                uri={gallery.find((asset) => asset.id === file.assetId)?.uri}
                icon={ImageIcon}
              >
                <IconButton
                  icon={X}
                  size={height.roundRow}
                  label={s.upload.dropFile(file.filename)}
                  onPress={() => drop(file.memoryId, file.assetId)}
                />
              </RowStuck>
            ))}
          </View>
        ) : null}

        {/* `UploadLimited`: what is on this screen is what was handed over, and the day marks
            below carry counts instead of «Выбрать все» — there is nothing to select all of. */}
        {limited ? (
          <HintNote icon={Info} tone="spark" text={s.upload.limited}>
            <Button
              variant="secondary"
              size="xs"
              wide={false}
              label={s.upload.chooseMore}
              onPress={() => void chooseMore()}
              style={styles.start}
            />
          </HintNote>
        ) : null}

        {/* Why a day's «Выбрать все» is out: the roll is still arriving, and a count taken
            halfway through it would pick the head of a day and say nothing about the tail. */}
        {reading && rows.length > 0 ? <Text role="meta">{s.upload.reading}</Text> : null}
      </>
    );
  }

  /** The body of the screen with no feed on it, in the four states the layout draws it in. */
  function message() {
    // Nothing to put on the screen at all. The message stands in the flow and carries what can be
    // done about it, the same shape `UploadAccess` uses — this one can only be tried again.
    if (galleryError !== null) {
      return (
        <CardMessage icon={ImageIcon} text={galleryError}>
          <Button variant="primary" size="md" label={s.action.retry} onPress={retry} />
        </CardMessage>
      );
    }

    // The phone has not said yet whether we may look.
    if (access === null) {
      return (
        <View style={styles.centre}>
          <Waiting text={s.state.checking} />
        </View>
      );
    }

    // `UploadAccess`: the phone's own dialog while it is still worth asking, and Settings once the
    // phone has stopped asking.
    if (!granted) {
      return (
        <CardMessage
          icon={ImageIcon}
          text={access.canAskAgain ? s.upload.explain : s.upload.refused}
        >
          <Button
            variant="primary"
            size="md"
            label={access.canAskAgain ? s.upload.allow : s.action.openSettings}
            onPress={() => void (access.canAskAgain ? ask() : Linking.openSettings())}
          />
        </CardMessage>
      );
    }

    if (reading) {
      return (
        <View style={styles.centre}>
          <Waiting text={s.upload.reading} />
        </View>
      );
    }

    // `UploadEmpty` — access given and nothing to give back. No bottom layer under it: there is
    // nothing to offer.
    return (
      <Empty sign="dashed" icon={Smartphone} title={s.upload.emptyTitle} text={s.upload.emptyText} />
    );
  }

  const feed = granted && rows.length > 0;

  return (
    // With a feed the board keeps nothing back for the status line: the photographs run under it
    // and the glass bar's own darkening is what makes the glyphs on it readable (spec 7.1).
    <Board style={feed ? styles.bleed : undefined}>
      {feed ? (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={[
            styles.feed,
            {
              // Spec 4: the body under the glass bar starts at 108 — the status line, the bar's own
              // 48 and 8 under it — and ends clear of the bottom layer, where there is one.
              paddingTop: insets.top + height.roundViewer + space.s2,
              paddingBottom: picking ? board.footerTall : space.s5,
            },
          ]}
          ListHeaderComponent={
            // The only thing on this face that is not a photograph, so it is the only thing that
            // takes the screen's own margin — the feed under it runs to both edges.
            <View style={[styles.head, styles.headFeed, said ? styles.headSaid : null]}>
              {blocks()}
            </View>
          }
          renderItem={({ item: row }) =>
            row.day ? (
              <DayMark
                label={s.upload.shotOn(formatDay(new Date(row.day.at)))}
                count={s.memory.frames(row.day.assets.length)}
                // Under a partial grant the seam only counts what is here, drawn back rather than
                // forward — the rest is not missing, it is unseen, and there is no whole day to take.
                limited={limited}
                picked={row.day.assets.every((asset) => picked.has(asset.id))}
                // Spec 7.8's third kind: the band itself takes the day and gives it back. Out with
                // picking off — there is nothing to take — and out until the whole roll is in hand,
                // since it arrives 500 at a time and a day that straddles a page is still growing,
                // so «все» would take only its head.
                onPress={picking && !limited && !reading ? () => toggleDay(row.day) : undefined}
                pressLabel={s.upload.selectDay(row.day.assets.length)}
              />
            ) : row.unseen ? (
              <DashedFrame style={styles.unseen}>
                <Text role="label" tone="faint" style={styles.middle}>
                  {s.upload.restUnseen}
                </Text>
              </DashedFrame>
            ) : (
              <View style={styles.strip}>
                {row.frames.map((item) => (
                  <Tile
                    key={item.id}
                    // Every frame here is one the phone already holds, so `ready` is the only state
                    // this feed ever draws — the other two belong to the gallery, where a file is
                    // still being turned into a derivative.
                    state="ready"
                    lane="feed"
                    uri={item.uri}
                    // No circle at all with picking off: a frame that is not being picked is not a
                    // checkbox, and the layout takes the circles away with the mode.
                    pick={picking ? (picked.has(item.id) ? 'send' : 'off') : undefined}
                    // The kit marks a video by how long it runs rather than by the word «video».
                    length={item.mediaType === 'video' ? formatRuntime(item.duration) : undefined}
                    label={nameOf(item)}
                    onPress={() => (picking ? toggle(item.id) : setOpen(item))}
                    style={cell}
                  />
                ))}
              </View>
            )
          }
        />
      ) : (
        <>
          {/* Spec 7.1: with no photographs under it the bar is the plain one, and the memory is
              named under the heading instead of inside a capsule of glass. */}
          <AppBar
            title={s.upload.title}
            subtitle={subtitleFor(memory)}
            left={<IconButton icon={ChevronLeft} label={s.action.back} onPress={leave} />}
          />
          <View style={styles.body}>
            <View style={[styles.head, said ? styles.headSaid : null]}>{blocks()}</View>
            {message()}
          </View>
        </>
      )}

      {/* Over the feed and not above it, which is what makes it glass. «Ваши кадры» over the memory
          this material is going into — a plate and not a button: the memory's own screen is behind
          «Назад», and there is nothing else here to open. */}
      {feed ? (
        <GlassBar
          style={styles.glass}
          title={s.upload.title}
          meta={memory ? s.upload.into(memory.title) : undefined}
          capsuleLabel={memory ? `${s.upload.title}, ${s.upload.into(memory.title)}` : s.upload.title}
          left={
            <IconButton
              icon={ChevronLeft}
              label={s.action.back}
              tone="glass"
              size={height.roundViewer}
              onPress={leave}
            />
          }
          right={
            <IconButton
              icon={CircleCheckBig}
              label={s.upload.picking}
              tone="glass"
              size={height.roundViewer}
              on={picking}
              onPress={() => setPicking((was) => !was)}
            />
          }
        />
      ) : null}

      {/* The bottom layer of the third kind, and only while something can be sent: with picking off
          the feed is just a feed, and `UploadAccess`, `UploadEmpty` and the rest are drawn with no
          layer at all. The button stands there from the start and is simply out until something is
          marked — the layout would rather show what this screen is for than hide it. */}
      {feed && picking ? (
        <ActionBar
          style={styles.layer}
          footer="upload"
          above={
            picked.size > 0 ? (
              <>
                <Text role="label" style={styles.grow}>
                  {/* The total is only worth saying once the whole roll is in hand — half a count
                      is a lie, so until then the selection counts only itself. */}
                  {reading
                    ? s.upload.picked(picked.size)
                    : s.upload.pickedOf(picked.size, gallery.length)}
                </Text>
                <Button variant="quiet" label={s.action.clear} onPress={() => setPicked(new Set())} />
              </>
            ) : undefined
          }
        >
          <Button
            variant="primary"
            wide
            icon={ArrowUp}
            disabled={picked.size === 0}
            // The count rides in the label, the layout's «Отправить 28 файлов» — it is what the
            // button is about to take with it, and with nothing marked there is no count to name.
            label={picked.size > 0 ? s.upload.send(picked.size) : s.action.send}
            onPress={send}
          />
        </ActionBar>
      ) : null}

      {/* Picking off, a tap opens the frame instead — the phone's own copy, at the size it was shot.
          ponytail: a video shows the poster the library hands back and does not play; the frame that
          plays is the one already in a memory (`src/memory/frame-viewer.tsx`). The day somebody
          wants playback here, it is `expo-video` over `getAssetInfoAsync().localUri`. */}
      <Modal
        visible={open !== null}
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <ThemePin value="dark">
          <View style={styles.room}>
            {open ? (
              <Image
                source={{ uri: open.uri }}
                contentFit="contain"
                accessibilityLabel={nameOf(open)}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={[styles.roomBar, { paddingTop: insets.top }]}>
              <IconButton
                icon={X}
                label={s.action.close}
                tone="viewer"
                size={height.roundViewer}
                onPress={() => setOpen(null)}
              />
            </View>
          </View>
        </ThemePin>
      </Modal>

      {/* `SheetAskAll` — doc-06's one question, and the person's own answer to it. Both buttons are
          equal in weight: this is their word about themselves, not something wanted from them. */}
      <Sheet
        visible={asking}
        onCancel={() => answerAskAll(null)}
        title={s.upload.askAll}
        head={
          <View style={styles.result}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.tick}
            >
              <Icon icon={Check} size={15} color={color.sparkInk} />
            </View>
            <Text role="row">{s.upload.sentToMemory(sent)}</Text>
          </View>
        }
        footer={
          <>
            <Button
              variant="paper"
              label={s.upload.thatsAll}
              onPress={() => answerAskAll('done')}
            />
            <Button
              variant="secondary"
              label={s.upload.moreToCome}
              onPress={() => answerAskAll('more_coming')}
            />
          </>
        }
      >
        <Text role="body" tone="muted">
          {s.upload.askAllText}
        </Text>
      </Sheet>
    </Board>
  );
}

/**
 * The line under «Ваши кадры» on the plain bar: which memory this is going into and when it
 * happened. The separator goes with the dates, so a memory whose dates will not read is never left
 * hanging off a «·» — `@/frames` learnt that one the hard way.
 */
function subtitleFor(memory: Memory | null): string | undefined {
  if (memory === null) return undefined;
  const when = formatEventDates(memory.event_start, memory.event_end);
  return when === '' ? memory.title : `${memory.title} · ${when}`;
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The feed face keeps nothing back for the status line — the glass bar is what stands there.
    bleed: { paddingTop: 0 },
    // Spec 4: the body of the plain-bar face starts at 124, which is the bar's own 44 and this
    // under it. The screen's margin is the app's 16.
    body: { flex: 1, paddingHorizontal: space.s4, paddingTop: space.s5 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // The feed is the kit's own: 2px between frames, no margins, nothing between a day's strip and
    // the next day but the seam's own height.
    feed: { flexGrow: 1, gap: FEED_GAP },
    strip: { flexDirection: 'row', gap: FEED_GAP },
    // What the queue and the grant have to say. The margin comes with the feed face only: the
    // plain-bar face stands in the body's own 16 already.
    head: { gap: space.s4 },
    headFeed: { paddingHorizontal: space.s4 },
    // And it only takes room when it has something to say: with nothing in it the first day of the
    // roll stands directly under the bar.
    headSaid: { paddingBottom: space.s4 },
    glass: { position: 'absolute', left: 0, right: 0, top: 0 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    parked: { gap: space.s2 },
    parkedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    start: { alignSelf: 'flex-start' },
    unseen: { marginTop: space.s5, marginHorizontal: space.s4 },
    middle: { textAlign: 'center' },
    grow: { flex: 1, minWidth: 0 },
    // The one frame opened full screen, and the room stays dark in daylight (spec 2).
    room: { flex: 1, backgroundColor: room.ink },
    roomBar: { paddingHorizontal: space.s3 },
    result: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    // The 26 circle of spec 7.6's «готово», on the line that says what has just gone.
    tick: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
