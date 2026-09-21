import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, themed, useTheme } from '@/theme';

import { Icon } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';

/** One frame as the strip and the mosaic know it: a picture, and whether it moves. */
export type Frame = { uri: string; video?: boolean };

/** Spec 7.7 — a neighbour is 30 wide, the frame in hand 44, and they lie 4 apart. */
const SHOT = 30;
const CURRENT = 44;
const GAP = 4;

/**
 * Spec 7.7 — the viewer's filmstrip: 48 tall, the neighbours 30 × 44 fading out towards the edges,
 * the current frame 44 × 48 at full strength with a play circle on it if it is a video.
 *
 * The one place in the product with a horizontal scroll (spec 1.5), and it turns with the frame
 * above it rather than on its own: the frame in hand is walked to the middle of the strip whenever
 * it changes, so the strip is never standing somewhere else than the picture over it.
 *
 * A `FlatList` and not a plain row of everything: a memory holds up to a thousand records, and a
 * strip that mounts a thousand thumbnails fetches a thousand pictures to show eleven of them.
 */
export function Filmstrip({
  frames,
  index,
  onPick,
  labelAt,
  style,
}: {
  frames: readonly Frame[];
  index: number;
  onPick?: (at: number) => void;
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

  useEffect(() => {
    if (viewport === 0 || index < 0 || index >= frames.length) return;
    strip.current?.scrollToIndex({ index, viewPosition: 0.5, animated: walked.current });
    walked.current = true;
    // `frames` is deliberately not in here: what the strip holds changes every few seconds while a
    // memory is still being developed, and re-centring on each of those is a strip that will not
    // stay where it was left — which is the bug a real phone reported twice over (TASK-106).
  }, [index, viewport]);

  return (
    <FlatList
      ref={strip}
      horizontal
      data={frames}
      keyExtractor={(frame, at) => frame.uri || String(at)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={style}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      // Fixed sizes, so the strip can be walked to any frame without measuring one: the frame in
      // hand is the wide one, and everything past it is pushed along by the difference.
      getItemLayout={(_, at) => ({
        length: at === index ? CURRENT : SHOT,
        offset: at * (SHOT + GAP) + (at > index ? CURRENT - SHOT : 0),
        index: at,
      })}
      renderItem={({ item, index: at }) => (
        <Shot
          frame={item}
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
  current,
  dim,
  label,
  onPress,
}: {
  frame: Frame;
  current: boolean;
  dim: number;
  label?: string;
  onPress?: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={[
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

function PlayDot() {
  const styles = useStyles();
  return (
    <View style={styles.playDot}>
      <Icon icon={Play} size={8} color={photo.on} fill={photo.on} />
    </View>
  );
}

/**
 * Spec 7.7 — the three mosaics the layout builds out of a memory's own frames:
 *
 * - `cover` — 3 × 2 with one 2 × 2 cell on the left, behind the large memory card;
 * - `strip` — four in a row inside an ordinary card, 96 tall;
 * - `banner` — four in a row under a solid, 176 tall, behind «Собираем ролик».
 *
 * A cell with nothing to put in it is left as plain `surface`: spec 7.6 says a memory with fewer
 * than three frames fills what it can and leaves the rest empty rather than repeating a picture.
 */
export function Mosaic({
  photos,
  layout = 'strip',
  style,
}: {
  photos: readonly string[];
  layout?: 'cover' | 'strip' | 'banner';
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
        layout === 'banner' ? styles.mosaicBanner : null,
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
    strip: { flexDirection: 'row', alignItems: 'center', gap: GAP, height: 48 },
    shot: {
      width: SHOT,
      height: 44,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shotCurrent: { width: CURRENT, height: 48, borderRadius: 5, opacity: 1 },
    playDot: {
      position: 'absolute',
      top: 17,
      left: 15,
      width: 14,
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
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
    mosaicBanner: { gap: 2 },
    cell: { flexGrow: 1, flexBasis: 0, backgroundColor: color.surface, overflow: 'hidden' },
    // The 2 × 2 cell on the left of a cover, and the two stacked beside it. Sized outright, both
    // ways: inside the wrap above there is no line to be stretched to.
    cellBig: { width: '66%', height: '100%', flexGrow: 0, flexBasis: 'auto' },
    cellSmall: { width: '32%', height: '49%', flexGrow: 0, flexBasis: 'auto' },
  }),
);
