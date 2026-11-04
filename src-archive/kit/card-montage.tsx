import { Image } from 'expo-image';
import { Check, Play, Plus } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { pictureKey } from '@/lib/picture-key';
import { night, photo, radius, space, ThemePin, themed, useTheme } from '@/theme';
import type { MontageState } from './badge';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';

const CARD = { width: 232, height: 148 };
const LARGE = 196;
const BLUR = 10;
export function CardMontage({
  title,
  meta,
  state,
  poster,
  caption,
  badge,
  step,
  large,
  label,
  onPress,
  children,
  style,
}: {
  title: string;
  meta?: string;
  state: MontageState;
  poster?: string | null;
  caption?: string;
  badge?: ReactNode;
  step?: {
    at: number;
    of: number;
    count: string;
    failed?: boolean;
  };
  large?: boolean;
  label?: string;
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const { roomy, way, room } = useWordRoom();
  const ready = state === 'ready';
  const action = ready ? null : children;
  const pinned = <ThemePin value="dark">{badge}</ThemePin>;
  const alone = ready && large;
  const face = (
    <>
      {alone ? (
        <View style={styles.playLarge}>
          <PlayCircle size={60} />
        </View>
      ) : (
        <View style={styles.stripBadge}>{pinned}</View>
      )}

      <View
        style={[
          styles.foot,
          alone ? styles.footLarge : null,
          action ? styles.footOverAction : null,
        ]}
      >
        {alone ? (
          <View style={styles.largeLine}>
            {pinned}
            {meta ? (
              <Text role="label" style={[styles.onPhoto, styles.figures]}>
                {meta}
              </Text>
            ) : null}
          </View>
        ) : ready ? (
          <View style={[styles.readyLine, roomy ? styles.readyLineRoomy : null]}>
            <PlayCircle size={34} />
            <WordRoom.Provider value={room}>
              <View key={way} style={[styles.grow, roomy ? styles.readyWordsRoomy : null]}>
                <Text role="label" style={styles.onPhoto}>
                  {title}
                </Text>
                {meta ? (
                  <Text role="meta" style={styles.onPhotoMeta}>
                    {meta}
                  </Text>
                ) : null}
              </View>
            </WordRoom.Provider>
          </View>
        ) : (
          <>
            <View style={styles.pendingLine}>
              <Text role="label" style={[styles.grow, styles.onPhoto]}>
                {title}
              </Text>
              {step ? (
                <Text role="meta" style={styles.onPhotoMeta}>
                  {step.count}
                </Text>
              ) : null}
            </View>
            {caption ? (
              <Text role="meta" numberOfLines={1} style={styles.onPhotoMeta}>
                {caption}
              </Text>
            ) : null}
            {step ? <StageScale at={step.at} of={step.of} failed={step.failed} /> : null}
          </>
        )}
      </View>
    </>
  );
  return (
    <View
      style={[
        styles.card,
        large ? styles.large : styles.strip,
        hovered ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {poster ? (
        <Image
          source={{ uri: poster, cacheKey: pictureKey(poster) }}
          contentFit="cover"
          blurRadius={ready ? 0 : BLUR}
          style={[StyleSheet.absoluteFill, ready ? null : styles.unfocused]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, large ? styles.scrimLarge : styles.scrim]}
      />

      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            label ?? [title, meta, caption, step?.count].filter(Boolean).join(' · ')
          }
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          {...props}
          style={styles.face}
        >
          {face}
        </Pressable>
      ) : (
        <View style={styles.face}>{face}</View>
      )}

      {action ? (
        <View style={styles.action}>
          <ThemePin value="dark">{action}</ThemePin>
        </View>
      ) : null}
    </View>
  );
}
const FILM_POSTER = 300;
export function PosterFilm({
  poster,
  meta,
  ready,
  label,
  onPress,
}: {
  poster?: string | null;
  meta?: string;
  ready?: string;
  label: string;
  onPress?: () => void;
}) {
  const { color } = useTheme();
  const { focused, props } = useHoverFocus();
  const styles = useStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={[styles.film, focused ? focusRing : null]}
    >
      {poster ? (
        <Image
          source={{ uri: poster, cacheKey: pictureKey(poster) }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={styles.filmHead} />
      <View
        pointerEvents="none"
        style={[
          styles.filmFoot,
          { experimental_backgroundImage: `linear-gradient(to top, ${color.ink} 4%, transparent)` },
        ]}
      />
      <View style={styles.filmPlay}>
        <PlayCircle size={68} />
      </View>

      <View pointerEvents="none" style={styles.scrub}>
        <Text role="runtimeXs" style={styles.onPhoto}>
          {'0:00'}
        </Text>
        <View style={styles.scrubLine}>
          <View style={styles.scrubKnob} />
        </View>
        <View style={styles.scrubEnd}>
          {ready ? (
            <View style={styles.scrubPill}>
              <Icon icon={Check} size={13} color={night.sparkInk} />
              <Text role="badgeSm" style={styles.scrubReady}>
                {ready}
              </Text>
            </View>
          ) : null}
          {meta ? (
            <Text role="label" style={[styles.onPhoto, styles.figures, styles.scrubMeta]}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
const PLAY_GLYPH = { 34: 15, 60: 24, 68: 27 } as const;
function PlayCircle({ size }: { size: keyof typeof PLAY_GLYPH }) {
  const styles = useStyles();
  return (
    <View style={[styles.play, { width: size, height: size }]}>
      <Icon icon={Play} size={PLAY_GLYPH[size]} color={night.ink} fill={night.ink} />
    </View>
  );
}
function StageScale({ at, of, failed }: { at: number; of: number; failed?: boolean }) {
  const styles = useStyles();
  const lit = (i: number) =>
    i >= at ? null : failed && i === at - 1 ? styles.scaleFailed : styles.scaleLit;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: of, now: at }}
      style={styles.scale}
    >
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[styles.scaleBar, lit(i)]} />
      ))}
    </View>
  );
}
export function CardMontageNew({ label, onPress }: { label: string; onPress?: () => void }) {
  const { color } = useTheme();
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.new,
        hovered ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <View style={styles.newCircle}>
        <Icon icon={Plus} size={19} color={color.paper} />
      </View>

      <Text role="caption" style={styles.newLabel}>
        {label.replace(' ', '\n')}
      </Text>
    </Pressable>
  );
}
export function EmptyMontages({
  text,
  photos,
  children,
  style,
}: {
  text: string;
  photos?: readonly string[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { roomy, way, room } = useWordRoom();
  return (
    <View style={[styles.emptyBlock, roomy ? styles.emptyRoomy : null, style]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stack}
      >
        {(photos ?? []).slice(0, 2).map((uri, i) => (
          <Image
            key={i}
            source={{ uri, cacheKey: pictureKey(uri) }}
            contentFit="cover"
            style={[styles.stackShot, i === 0 ? styles.stackBack : styles.stackFront]}
          />
        ))}
      </View>
      <WordRoom.Provider value={room}>
        <View key={way} style={[styles.emptyWords, roomy ? styles.emptyWordsRoomy : null]}>
          <Text role="note" style={styles.emptyText}>
            {text}
          </Text>
          {children}
        </View>
      </WordRoom.Provider>
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: { borderRadius: radius.section, overflow: 'hidden', backgroundColor: color.surface },
    strip: { width: CARD.width, minHeight: CARD.height },
    large: { width: '100%', minHeight: LARGE, borderRadius: radius.card },
    hover: { backgroundColor: color.raise },
    unfocused: { opacity: 0.55, transform: [{ scale: 1.15 }] },
    scrim: { experimental_backgroundImage: photo.poster },
    scrimLarge: { experimental_backgroundImage: photo.posterLarge },
    stripBadge: { alignSelf: 'flex-start', marginLeft: 10, marginTop: 10 },
    playLarge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    film: { minHeight: FILM_POSTER, backgroundColor: color.raise, overflow: 'hidden' },
    filmHead: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 150,
      experimental_backgroundImage: photo.filmHead,
    },
    filmFoot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
    filmPlay: { position: 'absolute', top: 152, left: 0, right: 0, alignItems: 'center' },
    scrub: {
      position: 'absolute',
      left: space.s5,
      right: space.s5,
      bottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    scrubLine: {
      flex: 1,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: photo.videoTrack,
    },
    scrubKnob: {
      width: 14,
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: night.paper,
    },
    scrubEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scrubPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 28,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
    },
    scrubReady: { color: color.sparkInk },
    scrubMeta: {
      textShadowColor: photo.figureShadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    play: {
      borderRadius: radius.pill,
      backgroundColor: night.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    face: { flex: 1 },
    foot: { marginTop: 'auto', padding: 12, gap: space.s2 },
    footLarge: { paddingHorizontal: 14 },
    largeLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2 },
    figures: { fontVariant: ['tabular-nums'] },
    footOverAction: { paddingBottom: space.s2 },
    action: { paddingHorizontal: 12, paddingBottom: 12 },
    readyLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    readyLineRoomy: { flexDirection: 'column', alignItems: 'flex-start' },
    readyWordsRoomy: { flex: 0, alignSelf: 'stretch' },
    pendingLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    grow: { flex: 1, minWidth: 0 },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.onQuiet },
    scale: { flexDirection: 'row', gap: 3 },
    scaleBar: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: photo.track },
    scaleLit: { backgroundColor: color.spark },
    scaleFailed: { backgroundColor: night.dangerText },
    new: {
      width: 92,
      minHeight: CARD.height,
      borderRadius: radius.section,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.lineQuiet,
      backgroundColor: color.hollow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    newCircle: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newLabel: { textAlign: 'center' },
    emptyBlock: {
      minHeight: 132,
      borderRadius: radius.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.lineQuiet,
      backgroundColor: color.hollow,
      padding: space.s4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      overflow: 'hidden',
    },
    stack: { width: 84, height: 96 },
    stackShot: { position: 'absolute', width: 58, height: 80, borderRadius: radius.thumb },
    stackBack: { left: 0, top: 10, opacity: 0.55, transform: [{ rotate: '-7deg' }] },
    stackFront: {
      right: 0,
      top: 4,
      transform: [{ rotate: '6deg' }],
      boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
    },
    emptyWords: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 10 },
    emptyRoomy: { flexDirection: 'column', alignItems: 'flex-start' },
    emptyWordsRoomy: { flex: 0, alignSelf: 'stretch' },
    emptyText: { lineHeight: 18 },
  }),
);
