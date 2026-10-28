// `expo-image` and not React Native's own, here as in the kit's tile: a frame picked out of the
// phone's gallery is named by a `ph://` reference to the photo library, which React Native has no
// loader for at all — that is the red «No suitable image URL loader» screen.
import { Image } from 'expo-image';
// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/lib/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import type * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, Check, ChevronLeft, CircleCheckBig, Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listMedia, listMemories, type MediaItem, type Memory } from '@/api';
import {
  ActionBar,
  Banner,
  BlockStuck,
  Board,
  Button,
  ConfirmSheet,
  DashedNote,
  DayHead,
  DayMark,
  FEED_GAP,
  GlassBar,
  HintNote,
  Icon,
  IconButton,
  Sheet,
  seamsOver,
  Text,
  Tile,
  Upload,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatRuntime, formatWeekday } from '@/lib/dates';
import { useDensity } from '@/lib/density';
import { type Failure, failure } from '@/lib/failure';
import { rowsOf } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { assetsByDay, type ShootingDay } from '@/lib/media-window';
import { alreadyThere } from '@/lib/upload/already';
import { type ParkedFile, parkedReason, progress } from '@/lib/upload/queue';
import { answerAskAll, drop, enqueue, useAskAll, useUploads, wake } from '@/lib/upload/send';
import { DensityPill, useDensityPinch } from '@/screens/memory/frames-density';
import { NoFeed } from '@/screens/upload/message';
import { useRoll } from '@/screens/upload/roll';
import {
  board,
  height,
  radius,
  space,
  ThemePin,
  themed,
  themes,
  uploadGaps,
  useTheme,
} from '@/theme';

/**
 * A frame opened full screen stays a dark room whatever the app's theme is (spec 2, and the kit's
 * one deliberate pin): around a photograph there must be nothing brighter than the photograph.
 */
const room = themes.dark.color;

/**
 * One line of the feed: a day of the roll, up to three of the frames shot on it — `lead` for the
 * first strip under its day, which stands flush with the day where the others keep a gutter — or,
 * under a partial grant, the plate saying the rest of that day is not ours to show.
 */
type Row =
  | { key: string; day: ShootingDay<MediaLibrary.Asset>; frames?: undefined; unseen?: undefined }
  | {
      key: string;
      frames: MediaLibrary.Asset[];
      lead: boolean;
      day?: undefined;
      unseen?: undefined;
    }
  | { key: string; unseen: true; day?: undefined; frames?: undefined };

const SeamCell = seamsOver<Row>((row) => row.day !== undefined);

/**
 * «Добавить кадры» — putting material into a memory: consent, the camera roll drawn the way a
 * memory's own feed is — three to a row, edge to edge, the date standing between one day and the
 * next — the selection to trim, and the sending itself (handed to `@/lib/upload/send`, which carries
 * on without this screen). What was already given lives on «Мои кадры» (`mine.tsx`), not here.
 * Nothing here asks what the memory's status is: material goes in during the event and long after
 * the montage was made (doc-02).
 *
 * Spec «Экраны»: `Upload`, and its four other faces — `UploadAccess`, `UploadLimited`,
 * `UploadQueue`, `UploadEmpty` — plus the sheet `SheetAskAll`. `UploadQueue` is a route of its own
 * (`queue.tsx`, this screen with `queue` on): «Отправить» hands the pick over and moves there, and
 * «Разобрать» on «Мои кадры» leads there. Two faces the layout draws apart (28 October):
 *
 * - **a feed** (`Upload`, `UploadQueue`, `UploadLimited`) — the roll edge to edge under the glass
 *   bar, the days as seams between them, the send button floating over the photographs: one look for
 *   all three, because they are one screen's states. What tells them apart is only what is said over
 *   the roll — the sending and what did not go, or the partial grant;
 * - **no feed** (`UploadAccess`, `UploadEmpty`, the waits) — the same glass bar over a message, and
 *   no bottom layer: there is nothing to pick and nothing to send (28 October).
 */
export default function UploadScreen({ queue = false }: { queue?: boolean }) {
  // `sent` is what the picking face handed over on its way here, for «Это всё?» to count.
  const { id, sent: handed } = useLocalSearchParams<{ id: string; sent?: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const { color } = useTheme();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /**
   * Where the content under the glass bar begins: spec 4's 108 — the status line, the bar's own 48
   * and 8 under it. The feed's roll and the message card of a face with no feed start on the same
   * line, the one screen's order (28 October); the phone's status line is measured, not assumed.
   */
  const underBar = insets.top + height.roundViewer + space.s2;
  // As many across as the person stands at (`@/lib/density`) — this roll is cut the way the
  // memory's own feed is cut, and the setting is the same one, the single frame of the scale
  // (spec 10.14.2) included: the pinch below walks it right on the roll.
  const density = useDensity();
  const pinch = useDensityPinch();
  // The whole app's queue; the rows below are this memory's share of it.
  const uploads = useUploads();
  /**
   * The phone's own roll, whole — its own module: the grant, the paging and the one line for a
   * gallery that would not open are a subject apart from what this screen does with what it finds.
   */
  const {
    access,
    ask,
    granted,
    limited,
    assets: gallery,
    reading,
    error: galleryError,
    again,
    chooseMore,
  } = useRoll();
  const [memory, setMemory] = useState<Memory | null>(null);
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
  const [sent, setSent] = useState(() => Number(handed) || 0);
  /** Whether the failures folded away under the first two are open (spec detail 78). */
  const [unfolded, setUnfolded] = useState(false);
  // Its own and not the roll's, because the two cost different things. A gallery that will not
  // open leaves nothing to put on the screen; an api that cannot be reached only costs the event
  // dates — picking and queueing carry on, which is the whole point of a queue that waits.
  const [apiError, setApiError] = useState<Failure | null>(null);
  /**
   * What this person already gave this memory — the listing narrowed to their own records, read
   * beside the memory itself and checked against before anything is sent (TASK-584).
   */
  const [brought, setBrought] = useState<MediaItem[] | null>(null);
  /**
   * The picked files once some of them are already in: held while the question is up, so the
   * sending waits for the person's word on which copies go.
   */
  const [repeat, setRepeat] = useState<{
    all: MediaLibrary.Asset[];
    fresh: MediaLibrary.Asset[];
    count: number;
  } | null>(null);

  /**
   * The roll as the kit lays it out: the day it was shot on, then that day's frames as many to a
   * row as the account stands at, then the next day — the event's days first. Flat, and cut by hand,
   * because that is what `numColumns` does to a list underneath and a list cannot do it around the
   * days standing between the strips. A day holding its own frames would read better and would mount
   * a wedding — six hundred frames on one day, the day this screen floats to the top — in a single
   * item.
   *
   * Held across renders: every tap on a frame is a render, and the cut runs over the whole camera
   * roll, which is thousands of rows on a phone that has had one a while.
   */
  const rows = useMemo(
    () =>
      assetsByDay(memory, gallery).flatMap((day): Row[] => [
        { key: `day-${day.at}`, day },
        ...rowsOf(day.assets, density).map((strip, i) => ({
          key: strip[0].id,
          frames: strip,
          lead: i === 0,
        })),
        // What a partial grant leaves out is said under the strip it is missing from, and nowhere
        // else: a day of three frames out of sixty otherwise reads as a day when nobody shot.
        ...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),
      ]),
    [memory, gallery, limited, density],
  );

  const load = useCallback(() => {
    if (!token) return;
    setApiError(null);
    // The same road the memory screen takes, and for the same reason: the event window lives on
    // the memory, this list already hands it out, and it works however the screen was reached —
    // a tapped push included, which arrives with nothing but an id.
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setApiError(failure(e)),
    );
  }, [token, id]);

  useEffect(load, [load]);

  const me = user?.id;
  /**
   * This person's own records in the memory — hidden ones included, since a frame taken out of the
   * shared feed is still a file they have already given. `mine.tsx` reads «my own» by the same
   * `uploaded_by === user.id`.
   */
  const readBrought = useCallback(async (): Promise<MediaItem[]> => {
    if (!token || me === undefined) return [];
    const all = await listMedia(token, id, { hidden: true });
    return all.filter((item) => item.uploaded_by === me);
  }, [token, id, me]);

  useEffect(() => {
    let live = true;
    // Only the «already here» question is at stake: an api that will not answer leaves it unasked
    // and the sending goes the way it always did, so this never raises the screen's banner.
    readBrought().then(
      (own) => live && setBrought(own),
      () => live && setBrought([]),
    );
    return () => {
      live = false;
    };
  }, [readBrought]);

  function retry() {
    load();
    again();
  }

  // This memory's share of the queue: the one going up right now, and the ones parked — said on the
  // queue's face alone. One bar for the whole sending and not thirty-four (spec 7.6), and every file
  // that did not go in one block under it.
  const queued = queue ? uploads.filter((file) => file.memoryId === id) : [];
  const sending = queued.find((file) => file.error === undefined);
  const stuck = queued.filter((file): file is ParkedFile => file.error !== undefined);

  /**
   * doc-06, and the layout's `SheetAskAll`: asked once, and only once everything this visit sent is
   * actually in — «блок отправки уступает место листу „Это всё?“». The api decides *whether* to ask
   * (`@/lib/upload/send`), this decides *when*, and the count beside the question is what went.
   *
   * A question raised while somebody was on another screen waits in the queue's own state until the
   * next time they send something from here, which is the next moment the sheet can count anything.
   */
  const asking = useAskAll() === id && sent > 0 && queued.length === 0;

  const feed = granted && rows.length > 0;
  /**
   * A face with no feed has nothing to pick and nothing to press, so choosing is on there whatever
   * the switch was left at; where there is a feed, the switch on the glass bar is the word — the
   * queue's bar carries it too (28 October).
   */
  const choosing = picking || !feed;
  // The gutter of the grid (spec 7.8), and the column measured out of the window rather than flexed
  // — `flex: 1/3` divides what a row has left after its gaps, and a last row of one frame has none
  // to leave, so it came out wider than the rest. Every feed runs edge to edge, with no margin at
  // all. At the single frame the gutter is nothing, so one frame stands the whole width (spec
  // 10.14.2).
  const gap = density === 1 ? 0 : FEED_GAP;
  const cell = { width: (width - gap * 2) / density };

  /** Whether every frame of a day is taken. */
  const dayTaken = (day: ShootingDay<MediaLibrary.Asset>) =>
    day.assets.every((asset) => picked.has(asset.id));

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

  /**
   * Where the picking ends and the sending starts. The selection is handed to the queue and this
   * screen is done with it: the queue holds it on disk, sends it part by part, and picks up again
   * by itself if the network or the app goes away mid-file. Offline is not a refusal here — the
   * files wait in the queue exactly as they do when a tunnel swallows them halfway.
   *
   * First, though, a file this person already gave this memory is not sent again in silence
   * (TASK-584). The match is soft (`@/lib/upload/already`), so it asks and never refuses: «Да»
   * takes every picked file, «Нет» only the new ones.
   */
  async function send() {
    const chosen = gallery.filter((asset) => picked.has(asset.id));
    if (chosen.length === 0) return;
    // A list still on its way is read now rather than let past: the check is what keeps a copy out
    // of the memory, and it costs one request only on the rare sending that beats the screen's own.
    const own = brought ?? (await readBrought().catch(() => [] as MediaItem[]));
    const repeats = await alreadyThere(chosen, own);
    if (repeats.size === 0) return hand(chosen);
    setRepeat({
      all: chosen,
      fresh: chosen.filter((asset) => !repeats.has(asset.id)),
      count: repeats.size,
    });
  }

  /** The chosen files to the queue, and the screen on to the sending. */
  function hand(chosen: readonly MediaLibrary.Asset[]) {
    // «Нет» with nothing new among the picks: they were all copies, and there is nowhere to go.
    if (chosen.length === 0) {
      setPicked(new Set());
      return;
    }
    enqueue(id, chosen);
    setPicked(new Set());
    // Spec 8, `Upload`: «отправка идёт — UploadQueue». The picking face hands over and gives way to
    // the queue's own, which says how it goes and asks «Это всё?» once it is all in.
    if (!queue) {
      router.replace({
        pathname: '/memory/[id]/queue',
        params: { id, sent: String(sent + chosen.length) },
      });
      return;
    }
    setSent((n) => n + chosen.length);
  }

  /** The way out. Reached by a tapped push there is nothing behind it, so the list is the answer. */
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** What a frame is called out as — the phone's own filename, which is never translated. */
  const nameOf = (asset: MediaLibrary.Asset) =>
    `${asset.mediaType === 'video' ? s.media.video : s.media.photo} ${asset.filename}`;

  // Everything the sending and the grant have to say. It stands over the feed and scrolls away with
  // it, and on a screen with no feed at all — an empty gallery with a queue still going — it stands
  // over whatever is being said instead.
  const said = apiError !== null || queued.length > 0 || limited || (reading && rows.length > 0);

  function blocks() {
    return (
      <>
        {/* Said, not shown as a dead end: without the api there is no event window, so the roll
            is cut into its days all the same but none of them is lifted to the top as the
            event's. Picking — by hand or by the day — and queueing both still work. */}
        {apiError !== null ? (
          <Banner tone="error" failure={apiError}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : null}

        {/* `UploadQueue`. One bar for the lot: it stands at whatever the file going up right now
            has sent, and the count beside it is what is still owed to this memory. The heading is
            the same block's, saying which of the two the file is doing: going up, or still coming
            down out of iCloud before it can (TASK-419). */}
        {queued.length > 0 ? (
          <Upload
            title={sending?.cloud ? s.upload.fromCloud : s.state.sending}
            meta={s.upload.stillToSend(queued.length)}
            value={sending ? progress(sending) : 0}
            hint={s.upload.carriesOn}
          />
        ) : null}

        {/* Every file that did not go, in one block (spec detail 78): its name, why, and a cross
            for a file somebody would rather not send after all. The queue retries by itself — on a
            timer and on coming back to the app — so «Ещё раз» is for whoever would rather not wait
            for either. The freshest stand first: the pump goes down the queue in order, so the last
            ones in it are the last to have stopped. */}
        {stuck.length > 0 ? (
          <BlockStuck
            title={s.upload.notSent(stuck.length)}
            retry={{ label: s.upload.again, onPress: wake }}
            // The queue keeps the reason and not the sentence, so the words are picked here, in the
            // language this render is in — a language switched while they sit parked turns these
            // lines with the rest of the screen (TASK-93).
            lines={[...stuck].reverse().map((file) => ({
              key: file.assetId,
              name: file.filename,
              reason: parkedReason(s, file.error),
              dropLabel: s.upload.dropFile(file.filename),
              onDrop: () => drop(id, file.assetId),
            }))}
            open={unfolded}
            onToggle={() => setUnfolded((was) => !was)}
            more={s.upload.folded(stuck.length - 2)}
            less={s.upload.fold}
          />
        ) : null}

        {/* `UploadLimited`: what is on this screen is what was handed over, and the days below
            carry counts instead of «Выбрать все» — there is nothing to select all of. */}
        {limited ? (
          <HintNote
            icon={Info}
            tone="spark"
            text={s.upload.limited}
            action={{ label: s.upload.chooseMore, onPress: () => void chooseMore() }}
          />
        ) : null}

        {/* Why a day's «Выбрать все» is out: the roll is still arriving, and a count taken
            halfway through it would pick the head of a day and say nothing about the tail. */}
        {reading && rows.length > 0 ? <Text role="meta">{s.upload.reading}</Text> : null}
      </>
    );
  }

  /**
   * The bottom layer of the third kind, and only while something can be sent: with picking off the
   * feed is just a feed, and `UploadAccess`, `UploadEmpty` and the rest are drawn with no layer at
   * all. With nothing going, the button stands there from the start and is simply out until
   * something is marked — the layout would rather show what this screen is for than hide it. While
   * something is going it stands only once something is marked (`UploadQueue`): the sending is what
   * that screen is about, and a button with nothing to send would argue with it. On every face with
   * a feed it floats over the photographs on the deepest footer, the one that lies on them — the
   * queue's grid and the partial grant's among them (28 October), where before they stood in the
   * board's own footer under the grid.
   *
   * The count over the button is `UploadLimited`'s alone (spec 8): everywhere else the number rides
   * in the button, and a day or a frame is let go of by a tap on it. With that count standing over
   * it, the footer is the shallower `count` — the layout draws `UploadLimited`'s 176 and not the 210
   * of the queue's own.
   */
  const layer =
    feed && choosing && (picked.size > 0 || queued.length === 0) ? (
      <ActionBar
        style={styles.layer}
        footer={limited ? undefined : 'upload'}
        above={
          limited && picked.size > 0 ? (
            <>
              <Text role="label" style={styles.grow}>
                {/* The total is only worth saying once the whole roll is in hand — half a count
                    is a lie, so until then the selection counts only itself. */}
                {reading
                  ? s.upload.picked(picked.size)
                  : s.upload.pickedOf(picked.size, gallery.length)}
              </Text>
              {/* 14 / 600 (`UploadLimited`): a quiet button's words are the place's own. */}
              <Button
                variant="quiet"
                labelRole="controlSm"
                label={s.action.clear}
                onPress={() => setPicked(new Set())}
              />
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
    ) : null;

  /**
   * A day over its frames — spec 7.8's seam of the third kind: «13 сентября, суббота» and how many,
   * with the band itself taking the day and giving it back. The picking face and the queue's grid
   * draw one and the same day; only a partial grant differs, having no whole day to take and counting
   * what is here instead (`UploadLimited`). The press is out until the whole roll is in hand: it
   * arrives 500 at a time and a day that straddles a page is still growing, so «все» would take only
   * its head.
   */
  function dayOf(day: ShootingDay<MediaLibrary.Asset>) {
    const at = new Date(day.at);
    const frames = day.assets.length;
    const takes = choosing && !limited && !reading;
    if (limited) {
      return <DayHead label={s.upload.shotOn(formatDay(at))} count={s.memory.frames(frames)} />;
    }
    const label = `${formatDay(at)}, ${formatWeekday(at)}`;
    return (
      <DayMark
        label={label}
        count={String(frames)}
        picked={dayTaken(day)}
        onPress={takes ? () => toggleDay(day) : undefined}
        pressLabel={dayTaken(day) ? s.upload.leaveDay(label) : s.upload.takeDay(label)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* The board keeps nothing back for the status line: the photographs and the message run
          under the glass bar, whose own darkening is what makes the glyphs on it readable (spec
          7.1). The bar is not the board's own: it floats over the whole screen, message face too. */}
      <Board
        style={styles.bleed}
        body={styles.body}
        list={
          feed
            ? () => (
                // The roll stands in a view of its own so a two-finger pinch is taken off the scroll
                // before it begins (spec 10.14.1); a one-finger drag scrolls the roll as it always did.
                <View style={styles.pinch} testID="density-pinch" {...pinch.panHandlers}>
                  <FlatList
                    data={rows}
                    keyExtractor={(row) => row.key}
                    // A day's band lies over the strips either side of it (spec detail 65).
                    CellRendererComponent={SeamCell}
                    contentContainerStyle={[
                      styles.feed,
                      {
                        // Spec 4: the roll starts on the body's own line under the glass bar and ends
                        // clear of the bottom layer, where there is one.
                        paddingTop: underBar,
                        paddingBottom: picking ? board.footerTall : space.s5,
                      },
                    ]}
                    // What is said over the roll is the only thing here that is not a photograph, so the
                    // only thing that takes the screen's own margin — and only when it has something to
                    // say, so the first day stands directly under the bar.
                    ListHeaderComponent={
                      said ? (
                        <View style={[styles.head, styles.headFeed, styles.headSaid]}>
                          {blocks()}
                        </View>
                      ) : null
                    }
                    renderItem={({ item: row }) =>
                      row.day ? (
                        dayOf(row.day)
                      ) : row.unseen ? (
                        <DashedNote text={s.upload.restUnseen} style={styles.unseen} />
                      ) : (
                        // A day's strips a gutter apart, and its first one flush with the day over it.
                        <View style={[styles.strip, { gap, marginTop: row.lead ? 0 : gap }]}>
                          {row.frames.map((item) => (
                            <Tile
                              key={item.id}
                              // Every frame here is one the phone already holds, so `ready` is the only
                              // state this feed ever draws — the other two belong to the gallery, where
                              // a file is still being turned into a derivative.
                              state="ready"
                              // The feed's own lane, with no rounding and the 24 circle in the corner
                              // — the queue and the partial grant wear it too (spec 7.8, 28 October).
                              lane="feed"
                              uri={item.uri}
                              // No circle at all with picking off: a frame that is not being picked is
                              // not a checkbox, and the layout takes the circles away with the mode.
                              pick={choosing ? (picked.has(item.id) ? 'send' : 'off') : undefined}
                              // The kit marks a video by how long it runs rather than by the word
                              // «video».
                              length={
                                item.mediaType === 'video'
                                  ? formatRuntime(item.duration)
                                  : undefined
                              }
                              label={nameOf(item)}
                              onPress={() => (choosing ? toggle(item.id) : setOpen(item))}
                              style={cell}
                            />
                          ))}
                        </View>
                      )
                    }
                  />
                </View>
              )
            : undefined
        }
      >
        {feed ? null : (
          <>
            {/* A face with no feed keeps the same body under the same glass: the card at 108, the
                middle of the whole screen for what stands in place of a roll (spec 4, 28 October). */}
            {said ? (
              <View style={[styles.head, styles.headSaid, { marginTop: underBar }]}>
                {blocks()}
              </View>
            ) : null}
            <NoFeed
              error={galleryError}
              access={access}
              ask={ask}
              reading={reading}
              onRetry={retry}
              top={said ? 0 : underBar}
            />
          </>
        )}
        {feed ? layer : null}

        {/* Picking off, a tap opens the frame instead — the phone's own copy, at the size it was shot.
          ponytail: a video shows the poster the library hands back and does not play; the frame that
          plays is the one already in a memory (`src/screens/memory/frame-viewer.tsx`). The day somebody
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
          // Spec 8, `SheetAskAll`: the line of what went, then the question with its paragraph 8 under
          // it, one block with it.
          head={
            <View style={styles.result}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.tick}
              >
                <Icon icon={Check} size={15} color={color.sparkInk} />
              </View>
              <Text role="rowSm">{s.upload.sentToMemory(sent)}</Text>
            </View>
          }
          title={s.upload.askAll}
          lead={
            <Text role="bodySm" tone="muted">
              {s.upload.askAllText}
            </Text>
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
        />

        {/* TASK-584: some of the picks are already in, and the answer decides which copies go.
            The gentle kind — nothing is lost, and this is the person's word about their own
            material. «Да» sends everything, «Нет» sends only the new files. */}
        <ConfirmSheet
          visible={repeat !== null}
          variant="gentle"
          title={s.upload.alreadyThere(repeat?.count ?? 0)}
          text={s.upload.alreadyThereText}
          confirmLabel={s.upload.alreadyYes}
          cancelLabel={s.upload.alreadyNo}
          onConfirm={() => {
            const chosen = repeat?.all ?? [];
            setRepeat(null);
            hand(chosen);
          }}
          onCancel={() => {
            const chosen = repeat?.fresh ?? [];
            setRepeat(null);
            hand(chosen);
          }}
        />
      </Board>

      {/* Over the whole screen and not above it, which is what makes it glass. «Добавить кадры»
          over the memory this material is going into — a plate and not a button: the memory's own
          screen is behind «Назад», and there is nothing else here to open. A face with no feed
          keeps the bar and its empty right slot, having nothing there to pick (28 October). */}
      <GlassBar
        style={styles.glass}
        title={s.upload.title}
        meta={memory ? s.upload.into(memory.title) : undefined}
        // The density pill takes the capsule's slot for as long as the pinch walks it, and the
        // 200ms it takes to fade — the capsule itself is back the moment the fingers lift.
        middle={
          feed && (pinch.pinching || pinch.leaving) ? (
            <DensityPill value={density} leaving={pinch.leaving} />
          ) : undefined
        }
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
          feed ? (
            <IconButton
              icon={CircleCheckBig}
              label={s.upload.picking}
              tone="glass"
              size={height.roundViewer}
              on={picking}
              onPress={() => setPicking((was) => !was)}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Nothing is kept back for the status line — the glass bar is what stands there, over the
    // photographs and over a message alike (28 October).
    bleed: { paddingTop: 0 },
    // The feed is the kit's own: edge to edge, and a day's seam flush with the strips on both sides
    // of it (`Upload`: the seam 108–128, the first frames at 128) — the gutter is between strips.
    feed: { flexGrow: 1 },
    // The bar floats over the whole screen, so the body is a sibling of the board and not a child
    // of it: this keeps the two on the same frame.
    screen: { flex: 1 },
    // A face with no feed: the screen's margin of 16, and the whole height of the body under the
    // glass for what stands in place of the roll — an empty state is centred on it, not under the
    // bar (spec 4, `UploadEmpty`).
    body: { paddingHorizontal: space.s4 },
    // The view the roll and the pinch stand in: nothing of its own but the room the list fills.
    pinch: { flex: 1 },
    strip: { flexDirection: 'row' },
    // What the sending and the grant have to say, 16 apart (`UploadQueue`).
    head: { gap: space.s4 },
    // Over the feed it takes the margin the photographs do not…
    headFeed: { paddingHorizontal: space.s4 },
    // …and stands clear of the first day.
    headSaid: { paddingBottom: space.s4 },
    glass: { position: 'absolute', left: 0, right: 0, top: 0 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    unseen: { marginTop: uploadGaps.unseen },
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
