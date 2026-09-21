import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ChevronLeft,
  Download,
  Ellipsis,
  Info,
  Pause,
  Play,
  Share,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, PanResponder, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadMedia,
  errorMessage,
  memberName,
  type MediaItem,
  type Member,
  type Memory,
} from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone, shareFile } from '@/downloads';
import { frameIndex, frameOf, mayOpen, megabytes, openFrameOf, shotBy, type Frame } from '@/frames';
import {
  Banner,
  ConfirmSheet,
  Empty,
  Filmstrip,
  IconButton,
  VideoTrack,
  ViewerBar,
} from '@/kit';
import { useStrings } from '@/language';
import { FrameSheet } from '@/memory/frames-sheets';
import { useTurnsWithPhone } from '@/orientation';
import { board, height, photo, radius, space, themed, themes, ThemePin } from '@/theme';

/**
 * `Viewer` and `ViewerVideo` (spec 8, «Просмотр медиа») — one frame on the whole of the phone, laid
 * out the way every phone's own gallery lays one out (doc-02): nothing under the picture but the
 * material itself, a floating bar of glass over it, the strip of neighbours along the bottom and the
 * row of actions under that.
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
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  /** Whether an errand is running on this frame — every button on the window waits for it. */
  const [busy, setBusy] = useState(false);
  /** The one line this window says out loud: saving, sharing, and how either of them went. */
  const [notice, setNotice] = useState<string | null>(null);
  /** `SheetConfirmDelete` over the window, and `SheetFrame` — what «Ещё» and «Подробности» open. */
  const [confirming, setConfirming] = useState(false);
  const [details, setDetails] = useState(false);

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
   * One step along the sheet, however it was asked for — a finger on the picture or a tap on the
   * strip. A frame still being developed stays shut either way: there is nothing behind it to open
   * yet, and it is the same gate the contact sheet puts on the same record.
   */
  function walk(to: number) {
    const next = frames[to];
    if (next && mayOpen(next)) onOpen(next.id);
  }

  /**
   * The picture is walked with a finger, photographs and videos alike, across the whole gallery
   * (TASK-182) — the gesture the window never had, which is what two reports about «не листается»
   * were really asking for (TASK-123).
   *
   * It lives on the picture and nowhere else. The strip below is the one horizontal scroll in the
   * product, and the scrubber above it is the other sideways gesture — the layout puts each on a
   * line of its own precisely so that no two of them ever share a finger.
   *
   * Rebuilt every render on purpose: the release reads which frame the walk starts from, and a
   * handler held still would go on walking from whichever frame the window was opened at.
   */
  const swipe = PanResponder.create({
    // A tap belongs to whatever is under it — the pause button in the middle of a video. The walk
    // asks for the finger only once it has plainly gone sideways, and it asks by capture so that a
    // swipe begun on that button is still a swipe.
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) =>
      Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      // ponytail: the frame is swapped when the finger lifts, and does not travel under it. A
      // carousel that follows the finger is a second horizontal scroll inside a modal over a
      // player — the exact ground TASK-106 and TASK-123 were lost on. Worth building the day the
      // movement itself is asked for, and not before.
      if (Math.abs(g.dx) < WALK) return;
      walk(index + (g.dx < 0 ? 1 : -1));
    },
  });

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

  /** The two lines of the floating pill: when the event was, and who brought this frame. */
  const when = memory === null ? '' : formatEventDates(memory.event_start, memory.event_end);
  const who = memberName(roster?.find((member) => member.id === item.uploaded_by) ?? null);
  const size = megabytes(item);

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
                    tone="glass"
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
              // Nothing was ever made for this one. Said here as well as on the tile, because this
              // is the window the delete is offered from — a failed record is one somebody may want
              // rid of rather than looked at.
              <View style={[styles.big, styles.blank]}>
                <Empty icon={TriangleAlert} text={s.gallery.waiting[item.status]} />
              </View>
            )}

            {notice ? <Banner text={notice} style={styles.notice} /> : null}
          </View>

          {/* Spec 7.1, the sixth kind of header: three pieces of glass over the photograph, and no
              darkening under them — the glass is what carries them now. */}
          <ViewerBar
            date={when}
            meta={who}
            style={[styles.bar, { top: insets.top + space.s2 }]}
            left={
              <IconButton
                icon={ChevronLeft}
                label={s.action.close}
                size={height.roundViewer}
                tone="glass"
                tint={photo.on}
                onPress={onClose}
              />
            }
            right={
              <IconButton
                icon={Ellipsis}
                label={s.viewer.more}
                size={height.roundViewer}
                tone="glass"
                tint={photo.on}
                onPress={() => setDetails(true)}
                disabled={busy}
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
              // The same step the finger takes, asked for by name instead of by direction — so a
              // tap on the strip and a swipe on the picture cannot disagree about what opens.
              onPick={walk}
            />

            {/* Spec 8: what takes the frame out of the memory stands at the two ends, what is done
                with it stands in the middle, on glass of its own. */}
            <View style={styles.actions}>
              <IconButton
                icon={Share}
                label={s.action.share}
                size={height.roundViewer}
                tone="glass"
                tint={photo.on}
                onPress={() => void hand()}
                disabled={busy}
              />
              <View style={styles.middle}>
                <View style={styles.pill}>
                  {/* Not gated on anything: a viewer may take home what they are looking at, and the
                      api says the same — the download route asks for membership and nothing more. */}
                  <IconButton
                    icon={Download}
                    label={s.viewer.saveToPhone}
                    size={height.roundViewer}
                    tone="ghost"
                    tint={photo.on}
                    onPress={() => void save()}
                    disabled={busy}
                  />
                  <IconButton
                    icon={Info}
                    label={s.viewer.details}
                    size={height.roundViewer}
                    tone="ghost"
                    tint={photo.on}
                    onPress={() => setDetails(true)}
                    disabled={busy}
                  />
                </View>
              </View>
              {mayDelete(item) ? (
                <IconButton
                  icon={Trash2}
                  label={s.viewer.remove}
                  size={height.roundViewer}
                  tone="glass"
                  tint={room.dangerText}
                  onPress={() => setConfirming(true)}
                  disabled={busy}
                />
              ) : (
                // Whoever may not delete keeps the glass group where it stands: a row that re-centres
                // itself by who is looking is a row that moves under the finger.
                <View style={styles.stub} />
              )}
            </View>
          </View>
        </View>
      </ThemePin>

      {/* `SheetFrame` — what to do with this frame, one line each, and the only red thing on it is
          the delete. It is what both «Ещё» and «Подробности» raise. */}
      <FrameSheet
        visible={details}
        title={s.media[item.kind]}
        meta={[shotBy(item, roster, memory), size === null ? null : s.viewer.size(size)]
          .filter(Boolean)
          .join(' · ')}
        thumb={item.thumbnail_url ?? undefined}
        onSave={() => {
          setDetails(false);
          void save();
        }}
        onShare={() => {
          setDetails(false);
          void hand();
        }}
        onDelete={
          mayDelete(item)
            ? () => {
                setDetails(false);
                setConfirming(true);
              }
            : undefined
        }
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
    tools: { gap: space.s3, paddingTop: space.s3 },
    // A horizontal list in a column takes every pixel it is offered unless it is told its own size.
    strip: { flexGrow: 0 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
    },
    middle: { flex: 1, alignItems: 'center' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      height: height.roundViewer,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: photo.glass,
    },
    stub: { width: height.roundViewer },
  }),
);
