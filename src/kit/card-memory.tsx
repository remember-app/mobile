import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, font, radius, space } from '@/theme';

import { focusRing, useHoverFocus, useReducedMotion } from './interaction';
import { shade } from './shades';
import { Text } from './text';

/**
 * Section 5 — a memory in the list, the main screen's one repeated thing.
 */

/** Enough dots to run past the tallest card; the rail clips whatever is left over. */
const RAIL_DOTS = 12;

/**
 * The kit's `.rail`: film perforation punched down the left edge. The one loud move in the whole
 * kit, and it belongs to this card alone — CSS draws it with a repeating radial gradient, React
 * Native has no gradients, so the holes are dots on a clipped strip at the same 13px pitch.
 */
function Rail() {
  return (
    <View
      style={styles.rail}
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
 * The kit's `.stack`: the last few frames, overlapped, so what is inside shows without opening it.
 * A memory nobody has added to yet says so with a dash instead of pretending to have frames.
 */
function Stack({ thumbs, more }: { thumbs: string[]; more?: number }) {
  const empty = thumbs.length === 0 && !more;

  return (
    <View style={styles.stack}>
      {thumbs.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          resizeMode="cover"
          style={[styles.frame, i > 0 ? styles.overlap : null]}
        />
      ))}
      {more ? (
        <View style={[styles.frame, styles.more, thumbs.length > 0 ? styles.overlap : null]}>
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      ) : null}
      {empty ? (
        <View style={[styles.frame, styles.more]}>
          <Text style={styles.moreText}>—</Text>
        </View>
      ) : null}
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
  more,
  onPress,
  style,
}: {
  title: string;
  meta: string[];
  /** Up to a couple of recent frame URIs; the rest are counted by `more`. */
  thumbs?: string[];
  more?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, ...meta].join(', ')}
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
      </View>
      <Stack thumbs={thumbs} more={more} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.s4,
    width: '100%',
    paddingVertical: space.s4,
    paddingRight: space.s4,
    paddingLeft: space.s3,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  cardHover: { backgroundColor: color.raise, borderColor: shade.lineHover },
  press: { transform: [{ translateY: 1 }] },
  // 4.8px holes, first centred 6.5 down, one every 13 — the kit's gradient, resolved to dots.
  rail: { width: 8, alignItems: 'center', paddingTop: 4.1, gap: 8.2, overflow: 'hidden' },
  railDot: { width: 4.8, height: 4.8, borderRadius: 2.4, backgroundColor: shade.perforation },
  body: { flex: 1, minWidth: 0, gap: space.s2 },
  title: { fontFamily: font.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  // Gap on both rows: 8 between one fact and the next dot, 8 between that dot and its fact.
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color.muted },
  stack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  frame: {
    width: 44,
    height: 44,
    borderRadius: radius.frame,
    borderWidth: 1,
    borderColor: color.ink,
    backgroundColor: color.raise,
  },
  overlap: { marginLeft: -12 },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, lineHeight: 13, fontWeight: '500', color: color.muted, fontVariant: ['tabular-nums'] },
});
