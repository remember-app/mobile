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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
  EASE,
  Empty,
  Filmstrip,
  ICO_S,
  IconButton,
  RowAction,
  STRIP_STANDING,
  STRIP_TURNED,
  useReducedMotion,
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
import { edgeBack, GO, SIDEWAYS, topDown } from '@/lib/gesture';
import { useStrings } from '@/lib/language';
import { useTurnsWithPhone } from '@/lib/orientation';
import { cachedVideo, keepVideo } from '@/lib/video-cache';
import { FrameInfoPanel } from '@/screens/memory/frame-info';
import {
  frameInfoPanelTop,
  frameInfoRoom,
  height,
  duration as motion,
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
  onEdited,
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
  /** A record changed while it was open — the panel moving when it was shot. The face writes it. */
  onEdited: (item: MediaItem) => void;
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
   * Whether the frame's own screen stands under the picture (spec 8, `FrameInfo`, TASK-478) — and,
   * since TASK-540, the movement that brings it there (spec 10.14.3). It is a screen and not a
   * sheet: the frame keeps the top of the window, the panel takes the rest and scrolls, and the pill
   * in the bar is held in while it stands — the same press that brought it up takes it back down.
   *
   * `rise` is that movement — 0 with the panel away and 1 with it settled — and it is the only thing
   * that moves: the panel coming up from the foot of the window and the frame's own room shrinking
   * to the top of it are one value read twice, so the two travel together rather than one after the
   * other. `panel` is whether the panel is mounted at all; it is unmounted once the value is back at
   * 0, so the read behind it belongs to the opening and not to every frame that is looked at.
   *
   * It also undoes the bare frame (TASK-476): the pill that brings the panel up is one of the things
   * a tap on the picture puts away, and a panel with no way back out of it is a trap.
   */
  const [panel, setPanel] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  /**
   * «Reduce motion», read at the moment it is needed rather than closed over: the gestures below are
   * built once, and a person turning the setting on while the window is open must get the instant
   * version rather than the one the window was built with.
   */
  const reduced = useReducedMotion();
  const still = useRef(reduced);
  still.current = reduced;

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
  /**
   * The file the player is handed: the copy already on the phone, else the signed stream — and a
   * record whose 720p was never made is a picture again.
   *
   * Read once per record and not once per render on purpose. The first opening keeps the video on
   * the phone in the background (below), and a source that followed the download would build a new
   * player the moment it finished — the film would jump back to its start halfway through. Opening
   * it again is a new record and reads the file off the disk then.
   */
  const playable = useMemo(
    () => (item.kind === 'video' ? (cachedVideo(item.id) ?? item.preview_url) : null),
    [item.id, item.kind, item.preview_url],
  );

  /**
   * What the first watching leaves behind: the video on the phone, under its record's id. Nothing
   * waits for it — the stream above plays while it arrives, so the first opening is not slower —
   * and the next opening is served off the disk, with no connection needed (doc-15).
   */
  useEffect(() => {
    if (item.kind !== 'video' || item.preview_url === null) return;
    if (cachedVideo(item.id) !== null) return;
    void keepVideo(item.id, item.preview_url);
  }, [item.id, item.kind, item.preview_url]);

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
   * 3:4 frame that was 390 × 520 becomes 390 × 289, and `cover` crops what no longer fits rather
   * than the frame shrinking out of its own proportions.
   *
   * The panel arrives rather than appearing (TASK-540, spec 10.14.3), so what `rise` moves between
   * is the two ends of that shrinking: `full` is the frame with the panel away, `box` is where it
   * settles with the panel up, and everything drawn in between is read off the one value. With the
   * panel away the two are the same box, so the interpolation is a constant and a frame that is only
   * being looked at is laid out by the plain numbers rather than by an animation.
   */
  const room = frameInfoRoom(screen);
  const full = frameBox(item.width, item.height, width, screen, screen);
  const box = frameBox(item.width, item.height, width, screen, room);
  /**
   * How tall the panel stands at rest: from where the layout puts its top edge down to the bottom of
   * the window — which is what it rises by. Its top is the frame's room and a hairline of black, so
   * it is the panel's own number that says where it lands, not the room the frame gave up.
   */
  const panelTall = screen - frameInfoPanelTop(screen);
  /**
   * The four numbers of the arrival, all of them read off `rise` (TASK-540): the room the frame is
   * centred in, the box it is drawn in, and how far the panel still has to come. One value, four
   * readers — which is what makes it one movement rather than a shrink and a slide.
   */
  const arrival = useMemo(
    () => ({
      stage: rise.interpolate({ inputRange: [0, 1], outputRange: [screen, room] }),
      width: rise.interpolate({ inputRange: [0, 1], outputRange: [full.width, box.width] }),
      height: rise.interpolate({ inputRange: [0, 1], outputRange: [full.height, box.height] }),
      panel: rise.interpolate({ inputRange: [0, 1], outputRange: [panelTall, 0] }),
    }),
    // The four nodes are made again when one of the numbers moves, and never once per frame of a
    // playing video: the boxes are the record's own proportions and the room is the layout's.
    [rise, screen, room, panelTall, full.width, full.height, box.width, box.height],
  );

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
    () =>
      frames.map((one) => {
        const frame = frameOf(one);
        return {
          uri: frame.uri ?? '',
          video: one.kind === 'video',
          // The same key the tile and the frame in hand are filed under: the strip's links are
          // signed afresh with the rest, and without it its neighbours are downloaded again on
          // every visit.
          cacheKey: frame.key,
        };
      }),
    [frames],
  );

  /**
   * One step along the sheet, asked for by name — the frame a finger has left the strip resting on
   * (TASK-574, #3: a tap on the strip no longer counts). A frame still being developed stays shut:
   * there is nothing behind it to open yet, and it is the same gate the contact sheet puts on the
   * same record.
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
   *
   * It is read for the row as well as for the step (TASK-540): the frame a swipe would open is the
   * frame drawn at that edge of the picture, so what the finger drags in and what it lands on are
   * one record by construction rather than two readings that happen to agree.
   */
  function neighbour(by: 1 | -1): MediaItem | null {
    for (let to = index + by; to >= 0 && to < frames.length; to += by) {
      if (mayOpen(frames[to])) return frames[to];
    }
    return null;
  }

  function stride(by: 1 | -1) {
    const next = neighbour(by);
    if (next) onOpen(next.id);
  }

  /** The step as this render knows it, for a gesture that outlives the render it began in. */
  const step = useRef(stride);
  step.current = stride;

  /** The two frames beside the one in hand — what a swipe drags in, and nothing at either end. */
  const before = neighbour(-1);
  const after = neighbour(1);

  /**
   * How far the row of frames has been dragged, in points (TASK-540, AC #2). The picture follows the
   * finger rather than being swapped out from under it when the finger lifts: zero is the frame in
   * hand in the middle of the screen, a whole box either way is the neighbour it is being swapped
   * for, and the row is what moves — the frame in hand and the two beside it travel together, so
   * what leaves by one edge is what comes in at the other.
   *
   * Reset rather than carried across a change of frame: the record is drawn in the middle of the row
   * whichever one it is, so the value belongs to the movement and not to the record. It is reset in
   * a layout effect, which runs before the new frame is on the screen — set in an effect after it,
   * the frame that was just dragged in would be drawn a whole box off to one side for a frame.
   */
  const shift = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {
    shift.setValue(0);
  }, [item.id, shift]);

  /**
   * How wide one step of the row is right now — the box the row is actually drawn in. The frame
   * shrinks as the panel rises, and with it the cells beside it, so a turned phone's frame is a
   * whole `full.width` wide with the panel away and only `box.width` once it stands. Reading the
   * shrunk box for a drag made with the panel shut would stop the row short of the frame it is
   * bringing in, and the picture would jump the last part of the way when the record changed.
   */
  const travel = panel ? box.width : full.width;

  /**
   * How far the row may travel each way, read through a ref like the step: the responder below is
   * built once and the neighbours under it change as the strip is walked. A whole box where there is
   * a frame to bring in, and nowhere at all at either end — a picture dragged past the last frame
   * has nothing behind it, and black coming in from the edge reads as a window that broke.
   *
   * Turned, nowhere either (TASK-574, #6): a frame that is narrower than the phone across leaves
   * its neighbours standing on the screen, and the horizontal viewer is meant to show the one frame
   * and nothing beside it. A sideways finger there still walks the gallery — it opens the frame it
   * went towards — but the row under it does not slide, because there is nothing drawn to slide in.
   */
  const reach = useRef({ back: 0, on: 0 });
  reach.current = {
    back: before && !turned ? travel : 0,
    on: after && !turned ? travel : 0,
  };

  /**
   * Where a downward drag may begin, read the same way — the responder is built once and the window
   * turns with the phone (TASK-475), so the band is a number that moves. It is the whole of the
   * stage, because the stage is the picture and nothing else: the tools that lie over its foot are
   * its siblings and take their own fingers, so any finger coming down the picture asks for the
   * frame's details and none of them is taken from a scroll or a scrubber (TASK-540, spec 10.14.4).
   */
  const downFrom = useRef(screen);
  downFrom.current = screen;

  /** The way out, read through a ref like the step: the responder is built once and outlives it. */
  const closed = useRef(onClose);
  closed.current = onClose;

  /**
   * The details, raised and dropped (TASK-540, spec 10.14.3, 10.14.4). One value moved to 1 or to 0
   * over the layout's own times — 260 up, 200 down — with the panel mounted and unmounted around it.
   * Under «reduce motion» there is no movement to make: the value is put where it belongs at once,
   * and the panel is simply there.
   *
   * Read through a ref like the step: the responder is built once and outlives the render.
   */
  const slide = useRef<(to: 0 | 1) => void>(() => {});
  slide.current = (to) => {
    if (still.current) {
      rise.setValue(to);
      setPanel(to === 1);
      return;
    }
    if (to === 1) setPanel(true);
    Animated.timing(rise, {
      toValue: to,
      duration: to === 1 ? motion.sheet : motion.banner,
      easing: EASE,
      // Not on the native driver, and it cannot be: what moves is the room the frame is laid out in,
      // and a height is a layout property. The panel's own travel rides the same value, so the two
      // are one movement and cannot be split between the two drivers.
      useNativeDriver: false,
    }).start(({ finished }) => {
      // Only on the way out, and only once it has arrived: a run that was replaced mid-flight ends
      // with `finished` false, and the panel under it is the next run's to put away.
      if (finished && to === 0) setPanel(false);
    });
  };

  /**
   * And what a tap on the picture means (TASK-476): the glass, the shades and the tools go away and
   * a second tap brings them back — over a photograph and a video alike (TASK-574, #4). A video's
   * play and pause is the 72 in the middle of the frame and nowhere else: a tap on the picture is
   * the same tidy-up a photograph's is, and the film under it keeps playing through it.
   *
   * With the panel of the frame's own screen standing (TASK-478), a tap takes that panel down
   * rather than the glass: the bar holds the only other way back and the bar is what a tap here
   * would be putting away, so tidying it would leave a panel with nothing to close it. The panel is
   * the tidier thing to put away and it is the one that was just opened.
   *
   * Read through the ref below like the step above it: the gesture is built once, and the player
   * under it is replaced as the strip is walked.
   */
  const tapped = useRef(tapPicture);
  tapped.current = tapPicture;

  function tapPicture() {
    if (panel) {
      slide.current(0);
      return;
    }
    setBare((was) => !was);
  }

  /**
   * The details asked for by a finger going up the picture (TASK-574, #2; spec 10.14.3, 10.14.4).
   * It is the same press the pill makes, so there is one way in and not two that drift — and with
   * the panel already up there is nothing to raise: the gesture that puts it away is the one over
   * the panel.
   */
  const shows = useRef(() => {});
  shows.current = () => {
    if (panel) return;
    // The tools come back with it (TASK-476): the pill in the bar is the panel's own way back out,
    // and a panel raised over a picture whose bar was hidden is a panel with nothing to close it.
    setBare(false);
    slide.current(1);
  };

  /**
   * What a finger let go of does to the row (TASK-540, AC #2): a drag that meant the next frame is
   * carried on to it — the picture travels the rest of the way under its own momentum and the frame
   * is opened once it has arrived, so what a person sees is the frame they asked for coming in
   * rather than a swap at the moment they lifted — and one that meant nothing is put back where it
   * was. At either end of the strip there is no frame to bring in, and the row goes back under the
   * one in hand however far it was dragged.
   *
   * The row carries on the way the finger was going, and `by` is the direction of the *frame*, not
   * of the finger: a drag to the left (a negative `dx`) asks for the next one, and the row must keep
   * travelling left — a whole box towards `by * -1` of the sign. Written the other way round the
   * row snapped back under the previous frame and then teleported to the next when the record
   * changed, which is the jump the first test on a phone reported (TASK-574, #1).
   */
  const settle = useRef<(by: -1 | 0 | 1) => void>(() => {});
  settle.current = (by) => {
    // Whether there is a frame at that edge to bring in at all: the strip's own ends, where the row
    // is put back under the frame in hand however far it was dragged.
    const goes = (by === 1 ? after : by === -1 ? before : null) !== null;
    // Under «reduce motion» there is nothing to move, and turned there is nothing drawn to move:
    // the neighbours are not in the row (TASK-574, #6), so the frame is swapped rather than slid.
    if (still.current || turned) {
      shift.setValue(0);
      if (goes && by !== 0) step.current(by);
      return;
    }
    Animated.timing(shift, {
      toValue: goes ? -by * travel : 0,
      duration: motion.step,
      easing: EASE,
      // The JS driver, like the arrival above and for the same kind of reason: this is the same
      // value a finger writes to while it drags, and a value cannot be handed to the native driver
      // and written from javascript in the same gesture.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && goes && by !== 0) step.current(by);
    });
  };

  /**
   * The picture is walked with a finger, photographs and videos alike, across the whole gallery
   * (TASK-182) — the gesture the window never had, which is what two reports about «не листается»
   * were really asking for (TASK-123) — and since TASK-540 the frame travels under it rather than
   * being swapped when it lifts (AC #2).
   *
   * It lives on the picture and nowhere else. The strip below is the one horizontal scroll in the
   * product, and the scrubber above it is the other sideways gesture — the layout puts each on a
   * line of its own precisely so that no two of them ever share a finger.
   *
   * Four things since TASK-574, and the ways are told apart by which way the finger went:
   * sideways walks the gallery, up raises the frame's own screen and down closes the window
   * (spec 10.14.4 — the pair that used to be the other way round, decision-25 now repealed), and
   * in from the left edge — the platform's own back, which the window answers because it is a
   * `Modal` and the app-wide `useEdgeBack` is nowhere near it — closes it in any state, like the
   * «Закрыть» in the corner.
   *
   * Built once and never rebuilt, with the step, the row and the way out read through the refs
   * above. `PanResponder` keeps how far the finger has come inside the object `create` hands back,
   * so a responder made afresh mid-gesture starts counting from nothing — and this window re-renders
   * four times a second for the whole of a playing video (`timeUpdate`). Rebuilt per render, every
   * threshold below was measured against whatever scrap of the swipe fell after the last of those
   * renders: the walk worked on a photograph and failed on video, which is the same symptom a third
   * time. Four gestures on one responder rather than four responders stacked on one view: the
   * stage takes the finger down once, and whichever way it went is decided once, from the same
   * numbers — four responders would each be deciding from a tally of their own.
   *
   * That is also what makes the gesture work when the tools are away — this responder is on the
   * stage, which is the whole of the window either way, and TASK-476 put nothing between them.
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
        // Capture, so a finger that has plainly gone one way takes the pause button under it with it
        // — a sideways drag begun on that button is still the gallery's, and an up or down one is
        // the frame's own screen or the way out (TASK-574). Any vertical past the threshold is
        // claimed: the picture is the whole of what stands under the stage, and nothing on it
        // scrolls, so a finger going up or down there is asking the window for one of its two.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          (Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy)) ||
          (Math.abs(g.dy) > SIDEWAYS && Math.abs(g.dy) > Math.abs(g.dx)),
        // The frame follows the finger while it is down (TASK-540, AC #2) — from the first point it
        // travels, not from the point a gesture is recognised at, because a picture that waits for
        // a threshold before moving is a picture that jumps. Only the gallery's own gesture moves
        // the row: a finger going up or down the picture, or in from the edge, is not a frame being
        // dragged sideways, and the row is left exactly where it stands.
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) <= Math.abs(g.dy)) return;
          const { back, on } = reach.current;
          shift.setValue(Math.max(-on, Math.min(back, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          // A finger that stayed where it was put down is a tap: the tools go away or come back
          // (TASK-476, TASK-574 #4). Anything else is a gesture, and which one is said by where it
          // began and which way it went — not by how far.
          if (Math.abs(g.dx) <= SIDEWAYS && Math.abs(g.dy) <= SIDEWAYS) return tapped.current();
          // The way out, whatever state the window is in: the edge swipe and the «Закрыть» are the
          // two that never depend on the panel (TASK-574, #2).
          if (edgeBack(g, GO)) return closed.current();
          // Down over the picture closes the window — with the details standing or without them
          // (spec 10.14.4). Over the details themselves the same drag is caught by the panel and
          // puts them away first; once there is nothing left over the picture, it closes (TASK-574).
          if (topDown(g, downFrom.current, GO)) return closed.current();
          // Up over the picture raises the frame's own screen (spec 10.14.3): the gesture and the
          // movement now go the same way.
          if (g.dy <= -GO && Math.abs(g.dy) > Math.abs(g.dx)) return shows.current();
          setBare(false);
          // A drag that came short of the step was a feel for the next frame and no more: the row
          // goes back under the one in hand, and nothing is opened.
          if (Math.abs(g.dx) < GO) return settle.current(0);
          settle.current(g.dx < 0 ? 1 : -1);
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
   * here: the panel unmounts when it is shut and takes its read with it.
   */
  function toggleDetails() {
    setMenu(false);
    // The panel needs the bar to be there to be put away from, and the bar is one of the things a
    // tap on the picture hides (TASK-476).
    setBare(false);
    slide.current(panel ? 0 : 1);
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
    slide.current(0);
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

  /**
   * One side of the row (TASK-540, AC #2): the frame beside the one in hand, in a cell of exactly
   * the box the frame in hand is drawn in — so the three of them stand one whole box apart and a
   * drag of one box lands on the neighbour. A side with no frame to bring in is a cell of the same
   * size with nothing in it: the frame in hand is the middle of three whichever frames there are,
   * and the black at that end is never dragged into, because the row cannot travel there.
   *
   * Hidden from a screen reader, like the mosaic: what is beside the frame is off the screen and is
   * a picture the reader has no way to reach, and the strip under it is where frames are named.
   *
   * Turned, there is no cell at all (TASK-574, #6): a frame that is shorter than the phone across
   * leaves its neighbours inside the screen, and the horizontal viewer shows the frame it is on and
   * nothing beside it. The row keeps its middle, which is what the picture is drawn in.
   */
  function beside(one: MediaItem | null) {
    if (turned) return null;
    const frame = one === null ? null : frameOf(one);
    return (
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.cell, { width: arrival.width, height: arrival.height }]}
      >
        {frame?.uri ? (
          <Image
            source={{ uri: frame.uri, cacheKey: frame.key }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
      </Animated.View>
    );
  }

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

              A video is not given one, and the reason is the button, not an omission: marking this
              view would mark it on top of the 72 in the middle, and on iOS a container marked
              accessible is read instead of its children — the play and pause would go missing to buy
              a duplicate of itself. The tap still tidies a video's tools away like a photograph's
              (TASK-574, #4); what it does not do is stand in for the transport. */}
          <Animated.View
            style={[styles.stage, { height: arrival.stage }]}
            {...swipe.panHandlers}
            {...said}
          >
            {/* The row the finger walks (TASK-540, AC #2): the frame in hand in the middle and the
                two beside it one box apart, so the picture travels under the finger and what leaves
                by one edge is what comes in at the other. A frame still being developed is not a
                neighbour at all — `neighbour` carries on past it exactly as the step does — and the
                row is where that shows, because the frame a swipe lands on is the frame drawn at
                that edge of it.

                The row is what moves, and it moves entire: the frames are laid out in it once and
                its own offset is all that changes, so a drag re-lays nothing out.

                A neighbour is drawn the way the strip draws it and not the way the open frame is —
                `frameOf`, the record's own thumbnail, rather than the big derivative. The strip has
                already fetched exactly this picture, so a neighbour is a frame that is on the phone
                rather than two more big files every open frame would ask for.
                ponytail: a half-swiped neighbour is therefore the soft 640px picture. The big
                derivative is worth asking for the day the drag is slow enough to be looked at. */}
            <Animated.View style={[styles.row, { transform: [{ translateX: shift }] }]}>
              {beside(before)}
              <Animated.View
                style={[styles.cell, { width: arrival.width, height: arrival.height }]}
              >
                {playable !== null ? (
                  // Streamed off the signed url, index first, so it plays before the whole file is
                  // down (doc-02, «Видео в галерее»). Its transport is the row under the strip and
                  // the button in the middle of the frame, so the platform's own is off.
                  //
                  // The picture fills the frame's own box (TASK-475), and the button lies over that
                  // same box — hung on the stage instead, it would centre itself over whatever the
                  // stage has left over rather than over the frame (reported off a device,
                  // TASK-181). The box is what says how big the picture is: left to itself, a
                  // `VideoView` measures nothing and the frame comes out as sound over black.
                  <>
                    <VideoView
                      player={player}
                      nativeControls={false}
                      // `cover` and not `contain`, like the photograph beside it and for the same
                      // reason: the box already carries the frame's own proportions, so this fills
                      // it rather than letterboxing inside a box that is already the right shape.
                      contentFit="cover"
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Pause and play, 72 in the middle of the picture — `ViewerVideo` and nowhere
                        else. Dark and not glass (spec 7.2): the viewer's glass vanishes over a
                        bright frame, and this glyph has to hold over any. `box-none`, so everything
                        around the circle belongs to the picture under it. */}
                    <View style={styles.middleOfFrame} pointerEvents="box-none">
                      <IconButton
                        icon={isPlaying ? Pause : Play}
                        label={isPlaying ? s.viewer.pause : s.viewer.play}
                        size={72}
                        tone="video"
                        onPress={() => (isPlaying ? player.pause() : player.play())}
                      />
                    </View>
                  </>
                ) : shown.uri !== null ? (
                  // Covered rather than contained (TASK-475): a horizontal frame used to be
                  // `contain`ed into whatever room was left between the glass and the strip, which
                  // left it small and centred on the screen — the whole of that task.
                  //
                  // `expo-image` and not React Native's own, for the disk behind it: the same frame
                  // opened twice should come off the phone rather than down the wire. What it is
                  // filed under is `shown`'s own key — `@/lib/frames` says why, and the tile reads
                  // the same one, so a record is one file on the phone rather than one per screen.
                  <Image
                    source={{ uri: shown.uri, cacheKey: shown.key }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  // Nothing was ever made for this one (spec 8, «кадр не загрузился»): the `image`
                  // sign and one line, with the strip left exactly where it is — whoever is here
                  // can walk straight past it. Said here as well as on the tile, because this is
                  // the window the delete is offered from, and a frame nobody can look at is the
                  // one somebody wants rid of.
                  <View style={styles.blank}>
                    <Empty icon={ImageSign} text={s.viewer.notOpened} />
                  </View>
                )}
              </Animated.View>
              {beside(after)}
            </Animated.View>

            {notice ? (
              // Above the strip rather than under it: the tools lie over the picture now, so a
              // notice pinned to the bottom of the stage would stand behind them. The panel has
              // taken the strip's place (TASK-478), so there is nothing left to clear but the
              // foot of the stage — which is a hairline above the panel's own top edge.
              <Banner
                text={notice}
                style={[styles.notice, { bottom: panel ? space.s4 : toolsTall + space.s4 }]}
              />
            ) : null}
          </Animated.View>

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
                // panel is standing under it, or it is not, and that is the whole difference. A tap
                // here and a swipe down over the picture are the same press (TASK-540, spec
                // 10.14.4), so the pill is pressed in while the panel stands either way.
                label={`${panel ? s.viewer.hideDetails : s.viewer.details}: ${when}, ${meta}`}
                onPress={toggleDetails}
                on={panel}
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
                  the panel says nothing about. `panel` and not the intent: they come back when the
                  panel is gone, not when it starts to leave (TASK-540). */}
              {panel ? null : (
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
                    // A finger leaves the strip resting on a frame and that frame is opened — the
                    // gate, not the stride: refusing is the honest answer to «open this one». A tap
                    // names nothing (TASK-574, #3): the strip is there to show where the middle
                    // stands, and a tap that jumped to the picture under the finger was one gesture
                    // doing what a swipe already does.
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

              It stands from where the layout puts its top edge, `frameInfoPanelTop` — 292 on a
              phone held upright, less on one lying on its side, and the whole screen when it is
              shut — so it is the panel's own number that says where it lands, a hairline of black
              under the frame's room.

              It arrives rather than appearing (TASK-540, spec 10.14.3): the box is at the foot of
              the window and the same `rise` that shrinks the frame above it carries it the rest of
              the way up, so the two are one movement. The panel is the one that is mounted — it
              stays until the movement is over, so the strip does not come back under a panel that is
              still leaving. */}
          {panel ? (
            <Animated.View
              style={[styles.panelBox, { transform: [{ translateY: arrival.panel }] }]}
            >
              <FrameInfoPanel
                memoryId={memoryId}
                item={item}
                onFilm={openFilm}
                onEdited={onEdited}
                onLetGo={(goes) => slide.current(goes ? 0 : 1)}
                rise={rise}
                style={{ height: panelTall }}
              />
            </Animated.View>
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
 * phone is held is read off the two numbers together, and a frame squeezed into 289 of a 390-wide
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
  // is what the layout says and what the four `Viewer*` boxes are — 289 of a standing phone, and
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
    // the frame for the picture to be pushed down into (TASK-475). Its height is the room the frame
    // has — the whole window, or the top of it while the panel of its own screen stands — and it is
    // `arrival.stage` that moves, because the panel arrives rather than appearing (TASK-540).
    //
    // No `overflow: hidden`, and that is the carousel (AC #2): the frames beside the one in hand
    // stand outside the stage by a whole box each, and a stage that clipped would leave the row
    // with nothing to drag in.
    stage: { alignItems: 'center', justifyContent: 'center' },
    // The three frames the finger walks, one box apart, laid out once and moved entire.
    row: { flexDirection: 'row' },
    // One frame of that row: the box of its own proportions `frameBox` gives, with the picture
    // filling it rather than sized by itself.
    cell: { overflow: 'hidden' },
    blank: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    // The frame's own screen at the foot of the window, off the bottom of it until it is raised
    // (TASK-540): the box is where the panel will stand, and `arrival.panel` carries it up from
    // under the edge. Its own height is the panel's — the frame above has already given it that
    // much of the room — so the two are the same surface either way.
    panelBox: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
