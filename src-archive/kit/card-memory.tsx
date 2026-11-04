import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { pictureKey } from '@/lib/picture-key';
import { font, photo, radius, space, themed, useTheme } from '@/theme';
import { DashedFrame, MetaDot, Progress } from './bits';
import { Mosaic } from './filmstrip';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';
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
  meta?: readonly string[];
  thumbs?: readonly string[];
  cover?: string | null;
  large?: boolean;
  organizer?: ReactNode;
  films?: ReactNode;
  progress?: number;
  progressLabel?: string;
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
  const { roomy, way, room } = useWordRoom();
  const rest = (thumbs ?? []).filter((uri) => uri !== cover);
  const pool = large && cover ? [] : rest;
  const era = useEra(pool.length);
  const drawn = pickFrames(pool, era);
  const shots = cover ? [cover, ...drawn] : drawn;
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
          {cover ? (
            <Image
              source={{ uri: cover, cacheKey: pictureKey(cover) }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Mosaic photos={shots} layout="cover" />
          )}

          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover]} />
          <View style={styles.largeTop}>
            {organizer}
            <View style={styles.grow} />
            {films}
          </View>
          <View style={styles.largeFoot}>
            <View style={styles.pair}>
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
              <View key={way} style={[styles.grow, styles.words, roomy ? styles.whole : null]}>
                <Text role="title">{title}</Text>

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
export const FACE_MS = 5 * 60 * 60 * 1000;
const eraAt = (now: number) => Math.floor(now / FACE_MS);
export function pickFrames(pool: readonly string[], era: number): string[] {
  const out = [...pool];
  let s = era >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function useEra(count: number): number {
  const [era, setEra] = useState(() => eraAt(Date.now()));
  useEffect(() => {
    if (count < 2) return;
    const at = setTimeout(() => setEra(eraAt(Date.now())), (era + 1) * FACE_MS - Date.now());
    return () => clearTimeout(at);
  }, [era, count]);
  return era;
}
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
    large: {
      minHeight: 340,
      gap: space.s3,
      borderRadius: radius.cover,
      overflow: 'hidden',
      backgroundColor: color.coverBase,
      justifyContent: 'space-between',
    },
    cover: { experimental_backgroundImage: photo.cover },
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
    barWords: { fontFamily: font.semi, lineHeight: 16 },
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: 10,
    },
    hover: { backgroundColor: color.raise },
    strip: { height: 96, borderRadius: radius.strip, overflow: 'hidden' },
    stripEmpty: { minHeight: 96, backgroundColor: color.stripEmpty },
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
    whole: { flex: 0, width: '100%' },
    words: { gap: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaLines: { flexWrap: 'wrap' },
    metaPart: { flexShrink: 1 },
    metaWords: { fontSize: 13, lineHeight: 17 },
    centred: { textAlign: 'center' },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.onQuiet },
    onCover: { color: photo.coverMeta },
  }),
);
