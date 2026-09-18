// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, Check, ChevronLeft, ImageIcon, Info, Smartphone, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

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
  GRID_GAP,
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
import { height, radius, space, themed, useTheme } from '@/theme';
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
 * One line of the contact sheet: a day of the roll, up to three of the frames shot on it, or — under
 * a partial grant — the plate saying the rest of that day is not ours to show.
 */
type Row =
  | { key: string; day: ShootingDay<MediaLibrary.Asset>; frames?: undefined; unseen?: undefined }
  | { key: string; frames: MediaLibrary.Asset[]; day?: undefined; unseen?: undefined }
  | { key: string; unseen: true; day?: undefined; frames?: undefined };

/**
 * Putting material into a memory: consent, the camera roll, «выбрать все за эту дату», a selection
 * to trim, the sending itself — handed to `@/uploads`, which carries on without this screen — and
 * the one question doc-06 asks afterwards. Nothing here asks what the memory's status is: material
 * goes in during the event and long after the montage was made (doc-02).
 *
 * Spec «Экраны»: `Upload`, and its four other faces — `UploadAccess`, `UploadLimited`,
 * `UploadQueue`, `UploadEmpty` — plus the sheet `SheetAskAll`. All of them are this one file: they
 * differ in what the body holds and in whether the bottom layer is there at all.
 */
export default function UploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { color } = useTheme();
  const s = useStrings();
  const styles = useStyles();
  /**
   * One column of the contact sheet, measured instead of flexed — the gallery's sheet carries the
   * long version of why. Short of it: `flex: 1/3` divides what a row has left after its gaps, and a
   * last row of one frame has no gaps to leave, so that frame came out 2pt wider than the rest.
   * This sheet stands inside the screen's own padding, which is what comes off the window here.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - GRID_GAP * 2) / 3 };
  // The whole app's queue; the rows below are this memory's share of it.
  const uploads = useUploads();
  // Checked on mount, asked for only on the button — that is the difference between knowing
  // whether we may look and looking. Nothing below runs until `granted`.
  const [access, ask] = MediaLibrary.usePermissions({ granularPermissions: [...WANTED] });
  const [memory, setMemory] = useState<Memory | null>(null);
  const [gallery, setGallery] = useState<MediaLibrary.Asset[]>([]);
  const [reading, setReading] = useState(true);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
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
    const chosen = gallery.filter((asset) => picked.has(asset.id));
    enqueue(id, chosen);
    setSent((n) => n + chosen.length);
    setPicked(new Set());
  }

  /**
   * The body, in the five states the layout draws it in. A function and not a component: the screen
   * holds every bit of state above, and a component here would be a new type on every render.
   */
  function body() {
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

    return (
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.sheet}
        // Everything the sending and the grant have to say stands above the first day and scrolls
        // away with it: this screen is a contact sheet, and the sheet is what it is for.
        ListHeaderComponent={
          <View style={styles.head}>
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
          </View>
        }
        ListEmptyComponent={
          reading ? (
            <View style={styles.centre}>
              <Waiting text={s.upload.reading} />
            </View>
          ) : (
            // `UploadEmpty` — access given and nothing to give back. No bottom layer under it:
            // there is nothing to offer.
            <Empty
              sign="dashed"
              icon={Smartphone}
              title={s.upload.emptyTitle}
              text={s.upload.emptyText}
            />
          )
        }
        renderItem={({ item: row }) =>
          row.day ? (
            <DayMark
              label={s.upload.shotOn(formatDay(new Date(row.day.at)))}
              // Spec 7.7's fourth kind: under a partial grant the right edge counts what is here
              // rather than offering the whole day, and it is drawn back rather than forward —
              // the rest is not missing, it is unseen. How many that is, the phone never says.
              count={limited ? s.memory.frames(row.day.assets.length) : undefined}
              limited={limited}
            >
              {limited ? null : (
                // The action belongs to this day and says how much of it there is — the layout's
                // «Выбрать все 61», outlined and small, because the glow on this screen is the
                // sending.
                <Button
                  variant="small"
                  label={s.upload.selectDay(row.day.assets.length)}
                  // Out until the whole roll is in hand: the roll arrives 500 at a time, so a day
                  // that straddles a page is still growing, and «все» would take only the head of
                  // it and say nothing about the tail.
                  disabled={reading}
                  onPress={() => pickDay(row.day)}
                />
              )}
            </DayMark>
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
                  // this sheet ever draws — the other two belong to the gallery, where a file is
                  // still being turned into a derivative.
                  state="ready"
                  uri={item.uri}
                  pick={picked.has(item.id) ? 'send' : 'off'}
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
    );
  }

  return (
    <Board>
      <AppBar
        // Spec «Экраны»: «Ваши кадры» over the memory this material is going into. The screen is
        // about the phone's own roll; the memory is the line under it, not the heading.
        title={s.upload.title}
        subtitle={subtitleFor(memory)}
        left={
          // A chevron, which is what every inner bar carries (spec 5): this screen is a step one
          // comes back from. Reached by a tapped push there is nothing behind it, and then the way
          // out is the memory list — the same answer `create` gives.
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />

      <View style={styles.body}>{body()}</View>

      {/* The bottom layer of the third kind, and only once something is picked: with nothing marked
          the layout has no layer at all — `UploadQueue` and `UploadEmpty` are drawn without one. */}
      {picked.size > 0 ? (
        <ActionBar
          above={
            <>
              <Text role="label" style={styles.grow}>
                {/* The total is only worth saying once the whole roll is in hand — half a count is
                    a lie, so until then the selection counts only itself. */}
                {reading
                  ? s.upload.picked(picked.size)
                  : s.upload.pickedOf(picked.size, gallery.length)}
              </Text>
              <Button variant="quiet" label={s.action.clear} onPress={() => setPicked(new Set())} />
            </>
          }
        >
          <Button
            variant="primary"
            wide
            icon={ArrowUp}
            // The count rides in the label, the layout's «Отправить 12 файлов» — it is what the
            // button is about to take with it.
            label={s.upload.send(picked.size)}
            onPress={send}
          />
        </ActionBar>
      ) : null}

      {/* `SheetAskAll` — doc-06's one question, and the person's own answer to it. Both buttons are
          equal in weight: this is their word about themselves, not something wanted from them. */}
      <Sheet
        visible={asking}
        onCancel={() => answerAskAll(false)}
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
            <Button variant="paper" label={s.upload.thatsAll} onPress={() => answerAskAll(true)} />
            <Button
              variant="secondary"
              label={s.upload.moreToCome}
              onPress={() => answerAskAll(false)}
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
 * The line under «Ваши кадры»: which memory this is going into and when it happened. The separator
 * goes with the dates, so a memory whose dates will not read is never left hanging off a «·» —
 * `@/frames` learnt that one the hard way.
 */
function subtitleFor(memory: Memory | null): string | undefined {
  if (memory === null) return undefined;
  const when = formatEventDates(memory.event_start, memory.event_end);
  return when === '' ? memory.title : `${memory.title} · ${when}`;
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 4: the body of this screen starts at 116 on the drawn board, which is the bar's own 44
    // and this under it. The screen's margin is the app's 16.
    body: { flex: 1, paddingHorizontal: space.s4, paddingTop: space.s5 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // No padding of its own: with nothing to say — the plain `Upload` face — this block has to take
    // up no room at all, and the day mark under it brings its own.
    head: { gap: space.s4 },
    // The kit's sheet: 3px between frames, and nothing else — the material is the picture here.
    // The column itself is measured out above; this only holds the gutters between them. Between
    // one day's strip and the next it is the daymark's own padding that opens the gap.
    sheet: { flexGrow: 1, gap: GRID_GAP },
    strip: { flexDirection: 'row', gap: GRID_GAP },
    parked: { gap: space.s2 },
    parkedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    start: { alignSelf: 'flex-start' },
    unseen: { marginTop: space.s5 },
    middle: { textAlign: 'center' },
    grow: { flex: 1, minWidth: 0 },
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
