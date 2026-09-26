import { Image } from 'expo-image';
import { Play, Plus } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { night, photo, radius, space, ThemePin, themed, useTheme } from '@/theme';

import type { MontageState } from './badge';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';

/**
 * Spec 7.6 — a montage in the strip over the feed: 232 × 148, and the poster is the whole card. The
 * height is a floor: on large type the words wrap and every card in the strip grows with the tallest.
 */
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
 * - **failed** — the same body with the dangerous badge, the line saying why it broke, the stage it
 *   broke on in danger on the scale, and the way to try again.
 *
 * `large` is the one full-width view the layout draws (196): the same card once the montage is the
 * screen rather than one of several in a strip. Ready, it says only the badge and what the film came
 * out as, in one row along the foot (detail 38, `MontageLiveDone`) — the name is the bar's over it,
 * and is still what the card is read out as.
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
  /**
   * Why a fallen one broke — one line, and the rest is left to the label and to the screen the card
   * opens: a second line lifts the name into the badge.
   */
  caption?: string;
  /** The state badge — its words belong to the screen. */
  badge?: ReactNode;
  /**
   * Which stage the building is on: «3 из 5», and five bars lit up to it, that one included.
   * `failed` — that stage is the one it fell over on, and its bar is drawn in danger.
   */
  step?: { at: number; of: number; count: string; failed?: boolean };
  large?: boolean;
  /**
   * What the whole card says to a screen reader, where its own words are not what pressing it does —
   * «Смотреть: Ролик на 2:30» on the poster that plays the film. Otherwise the words on the card, in
   * the order they stand: a pressed card is one element, and whatever is left out of its label is
   * never read — why a fallen one broke above all, and all of it, where the card shows one line.
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
  const { roomy, way, room } = useWordRoom();
  const ready = state === 'ready';
  const action = ready ? null : children;
  // The badge and the button under a fallen card lie on the poster, which is a photograph in both
  // themes: they are read in the night's ink, or «Собирается» in the day's blue would be a dark word
  // on a dark frame.
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
          // The circle beside the name, or over it once a word beside it breaks (`useWordRoom`).
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
 * hand is lit like the ones behind it, and the track is white on a picture. A stage that fell over
 * is lit in danger instead, the way its row wears the cross on the screen the card opens.
 */
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
      {/* Two lines, centred (spec 7.6, detail 39): the layout breaks «Новый / ролик» by hand, and
          at 12 the pair would otherwise fit one line of the 92. Read out whole all the same. */}
      <Text role="caption" style={styles.newLabel}>
        {label.replace(' ', '\n')}
      </Text>
    </Pressable>
  );
}

/**
 * Spec 7.6 — the dashed 132 block that stands where the strip of montages would be when a memory has
 * none yet. Not an empty state: the words do not report an absence, they say what a montage is, and
 * the two leaning frames are the memory's own — the reward shown rather than described.
 *
 * The 132 is a floor, and once a word beside the frames breaks — «Смонтировать» on large type — the
 * words and the button go under them and take the width (`useWordRoom`, TASK-375).
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
            key={uri}
            source={{ uri }}
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
    // Spec 7.6 — the poster of a montage being cut: blurred, drained and pushed out past its own
    // edges, so the blur has something to eat into instead of fading to the card's corner.
    unfocused: { opacity: 0.55, transform: [{ scale: 1.15 }] },
    scrim: { experimental_backgroundImage: photo.poster },
    // The large poster has no name on it, so its top is lighter (spec 2, 10.11: `MontageLiveDone`).
    scrimLarge: { experimental_backgroundImage: photo.posterLarge },
    // 10 off the top left corner, in the card's flow: the words grown with the type push the card down
    // rather than run under the badge.
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
    play: {
      borderRadius: radius.pill,
      backgroundColor: night.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    face: { flex: 1 },
    foot: { marginTop: 'auto', padding: 12, gap: space.s2 },
    // `MontageLiveDone`: «Готов» 14 in from the poster's left and 12 up from its foot, the figures
    // 8 after it on the same middle — 13 / 600, white, tabular. On large type the figures go under
    // the badge rather than over it.
    footLarge: { paddingHorizontal: 14 },
    largeLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2 },
    figures: { fontVariant: ['tabular-nums'] },
    // The button under a fallen card keeps the foot's 12 at the edges and its 8 above.
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
    // The night's, as the badge beside it is: the day's `dangerText` is a dark red made for cream,
    // and this lies on a photograph in both themes.
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
    // A word beside the frames broke: the frames stand over the words, which take the width.
    emptyRoomy: { flexDirection: 'column', alignItems: 'flex-start' },
    emptyWordsRoomy: { flex: 0, alignSelf: 'stretch' },
    // Spec 7.6, detail 40: 13 / 18 — a line tighter than `note` runs elsewhere.
    emptyText: { lineHeight: 18 },
  }),
);
