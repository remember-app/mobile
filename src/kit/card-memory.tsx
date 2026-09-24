import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, space, themed, useTheme } from '@/theme';

import { DashedFrame, MetaDot, Progress } from './bits';
import { Mosaic } from './filmstrip';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

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
  // The chosen frame leads the strip and is never repeated further along it (spec 10.8.3): four
  // cells, and the first of them is now spoken for.
  const shots = cover ? [cover, ...(thumbs ?? []).filter((uri) => uri !== cover)] : thumbs ?? [];

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
            <Text role="display" numberOfLines={3} style={styles.onPhoto}>
              {title}
            </Text>
            {meta?.length ? <Meta parts={meta} onPhoto /> : null}
            {progress !== undefined && progressLabel ? (
              <View style={styles.bar}>
                <Progress value={progress} tone="spark" onPhoto label={progressLabel} />
                <Text role="meta" style={styles.onPhotoMeta}>
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
            <DashedFrame style={styles.strip}>
              <Icon icon={ImageIcon} size={22} color={color.faint} />
              {emptyText ? (
                <Text role="meta" tone="faint" style={styles.centred}>
                  {emptyText}
                </Text>
              ) : null}
            </DashedFrame>
          )}
          <View style={styles.foot}>
            <View style={styles.grow}>
              <Text role="title" numberOfLines={2}>
                {title}
              </Text>
              {/* An empty memory has nothing to count, so it wears its name alone. */}
              {shots.length && meta?.length ? <Meta parts={meta} /> : null}
            </View>
            {films}
          </View>
        </>
      )}
    </Pressable>
  );
}

/** A meta line: pieces of text with the 3px dot between them, and nowhere else in the product. */
function Meta({ parts, onPhoto }: { parts: readonly string[]; onPhoto?: boolean }) {
  const styles = useStyles();

  return (
    <View style={styles.meta}>
      {parts.map((part, i) => (
        <View key={part} style={styles.meta}>
          {i > 0 ? <MetaDot onPhoto={onPhoto} /> : null}
          <Text role="meta" style={onPhoto ? styles.onPhotoMeta : null}>
            {part}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    large: {
      height: 340,
      borderRadius: radius.cover,
      overflow: 'hidden',
      backgroundColor: color.surface,
      justifyContent: 'space-between',
      padding: space.s4,
    },
    cover: { experimental_backgroundImage: photo.cover },
    largeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
    largeFoot: { gap: space.s2 },
    bar: { gap: 6, marginTop: space.s1 },
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: 10,
      gap: space.s3,
    },
    hover: { backgroundColor: color.raise },
    // The strip of four inside an ordinary card: 96 tall, its own 14 radius.
    strip: { height: 96, borderRadius: radius.strip, overflow: 'hidden' },
    foot: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingHorizontal: 6 },
    grow: { flex: 1, minWidth: 0 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    centred: { textAlign: 'center' },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.onQuiet },
  }),
);
