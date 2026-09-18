import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { duration, photo, radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { useLoop } from './interaction';
import { Text } from './text';

/**
 * A screen with nothing on it yet, and a screen still waiting for something — spec 7.8. An empty
 * state is an invitation and not a report: the heading names what is missing, the paragraph says
 * what to do, and the action itself stands in the bottom layer rather than inside this block.
 */

/** The sizes the spec spins at: inside a tile or a row, a step circle, over a scrim, a whole screen. */
export type SpinnerSize = 16 | 26 | 34 | 38;

/**
 * A ring with one lit arc in `spark`, one turn every 900ms, linear (spec 6). The only thing in the
 * product allowed to move without being asked — and even it stops when the phone says to reduce
 * motion, which is why the still arc below is a real state and not a fallback.
 *
 * A button waiting on the server borrows it with its own colours: `track` its own ink, `head`
 * transparent.
 */
export function Spinner({
  size = 34,
  track,
  head,
}: {
  size?: SpinnerSize | number;
  track?: string;
  head?: string;
}) {
  const { color } = useTheme();
  const turn = useLoop(duration.spin);
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    // Thinner on the small ones, or a 16 spinner is a solid dot.
    borderWidth: size <= 16 ? 2 : 3,
    borderColor: track ?? color.raise,
    borderTopColor: head ?? color.spark,
  };

  if (!turn) return <View style={ring} />;

  return (
    <Animated.View
      style={[
        ring,
        {
          transform: [
            { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          ],
        },
      ]}
    />
  );
}

/** Spec 7.8 — waiting, with a line saying what is being waited for. */
export function Waiting({ text, size = 38 }: { text: string; size?: SpinnerSize }) {
  return (
    <View style={waiting.block}>
      <Spinner size={size} />
      <Text role="bodySm" tone="muted" style={waiting.text}>
        {text}
      </Text>
    </View>
  );
}

const waiting = StyleSheet.create({
  block: { alignItems: 'center', gap: space.s4 },
  text: { textAlign: 'center' },
});

/**
 * The signs an empty state can wear (spec 7.8):
 *
 * - `dashed` — a dashed circle, for a list empty for a natural reason;
 * - `line` — the same circle ringed solid in `line`, where nothing is missing but the road is out:
 *   the state is a dead end and not a list waiting to fill (`InviteDead`);
 * - `spark` — a circle ringed in `spark`, where the person is being called to act;
 * - `poster` — two dimmed photographs and a play circle, where the point is the reward rather than
 *   the absence (`FilmsEmpty`).
 */
export type EmptySign = 'dashed' | 'line' | 'spark' | 'poster';

/** Which ring each sign draws. `poster` has none — it is photographs. */
const SIGN = {
  dashed: 'signDashed',
  line: 'signLine',
  spark: 'signSpark',
  poster: 'signDashed',
} as const;

export function Empty({
  sign = 'dashed',
  icon,
  busy,
  title,
  text,
  photos,
  children,
}: {
  sign?: EmptySign;
  icon?: IconComponent;
  /** Waiting instead of empty: the spinner holds the place of the list rather than blinking over it. */
  busy?: boolean;
  title?: string;
  text: string;
  /** `poster` only — the two frames behind the play circle. */
  photos?: readonly string[];
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.empty}>
      {busy ? (
        <Spinner size={38} />
      ) : (
        // The sign only ever repeats the words below it, so screen readers are spared it.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {sign === 'poster' ? (
            <Poster photos={photos ?? []} icon={icon} />
          ) : (
            <View style={[styles.sign, styles[SIGN[sign]]]}>
              {icon ? <Icon icon={icon} size={38} color={color.faint} /> : null}
            </View>
          )}
        </View>
      )}
      {title ? (
        <Text role="emptyTitle" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <Text role="body" tone="muted" style={styles.text}>
        {text}
      </Text>
      {children}
    </View>
  );
}

/** Two dimmed frames at an angle with a play circle over them — the reward, shown rather than told. */
function Poster({ photos, icon }: { photos: readonly string[]; icon?: IconComponent }) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.poster}>
      {photos.slice(0, 2).map((uri, i) => (
        <Image
          key={uri}
          source={{ uri }}
          contentFit="cover"
          style={[styles.posterShot, i === 0 ? styles.posterLeft : styles.posterRight]}
        />
      ))}
      <View style={styles.posterPlay}>
        {icon ? <Icon icon={icon} size={30} color={color.spark} fill={color.spark} /> : null}
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 4: the margins of an empty state open out to 32–40, and the block breathes at 22–24.
    empty: {
      alignItems: 'center',
      gap: space.s6,
      paddingVertical: space.s7,
      paddingHorizontal: space.s7,
    },
    sign: {
      width: 96,
      height: 96,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signDashed: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: color.dashed,
      backgroundColor: color.surface,
    },
    signLine: { borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
    signSpark: { borderWidth: 2, borderColor: color.spark, backgroundColor: color.surface },
    title: { textAlign: 'center' },
    // Spec 3 holds a paragraph to about 60 characters, which at these margins is this width.
    text: { textAlign: 'center', maxWidth: 300 },
    poster: { width: 200, height: 150, alignItems: 'center', justifyContent: 'center' },
    posterShot: {
      position: 'absolute',
      width: 104,
      height: 128,
      borderRadius: radius.field,
      opacity: 0.45,
    },
    posterLeft: { left: 0, transform: [{ rotate: '-9deg' }] },
    posterRight: { right: 0, transform: [{ rotate: '8deg' }] },
    posterPlay: {
      width: 88,
      height: 88,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: color.spark,
      backgroundColor: photo.mark,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
