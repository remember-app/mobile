// `expo-image` and not React Native's own: a frame picked out of the phone's gallery is named by a
// `ph://` reference to the photo library, which React Native has no loader for at all — that is the
// red «No suitable image URL loader» screen. This one asks the Photos framework, which answers for a
// video with its poster frame too, and hands back a bitmap already scaled to the tile instead of a
// twelve-megapixel original — which is what makes a grid of thousands survivable.
import { Image } from 'expo-image';
import { Check, ImageIcon, Play, X } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { font, duration as motion, night, photo, radius, space, themed, useTheme } from '@/theme';

import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/** What has become of one frame (spec 7.8). */
export type TileState = 'ready' | 'processing' | 'failed';

/**
 * The five kinds of pick circle (spec 7.4, detail 26). `send` is the `accent` one — a frame marked
 * in the feed, in the send queue and in the cover sheet; `keep` is the wizard's `spark` one — the
 * frame is taken into the montage (spec 1.2: `spark` is «взято в ролик»). Being dropped is not
 * a pick at all — `auto` shows the reason instead of a circle, `hand` shows a cross — and both dim
 * the frame rather than hide it.
 */
export type PickKind = 'send' | 'keep' | 'off' | 'auto' | 'hand';

/**
 * The two grids a frame stands in (spec 7.8). They are not one grid at two sizes: the memory's own
 * feed runs edge to edge with the frames nearly touching and no rounding at all, because there the
 * photographs *are* the screen; the wizard and the send queue stand inside the screen's own 16 with
 * a hair more air and a 4 radius, because there a frame is a thing being picked out of a list.
 */
export type TileLane = 'feed' | 'pick';

/**
 * The gutter between two frames, one per lane, and the whole of what stands between them. Here
 * rather than in the screens that draw a grid: each has to work a column width out of it, and a
 * gutter of two minds would tell them two different widths.
 */
export const GRID_GAP = 3;
export const FEED_GAP = 2;

/**
 * One frame of the grid (spec 7.8). It fills whatever column it is given and stays square — at 390
 * that is 129 across the feed and 117 inside the wizard, which is where those two numbers in the
 * spec come from. Nothing here is pressable unless `onPress` is passed: a frame still developing is
 * not a button.
 */
export function Tile({
  state,
  uri,
  lane = 'pick',
  pick,
  ring,
  length,
  reason,
  caption,
  label,
  onPress,
  style,
}: {
  state: TileState;
  uri?: string;
  /** Which grid this one stands in — it settles the rounding and the size of the circle. */
  lane?: TileLane;
  /** The circle in the corner. Left off, the frame is not in a picking mode at all. */
  pick?: PickKind;
  /**
   * The send queue's own frame around a picked file (spec 7.4): 3px of `accent` inset over the
   * picture. Only there — in the feed a picked frame is told by the darkening alone, and in the
   * wizard by the circle.
   */
  ring?: boolean;
  /** A video's running time as the screen writes it, «0:24». */
  length?: string;
  /** Why the automatic pass dropped this one: a glyph and a word, «Размыто» / «Дубль» / «Темно». */
  reason?: { icon: IconComponent; label: string };
  /** What a developing frame says of itself. */
  caption?: string;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const dropped = pick === 'auto' || pick === 'hand';
  const picked = pick === 'send' || pick === 'keep';

  const inner = (
    <>
      {state === 'ready' && uri ? (
        // The fade is `expo-image`'s own cross-dissolve and not an `Animated` opacity laid over it.
        // It was the latter until the frame stopped appearing at all: a native-driver opacity has to
        // be attached to a native view, and this is a class component wrapping one, so the value
        // rose to 1 in JS while the picture sat at 0 until an unrelated re-render pushed it — which
        // is why a tile only showed itself once it was tapped.
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={reduced ? 0 : motion.sheet}
          style={[styles.image, dropped ? styles.down : null]}
        />
      ) : null}

      {state === 'processing' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <Spinner size={16} />
          {caption ? (
            <Text role="meta" style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Spec 7.7 — «не загрузилась»: a plain surface and a frame glyph, and a press tries again. */}
      {state === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon icon={ImageIcon} size={22} color={color.faint} />
          </View>
          {/* Read, so `muted` — the glyph above it is the quiet part (spec 10.1). */}
          {caption ? (
            <Text role="meta" style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {length && state === 'ready' && !reason ? <FrameMark length={length} lane={lane} /> : null}
      {reason ? <FrameMark icon={reason.icon} label={reason.label} lane={lane} /> : null}

      {/* Spec 7.4 — a picked frame goes down under a scrim so the circle on it stays the brightest
          thing in the square: .30 in the feed, .28 under the ring of the 117 grid (10.11). */}
      {picked ? (
        <View
          testID="tile-scrim"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, ring ? styles.scrimRing : styles.scrim]}
        />
      ) : null}

      {/* A layer over the picture rather than a border on the tile itself: a border comes out of the
          tile's own box, which in the grid would make a picked frame narrower than its neighbours. */}
      {ring && picked ? (
        <View
          testID="tile-ring"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.ring, { borderColor: color.accent }]}
        />
      ) : null}

      {pick && pick !== 'auto' ? <PickCircle kind={pick} size={lane === 'feed' ? 24 : 22} /> : null}
    </>
  );

  const frame: StyleProp<ViewStyle> = [
    styles.tile,
    lane === 'feed' ? styles.feed : null,
    state === 'processing' ? styles.processing : null,
    state === 'failed' ? styles.broken : null,
    style,
  ];

  if (!onPress) {
    return (
      <View style={frame} accessibilityRole="image" accessibilityLabel={label}>
        {inner}
      </View>
    );
  }

  // A frame that carries a pick is a checkbox, and one that does not is a button. It matters:
  // `checked` is spoken only when it is true, so on a screen whose whole job is picking, an unpicked
  // frame would announce neither that it toggles nor that it is currently off.
  return (
    <Pressable
      accessibilityRole={pick ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={pick ? { checked: picked } : undefined}
      onPress={onPress}
      {...props}
      style={[frame, focused ? focusRing : null]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Spec 7.4 — the circle that says a frame has been picked, in the three sizes the layout draws it
 * at: 24 in the corner of a feed frame, 22 in the wizard and the send queue, 13 inside a day gap.
 * Its own component because it is its own detail: the same circle stands on a frame going to the
 * server and on a frame being taken home, and only the colour tells those two apart.
 *
 * The 13 is the one that does not lie on a photograph, so it is drawn in the theme's own ink rather
 * than in the white a picture needs underneath it.
 */
export function PickCircle({
  kind,
  size = 22,
}: {
  kind: Exclude<PickKind, 'auto'>;
  size?: 24 | 22 | 13;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const tiny = size === 13;
  const tick = tiny ? 8 : 13;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.pick,
        { width: size, height: size },
        tiny ? null : size === 24 ? styles.pickCornerFeed : styles.pickCorner,
        kind === 'send' ? [styles.pickSend, { backgroundColor: color.accent }] : null,
        kind === 'send' && tiny ? styles.pickBare : null,
        kind === 'keep' ? { backgroundColor: color.spark } : null,
        kind === 'off'
          ? tiny
            ? { borderWidth: 1, borderColor: color.faint }
            : styles.pickOff
          : null,
        kind === 'hand' ? [styles.pickHand, { borderColor: night.lineStrong }] : null,
      ]}
    >
      {kind === 'send' ? <Icon icon={Check} size={tick} color={color.onFill} /> : null}
      {kind === 'keep' ? <Icon icon={Check} size={tick} color={color.sparkInk} /> : null}
      {kind === 'hand' ? <Icon icon={X} size={tick} color={night.muted} /> : null}
    </View>
  );
}

/**
 * The feed's running-time triangle (`MemoryFrames`) is the layout's own path in a 9 box,
 * `M8 5.2v13.6L19 12z` — 4 × 5 and thin. Lucide's rounded `play` fills most of its box, so at 9 it
 * came out half again as large; at 6 it lands on the same 4 × 5, as far ahead of the words.
 */
const FEED_PLAY = 6;

/**
 * Spec 7.4 — the mark in the bottom corner of a tile: either a video's running time, or the reason
 * the automatic pass dropped the frame.
 *
 * The running time carries no plate in the feed at all — a shadow on the letters is enough, and a
 * plate under every video would be a grid of dark rectangles. In the wizard, where the frames stand
 * apart on their own, it gets the plate back. The reason's plate is denser still and runs the whole
 * width, because a word has to be read at 10px over somebody's photograph.
 */
export function FrameMark({
  length,
  icon,
  label,
  lane = 'pick',
}: {
  length?: string;
  icon?: IconComponent;
  label?: string;
  lane?: TileLane;
}) {
  const styles = useStyles();
  const bare = lane === 'feed' && !label;

  return (
    <View style={[styles.mark, bare ? styles.markBare : null, label ? styles.markWide : null]}>
      <Icon
        icon={icon ?? Play}
        size={bare ? FEED_PLAY : length ? 9 : 11}
        // Spec 7.4, detail 25: the reason's glyph is 11 at 2.
        stroke={label ? 2 : undefined}
        color={photo.on}
        fill={length ? photo.on : undefined}
      />
      <Text
        role="meta"
        numberOfLines={1}
        style={[styles.markText, bare ? styles.markShadow : null, label ? styles.markTextSm : null]}
      >
        {length ?? label}
      </Text>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    tile: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.tile,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    // Spec 7.8: in the feed the photographs run together and nothing is rounded off them.
    feed: { borderRadius: 0 },
    processing: { borderWidth: 1, borderColor: color.line },
    broken: { backgroundColor: color.raise },
    image: { width: '100%', height: '100%' },
    // Spec 7.4: a frame the pass dropped goes down to 32% — visible, and plainly out.
    down: { opacity: 0.32 },
    state: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.s2 },
    caption: { textAlign: 'center' },
    scrim: { backgroundColor: photo.picked },
    scrimRing: { backgroundColor: photo.pickedRing },
    ring: { borderWidth: 3, borderRadius: radius.tile },
    pick: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    // Spec detail 26: the 22 of the wizard and the 117 grid 6 from the corner, the feed's 24 at 7.
    pickCorner: { position: 'absolute', top: 6, right: 6 },
    pickCornerFeed: { position: 'absolute', top: 7, right: 7 },
    // The 24 in the feed carries a white collar so it is read over any photograph; the 13 in a day
    // gap stands on the screen's own ink and needs none.
    pickSend: { borderWidth: 2, borderColor: photo.on },
    pickBare: { borderWidth: 0 },
    pickOff: { backgroundColor: photo.pickOff, borderWidth: 2, borderColor: photo.pickEdge },
    pickHand: { backgroundColor: photo.pickHand, borderWidth: 1 },
    // Spec 7.4, detail 25: in the wizard the time stands on a 20 plate 6 off the lower left corner.
    mark: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
    },
    // In the feed the timecode stands at the right edge and owns no surface at all: 7 from the edge
    // and 6 from the foot (`MemoryFrames`). The plate's padding is taken off edge by edge — a bare
    // `padding: 0` loses to `paddingHorizontal` in React Native whatever the order, and left the
    // time 14 in from the edge and 9 up.
    markBare: {
      left: undefined,
      right: 7,
      bottom: 6,
      gap: 4,
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: undefined,
    },
    // The reason is a 21 pill across the tile, 5 in from its sides and its foot — a word needs the
    // room a timecode does not (`MontageSelect.json` e21, e27, e42).
    markWide: {
      left: 5,
      right: 5,
      bottom: 5,
      paddingHorizontal: space.s2,
      backgroundColor: photo.markStrong,
    },
    markText: { color: photo.on, fontSize: 11, lineHeight: 14, fontFamily: font.semi },
    markShadow: {
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    markTextSm: { color: night.muted, fontSize: 10, lineHeight: 15, flexShrink: 1 },
  }),
);
