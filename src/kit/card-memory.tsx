import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, radius, space, themed } from '@/theme';

import { useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Section 5 — a memory in the list, the main screen's one repeated thing.
 */

/**
 * Enough dots to run past the tallest card; the rail clips whatever is left over. Sixteen and not
 * twelve since the frames moved inside the card: a card is now the title, the facts and an 80-high
 * strip, and the perforation has to reach the bottom of that even when the facts take two lines.
 */
const RAIL_DOTS = 16;

/** The kit's 8-wide rail. Named because the card's left padding has to keep exactly that much. */
const RAIL_WIDTH = 8;

/**
 * The kit's `.rail`: film perforation punched down the left edge. The one loud move in the whole
 * kit, and it belongs to this card alone — CSS draws it with a repeating radial gradient, React
 * Native has no gradients, so the holes are dots on a clipped strip at the same 13px pitch.
 *
 * Painted over the card's left padding rather than standing beside the body in the row. A gradient
 * costs no height, a column of sixteen dots is 204 tall, and in the row that column was what the
 * card's height was measured from — the card came out 64 taller than the anatomy it draws.
 */
function Rail() {
  const styles = useStyles();

  return (
    <View
      style={styles.rail}
      testID="card-memory-rail"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: RAIL_DOTS }, (_, i) => (
        <View key={i} style={styles.railDot} />
      ))}
    </View>
  );
}

/**
 * The kit's `.card-memory__strip`: a cut of negative under the title, so what is inside the memory
 * shows without opening it. Every frame is `flex: 1` on a zero basis, which is the whole trick —
 * one frame stretches across the strip, four go near-square, and any number in between looks meant
 * rather than short of a grid. A memory nobody has added to yet keeps the same band as clean film
 * and says what to do about it.
 */
function Strip({ thumbs, blank }: { thumbs: string[]; blank?: string }) {
  const styles = useStyles();

  return (
    <View style={styles.strip}>
      {thumbs.length > 0 ? (
        thumbs.map((uri, i) => (
          <Image
            key={`${uri}-${i}`}
            testID="card-memory-frame"
            source={{ uri }}
            resizeMode="cover"
            style={styles.film}
          />
        ))
      ) : (
        <View style={[styles.film, styles.blank]}>
          <Text role="meta" style={styles.blankText}>
            {blank}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The kit's `.card-memory`. `meta` is the facts as the screen words them — date, frames, people —
 * and the card sets the 3px dots between them.
 */
export function CardMemory({
  title,
  meta,
  thumbs = [],
  blank,
  onPress,
  style,
}: {
  title: string;
  meta: string[];
  /** The frames to draw, however many the listing signed — the strip divides itself between them. */
  thumbs?: string[];
  /** What the card says instead, when there are no frames at all. The screen's words. */
  blank?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      // The frames are the card and a screen reader cannot have them, so what stands in for them is
      // the line the card would draw in their place — read only when there are none to draw.
      accessibilityLabel={[title, ...meta, thumbs.length === 0 ? blank : undefined]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.card,
        hovered ? styles.cardHover : null,
        pressed && !reduced ? styles.press : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      <Rail />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.meta}>
          {meta.map((item, i) => (
            <View key={`${item}-${i}`} style={styles.metaItem}>
              {i > 0 ? <View style={styles.dot} /> : null}
              <Text role="meta">{item}</Text>
            </View>
          ))}
        </View>
        <Strip thumbs={thumbs} blank={blank} />
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color, shade }) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
      paddingVertical: space.s4,
      paddingRight: space.s4,
      // The kit's 12 to the perforation, the perforation's own 8, then the kit's 16 from it to the
      // text. In the kit those last two are the rail and the row's gap; here the rail is painted
      // over the padding instead of standing in the row, so the padding holds its place.
      paddingLeft: space.s3 + RAIL_WIDTH + space.s4,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.card,
    },
    cardHover: { backgroundColor: color.raise, borderColor: shade.lineHi },
    press: { transform: [{ translateY: 1 }] },
    // 4.8px holes, first centred 6.5 down, one every 13 — the kit's gradient, resolved to dots.
    // Laid over the card's left padding, top and bottom pinned to the card's own: the strip is then
    // exactly as tall as the card is and clips the dots that run past it, and nothing sets a height.
    rail: {
      position: 'absolute',
      left: space.s3,
      top: space.s4,
      bottom: space.s4,
      width: RAIL_WIDTH,
      alignItems: 'center',
      paddingTop: 4.1,
      gap: 8.2,
      overflow: 'hidden',
    },
    railDot: { width: 4.8, height: 4.8, borderRadius: 2.4, backgroundColor: shade.perf },
    body: { flex: 1, minWidth: 0, gap: space.s2 },
    title: { fontFamily: font.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
    // Gap on both rows: 8 between one fact and the next dot, 8 between that dot and its fact.
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s2 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color.muted },
    // 3 between frames — the same cut as between two frames of the contact sheet — and 4 above the
    // strip, which on top of the body's own 8 is the kit's 12 between the facts and the film.
    strip: { flexDirection: 'row', gap: 3, marginTop: space.s1 },
    // One band of film, whether a frame is printed on it or not. No width: the frames divide the
    // strip between themselves, however many arrive. The height is fixed instead, so a memory with
    // one frame in it takes no more of the list than a full one.
    film: {
      flex: 1,
      height: 80,
      borderRadius: radius.frame,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.ink,
    },
    blank: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s4 },
    // A sentence and not a fact, so it wraps: the kit gives this one line-height 1.35 where `meta`
    // reads its figures at 1.2.
    blankText: { lineHeight: 17.6, textAlign: 'center' },
  }),
);
