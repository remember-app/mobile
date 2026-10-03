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
import {
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadMedia,
  errorMessage,
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
import { formatDayShort, formatRuntime, formatTime } from '@/lib/dates';
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
import { edgeBack, GO, SIDEWAYS, TOP, topDown } from '@/lib/gesture';
import { useStrings } from '@/lib/language';
import { useTurnsWithPhone } from '@/lib/orientation';
import { FrameInfoPanel } from '@/screens/memory/frame-info';
import {
  frameInfoRoom,
  height,
  photo,
  space,
  ThemePin,
  themed,
  viewerFoot,
  viewerShade,
} from '@/theme';

/**
 * `Viewer` and `ViewerVideo` (spec 8, «Просмотр медиа») — one frame on the whole of the phone, laid
 * out the way every phone's own gallery lays one out (doc-02): nothing under the picture but the
 * material itself, three pieces of glass floating over it, and the strip of neighbours along the
 * bottom.
 *
 * Three buttons and no row of actions under the strip: «Закрыть», the pill of when and who — which
 * raises the frame's own screen (`FrameInfo`) — and the «⋯» that drops the glass menu of what
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
  /**
   * Whether the window is down to the frame alone (TASK-476) — a tap on the picture put the glass,
   * the shades and the tools away, and another tap brings them back. The layout draws no such state
   * and none is invented here: what stands without them is the same window with them not drawn.
   */
  const [bare, setBare] = useState(false);
  /** The one line this window says out loud: saving, sharing, and how either of them went. */
  const [notice, setNotice] = useState<string | null>(null);
  /** The surfaces over the window: the menu the «⋯» drops, the delete, and the film on its way. */
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** The film the panel asked for, held while this window shuts and raised once it is gone. */
  const [film, setFilm] = useState<string | null>(null);
  /**
   * Whether the frame's own screen stands under the picture (spec 8, `FrameInfo`, TASK-478). It is
   * a screen and not a sheet: the frame keeps the top of the window, the panel takes the rest and
   * scrolls, and the pill in the bar is held in while it stands — the same press that brought it
   * up takes it back down.
   *
   * It also undoes the bare frame (TASK-476): the pill that brings the panel up is one of the
   * things a tap on the picture puts away, and a panel with no way back out of it is a trap.
   */
  const [details, setDetails] = useState(false);

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
   * So: the frame takes the screen whole across the way the phone is held — the width upright, the
   * height turned — and its other side is whatever its own proportions make of that. A record the
   * api has not measured yet — `width` and `height` are null until the worker has looked at it — has
   * no proportions to lay out, and takes the whole room: that is a frame shown as it is rather
   * than a guessed shape, and it lasts until the numbers arrive.
   *
   * The room is the whole of the window except while the frame's own screen is standing under the
   * picture (TASK-478): the panel is not a sheet rising over the frame, the frame stays and gives up
   * the bottom of the screen to it. So the same `frameBox` in a shorter room is all that takes — a
   * 3:4 frame that was 390 × 520 becomes 390 × 352, and `cover` crops what no longer fits rather
   * than the frame shrinking out of its own proportions.
   */
  const room = details ? frameInfoRoom(screen) : screen;
  const box = frameBox(item.width, item.height, width, screen, room);

  /**
   * How tall the tools lying over the picture come out — the strip, its own distance from the bottom
   * edge, and over a video its scrubber above that (`ViewerVideo` puts the two on lines of their
   * own, and the sound button is what makes the scrubber row 36). The notice stands above this
   * rather than at the bottom of the stage, which is the whole of the picture now (TASK-475).
   *
   * The panel stands where the strip lies, so the strip goes while it is up (TASK-478): the layout
   * draws `FrameInfo` with the frame, the bar and the panel and nothing else, and the panel has no
   * room for a strip that walked to frames the panel knows nothing about.
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
   * One step along the sheet, asked for by name — a tap on the strip, and the frame a finger has
   * left the strip resting on. A frame still being developed stays shut: there is nothing behind it
   * to open yet, and it is the same gate the contact sheet puts on the same record.
   *
   * It is `walk` and not `stride` that a resting finger gets, unlike a swipe across the picture:
   * the strip has landed on one frame, and carrying on past it to the next would open something
   * nobody pointed at. So the answer is said back to the strip — a false one and it puts itself
   * back on the frame in hand rather than standing over one this window never opened.
   */
  function walk(to: number): boolean {
    const next = frames[to];
    if (!next || !mayOpen(next)) return false;
    // A frame picked by name is a deliberate step, and it brings the tools back with it (TASK-476) —
    // the same answer a swipe gives, so that whichever way a person moves on, they land on a frame
    // they can still get out of.
    setBare(false);
    onOpen(next.id);
    return true;
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
   * Where the way back is measured from, read the same way — the responder below is built once, and
   * the window turns with the phone (TASK-475), so the band a downward swipe has to begin in is a
   * number that moves. Held as a ref rather than closed over for the same reason the step is.
   */
  const backFrom = useRef(screen * TOP);
  backFrom.current = screen * TOP;

  /** The way out, read through a ref like the step: the responder is built once and outlives it. */
  const closed = useRef(onClose);
  closed.current = onClose;

  /**
   * And what a tap on the picture means (TASK-476): a video plays and stands still — its own
   * transport is the button in the middle of the frame and the picture is not a place to tidy the
   * window away from — while a photograph gives the glass, the shades and the tools away and a
   * second tap brings them back.
   *
   * With the panel of the frame's own screen standing (TASK-478), a photograph's tap takes that
   * panel down rather than the glass: the bar holds the only other way back and the bar is what a
   * tap here would be putting away, so tidying it would leave a panel with nothing to close it. The
   * panel is the tidier thing to put away and it is the one that was just opened.
   *
   * Read through the ref below like the step above it: the gesture is built once, and the player
   * under it is replaced as the strip is walked.
   */
  const tapped = useRef(tapPicture);
  tapped.current = tapPicture;

  function tapPicture() {
    if (playable !== null) {
      if (isPlaying) player.pause();
      else player.play();
      return;
    }
    if (details) {
      setDetails(false);
      return;
    }
    setBare((was) => !was);
  }

  /**
   * The picture is walked with a finger, photographs and videos alike, across the whole gallery
   * (TASK-182) — the gesture the window never had, which is what two reports about «не листается»
   * were really asking for (TASK-123) — and, since TASK-477, the way out of the window is a swipe
   * down over the picture or in from its left edge, on one and the same finger.
   *
   * It lives on the picture and nowhere else. The strip below is the one horizontal scroll in the
   * product, and the scrubber above it is the other sideways gesture — the layout puts each on a
   * line of its own precisely so that no two of them ever share a finger.
   *
   * Built once and never rebuilt, with the step and the way out read through the refs above.
   * `PanResponder` keeps how far the finger has come inside the object `create` hands back, so a
   * responder made afresh mid-gesture starts counting from nothing — and this window re-renders
   * four times a second for the whole of a playing video (`timeUpdate`). Rebuilt per render, both
   * thresholds below were measured against whatever scrap of the swipe fell after the last of those
   * renders: the walk worked on a photograph and failed on video, which is the same symptom a third
   * time. Three gestures on one responder rather than three responders stacked on one view: the
   * stage takes the finger down once, and whichever way it went is decided once, from the same
   * numbers — three responders would each be deciding from a tally of their own.
   *
   * The window is a `Modal`, so it stands over the navigator and the app-wide edge swipe
   * (`useEdgeBack`) is nowhere near it: it is asked here too, on the same finger, and the left
   * edge answers exactly as it does on a screen. That is also what makes the gesture work when the
   * tools are away — this responder is on the stage, which is the whole of the window either way,
   * and TASK-476 put nothing between them.
   */
  const swipe = useMemo(
    () =>
      PanResponder.create({
        // A tap belongs to whatever is under it — the pause button in the middle of a video, and a
        // screen reader's own way in. So the stage takes the finger down without capture, where the
        // responder system asks the deeper view first: a tap on that button is the button's, and a
        // tap anywhere else on the picture is this window's (TASK-476).
        onStartShouldSetPanResponderCapture: () => false,
        onStartShouldSetPanResponder: () => true,
        // Capture, so the window's own way out is decided before the strip below or the scrubber
        // takes the finger — the strip is horizontal and answers a swipe of its own, and a finger
        // that began up in the top third and is falling was never going to be its anyway.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          (Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy)) ||
          topDown(g, backFrom.current),
        onPanResponderRelease: (_, g) => {
          // A finger that stayed where it was put down is a tap: a video plays and stands still, a
          // photograph puts the tools away or brings them back. Anything else is a gesture, and
          // which one is said by where it began and which way it went — not by how far.
          if (Math.abs(g.dx) <= SIDEWAYS && Math.abs(g.dy) <= SIDEWAYS) return tapped.current();
          // The way out (TASK-477), asked at the same moment as the walk and on the same numbers:
          // down over the picture, or in from the left edge. Neither brings the tools back first —
          // there is nowhere to bring them back to, the window is gone.
          if (topDown(g, backFrom.current, GO) || edgeBack(g, GO)) return closed.current();
          setBare(false);
          // ponytail: the frame is swapped when the finger lifts, and does not travel under it. A
          // carousel that follows the finger is a second horizontal scroll inside a modal over a
          // player — the exact ground TASK-106 and TASK-123 were lost on. Worth building the day
          // the movement itself is asked for, and not before.
          if (Math.abs(g.dx) < GO) return;
          step.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );

  /**
   * The frame's own screen, asked for when the pill is pressed and not before: the window opens on
   * a picture, and this is the half of a frame nobody has asked about yet.
   *
   * One button both ways (TASK-478, spec 8, `FrameInfo`): the layout draws the pill *pressed* while
   * the panel stands, so the press that raised it is the press that puts it away — a second
   * control for the same thing in the same place is a control nobody needs.
   *
   * The read is the panel's own (it asks on being mounted), which is why there is no bookkeeping
   * here: the panel unmounts when this goes false and takes its read with it.
   */
  function toggleDetails() {
    setMenu(false);
    // The panel needs the bar to be there to be put away from, and the bar is one of the things a
    // tap on the picture hides (TASK-476).
    setBare(false);
    setDetails((was) => !was);
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

  /**
   * What the picture says to a screen reader, and nothing at all over a video — see the stage
   * below. `activate` rather than `onAccessibilityTap`, because it is the one name both platforms
   * answer to: iOS reads it in `accessibilityActivate`, Android maps it to `ACTION_CLICK`, and the
   * latter is what the scrubber's own `increment`/`decrement` already ride on (`VideoTrack`).
   *
   * Its name says what the tap will do and not what the picture is, because that is what a reader
   * is answered by — «Спрятать панели» and «Показать панели» rather than «фотография» either way.
   */
  const said: ViewProps | null =
    playable === null
      ? {
          accessible: true,
          accessibilityRole: 'button',
          accessibilityLabel: bare ? s.viewer.showTools : s.viewer.hideTools,
          accessibilityActions: TOGGLE,
          onAccessibilityAction: () => tapped.current(),
        }
      : null;

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
        <View
          style={styles.viewer}
          // The swipe down and the swipe in from the edge are the window's way out to a finger, and
          // this is the way out to a screen reader — the platform's own «escape», the gesture a reader
          // reaches for when a screen appears over the one they were on. It stands on the room
          // rather than on the picture, so it is answered over a video too and not only over a
          // photograph (where `said` below carries the one other action the picture has).
          onAccessibilityEscape={onClose}
        >
          {/* The frame itself, centred in the whole of the phone — the layout draws it in a box of
              its own proportions (spec 8, `Viewer*`), and the glass above and the strip under it lie
              over it rather than taking room away from it. The finger that walks the gallery is
              taken here, on the picture, and never on the strip or the scrubber.

              A photograph is also one control to a screen reader (TASK-476): the tap that puts the
              tools away and brings them back is offered under the name of what it will do, since a
              reader is answered by what is about to happen rather than by «the picture». It is the
              picture alone that carries this, and it carries it whenever the tools are away — the
              one moment the reader most needs a way back in.

              A video is not given one, and the reason is the button, not an omission: a tap on a
              video plays and stands still rather than hiding anything (AC #5), and that is exactly
              what the 72 in the middle of the frame already says it does, so the reader already
              holds this control under its own name. Marking this view would be marking it on top of
              that button, and on iOS a container marked accessible is read instead of its children
              — the play and pause would go missing to buy a duplicate of itself. */}
          <View style={styles.stage} {...swipe.panHandlers} {...said}>
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
              // notice pinned to the bottom of the stage would stand behind them. The panel has
              // taken the strip's place (TASK-478), so there is nothing left to clear but the
              // foot of the stage — which is the panel's own top edge.
              <Banner
                text={notice}
                style={[styles.notice, { bottom: details ? space.s4 : toolsTall + space.s4 }]}
              />
            ) : null}
          </View>

          {/* Everything the window draws over the frame, and nothing of the frame itself (TASK-476):
              the two darkenings, the glass bar and the tools. A tap on the picture takes all three
              away and brings them back, and a swipe or a step along the strip brings them back
              whatever they were doing — so this block is the whole of what «the frame alone» means,
              and the pause button over a video stays because it is inside the frame and not here.

              The layout draws no state without them and none is invented for this: what stands
              without them is the same window with these not drawn. */}
          {bare ? null : (
            <>
              {/* The two darkenings (spec 8, the four `Viewer*` layouts, TASK-475): 150 at the head
                  and 160 at the foot with the phone standing, 110 and 120 with it turned. They lie
                  over the picture and take no finger — the picture takes every touch under them,
                  and the strip is under the foot one. */}
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

              {/* Spec 7.1, the fifth kind of header: three pieces of glass over the photograph
                  and no darkening under them — the glass is what carries them now. All the window's
                  controls are these three; the pill in the middle is a button like the two round
                  ones. */}
              <ViewerBar
                date={when}
                meta={meta}
                // One button both ways (TASK-478): what it will do, said under its own name — the
                // panel is standing under it, or it is not, and that is the whole difference.
                label={`${details ? s.viewer.hideDetails : s.viewer.details}: ${when}, ${meta}`}
                onPress={toggleDetails}
                on={details}
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
                    // Spec 7.1, detail 9: the button the menu fell out of stays visible and lit
                    // under it, so the menu reads as having come from there and not from the top of
                    // the screen. `photo.held` is that light, and it is the only state this button
                    // has.
                    style={menu ? styles.held : null}
                  />
                }
              />

              {/* Over the picture now, not under it: the layout draws the strip 30 off the bottom
                  edge upright and 14 turned, over the frame, which is what `board.bottom` is
                  standing and what the turned strip's own `foot` is. A video's scrubber stands over
                  the strip on its own line, so the two never fight over a finger (spec 8,
                  `ViewerVideo`).

                  Neither of them stands while the panel of the frame's own screen does (TASK-478):
                  the panel takes the whole of that foot of the window, and the strip walks to frames
                  the panel says nothing about. */}
              {details ? null : (
                <View
                  style={[styles.tools, { paddingBottom: Math.max(insets.bottom, stripSize.foot) }]}
                >
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
                        // Dragged and pressed, not only read: a film nobody can wind is a film
                        // watched from the start every time. Nothing to wind until the length is
                        // known — the api's own, or the player's once the first `timeUpdate` has
                        // been through.
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
                    // A tap names the frame it wants and a finger leaves the strip resting on one, so
                    // both are the gate and not the stride: refusing is the honest answer to «open
                    // this one», and the two agree on what may open.
                    onPick={walk}
                    onSettle={walk}
                  />
                </View>
              )}
            </>
          )}

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

          {/* `FrameInfo` (spec 8, TASK-478) — the frame's own screen, standing *under* the picture
              rather than over it. Inside the pinned room on purpose, unlike the two sheets below:
              this is not a surface of its own over the window, it is the bottom of the window — and
              the night it is drawn in is the one the photograph above it is in, not the one the app
              happens to be in.

              It takes whatever the frame gave up, which is `frameInfoRoom` — 352 on a phone held
              upright, less on one lying on its side, and the whole screen when it is shut. */}
          {details ? (
            <FrameInfoPanel
              memoryId={memoryId}
              item={item}
              onFilm={openFilm}
              style={{ height: screen - room }}
            />
          ) : null}
        </View>
      </ThemePin>

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

/**
 * The one thing a screen reader may do to the picture, since it has no finger to tap it with
 * (TASK-476). `activate` is the name both platforms answer to — iOS reads it in
 * `accessibilityActivate`, Android maps it to `ACTION_CLICK` — so one list serves iOS and Android,
 * as the scrubber's `increment`/`decrement` do (`VideoTrack`).
 */
const TOGGLE = [{ name: 'activate' }];

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
 * `room` is how far down the frame may reach, and it is the whole screen except while the frame's
 * own screen is standing under the picture (TASK-478) — which is a shorter window either way up the
 * phone is held. It is a separate argument and not a smaller `screenHeight` because which way up the
 * phone is held is read off the two numbers together, and a frame squeezed into 352 of a 390-wide
 * phone would otherwise turn itself on its side.
 *
 * A record the api has not measured — `width` and `height` are null until the worker has looked —
 * has no shape to lay out, and takes the whole room. That is what is drawn while the numbers are
 * missing, not a guess at a shape; it is replaced by the real one on the render they arrive.
 */
export function frameBox(
  frameWidth: number | null,
  frameHeight: number | null,
  screenWidth: number,
  screenHeight: number,
  room?: number,
): { width: number; height: number } {
  const turned = screenWidth > screenHeight;
  const down = room ?? screenHeight;
  // The side that runs across the way the phone is held, and the room bounds whichever of the two
  // that is standing up-and-down: `across` with the phone upright, `along` with it turned, where
  // it is the screen's own height that the frame is measured against. One rule both ways up, which
  // is what the layout says and what the four `Viewer*` boxes are — 352 of a standing phone, and
  // as much of a turned one as its shorter window can spare the panel (`frameInfoRoom`).
  const along = turned ? Math.min(screenHeight, down) : screenWidth;
  // The other side is bounded by the screen itself, for the same reason the room is not passed for
  // it: the room is what the panel took, and a frame cannot be wider than the phone.
  const limit = turned ? screenWidth : down;
  if (!frameWidth || !frameHeight) {
    return turned ? { width: limit, height: along } : { width: along, height: limit };
  }
  // The frame takes the screen whole across the way the phone is held — the width upright, the
  // height turned — and its other side is whatever its own proportions make of that. All four of
  // the layout's boxes fall out of that one sentence: a 3:2 is 390 × 260 upright and 585 × 390
  // turned, a 3:4 is 390 × 520 and 293 × 390.
  // And the other side is that much of the frame's own proportion — its height over its width when
  // it lies across a standing phone, the other way round when it lies up a turned one.
  const across = turned ? (along * frameWidth) / frameHeight : (along * frameHeight) / frameWidth;
  // Clamped to the room, because a frame is its own shape whatever the phone is: a 1000 × 10000
  // frame across a 390-wide phone is 390 tall and not 3900. `cover` crops what is left, which is
  // what the layout draws — and a phone cannot show what is under its own edges.
  return turned
    ? { width: Math.min(across, limit), height: along }
    : { width: along, height: Math.min(across, limit) };
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
