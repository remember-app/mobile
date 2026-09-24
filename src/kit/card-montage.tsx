import { Image } from 'expo-image';
import { Play, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { night, photo, radius, space, themed, ThemePin, useTheme } from '@/theme';

import { type MontageState } from './badge';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/** Spec 7.6 — a montage in the strip over the feed: 232 × 148, and the poster is the whole card. */
const CARD = { width: 232, height: 148 };

/** The same montage when it is the only thing on the screen (`MontageLiveDone`). */
const LARGE = 196;

/** Spec 7.6 — how much of the blur, and how far the poster is pushed out from under it. */
const BLUR = 10;

/**
 * Spec 7.6 — a montage, in the three states that are three different bodies rather than three
 * colours of one. All three are the poster and nothing else: a montage is a video, so the card is a
 * still with words laid over it, never a surface with a picture inside it.
 *
 * - **ready** — the still, the play circle, the name and what it was made of;
 * - **pending** — the same still under a blur, because there is a film coming but nothing to show
 *   of it yet, and a scale of five saying how far along it is;
 * - **failed** — the same body with the dangerous badge, the line saying where it broke, and the
 *   way to try again.
 *
 * `large` is the one full-width view the layout draws (196): the same card once the montage is the
 * screen rather than one of several in a strip.
 */
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
  /** «14 сентября · Тёплая», «2:30 · 16:9» — written by the screen. */
  meta?: string;
  state: MontageState;
  poster?: string | null;
  /** «Сборка оборвалась на полпути» — the failed card's own line. */
  caption?: string;
  /** The state badge — its words belong to the screen. */
  badge?: ReactNode;
  /** Which stage the building is on: «3 из 5», and five bars lit up to it, that one included. */
  step?: { at: number; of: number; count: string };
  large?: boolean;
  /**
   * What the whole card says to a screen reader, where its own words are not what pressing it does —
   * «Смотреть: Ролик на 2:30» on the poster that plays the film. Otherwise the words on the card, in
   * the order they stand: a pressed card is one element, and whatever is left out of its label is
   * never read — «Сборка оборвалась на полпути» on a fallen one above all.
   */
  label?: string;
  /**
   * Watching it, or going to where it is being made or where it broke — one press for the whole
   * card but the button under a fallen one.
   */
  onPress?: () => void;
  /** «Повторить» — the 36 button under a montage that fell over. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const ready = state === 'ready';
  const action = ready ? null : children;

  const face = (
    <>
      {/* The badge and the button under a fallen card lie on the poster, which is a photograph in both
          themes: they are read in the night's ink, or «Собирается» in the day's blue would be a dark
          word on a dark frame. */}
      <View style={large ? styles.largeBadge : styles.stripBadge}>
        <ThemePin value="dark">{badge}</ThemePin>
      </View>

      {ready && large ? (
        <View style={styles.playLarge}>
          <PlayCircle size={60} />
        </View>
      ) : null}

      <View style={[styles.foot, action ? styles.footOverAction : null]}>
        {ready ? (
          <View style={styles.readyLine}>
            {large ? null : <PlayCircle size={34} />}
            <View style={styles.grow}>
              <Text role="label" numberOfLines={1} style={styles.onPhoto}>
                {title}
              </Text>
              {meta ? (
                <Text role="meta" style={styles.onPhotoMeta}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.pendingLine}>
              <Text role="label" numberOfLines={1} style={[styles.grow, styles.onPhoto]}>
                {title}
              </Text>
              {step ? (
                <Text role="meta" style={styles.onPhotoMeta}>
                  {step.count}
                </Text>
              ) : null}
            </View>
            {caption ? (
              <Text role="meta" numberOfLines={2} style={styles.onPhotoMeta}>
                {caption}
              </Text>
            ) : null}
            {step ? <StageScale at={step.at} of={step.of} /> : null}
          </>
        )}
      </View>
    </>
  );

  // The press is everything but the button under a fallen card, and that button stands beside it
  // rather than inside it: a pressable card is one accessible element, and a button inside one is
  // swallowed whole. A card nobody can press is a group, its words read as words.
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
        // Spec 7.6 — a montage still being cut shows its own frame pushed out of focus: there is
        // something there, and it is not ready to be looked at. `expo-image` blurs it natively;
        // the scale is what keeps the blur from leaving a soft edge around the card.
        <Image
          source={{ uri: poster }}
          contentFit="cover"
          blurRadius={ready ? 0 : BLUR}
          style={[StyleSheet.absoluteFill, ready ? null : styles.unfocused]}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label ?? [title, meta, caption, step?.count].filter(Boolean).join(' · ')}
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

/**
 * The `paper` circle a finished montage is watched from — 34 in the strip, 60 when it is the screen.
 * It lies on the poster, so it is the night's paper with the night's ink in it in both themes (the
 * layout draws it `rgba(245,243,238,.95)` with `#0B0B12` inside): in daylight the theme's own `ink`
 * is a cream, and a cream triangle on a cream circle is a circle with nothing in it.
 */
function PlayCircle({ size }: { size: 34 | 60 }) {
  const styles = useStyles();

  return (
    <View style={[styles.play, { width: size, height: size }]}>
      <Icon icon={Play} size={size === 60 ? 24 : 15} color={night.ink} fill={night.ink} />
    </View>
  );
}

/**
 * Spec 7.6 and detail 38 — five 3px bars over the poster, `spark` up to the stage in hand and that
 * one included, as many as the count beside them says. Not the wizard's `StepScale` (spec 7.10):
 * that one runs on `line` over a surface and marks the step in hand in `accent`; here the stage in
 * hand is lit like the ones behind it, and the track is white on a picture.
 */
function StageScale({ at, of }: { at: number; of: number }) {
  const styles = useStyles();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: of, now: at }}
      style={styles.scale}
    >
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[styles.scaleBar, i < at ? styles.scaleLit : null]} />
      ))}
    </View>
  );
}

/**
 * Spec 7.6 — the dashed 92 × 148 tile that stands first in the strip of montages, always. It is the
 * one place on the memory's own screen where a new film is started, so it is a hole in the row
 * rather than a card: there is nothing in it yet, and the plus says what would be.
 */
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
      <Text role="label" style={styles.newLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Spec 7.6 — the dashed 132 block that stands where the strip of montages would be when a memory has
 * none yet. Not an empty state: the words do not report an absence, they say what a montage is, and
 * the two leaning frames are the memory's own — the reward shown rather than described.
 */
export function EmptyMontages({
  text,
  photos,
  children,
  style,
}: {
  text: string;
  /** Two of the memory's frames. Fewer than two and the stack simply has fewer in it. */
  photos?: readonly string[];
  /** The `paper` 36 «Смонтировать» — the block never explains without offering. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.emptyBlock, style]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stack}
      >
        {(photos ?? []).slice(0, 2).map((uri, i) => (
          <Image
            key={uri}
            source={{ uri }}
            contentFit="cover"
            style={[styles.stackShot, i === 0 ? styles.stackBack : styles.stackFront]}
          />
        ))}
      </View>
      <View style={styles.emptyWords}>
        <Text role="note">{text}</Text>
        {children}
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: { borderRadius: radius.section, overflow: 'hidden', backgroundColor: color.surface },
    strip: { ...CARD },
    large: { width: '100%', height: LARGE, borderRadius: radius.card },
    hover: { backgroundColor: color.raise },
    // Spec 7.6 — the poster of a montage being cut: blurred, drained and pushed out past its own
    // edges, so the blur has something to eat into instead of fading to the card's corner.
    unfocused: { opacity: 0.55, transform: [{ scale: 1.15 }] },
    scrim: { experimental_backgroundImage: photo.poster },
    stripBadge: { position: 'absolute', left: 10, top: 10 },
    largeBadge: { position: 'absolute', left: 14, bottom: 12 },
    playLarge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    play: {
      borderRadius: radius.pill,
      backgroundColor: night.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    face: { flex: 1 },
    foot: { marginTop: 'auto', padding: 12, gap: space.s2 },
    // The button under a fallen card keeps the foot's 12 at the edges and its 8 above.
    footOverAction: { paddingBottom: space.s2 },
    action: { paddingHorizontal: 12, paddingBottom: 12 },
    readyLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pendingLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    grow: { flex: 1, minWidth: 0 },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.onQuiet },
    scale: { flexDirection: 'row', gap: 3 },
    scaleBar: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: photo.track },
    scaleLit: { backgroundColor: color.spark },
    new: {
      width: 92,
      height: CARD.height,
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
      height: 132,
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
  }),
);
