import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { photo, radius, themed } from '@/theme';

import { Icon } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';
import { TAP } from './tap';

/** One frame as the strip and the mosaic know it: a picture, and whether it moves. */
export type Frame = { uri: string; video?: boolean };

/** Spec 7.8, detail 67 — a neighbour and the frame in hand lie 2 apart, whichever way up the phone. */
const GAP = 2;

/**
 * The sizes the strip is drawn at, measured off the layout (spec 7.8, detail 67 for the standing
 * phone; TASK-475 for the turned one). Held here and not in the strip, because the strip does not
 * decide how big it is drawn — the window it stands under does, and there are two of those.
 *
 * Standing: neighbours 30 × 44, the frame in hand 44 × 48, the strip 48. Turned: 26 × 36, 38 × 40,
 * the strip 40 — everything two thirds of what it is upright, because a turned phone has 390 of
 * height where a standing one has 844 and the strip cannot afford the same share of it.
 */
export type StripSize = {
  /** a neighbour's width */
  shot: number;
  /** a neighbour's height — under the strip's own, as it is standing and as it is turned */
  shotTall: number;
  /** the frame in hand, in both directions */
  current: number;
  /** the strip's own height, which the frame in hand fills */
  tall: number;
  /** how far the strip stands off the bottom edge of the screen */
  foot: number;
};

export const STRIP_STANDING: StripSize = {
  shot: 30,
  shotTall: 44,
  current: 44,
  tall: 48,
  foot: 30,
};

export const STRIP_TURNED: StripSize = {
  shot: 26,
  shotTall: 36,
  current: 38,
  tall: 40,
  foot: 14,
};

/**
 * Spec 7.7 — the viewer's filmstrip: 48 tall, the neighbours 30 × 44 fading out towards the edges,
 * the current frame 44 × 48 at full strength with a play circle on it if it is a video.
 *
 * The one place in the product with a horizontal scroll (spec 1.5), and it turns with the frame
 * above it both ways: the frame in hand is walked to the middle of the strip whenever it changes,
 * and a finger that leaves the strip resting on another frame asks for that frame to be opened.
 * One is not the other — a strip that walks and never listens is the «не меняет элементы при
 * листании» a real phone reported (doc-12), and a strip that listens and never walks is a frame
 * in hand standing somewhere other than the picture over it.
 *
 * A `FlatList` and not a plain row of everything: a memory holds up to a thousand records, and a
 * strip that mounts a thousand thumbnails fetches a thousand pictures to show eleven of them.
 */
export function Filmstrip({
  frames,
  index,
  size = STRIP_STANDING,
  onPick,
  onSettle,
  labelAt,
  style,
}: {
  frames: readonly Frame[];
  index: number;
  /** How big it is drawn — the window's own, one per way up the phone is held (`Viewer*`, TASK-475). */
  size?: StripSize;
  onPick?: (at: number) => void;
  /**
   * The frame the finger left the strip resting on, and whether the window took it in hand. The
   * answer is not a maybe: a frame still being developed is refused, and the strip has to go back
   * to the frame in hand rather than stand centred over one nobody opened.
   */
  onSettle?: (at: number) => boolean;
  /** What each frame is called out as — «Кадр 4 из 486», written by the screen. */
  labelAt?: (at: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const strip = useRef<FlatList<Frame>>(null);
  /**
   * How wide the strip itself is, and 0 until it has been laid out. The walk is hung on this and
   * never on the size of the content: an iOS modal is laid out twice — the first pass sized from
   * the way the phone is physically held — and only the strip's own viewport says which pass this
   * is. A frame landing changes the content and not the viewport, so nothing hauls the strip back
   * from under a finger.
   */
  const [viewport, setViewport] = useState(0);
  /** Whether the strip has been walked at all: the first walk is a jump, every one after it moves. */
  const walked = useRef(false);
  /** Whether this touch has already said where it came to rest — see `rest`. */
  const settled = useRef(false);
  /** Whether the finger let go with the strip still carrying its own way. */
  const flung = useRef(false);

  const to = (at: number, animated: boolean) =>
    strip.current?.scrollToIndex({ index: at, viewPosition: 0.5, animated });

  useEffect(() => {
    if (viewport === 0 || index < 0 || index >= frames.length) return;
    to(index, walked.current);
    walked.current = true;
    // `frames` is deliberately not in here: what the strip holds changes every few seconds while a
    // memory is still being developed, and re-centring on each of those is a strip that will not
    // stay where it was left — which is the bug a real phone reported twice over (TASK-106).
  }, [index, viewport]);

  /**
   * Where the finger left the strip ({@link restedAt}), asked once and once only per touch.
   *
   * Both ends of the touch answer, because neither covers the other: a flick is still running when
   * the finger lifts, and it is the flick that decides which frame it landed on — asking on the lift
   * alone would open the frame the finger passed over. A touch that neither flicks nor moves asks
   * on the lift, and on a flick the lift asks nothing ({@link flung}).
   *
   * `settled` is what keeps one touch from answering twice over, and it is also the strip's own
   * walk out of the way: the walk the window answers with reports its own settling, which must not
   * be taken for a finger choosing the frame the strip was already standing on.
   */
  function rest(x: number) {
    if (settled.current || viewport === 0) return;
    settled.current = true;
    const at = restedAt(x, viewport, frames.length, index, size);
    // Nothing chosen — a touch that did not move the strip, or the frame in hand itself — and a
    // frame the window took stands for itself: it walks the strip on the very next render.
    if (at < 0 || at === index || onSettle?.(at)) return;
    to(index, true);
  }

  const scrollTo = (e: NativeSyntheticEvent<NativeScrollEvent>) => e.nativeEvent.contentOffset.x;

  return (
    <FlatList
      ref={strip}
      horizontal
      data={frames}
      keyExtractor={(frame, at) => frame.uri || String(at)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.strip, { height: size.tall }]}
      style={style}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      onScrollBeginDrag={() => {
        settled.current = false;
        flung.current = false;
      }}
      onMomentumScrollBegin={() => {
        flung.current = true;
      }}
      onScrollEndDrag={(e) => {
        if (!flung.current) rest(scrollTo(e));
      }}
      onMomentumScrollEnd={(e) => rest(scrollTo(e))}
      // The sizes are fixed, so the strip can be walked to any frame without measuring one — and the
      // same arithmetic reads back where a finger has left it.
      getItemLayout={(_, at) => ({ ...shotAt(at, index, size), index: at })}
      renderItem={({ item, index: at }) => (
        <Shot
          frame={item}
          size={size}
          current={at === index}
          // The fade is by distance from the frame in hand: 0.75, 0.6, then 0.45 for everything past.
          dim={[0.75, 0.6][Math.abs(at - index) - 1] ?? 0.45}
          label={labelAt?.(at)}
          onPress={onPick ? () => onPick(at) : undefined}
        />
      )}
    />
  );
}

function Shot({
  frame,
  size,
  current,
  dim,
  label,
  onPress,
}: {
  frame: Frame;
  size: StripSize;
  current: boolean;
  dim: number;
  label?: string;
  onPress?: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const width = current ? size.current : size.shot;
  const height = current ? size.tall : size.shotTall;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      disabled={!onPress}
      onPress={onPress}
      // Spec 1.6 and 10.2: a shot is drawn at the layout's size — 26 × 36 turned, 30 × 44 standing —
      // and neither is 44 across, so the target grows out to it in transparent space. It grows as
      // far as the frame beside it allows ({@link slopFor}): reaching past the half of the gap
      // between two shots would put a tap on the frame the person did not touch, which is worse
      // than a small one.
      hitSlop={slopFor(height)}
      {...props}
      style={[
        { width, height },
        styles.shot,
        current ? styles.shotCurrent : { opacity: dim },
        focused ? focusRing : null,
      ]}
    >
      <Image source={{ uri: frame.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      {current && frame.video ? <PlayDot /> : null}
    </Pressable>
  );
}

/**
 * Where one frame of the strip stands — its own length and the distance from the head of the strip
 * to it. The frame in hand is the wide one, and everything past it is pushed along by the difference.
 *
 * One place for it, because two places must agree on it exactly: the list is told this is where
 * each frame lies ({@link FlatList.getItemLayout}), and the same arithmetic reads back where a
 * resting finger has left the strip. The strip's sizes are fixed, so both are plain numbers.
 */
function shotAt(at: number, index: number, size: StripSize) {
  return {
    length: at === index ? size.current : size.shot,
    offset: at * (size.shot + GAP) + (at > index ? size.current - size.shot : 0),
  };
}

/**
 * The frame a finger has left the strip resting on, or -1 when it has chosen nothing.
 *
 * The nearest frame to the middle of the strip, the way a phone's own gallery reads the row of
 * photographs under an open one. It is arithmetic over {@link shotAt} and no measuring: nothing has
 * to be mounted to be found, and the sizes are the window's, so it reads the same standing or turned.
 *
 * **A finger that did not move the strip has chosen nothing.** That is what `-1` says, and it is
 * what keeps the two ends honest: at the first frame the strip cannot scroll any further back, and
 * the middle of the strip then stands over a neighbour a few frames away. Left to the nearest alone,
 * a flick past the last frame would open the frame before it — the one thing AC #3 of TASK-474
 * refuses. A strip shorter than the viewport never moves at all, and is short for every frame in it.
 *
 * So it is measured against where the frame in hand stands the strip: the same arithmetic the walk
 * uses, clamped to the ends the way the list clamps them.
 */
function restedAt(x: number, viewport: number, count: number, index: number, size: StripSize) {
  if (count === 0 || viewport === 0) return -1;
  const held = shotAt(index, index, size);
  const last = shotAt(count - 1, index, size);
  // Where the frame in hand stands the strip, clamped to the ends the way the list clamps them.
  const standing = Math.max(
    0,
    Math.min(held.offset + held.length / 2 - viewport / 2, last.offset + last.length - viewport),
  );
  if (Math.abs(x - standing) < 1) return -1;

  const middle = x + viewport / 2;
  let on = 0;
  let nearest = Infinity;
  for (let at = 0; at < count; at += 1) {
    const { length, offset } = shotAt(at, index, size);
    const away = Math.abs(offset + length / 2 - middle);
    if (away < nearest) {
      nearest = away;
      on = at;
    }
  }
  return on;
}

/**
 * How far a shot's touch reaches past what it is drawn at (spec 10.2), never past the frame beside
 * it: the two stand {@link GAP} apart, so half that is all a tap can take without landing on the
 * wrong photograph.
 *
 * That leaves the strip short of the 44 in both directions at the layout's own turned sizes — 38 and
 * 40, with a 2 gap between frames that are themselves only 26 wide. Those are the numbers
 * `ViewerRotated*` draws and the window cannot change them; a shot is walked by its neighbours and
 * by the finger, not aimed at, and the frames either side of it are what a person hits instead.
 * ponytail: a strip whose shots were 44 wide would need the gap to grow with them and the pictures
 * to stop being a strip. Raise it when the layout moves off 38 × 40.
 */
function slopFor(height: number) {
  const across = GAP / 2;
  const down = Math.max(0, (TAP - height) / 2);
  return { left: across, right: across, top: down, bottom: down };
}

function PlayDot() {
  const styles = useStyles();
  return (
    <View style={styles.playDot}>
      <Icon icon={Play} size={8} color={photo.on} fill={photo.on} />
    </View>
  );
}

/**
 * Spec 7.7 — the mosaics the layout builds out of a memory's own frames:
 *
 * - `cover` — 3 × 2 with one 2 × 2 cell on the left, behind the large memory card;
 * - `strip` — four in a row inside an ordinary card, 96 tall.
 *
 * A cell with nothing to put in it is left as plain `raise` (spec 7.8, detail 68): a memory with
 * fewer frames than cells fills what it can and leaves the rest empty rather than repeating a picture.
 */
export function Mosaic({
  photos,
  layout = 'strip',
  style,
}: {
  photos: readonly string[];
  layout?: 'cover' | 'strip';
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const cells = layout === 'cover' ? 3 : 4;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.mosaic,
        layout === 'cover' ? styles.mosaicCover : null,
        style,
      ]}
    >
      {Array.from({ length: cells }, (_, i) => {
        const uri = photos[i];
        return (
          <View
            key={uri ?? i}
            style={[
              styles.cell,
              layout === 'cover' && i === 0 ? styles.cellBig : null,
              layout === 'cover' && i > 0 ? styles.cellSmall : null,
            ]}
          >
            {uri ? (
              <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    strip: { flexDirection: 'row', alignItems: 'center', gap: GAP },
    // Widths and heights come from the `size` the window handed in — the strip does not decide how
    // big it is drawn — and only the corners and the surface are here.
    shot: {
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shotCurrent: { borderRadius: 5, opacity: 1 },
    // In the corner of the frame in hand, 4 in from its left and its foot (`ViewerVideo`).
    playDot: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      width: 14,
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: photo.playDot,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // A plain row that does not wrap, so `alignItems: stretch` gives each cell the full height of
    // the slot. It used to wrap, and that is what drew nothing at all on an ordinary memory card
    // (TASK-176): yoga defaults `alignContent` to `flex-start` where css defaults it to `stretch`,
    // so a wrapped line is only as tall as what already stands in it — and a cell whose only child
    // is an absolutely positioned picture stands 0 tall. Four cells of 88 × 0, and the card's own
    // surface showing through the 96 points where the frames belonged.
    mosaic: { flexDirection: 'row', gap: 3 },
    // The one mosaic that wraps, and a column rather than a row: the big cell fills the first
    // column, the two small ones stack in the second. A row cannot draw that — the big cell makes
    // its line as tall as the whole cover, which puts the wrapped line under the bottom edge.
    mosaicCover: { flexDirection: 'column', flexWrap: 'wrap', gap: 2 },
    cell: { flexGrow: 1, flexBasis: 0, backgroundColor: color.raise, overflow: 'hidden' },
    // The 2 × 2 cell on the left of a cover, and the two stacked beside it. Sized outright, both
    // ways: inside the wrap above there is no line to be stretched to.
    cellBig: { width: '66%', height: '100%', flexGrow: 0, flexBasis: 'auto' },
    cellSmall: { width: '32%', height: '49%', flexGrow: 0, flexBasis: 'auto' },
  }),
);
