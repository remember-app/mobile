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
import { Modal, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadMedia,
  errorMessage,
  type FrameInfo,
  fetchFrameInfo,
  type MediaItem,
  type Member,
  type Memory,
  memberName,
} from '@/api';
import {
  ActionMenu,
  Banner,
  ConfirmSheet,
  Empty,
  Filmstrip,
  ICO_S,
  IconButton,
  RowAction,
  STRIP_STANDING,
  STRIP_TURNED,
  VideoTrack,
  ViewerBar,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDayShort, formatRuntime, formatTime, formatWeekday } from '@/lib/dates';
import { maySaveToPhone, saveToPhone, shareFile } from '@/lib/downloads';
import {
  type Frame,
  frameIndex,
  frameOf,
  mayOpen,
  openFrameOf,
  shotAt,
  shotBy,
} from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { useTurnsWithPhone } from '@/lib/orientation';
import { FrameInfoSheet } from '@/screens/memory/frames-sheets';
import { height, photo, space, ThemePin, themed, viewerFoot, viewerShade } from '@/theme';

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
  /** The film the sheet asked for, held while this window shuts and raised once it is gone. */
  const [film, setFilm] = useState<string | null>(null);
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
   * Which way up the phone is right now, and the four numbers that follow from it (spec 8, the four
   * `Viewer*` layouts, TASK-475). The window is the one screen in the app that turns with the
   * phone, so it has four shapes to be right in rather than one — and it reads which one off the
   * screen itself rather than off the sensor, because a layout that lies about which way up the
   * phone is held draws the standing one, and the screen is the thing being drawn.
   *
   * Landscape is a phone wider than it is tall, and nothing else: the viewer does not care whether
   * it is held on its left side or its right, only that there is more width than height.
   */
  const { width, height: screen } = useWindowDimensions();
  const turned = width > screen;
  /** The strip's own sizes, and the darkening's own depth — one pair per way up. */
  const stripSize = turned ? STRIP_TURNED : STRIP_STANDING;
  const shade = turned ? viewerShade.turned : viewerShade.standing;

  /**
   * The open record read for the whole of the phone and not for a tile: the big derivative, with the
   * grid's thumbnail behind it for one that has none (TASK-120 — the tile's 640px blown up over a
   * phone is mush).
   */
  const shown = openFrameOf(item);
  /** A video is played where it lies; a record whose 720p was never made is a picture again. */
  const playable = item.kind === 'video' ? item.preview_url : null;

  /**
   * The box the frame is drawn in, which is the whole of the change (TASK-475, spec 8, the four
   * `Viewer*` layouts). It used to be `contentFit="contain"` in a box the stage happened to have,
   * and that is what left a horizontal frame small and centred on the screen: contained, a 3:2
   * photograph is two thirds of the width of a phone held upright and half of one held sideways.
   *
   * What the layout draws instead is the frame in a box of its own proportions, which comes to the
   * whole width of the screen upright and the whole of its height turned, and the picture `cover`ed
   * into it. 390 × 520 upright for a 3:4 frame, 390 × 260 for a 3:2 one; 585 × 390 turned for that
   * same 3:2, 293 × 390 for the 3:4 — the layout's own numbers, and every one of them is a frame's
   * own shape as wide as it can go without leaving the screen.
   *
   * So: the frame's proportions, the screen's long side, and the frame laid along whichever of the
   * two will hold it. A record the api has not measured yet — `width` and `height` are null until
   * the worker has looked at it — has no proportions to lay out, and takes the whole screen: that
   * is a frame shown as it is rather than a guessed shape, and it lasts until the numbers arrive.
   */
  const box = frameBox(item.width, item.height, width, screen);

  /**
   * How tall the tools lying over the picture come out — the strip, its own distance from the bottom
   * edge, and over a video its scrubber above that (`ViewerVideo` puts the two on lines of their
   * own, and the sound button is what makes the scrubber row 36). The notice stands above this
   * rather than at the bottom of the stage, which is the whole of the picture now (TASK-475).
   */
  const toolsTall =
    stripSize.tall + stripSize.foot + (playable !== null ? viewerFoot.track + height.roundRow : 0);

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
   * The window goes first, and only once it is gone is the ask made: the player is a `Modal` too,
   * and iOS swallows a `Modal` raised while another is still being dismissed. So this one shuts and
   * says so (`onDismiss`), and `raiseFilm` runs then. Android has no such event and no such
   * trouble, so it runs at once. The feed under is left on the frame it was on either way.
   */
  function openFilm(montageId: string) {
    setDetails(false);
    setFilm(montageId);
    if (Platform.OS !== 'ios') raiseFilm(montageId);
  }

  function raiseFilm(montageId: string) {
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
      // Shut, and not unmounted, when a film is asked for: the event that says the window is gone
      // is only heard from a `Modal` that is still there to hear it.
      visible={film === null}
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        if (film !== null) raiseFilm(film);
      }}
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
          {/* The frame itself, centred in the whole of the phone — the layout draws it in a box of
              its own proportions (spec 8, `Viewer*`), and the glass above and the strip under it lie
              over it rather than taking room away from it. The finger that walks the gallery is
              taken here, on the picture, and never on the strip or the scrubber. */}
          <View style={styles.stage} {...swipe.panHandlers}>
            {playable !== null ? (
              // Streamed off the signed url, index first, so it plays before the whole file is down
              // (doc-02, «Видео в галерее»). Its transport is the row under the strip and the button
              // in the middle of the frame, so the platform's own is off.
              //
              // The picture and its button share one box, and that box is the frame's own — hung on
              // the stage instead, the button would centre itself over whatever the stage has left
              // over rather than over the frame (reported off a device, TASK-181).
              <View style={[styles.big, box]}>
                <VideoView
                  player={player}
                  nativeControls={false}
                  // `cover` and not `contain`, like the photograph below and for the same reason:
                  // the box already carries the frame's own proportions, so this fills it rather
                  // than letterboxing inside a box that is already the right shape (TASK-475).
                  contentFit="cover"
                  style={styles.fill}
                />

                {/* Pause and play, 72 in the middle of the picture — `ViewerVideo` and nowhere
                    else. Dark and not glass (spec 7.2): the viewer's glass vanishes over a bright
                    frame, and this glyph has to hold over any. `box-none`, so everything around the
                    circle belongs to the picture under it. */}
                <View style={styles.middleOfFrame} pointerEvents="box-none">
                  <IconButton
                    icon={isPlaying ? Pause : Play}
                    label={isPlaying ? s.viewer.pause : s.viewer.play}
                    size={72}
                    tone="video"
                    onPress={() => (isPlaying ? player.pause() : player.play())}
                  />
                </View>
              </View>
            ) : shown.uri !== null ? (
              // In the frame's own box, covered rather than contained (TASK-475): a horizontal
              // frame used to be `contain`ed into whatever room was left between the glass and the
              // strip, which left it small and centred on the screen — the whole of this task.
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
                style={[styles.big, box]}
                contentFit="cover"
              />
            ) : (
              // Nothing was ever made for this one (spec 8, «кадр не загрузился»): the `image` sign
              // and one line, with the strip left exactly where it is — whoever is here can walk
              // straight past it. Said here as well as on the tile, because this is the window the
              // delete is offered from, and a frame nobody can look at is the one somebody wants
              // rid of.
              <View style={[styles.big, box, styles.blank]}>
                <Empty icon={ImageSign} text={s.viewer.notOpened} />
              </View>
            )}

            {notice ? (
              // Above the strip rather than under it: the tools lie over the picture now, so a
              // notice pinned to the bottom of the stage would stand behind them.
              <Banner text={notice} style={[styles.notice, { bottom: toolsTall + space.s4 }]} />
            ) : null}
          </View>

          {/* The two darkenings (spec 8, the four `Viewer*` layouts, TASK-475): 150 at the head and
              160 at the foot with the phone standing, 110 and 120 with it turned. They lie over
              the picture and take no finger — the picture takes every touch under them, and the
              strip is under the foot one. */}
          <View
            style={[styles.shade, styles.shadeTop, { height: shade.top }]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.shade,
              styles.shadeFoot,
              turned ? styles.shadeFootTurned : null,
              { height: shade.foot },
            ]}
            pointerEvents="none"
          />

          {/* Spec 7.1, the fifth kind of header: three pieces of glass over the photograph and no
              darkening under them — the glass is what carries them now. All the window's controls
              are these three; the pill in the middle is a button like the two round ones. */}
          <ViewerBar
            date={when}
            meta={meta}
            label={`${s.viewer.details}: ${when}, ${meta}`}
            onPress={openInfo}
            turned={turned}
            // Spec 7.1, detail 5: `top 52` — the glass starts where the status line ends, with
            // nothing between. Turned, the phone is short and the layout puts the bar 18 down
            // instead (`ViewerRotated*`), which is past any status line it has.
            style={[styles.bar, { top: turned ? 18 : insets.top }]}
            left={
              <IconButton
                icon={ChevronLeft}
                label={s.action.close}
                size={turned ? height.roundBar : height.roundViewer}
                tone="viewer"
                tint={photo.on}
                onPress={onClose}
              />
            }
            right={
              <IconButton
                icon={Ellipsis}
                label={s.viewer.more}
                size={turned ? height.roundBar : height.roundViewer}
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

          {/* Over the picture now, not under it: the layout draws the strip 30 off the bottom edge
              upright and 14 turned, over the frame, which is what `board.bottom` is standing and
              what the turned strip's own `foot` is. A video's scrubber stands over the strip on its
              own line, so the two never fight over a finger (spec 8, `ViewerVideo`). */}
          <View style={[styles.tools, { paddingBottom: Math.max(insets.bottom, stripSize.foot) }]}>
            {/* The scrubber stands on a line of its own above the strip so that two horizontal
                gestures never fight over the same finger (spec 8, `ViewerVideo`). */}
            {playable !== null ? (
              // Spec 7.10: the row keeps 16 at the sides and the sound button hangs 8 into the
              // right one (`ViewerVideo`: «0:24» at 16, the button's edge at 382).
              <View style={styles.track}>
                <VideoTrack
                  at={formatRuntime(at) ?? ZERO}
                  of={formatRuntime(runs) ?? ZERO}
                  value={runs > 0 ? at / runs : 0}
                  label={s.viewer.played}
                  // Dragged and pressed, not only read: a film nobody can wind is a film watched
                  // from the start every time. Nothing to wind until the length is known — the
                  // api's own, or the player's once the first `timeUpdate` has been through.
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
                      glyph={SOUND_GLYPH}
                      style={styles.sound}
                      onPress={() => {
                        player.muted = !player.muted;
                      }}
                    />
                  }
                />
              </View>
            ) : null}

            <Filmstrip
              frames={strip}
              index={index}
              size={stripSize}
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
            top={
              (turned ? 18 : insets.top) +
              (turned ? height.roundBar : height.roundViewer) +
              space.s2
            }
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

/**
 * The sound switch on the track, in its 36 (`ViewerVideo.json` e18): the layout draws its speaker 19
 * at 1.8, a tighter drawing than Lucide's, and Lucide's at 18 lands on it (16.5 across against 15.7)
 * — larger than the 16 the circle gives a cross or a plus in a row.
 */
const SOUND_GLYPH = { size: ICO_S } as const;

/** What a timecode says before there is anything to count — «0:00» in every language. */
const ZERO = '0:00';

/** How far sideways a finger has to go before the picture takes it from whatever is under it. */
const SIDEWAYS = 12;

/** And how far in all, for a lift to mean «the next one» rather than «I changed my mind». */
const WALK = 56;

/**
 * The box a frame is drawn in (spec 8, the four `Viewer*` layouts, TASK-475), and the one place the
 * window's four states are actually worked out — everything else in this file reads which way up the
 * phone is and takes its numbers from there.
 *
 * The layout draws the frame in a box of its own proportions rather than fitted to the screen by
 * `contain`: 390 × 520 upright for a 3:4 frame and 390 × 260 for a 3:2 one, 585 × 390 turned for
 * that same 3:2 and 293 × 390 for the 3:4. Every one of those is the frame's own shape as large as
 * it goes without leaving the screen — which is the whole of it, and no more than the ladder owes:
 * take the screen's long side, lay the frame along whichever direction will hold it, and let it be
 * covered rather than letterboxed.
 *
 * A record the api has not measured — `width` and `height` are null until the worker has looked —
 * has no shape to lay out, and takes the whole screen. That is what is drawn while the numbers are
 * missing, not a guess at a shape; it is replaced by the real one on the render they arrive.
 */
export function frameBox(
  frameWidth: number | null,
  frameHeight: number | null,
  screenWidth: number,
  screenHeight: number,
): { width: number; height: number } {
  if (!frameWidth || !frameHeight) return { width: screenWidth, height: screenHeight };
  // The frame takes the screen whole across the way the phone is held — the width upright, the
  // height turned — and its other side is whatever its own proportions make of that. All four of
  // the layout's boxes fall out of that one sentence: a 3:2 is 390 × 260 upright and 585 × 390
  // turned, a 3:4 is 390 × 520 and 293 × 390.
  const turned = screenWidth > screenHeight;
  const along = turned ? screenHeight : screenWidth;
  // And the other side is that much of the frame's own proportion — its height over its width when
  // it lies across a standing phone, the other way round when it lies up a turned one.
  const across = turned ? (along * frameWidth) / frameHeight : (along * frameHeight) / frameWidth;
  // Clamped to the screen, because a frame is its own shape whatever the phone is: a 1000 × 10000
  // frame across a 390-wide phone is 390 tall and not 3900. `cover` crops what is left, which is
  // what the layout draws — and a phone cannot show what is under its own edges.
  return turned
    ? { width: Math.min(across, screenWidth), height: along }
    : { width: along, height: Math.min(across, screenHeight) };
}

const useStyles = themed(() =>
  StyleSheet.create({
    // A dark room in both themes, and darker than `ink` on purpose (spec 8, `Viewer`): anything
    // lighter around the photograph pulls the eye off it.
    viewer: { flex: 1, backgroundColor: photo.viewer },
    // The frame is centred in the whole of the phone rather than in what is left between the
    // floating bar and the strip: the strip lies over the picture now, so there is no room above
    // the frame for the picture to be pushed down into (TASK-475).
    stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // The frame's own box — `frameBox` above, one of the four the layout draws.
    big: {},
    fill: {},
    blank: { alignItems: 'center', justifyContent: 'center' },
    // Over the picture's own box and not the stage's, which is what puts the button in the middle
    // of the frame rather than in the middle of what is left over above it.
    middleOfFrame: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The two darkenings over the picture (spec 8, `Viewer*`): one at the head under the glass, one
    // at the foot over the strip. They take no finger — the picture takes every touch under them.
    shade: { position: 'absolute', left: 0, right: 0 },
    shadeTop: { top: 0, experimental_backgroundImage: photo.viewerShadeTop },
    shadeFoot: { bottom: 0, experimental_backgroundImage: photo.viewerShadeFoot },
    shadeFootTurned: { experimental_backgroundImage: photo.viewerShadeFootTurned },
    bar: { position: 'absolute', left: 0, right: 0 },
    // Over the picture and at the foot of it: the strip below stays the only thing under it.
    notice: { position: 'absolute', left: space.s4, right: space.s4, bottom: space.s4 },
    // The strip and, over a video, its scrubber, lying over the picture — not below it. The
    // layout draws no gap between the picture and the tools any more, because there is no picture
    // above them to have one: the strip sits `board.bottom` off the bottom edge and the picture is
    // behind it, darkened by the foot shade.
    tools: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: viewerFoot.track },
    track: { paddingHorizontal: space.s4 },
    sound: { marginRight: -space.s2 },
    // A horizontal list in a column takes every pixel it is offered unless it is told its own size.
    strip: { flexGrow: 0 },
    // The «⋯» while its menu is out (spec 7.1, detail 9).
    held: { backgroundColor: photo.held },
  }),
);
