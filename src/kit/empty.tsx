import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { duration, radius, space, spinner, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { useLoop } from './interaction';
import { Text } from './text';

/**
 * A screen with nothing on it yet, and a screen still waiting for something — spec 7.9. An empty
 * state is an invitation and not a report: the heading names what is missing, the paragraph says
 * what to do, and the action itself stands in the bottom layer rather than inside this block.
 */

/** The sizes the spec spins at: inside a tile or a row, a card, a link being walked in, a screen. */
export type SpinnerSize = (typeof spinner)[keyof typeof spinner];

/**
 * A ring with one lit arc in `spark`, one turn every 900ms, linear (spec 6). The only thing in the
 * product allowed to move without being asked — and even it stops when the phone says to reduce
 * motion, which is why the still arc below is a real state and not a fallback.
 *
 * A button waiting on the server borrows it with its own colours: `track` its own ink, `head`
 * transparent; the running stage on air, with its own ring as well (spec detail 56: 2).
 */
export function Spinner({
  size = spinner.join,
  track,
  head,
  ring: width,
}: {
  size?: SpinnerSize | number;
  track?: string;
  head?: string;
  /** How thick the ring is, where the place names it. Left off, the size decides. */
  ring?: number;
}) {
  const { color } = useTheme();
  const turn = useLoop(duration.spin);
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    // Thinner on the small ones, or a 16 spinner is a solid dot.
    borderWidth: width ?? (size <= 16 ? 2 : 3),
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

/** Spec 7.9 — waiting, with a line saying what is being waited for. */
export function Waiting({ text, size = spinner.screen }: { text: string; size?: SpinnerSize }) {
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
 * The signs an empty state can wear (spec 7.9):
 *
 * - `dashed` — a dashed circle over a hollow, for a list empty for a natural reason;
 * - `line` — the same circle ringed solid in `line`, where nothing is missing but the road is out:
 *   the state is a dead end and not a list waiting to fill (`InviteDead`);
 * - `spark` — a circle ringed in `spark`, where the person is being called to act.
 *
 * A memory with no montages in it is *not* one of these any more (spec 7.6): it is the dashed block
 * that stands where the strip would be, `EmptyMontages` in `kit/card-montage.tsx`. An empty state
 * takes the whole body of a screen, and «пока нет роликов» never did.
 */
export type EmptySign = 'dashed' | 'line' | 'spark';

/** Which ring each sign draws. */
const SIGN = { dashed: 'signDashed', line: 'signLine', spark: 'signSpark' } as const;

export function Empty({
  sign = 'dashed',
  icon,
  busy,
  title,
  text,
  children,
}: {
  sign?: EmptySign;
  icon?: IconComponent;
  /** Waiting instead of empty: the spinner holds the place of the list rather than blinking over it. */
  busy?: boolean;
  title?: string;
  text: string;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.empty}>
      {busy ? (
        <Spinner size={spinner.screen} />
      ) : (
        // The sign only ever repeats the words below it, so screen readers are spared it.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.sign, styles[SIGN[sign]]]}>
            {/* The dimmed glyph belongs to a circle that is dimmed itself. Inside the `spark` ring
                the sign is the invitation, so it is read in `paper` like the heading under it.
                Spec 7.9, detail 69: 38 in the dashed circle, 40 in the other two. */}
            {icon ? (
              <Icon
                icon={icon}
                size={sign === 'dashed' ? 38 : 40}
                color={sign === 'spark' ? color.paper : color.faint}
              />
            ) : null}
          </View>
        </View>
      )}
      {/* Spec 7.9 draws two rhythms and not one: 22 from the sign down to the words, 12 between the
          heading and the paragraph it belongs with. */}
      <View style={styles.words}>
        {title ? (
          <Text role="emptyTitle" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : null}
        <Text role="body" tone="muted" style={styles.text}>
          {text}
        </Text>
      </View>
      {children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 4: an empty state stands 36 in from the edge of the screen — the screen's own 16 and these
    // 20 — and breathes at 22–24. 22 is off the step of 4 on purpose: it is what the layout draws
    // under every sign.
    empty: {
      alignItems: 'center',
      gap: 22,
      paddingVertical: space.s7,
      paddingHorizontal: space.s5,
    },
    words: { alignItems: 'center', gap: space.s3 },
    sign: {
      width: 96,
      height: 96,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Spec 7.9 — the dashed sign stands on a hollow and not on a surface: a list with nothing in it
    // is a hole in the screen, and a card there would be a thing where there is none.
    signDashed: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.dashed,
      backgroundColor: color.hollowSoft,
    },
    signLine: { borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
    // The layout rings it outside the 96 (`box-shadow: 0 0 0 2px`): 100 across, and the words under
    // it stand where they stand under the other two.
    signSpark: { boxShadow: `0 0 0 2px ${color.spark}`, backgroundColor: color.surface },
    title: { textAlign: 'center' },
    // Spec 3 holds a paragraph to about 60 characters, which the margins above already make it.
    text: { textAlign: 'center' },
  }),
);
