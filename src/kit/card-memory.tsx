import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { font, photo, radius, space, themed, useTheme } from '@/theme';

import { DashedFrame, MetaDot, Progress } from './bits';
import { Mosaic } from './filmstrip';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';

/**
 * Spec 7.6 — a memory in the list, in the two sizes the layout gives it.
 *
 * `large` is the freshest one: 340 tall, a 3 × 2 mosaic of its own frames under the darkening, the
 * name printed across it and a bar of who has already brought theirs. It takes two fifths of the
 * screen because it carries a photograph, and a photograph is the product.
 *
 * The ordinary one is a surface with a strip of four frames across the top. Empty, that strip
 * becomes a dashed frame that says so — spec 7.6 keeps the meta off an empty card entirely, because
 * there is nothing yet to count.
 *
 * Both heights are floors (TASK-375): on large type the words wrap and the card grows down, and the
 * badges go under what no longer leaves them room — the films badge under the organizer's on the
 * large card, under the name on the ordinary one once the name breaks a word beside it. The name is
 * never cut on either (TASK-400): it is the one place the list says which memory this is.
 */
export function CardMemory({
  title,
  meta,
  thumbs,
  cover,
  large,
  organizer,
  films,
  progress,
  progressLabel,
  emptyText,
  onPress,
  label,
  style,
}: {
  title: string;
  /** «12–14 сентября · 486 кадров» — the screen writes both halves; the dot between them is ours. */
  meta?: readonly string[];
  thumbs?: readonly string[];
  /**
   * The one frame somebody chose to stand for this memory (spec 10.8.3). On the large card it takes
   * the whole face instead of the mosaic; on the ordinary one it simply leads the strip. Nothing
   * else moves either way, and without it both cards are what they were.
   */
  cover?: string | null;
  large?: boolean;
  /** The «ОРГАНИЗАТОР» badge, when this account organizes this memory. */
  organizer?: ReactNode;
  /** The films badge — filled on the large card, outlined on the ordinary one. */
  films?: ReactNode;
  /** 0…1 — how many of the participants have brought their frames. Large card only. */
  progress?: number;
  /** «7 из 9 уже скинули свои кадры» — the bar is never drawn without it. */
  progressLabel?: string;
  /** «Ни одного кадра — скиньте первые»: passed when there is nothing in the strip yet. */
  emptyText?: string;
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color, shadow } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const { roomy, room } = useWordRoom();
  // The chosen frame leads the strip and is never repeated further along it (spec 10.8.3): four
  // cells, and the first of them is now spoken for.
  const shots = cover ? [cover, ...(thumbs ?? []).filter((uri) => uri !== cover)] : (thumbs ?? []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        large ? styles.large : styles.card,
        { boxShadow: large ? shadow.cardLarge : shadow.card },
        hovered && !large ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {large ? (
        <>
          {/* Spec 10.8.3 — a chosen frame takes the whole face; without one the memory shows itself
              as the mosaic of what is in it. Everything laid over the picture stays put either way. */}
          {cover ? (
            <Image source={{ uri: cover }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <Mosaic photos={shots} layout="cover" />
          )}
          {/* Spec 2: the darkening over a photograph stays dark in daylight, and so does the white
              it is read in — it lies on the picture, not on the interface. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover]} />
          <View style={styles.largeTop}>
            {organizer}
            <View style={styles.grow} />
            {films}
          </View>
          <View style={styles.largeFoot}>
            <View style={styles.pair}>
              {/* Spec 3 and 7.6, detail 36: the name is balanced — «Свадьба / Лизы и Марка». */}
              <Text role="displayCover" balance style={styles.onPhoto}>
                {title}
              </Text>
              {meta?.length ? <Meta parts={meta} onPhoto /> : null}
            </View>
            {progress !== undefined && progressLabel ? (
              <View style={styles.pair}>
                <Progress value={progress} tone="spark" onPhoto label={progressLabel} />
                <Text role="meta" style={[styles.onPhotoMeta, styles.barWords]}>
                  {progressLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <>
          {shots.length ? (
            <View style={styles.strip}>
              <Mosaic photos={shots} layout="strip" />
            </View>
          ) : (
            // Spec 7.6, detail 37 (`Main`, `HomeDay`): a 20 frame glyph at 1.6 and the words under
            // it 13 / 500 in `muted` — a sentence to read, not a sign.
            <DashedFrame style={styles.stripEmpty}>
              <Icon icon={ImageIcon} size={20} stroke={1.6} color={color.stripSign} />
              {emptyText ? (
                <Text role="meta" style={[styles.metaWords, styles.centred]}>
                  {emptyText}
                </Text>
              ) : null}
            </DashedFrame>
          )}
          <View style={styles.foot}>
            <WordRoom.Provider value={room}>
              <View style={[styles.grow, styles.words, roomy ? styles.whole : null]}>
                <Text role="title">{title}</Text>
                {/* An empty memory has nothing to count, so it wears its name alone. */}
                {shots.length && meta?.length ? <Meta parts={meta} /> : null}
              </View>
            </WordRoom.Provider>
            {films}
          </View>
        </>
      )}
    </Pressable>
  );
}

/**
 * A meta line: pieces of text with the 3px dot between them, and nowhere else in the product. On
 * large type a piece that does not fit goes to the next line whole, and the dot stays at the end of
 * the line it closes.
 */
function Meta({ parts, onPhoto }: { parts: readonly string[]; onPhoto?: boolean }) {
  const styles = useStyles();

  return (
    <View style={[styles.meta, styles.metaLines]}>
      {parts.map((part, i) => (
        <View key={part} style={[styles.meta, styles.metaPart]}>
          <Text role="meta" style={[styles.metaWords, onPhoto ? styles.onCover : null]}>
            {part}
          </Text>
          {i < parts.length - 1 ? <MetaDot onPhoto={onPhoto} /> : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The badges at the top and the words at the foot; on large type, where they meet, 12 between.
    large: {
      minHeight: 340,
      gap: space.s3,
      borderRadius: radius.cover,
      overflow: 'hidden',
      backgroundColor: color.coverBase,
      justifyContent: 'space-between',
    },
    cover: { experimental_backgroundImage: photo.cover },
    // `Main`: the badges hang 14 off the top corners, the words stand 18 off the bottom ones — the
    // name with its meta, then 12 down, the bar with its sentence, 7 inside each pair. On large type
    // the films badge goes under the organizer's.
    largeTop: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s2,
      paddingTop: 14,
      paddingHorizontal: 14,
    },
    largeFoot: { gap: space.s3, paddingHorizontal: 18, paddingBottom: 18 },
    pair: { gap: 7 },
    // Spec 7.6, detail 36: the sentence under the bar is 12 / 600, in Onest's own leading at 12.
    barWords: { fontFamily: font.semi, lineHeight: 16 },
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: 10,
    },
    hover: { backgroundColor: color.raise },
    // The strip of four inside an ordinary card: 96 tall, its own 14 radius. Empty, the 96 is a floor
    // under the sentence it holds.
    strip: { height: 96, borderRadius: radius.strip, overflow: 'hidden' },
    stripEmpty: { minHeight: 96, backgroundColor: color.stripEmpty },
    // `Main`: 13 under the strip, 5 over the card's own 10 below, and the films badge stands on the
    // foot of the words rather than in their middle — 181 for a card with a meta line, 158 without.
    foot: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: space.s3,
      paddingTop: 13,
      paddingHorizontal: 6,
      paddingBottom: 5,
    },
    grow: { flex: 1, minWidth: 0 },
    // The name broke a word beside the badge: the words take the line, the badge goes under them. A
    // width and not a basis: Yoga keeps the basis it first worked out for a node whose basis is set,
    // and the change would never reach the phone (TASK-375).
    whole: { flex: 0, width: '100%' },
    words: { gap: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaLines: { flexWrap: 'wrap' },
    metaPart: { flexShrink: 1 },
    // Spec 7.6, details 36–37: a card's meta is 13 / 500 — a size over the role's 12 — in Onest's own
    // leading at 13.
    metaWords: { fontSize: 13, lineHeight: 17 },
    centred: { textAlign: 'center' },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.onQuiet },
    onCover: { color: photo.coverMeta },
  }),
);
