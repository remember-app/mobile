import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ChevronLeft,
  Download,
  Ellipsis,
  Image as ImageSign,
  Pause,
  Play,
  Share,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadMedia,
  errorMessage,
  fetchFrameInfo,
  memberName,
  type FrameInfo,
  type MediaItem,
  type Member,
  type Memory,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDayShort, formatRuntime, formatTime, formatWeekday } from '@/dates';
import { maySaveToPhone, saveToPhone, shareFile } from '@/downloads';
import {
  frameIndex,
  frameOf,
  mayOpen,
  openFrameOf,
  shotAt,
  shotBy,
  type Frame,
} from '@/frames';
import {
  ActionMenu,
  Banner,
  ConfirmSheet,
  Empty,
  Filmstrip,
  IconButton,
  RowAction,
  VideoTrack,
  ViewerBar,
} from '@/kit';
import { useStrings } from '@/language';
import { FrameInfoSheet } from '@/memory/frames-sheets';
import { useTurnsWithPhone } from '@/orientation';
import { board, height, photo, space, themed, themes, ThemePin } from '@/theme';

/**
 * `Viewer` and `ViewerVideo` (spec 8, «Просмотр медиа») — one frame on the whole of the phone, laid
 * out the way every phone's own gallery lays one out (doc-02): nothing under the picture but the
 * material itself, three pieces of glass floating over it, and the strip of neighbours along the
 * bottom.
 *
 * Three buttons and no row of actions under the strip: «Закрыть», the pill of when and who — which
 * raises the frame's own sheet (`SheetFrameInfo`) — and the «⋯» that drops the glass menu of what
 * can be done with it (`SheetFrame`). What a frame *is* and what is *done* to it used to share one
 * sheet under two names; the layout separates them, and this window says each of them once.
 *
 * Its own file and not the gallery's: this is a screen in everything but the router — it holds what
 * is done to a frame (kept, handed on, deleted) and, for a video, the transport as well. The face
 * behind it owns the material and is told when a record goes.
 *
 * It is mounted by a frame being opened and unmounted by it closing, which is what starts the video
 * playing, what hands the phone its freedom to turn, and what makes «once per opening» need no latch.
 */
export function FrameViewer({
  memoryId,
  item,
  frames,
  roster,
  memory,
  mayDelete,
  nameOf,
  onOpen,
  onClose,
  onRemoved,
}: {
  memoryId: string;
  /** The record on screen, as the face's own list holds it — re-read, and freshly signed with it. */
  item: MediaItem;
  /** The contact sheet rolled into one row: what the strip walks, in the order the grid reads. */
  frames: readonly MediaItem[];
  roster: readonly Member[] | null;
  memory: Memory | null;
  /** Ownership and not role, decided by the face: a viewer may delete what they brought. */
  mayDelete: (item: MediaItem) => boolean;
  /** What a frame is called out as — the face's own answer, so the strip and the grid read alike. */
  nameOf: (item: MediaItem, frame: Frame, current?: boolean) => string;
  onOpen: (id: string) => void;
  onClose: () => void;
  onRemoved: (id: string) => void;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  /** Whether an errand is running on this frame — every button on the window waits for it. */
  const [busy, setBusy] = useState(false);
  /** The one line this window says out loud: saving, sharing, and how either of them went. */
  const [notice, setNotice] = useState<string | null>(null);
  /** The three surfaces over the window: the menu the «⋯» drops, the frame's sheet, the delete. */
  const [menu, setMenu] = useState(false);
  const [details, setDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** What the sheet shows, and the api's word when the one read behind it failed. */
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [infoFailed, setInfoFailed] = useState<string | null>(null);
  /** Which opening of the sheet the read behind it belongs to — see `openInfo`. */
  const opening = useRef(0);

  // A frame shot sideways is worth turning the phone for, and the rest of the app is portrait-only.
  // This component exists for exactly as long as a frame is open, so the flag is simply `true`: the
  // cleanup hands the app back to portrait however the window is left.
  useTurnsWithPhone(true);

  /**
   * The open record read for the whole of the phone and not for a tile: the big derivative, with the
   * grid's thumbnail behind it for one that has none (TASK-120 — the tile's 640px blown up over a
   * phone is mush).
   */
  const shown = openFrameOf(item);
  /** A video is played where it lies; a record whose 720p was never made is a picture again. */
  const playable = item.kind === 'video' ? item.preview_url : null;

  /**
   * One player for the window, made afresh whenever the file under it changes — which is what starts
   * the next video playing as the strip is walked. A photo is a player with no source: the hook
   * cannot be called some renders and not others, and an idle player costs nothing.
   */
  const player = useVideoPlayer(playable, (it) => {
    // Four times a second: the timecode counts in whole seconds and the bar is 300px wide, so
    // anything finer is a render nobody can see.
    it.timeUpdateEventInterval = 0.25;
    it.play();
  });
  // The three events are the nudge to redraw and nothing more: what the transport shows is read off
  // the player itself. `useEvent` keeps the last payload it was handed even when the player under it
  // is replaced, so a walk from one video to the next would otherwise draw the one before it — its
  // timecode under the new picture, and a pause icon over a video that is playing.
  useEvent(player, 'timeUpdate');
  useEvent(player, 'playingChange');
  useEvent(player, 'mutedChange');
  const at = player.currentTime;
  // The api's own length first — it is known before a single byte of the file arrives. The player's
  // is the fallback for a record that came without one, and it is right by the first `timeUpdate`.
  const runs = item.duration_seconds ?? player.duration;
  const isPlaying = player.playing;
  const isMuted = player.muted;

  /** Where along the strip this frame stands, and the strip itself as the library takes it. */
  const index = frameIndex(frames, item.id);
  const strip = useMemo(
    () => frames.map((one) => ({ uri: frameOf(one).uri ?? '', video: one.kind === 'video' })),
    [frames],
  );

  /**
   * One step along the sheet, asked for by name — a tap on the strip. A frame still being
   * developed stays shut: there is nothing behind it to open yet, and it is the same gate the
   * contact sheet puts on the same record.
   */
  function walk(to: number) {
    const next = frames[to];
    if (next && mayOpen(next)) onOpen(next.id);
  }

  /**
   * And the same step asked for by direction — a finger. This one carries on past a frame still
   * developing rather than stopping at it: «the next one» is not «open this one», and a run of
   * records the worker has not finished with is exactly what the top of a sheet looks like minutes
   * after an upload. A wall there is one more «не листается» (TASK-106, TASK-123) with nothing on
   * screen to explain it.
   */
  function stride(by: 1 | -1) {
    for (let to = index + by; to >= 0 && to < frames.length; to += by) {
      if (mayOpen(frames[to])) return onOpen(frames[to].id);
    }
  }

  /** The step as this render knows it, for a gesture that outlives the render it began in. */
  const step = useRef(stride);
  step.current = stride;

  /**
   * The picture is walked with a finger, photographs and videos alike, across the whole gallery
   * (TASK-182) — the gesture the window never had, which is what two reports about «не листается»
   * were really asking for (TASK-123).
   *
   * It lives on the picture and nowhere else. The strip below is the one horizontal scroll in the
   * product, and the scrubber above it is the other sideways gesture — the layout puts each on a
   * line of its own precisely so that no two of them ever share a finger.
   *
   * Built once and never rebuilt, with the step read through the ref above. `PanResponder` keeps
   * how far the finger has come inside the object `create` hands back, so a responder made afresh
   * mid-gesture starts counting from nothing — and this window re-renders four times a second for
   * the whole of a playing video (`timeUpdate`). Rebuilt per render, both thresholds below were
   * measured against whatever scrap of the swipe fell after the last of those renders: the walk
   * worked on a photograph and failed on video, which is the same symptom a third time.
   */
  const swipe = useMemo(
    () =>
      PanResponder.create({
        // A tap belongs to whatever is under it — the pause button in the middle of a video. The
        // walk asks for the finger only once it has plainly gone sideways, and it asks by capture
        // so that a swipe begun on that button is still a swipe.
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          // ponytail: the frame is swapped when the finger lifts, and does not travel under it. A
          // carousel that follows the finger is a second horizontal scroll inside a modal over a
          // player — the exact ground TASK-106 and TASK-123 were lost on. Worth building the day
          // the movement itself is asked for, and not before.
          if (Math.abs(g.dx) < WALK) return;
          step.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );

  /**
   * The frame's own sheet, and the one read behind it — asked for when the pill is pressed and not
   * before: the window opens on a picture, and this is the half of a frame nobody has asked about
   * yet. Read afresh on every opening, because the walk along the strip changes what it is about.
   */
  function openInfo() {
    setMenu(false);
    setDetails(true);
    setInfo(null);
    setInfoFailed(null);
    if (!token) return;
    // Only the latest opening may answer into the sheet. The strip cannot be walked while it is up,
    // but it can be shut and raised again — on the next frame, or on this one — before an earlier
    // read has answered, and that answer landing second would fill the open sheet with the frame
    // before it, or lay a failure of the first read over the details the second one brought.
    const mine = ++opening.current;
    fetchFrameInfo(token, memoryId, item.id).then(
      (read) => {
        if (opening.current === mine) setInfo(read);
      },
      (e: unknown) => {
        if (opening.current === mine) setInfoFailed(errorMessage(e));
      },
    );
  }

  /**
   * «В роликах» — one line of the sheet, and the only thing on it that leads anywhere. It leads to
   * the film on the memory's own screen, which is the product's one player: the layout draws no
   * second one for a frame, and a player of its own here would be a third place a video is watched.
   *
   * One parameter and no more since the memory lost its tabs (TASK-207): `montage` is what raises
   * the player, and the block of films spends it the moment it has. Set on this very screen and not
   * pushed: this window is a part of the memory's route, and a push to that route would stack a
   * second feed of the same memory under the film.
   *
   * The window goes first, and the feed under it is left on the frame it was on.
   */
  function openFilm(montageId: string) {
    setDetails(false);
    onClose();
    router.setParams({ montage: montageId });
  }

  /** The grant, asked for at the moment it is needed, with this window's place to say «no». */
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(s.error.galleryRefused);
    return granted;
  }

  /** The open file, kept. The link is asked for here and not held: it dies in a quarter hour. */
  async function save() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      // The actions here are icons, and an icon has no spinner in it — this line is where «it is
      // doing something» is said, and the next one replaces it with how it went.
      setNotice(s.save.one);
      const { url } = await downloadMedia(token, memoryId, item.id);
      await saveToPhone({ id: item.id, kind: item.kind, url });
      setNotice(s.save.done);
    } catch (e) {
      // The api's own wording when it is the one refusing; past that it is the download or the
      // phone's gallery, and neither is worth blaming the api for.
      setNotice(e instanceof ApiError ? e.message : s.save.failedOne);
    } finally {
      setBusy(false);
    }
  }

  /** The same file handed on instead of kept — out through the phone's own share sheet. */
  async function hand() {
    if (!token) return;
    setBusy(true);
    setNotice(s.viewer.sharing);
    try {
      const { url } = await downloadMedia(token, memoryId, item.id);
      await shareFile({ id: item.id, kind: item.kind, url });
      // Nothing to report: what happened next happened in the phone's own sheet.
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : s.viewer.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteMedia(token, memoryId, item.id);
    } catch (e) {
      // 404 is «it is already gone» — somebody else got there first, which is what was wanted
      // anyway. Everything else stays on screen with a reason.
      if (!(e instanceof ApiError && e.status === 404)) {
        setNotice(
          e instanceof ApiError && e.status === 403 ? s.gallery.deleteDenied : errorMessage(e),
        );
        return;
      }
    } finally {
      setBusy(false);
    }
    onRemoved(item.id);
  }

  /**
   * The two floors of the floating pill (spec 8): «13 сентября» over «21:47 · Марк Ковалёв» — when
   * this frame happened and who brought it. The stamp is the gallery's own reading of when, the day
   * the camera wrote falling back to the day the file arrived, so the pill agrees with the heading
   * the same frame sits under in the feed.
   */
  const stamp = new Date(shotAt(item));
  const when = formatDayShort(stamp);
  const who = memberName(roster?.find((member) => member.id === item.uploaded_by) ?? null);
  const meta = [formatTime(stamp), who].filter(Boolean).join(' · ');

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      // Landscape too: a frame shot sideways is worth turning the phone for.
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* The room is pinned dark for everything the library draws inside it — the strip, the banner,
          the empty state, the glass. The layout gives this window a background darker than `ink` on
          purpose, and in daylight the library would otherwise answer with the light set: a pale
          frame around a photograph, which is the one thing the direction forbids. The two sheets
          below are outside the pin on purpose: a sheet is its own surface over the screen and not
          something inside the room, so it is drawn in the theme the app is actually in. */}
      <ThemePin value="dark">
        <View style={styles.viewer}>
          {/* The frame itself, between the floating bar and the tools under it — the layout's own
              116 above and 148 (196 with a video's scrubber) below. The finger that walks the
              gallery is taken here, on the picture, and never on the strip or the scrubber. */}
          <View
            style={[styles.stage, { paddingTop: insets.top + STAGE_TOP }]}
            {...swipe.panHandlers}
          >
            {playable !== null ? (
              // Streamed off the signed url, index first, so it plays before the whole file is down
              // (doc-02, «Видео в галерее»). Its transport is the row under the strip and the button
              // in the middle of the frame, so the platform's own is off.
              //
              // The picture and its button share one box, and that box is what the stage leaves
              // after its own padding. Hung on the stage instead, the button centres itself over
              // the padding as well — which on a phone is the 116 of floating bar, and puts it
              // visibly above the middle of the frame (reported off a device).
              <View style={styles.big}>
                <VideoView
                  player={player}
                  nativeControls={false}
                  contentFit="contain"
                  style={styles.fill}
                />

                {/* Pause and play, 72 in the middle of the picture — `ViewerVideo` and nowhere
                    else. Glass, like every other button standing on a photograph: the frame has to
                    go on showing through it. `box-none`, so everything around the circle belongs
                    to the picture under it. */}
                <View style={styles.middleOfFrame} pointerEvents="box-none">
                  <IconButton
                    icon={isPlaying ? Pause : Play}
                    label={isPlaying ? s.viewer.pause : s.viewer.play}
                    size={72}
                    tone="viewer"
                    tint={photo.on}
                    onPress={() => (isPlaying ? player.pause() : player.play())}
                  />
                </View>
              </View>
            ) : shown.uri !== null ? (
              // Whole and not cropped: the frame is shown as it was shot even when that is not the
              // shape of the phone, and what is left over at the sides is the room itself.
              //
              // `expo-image` and not React Native's own, for the disk behind it: the same frame
              // opened twice should come off the phone rather than down the wire. What it is filed
              // under has to be said outright — the api signs a fresh url for the same bytes on
              // every read of the gallery (a quarter hour each), so a key made of the url is a fresh
              // download every time the list is re-read. The record's id is what does not move, and
              // which derivative it is rides along: a photo whose big copy the worker has since made
              // must not go on being served the thumbnail filed under the same id.
              <Image
                source={{
                  uri: shown.uri,
                  cacheKey: `${item.id}:${shown.uri === item.preview_url ? 'preview' : 'thumb'}`,
                }}
                style={styles.big}
                contentFit="contain"
              />
            ) : (
              // Nothing was ever made for this one (spec 8, «кадр не загрузился»): the `image` sign
              // and one line, with the strip left exactly where it is — whoever is here can walk
              // straight past it. Said here as well as on the tile, because this is the window the
              // delete is offered from, and a frame nobody can look at is the one somebody wants
              // rid of.
              <View style={[styles.big, styles.blank]}>
                <Empty icon={ImageSign} text={s.viewer.notOpened} />
              </View>
            )}

            {notice ? <Banner text={notice} style={styles.notice} /> : null}
          </View>

          {/* Spec 7.1, the fifth kind of header: three pieces of glass over the photograph and no
              darkening under them — the glass is what carries them now. All the window's controls
              are these three; the pill in the middle is a button like the two round ones. */}
          <ViewerBar
            date={when}
            meta={meta}
            label={`${s.viewer.details}: ${when}, ${meta}`}
            onPress={openInfo}
            style={[styles.bar, { top: insets.top + space.s2 }]}
            left={
              <IconButton
                icon={ChevronLeft}
                label={s.action.close}
                size={height.roundViewer}
                tone="viewer"
                tint={photo.on}
                onPress={onClose}
              />
            }
            right={
              <IconButton
                icon={Ellipsis}
                label={s.viewer.more}
                size={height.roundViewer}
                tone="viewer"
                tint={photo.on}
                onPress={() => setMenu(true)}
                disabled={busy}
                // Spec 7.1, detail 9: the button the menu fell out of stays visible and lit under
                // it, so the menu reads as having come from there and not from the top of the
                // screen. `photo.held` is that light, and it is the only state this button has.
                style={menu ? styles.held : null}
              />
            }
          />

          <View style={[styles.tools, { paddingBottom: Math.max(insets.bottom, board.bottom) }]}>
            {/* The scrubber stands on a line of its own above the strip so that two horizontal
                gestures never fight over the same finger (spec 8, `ViewerVideo`). */}
            {playable !== null ? (
              <VideoTrack
                at={formatRuntime(at) ?? ZERO}
                of={formatRuntime(runs) ?? ZERO}
                value={runs > 0 ? at / runs : 0}
                label={s.viewer.played}
                // Dragged and pressed, not only read: a film nobody can wind is a film watched from
                // the start every time. Nothing to wind until the length is known — the api's own,
                // or the player's once the first `timeUpdate` has been through.
                onSeek={
                  runs > 0
                    ? (to) => {
                        player.currentTime = to * runs;
                      }
                    : undefined
                }
                sound={
                  <IconButton
                    icon={isMuted ? VolumeX : Volume2}
                    label={isMuted ? s.viewer.unmute : s.viewer.mute}
                    size={height.roundRow}
                    tone="ghost"
                    tint={photo.on}
                    onPress={() => {
                      player.muted = !player.muted;
                    }}
                  />
                }
              />
            ) : null}

            <Filmstrip
              frames={strip}
              index={index}
              style={styles.strip}
              labelAt={(to) => nameOf(frames[to], frameOf(frames[to]), to === index)}
              // A tap names the frame it wants, so this is the gate and not the stride: refusing
              // is the honest answer to «open this one», and the two agree on what may open.
              onPick={walk}
            />
          </View>

          {/* `SheetFrame` (spec 8) — the three errands, on glass that falls out of the «⋯» rather
              than rising from the bottom of the screen: what is under the finger is the frame, and
              the menu stands where the frame's own button is. Inside the pinned room, because that
              is where the button it belongs to is; the two sheets below are not.

              «Удалить из воспоминания» is the only red line and the only one that may be missing —
              somebody who may not delete this frame is shown no delete at all, never a grey one.
              It deletes nothing itself either: it hands the window to the sheet that names the
              price. */}
          <ActionMenu
            visible={menu}
            onCancel={() => setMenu(false)}
            top={insets.top + space.s2 + height.roundViewer + space.s2}
            gapBefore={2}
          >
            <RowAction
              icon={Share}
              label={s.action.share}
              onPress={() => {
                setMenu(false);
                void hand();
              }}
            />
            {/* Not gated on anything: a viewer may take home what they are looking at, and the api
                says the same — the download route asks for membership and nothing more. */}
            <RowAction
              icon={Download}
              label={s.viewer.saveToPhone}
              onPress={() => {
                setMenu(false);
                void save();
              }}
            />
            {mayDelete(item) ? (
              <RowAction
                icon={Trash2}
                label={s.viewer.remove}
                danger
                onPress={() => {
                  setMenu(false);
                  setConfirming(true);
                }}
              />
            ) : null}
          </ActionMenu>
        </View>
      </ThemePin>

      {/* `SheetFrameInfo` — everything the picture does not say, and nothing to press on it but a
          movie this frame ended up in. Read when it is opened; the head is known already. */}
      <FrameInfoSheet
        visible={details}
        thumb={item.thumbnail_url ?? undefined}
        title={`${when}, ${formatTime(stamp)}`}
        meta={[formatWeekday(stamp), memory?.title].filter(Boolean).join(' · ')}
        info={info}
        error={infoFailed}
        onFilm={openFilm}
        onClose={() => setDetails(false)}
      />

      {/* `SheetConfirmDelete`: irreversible, and the api takes the bytes with it — worth one
          question first, asked on a sheet that shows the frame it is about and names the price in
          full, never by the system dialog. */}
      <ConfirmSheet
        visible={confirming}
        thumb={item.thumbnail_url ?? undefined}
        meta={shotBy(item, roster, memory)}
        title={s.gallery.deleteAsk(item.kind)}
        text={s.gallery.deleteText}
        confirmLabel={s.action.delete}
        cancelLabel={s.gallery.keep}
        onConfirm={() => {
          setConfirming(false);
          void remove();
        }}
        onCancel={() => setConfirming(false)}
      />
    </Modal>
  );
}

/** What a timecode says before there is anything to count — «0:00» in every language. */
const ZERO = '0:00';

/** How far sideways a finger has to go before the picture takes it from whatever is under it. */
const SIDEWAYS = 12;

/** And how far in all, for a lift to mean «the next one» rather than «I changed my mind». */
const WALK = 56;

/**
 * What the floating bar takes off the top of the picture: the 48 button plus the 8 above and below
 * it. The layout's 116 is this measured from a 52 status line.
 */
const STAGE_TOP = height.roundViewer + space.s2 * 2;

/**
 * The window is a dark room in both themes — the layout gives it a background darker than `ink` on
 * purpose, or the mount pulls the eye off the photograph. Everything the library draws inside takes
 * the pin with it; these are the few colours this file names itself.
 */
const room = themes.dark.color;

const useStyles = themed(() =>
  StyleSheet.create({
    viewer: { flex: 1, backgroundColor: room.ink },
    // The picture takes what is left between the floating bar and the tools, and is centred in it.
    stage: { flex: 1, justifyContent: 'center' },
    big: { flex: 1, width: '100%' },
    fill: { flex: 1 },
    blank: { justifyContent: 'center' },
    // Over the picture's own box and not the stage's, which is what puts the button in the middle
    // of the frame rather than in the middle of what is left over above it.
    middleOfFrame: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bar: { position: 'absolute', left: 0, right: 0 },
    // Over the picture and at the foot of it: the strip below stays the only thing under it.
    notice: { position: 'absolute', left: space.s4, right: space.s4, bottom: space.s4 },
    // The strip and, over a video, its scrubber — and nothing else: the picture above ends where
    // this begins, which is what keeps a whole frame whole.
    tools: { gap: space.s3, paddingTop: space.s3 },
    // A horizontal list in a column takes every pixel it is offered unless it is told its own size.
    strip: { flexGrow: 0 },
    // The «⋯» while its menu is out (spec 7.1, detail 9).
    held: { backgroundColor: photo.held },
  }),
);
