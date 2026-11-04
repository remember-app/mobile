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
  item: MediaItem;
  frames: readonly MediaItem[];
  roster: readonly Member[] | null;
  memory: Memory | null;
  mayDelete: (item: MediaItem) => boolean;
  nameOf: (item: MediaItem, frame: Frame, current?: boolean) => string;
  onOpen: (id: string) => void;
  onClose: () => void;
  onRemoved: (id: string) => void;
  onEdited: (item: MediaItem) => void;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [bare, setBare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [film, setFilm] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const still = useRef(reduced);
  still.current = reduced;
  useTurnsWithPhone(true);
  const { width, height: screen } = useWindowDimensions();
  const turned = width > screen;
  const stripSize = turned ? STRIP_TURNED : STRIP_STANDING;
  const shade = turned ? viewerShade.turned : viewerShade.standing;
  const shown = openFrameOf(item);
  const playable = useMemo(
    () => (item.kind === 'video' ? (cachedVideo(item.id) ?? item.preview_url) : null),
    [item.id, item.kind, item.preview_url],
  );
  useEffect(() => {
    if (item.kind !== 'video' || item.preview_url === null) return;
    if (cachedVideo(item.id) !== null) return;
    void keepVideo(item.id, item.preview_url);
  }, [item.id, item.kind, item.preview_url]);
  const room = frameInfoRoom(screen);
  const full = frameBox(item.width, item.height, width, screen, screen);
  const box = frameBox(item.width, item.height, width, screen, room);
  const panelTall = screen - frameInfoPanelTop(screen);
  const arrival = useMemo(
    () => ({
      stage: rise.interpolate({ inputRange: [0, 1], outputRange: [screen, room] }),
      width: rise.interpolate({ inputRange: [0, 1], outputRange: [full.width, box.width] }),
      height: rise.interpolate({ inputRange: [0, 1], outputRange: [full.height, box.height] }),
      panel: rise.interpolate({ inputRange: [0, 1], outputRange: [panelTall, 0] }),
    }),
    [rise, screen, room, panelTall, full.width, full.height, box.width, box.height],
  );
  const toolsTall =
    stripSize.tall + stripSize.foot + (playable !== null ? viewerFoot.track + height.roundRow : 0);
  const player = useVideoPlayer(playable, (it) => {
    it.timeUpdateEventInterval = 0.25;
    it.play();
  });
  useEvent(player, 'timeUpdate');
  useEvent(player, 'playingChange');
  useEvent(player, 'mutedChange');
  const at = player.currentTime;
  const runs = item.duration_seconds ?? player.duration;
  const isPlaying = player.playing;
  const isMuted = player.muted;
  const index = frameIndex(frames, item.id);
  const strip = useMemo(
    () =>
      frames.map((one) => {
        const frame = frameOf(one);
        return {
          uri: frame.uri ?? '',
          video: one.kind === 'video',
          cacheKey: frame.key,
        };
      }),
    [frames],
  );
  function walk(to: number): boolean {
    const next = frames[to];
    if (!next || !mayOpen(next)) return false;
    setBare(false);
    onOpen(next.id);
    return true;
  }
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
  const step = useRef(stride);
  step.current = stride;
  const before = neighbour(-1);
  const after = neighbour(1);
  const shift = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {
    shift.setValue(0);
  }, [item.id, shift]);
  const travel = panel ? box.width : full.width;
  const reach = useRef({ back: 0, on: 0 });
  reach.current = {
    back: before && !turned ? travel : 0,
    on: after && !turned ? travel : 0,
  };
  const downFrom = useRef(screen);
  downFrom.current = screen;
  const closed = useRef(onClose);
  closed.current = onClose;
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
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && to === 0) setPanel(false);
    });
  };
  const tapped = useRef(tapPicture);
  tapped.current = tapPicture;
  function tapPicture() {
    if (panel) {
      slide.current(0);
      return;
    }
    setBare((was) => !was);
  }
  const shows = useRef(() => {});
  shows.current = () => {
    if (panel) return;
    setBare(false);
    slide.current(1);
  };
  const settle = useRef<(by: -1 | 0 | 1) => void>(() => {});
  settle.current = (by) => {
    const goes = (by === 1 ? after : by === -1 ? before : null) !== null;
    if (still.current || turned) {
      shift.setValue(0);
      if (goes && by !== 0) step.current(by);
      return;
    }
    Animated.timing(shift, {
      toValue: goes ? -by * travel : 0,
      duration: motion.step,
      easing: EASE,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && goes && by !== 0) step.current(by);
    });
  };
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          (Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy)) ||
          (Math.abs(g.dy) > SIDEWAYS && Math.abs(g.dy) > Math.abs(g.dx)),
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) <= Math.abs(g.dy)) return;
          const { back, on } = reach.current;
          shift.setValue(Math.max(-on, Math.min(back, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) <= SIDEWAYS && Math.abs(g.dy) <= SIDEWAYS) return tapped.current();
          if (edgeBack(g, GO)) return closed.current();
          if (topDown(g, downFrom.current, GO)) return closed.current();
          if (g.dy <= -GO && Math.abs(g.dy) > Math.abs(g.dx)) return shows.current();
          setBare(false);
          if (Math.abs(g.dx) < GO) return settle.current(0);
          settle.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );
  function toggleDetails() {
    setMenu(false);
    setBare(false);
    slide.current(panel ? 0 : 1);
  }
  function openFilm(montageId: string) {
    slide.current(0);
    setFilm(montageId);
    if (Platform.OS !== 'ios') raiseFilm(montageId);
  }
  function raiseFilm(montageId: string) {
    onClose();
    router.setParams({ montage: montageId });
  }
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(s.error.galleryRefused);
    return granted;
  }
  async function save() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      setNotice(s.save.one);
      const { url } = await downloadMedia(token, memoryId, item.id);
      await saveToPhone({ id: item.id, kind: item.kind, url });
      setNotice(s.save.done);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : s.save.failedOne);
    } finally {
      setBusy(false);
    }
  }
  async function hand() {
    if (!token) return;
    setBusy(true);
    setNotice(s.viewer.sharing);
    try {
      const { url } = await downloadMedia(token, memoryId, item.id);
      await shareFile({ id: item.id, kind: item.kind, url });
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
  const stamp = new Date(shotAt(item));
  const when = formatDayShort(stamp);
  const who = memberName(roster?.find((member) => member.id === item.uploaded_by) ?? null);
  const meta = [formatTime(stamp), who].filter(Boolean).join(' · ');
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
      visible={film === null}
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        if (film !== null) raiseFilm(film);
      }}
      supportedOrientations={['portrait', 'landscape']}
    >
      <ThemePin value="dark">
        <View style={styles.viewer} onAccessibilityEscape={onClose}>
          <Animated.View
            style={[styles.stage, { height: arrival.stage }]}
            {...swipe.panHandlers}
            {...said}
          >
            <Animated.View style={[styles.row, { transform: [{ translateX: shift }] }]}>
              {beside(before)}
              <Animated.View
                style={[styles.cell, { width: arrival.width, height: arrival.height }]}
              >
                {playable !== null ? (
                  <>
                    <VideoView
                      player={player}
                      nativeControls={false}
                      contentFit="cover"
                      style={StyleSheet.absoluteFill}
                    />

                    {bare ? null : (
                      <View style={styles.middleOfFrame} pointerEvents="box-none">
                        <IconButton
                          icon={isPlaying ? Pause : Play}
                          label={isPlaying ? s.viewer.pause : s.viewer.play}
                          size={72}
                          tone="video"
                          onPress={() => (isPlaying ? player.pause() : player.play())}
                        />
                      </View>
                    )}
                  </>
                ) : shown.uri !== null ? (
                  <Image
                    source={{ uri: shown.uri, cacheKey: shown.key }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.blank}>
                    <Empty icon={ImageSign} text={s.viewer.notOpened} />
                  </View>
                )}
              </Animated.View>
              {beside(after)}
            </Animated.View>

            {notice ? (
              <Banner
                text={notice}
                style={[styles.notice, { bottom: panel ? space.s4 : toolsTall + space.s4 }]}
              />
            ) : null}
          </Animated.View>

          {bare ? null : (
            <>
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

              <ViewerBar
                date={when}
                meta={meta}
                label={`${panel ? s.viewer.hideDetails : s.viewer.details}: ${when}, ${meta}`}
                onPress={toggleDetails}
                on={panel}
                turned={turned}
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
                    style={menu ? styles.held : null}
                  />
                }
              />

              {panel ? null : (
                <View
                  style={[styles.tools, { paddingBottom: Math.max(insets.bottom, stripSize.foot) }]}
                >
                  {playable !== null ? (
                    <View style={styles.track}>
                      <VideoTrack
                        at={formatRuntime(at) ?? ZERO}
                        of={formatRuntime(runs) ?? ZERO}
                        value={runs > 0 ? at / runs : 0}
                        label={s.viewer.played}
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
                    onSettle={walk}
                  />
                </View>
              )}
            </>
          )}

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
const SOUND_GLYPH = { size: ICO_S } as const;
const ZERO = '0:00';
const TOGGLE = [{ name: 'activate' }];
export function frameBox(
  frameWidth: number | null,
  frameHeight: number | null,
  screenWidth: number,
  screenHeight: number,
  room?: number,
): {
  width: number;
  height: number;
} {
  const turned = screenWidth > screenHeight;
  const down = room ?? screenHeight;
  const along = turned ? Math.min(screenHeight, down) : screenWidth;
  const limit = turned ? screenWidth : down;
  if (!frameWidth || !frameHeight) {
    return turned ? { width: limit, height: along } : { width: along, height: limit };
  }
  const across = turned ? (along * frameWidth) / frameHeight : (along * frameHeight) / frameWidth;
  return turned
    ? { width: Math.min(across, limit), height: along }
    : { width: along, height: Math.min(across, limit) };
}
const useStyles = themed(() =>
  StyleSheet.create({
    viewer: { flex: 1, backgroundColor: photo.viewer },
    stage: { alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row' },
    cell: { overflow: 'hidden' },
    blank: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    middleOfFrame: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shade: { position: 'absolute', left: 0, right: 0 },
    shadeTop: { top: 0, experimental_backgroundImage: photo.viewerShadeTop },
    shadeFoot: { bottom: 0, experimental_backgroundImage: photo.viewerShadeFoot },
    shadeFootTurned: { experimental_backgroundImage: photo.viewerShadeFootTurned },
    bar: { position: 'absolute', left: 0, right: 0 },
    panelBox: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    notice: { position: 'absolute', left: space.s4, right: space.s4, bottom: space.s4 },
    tools: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: viewerFoot.track },
    track: { paddingHorizontal: space.s4 },
    sound: { marginRight: -space.s2 },
    strip: { flexGrow: 0 },
    held: { backgroundColor: photo.held },
  }),
);
