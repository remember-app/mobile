import { Check, ChevronRight, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Divider } from './bits';
import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.6 — the rows. Each of them is one line of a list somewhere in the product, and what they
 * have in common is that the screen writes every word in them: a row is a shape, never a sentence.
 */

/**
 * One line of the order summary (spec 7.6): a fixed 88 label, the value, and a chevron. Every row
 * leads back to the step of the wizard that settled it, which is why it is pressable at all — the
 * summary is a way back, not a receipt.
 */
export function RowSummary({
  label,
  value,
  onPress,
  divider,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View>
      {divider ? <Divider /> : null}
      <Tappable label={`${label}: ${value}`} onPress={onPress} style={styles.summary}>
        <Text role="label" tone="muted" style={styles.summaryLabel}>
          {label}
        </Text>
        <Text role="row" numberOfLines={1} style={[styles.grow, styles.summaryValue]}>
          {value}
        </Text>
        <Icon icon={ChevronRight} size={18} color={color.faint} />
      </Tappable>
    </View>
  );
}

/**
 * A music track (spec 7.6). Unpicked it is a line in a list; picked, the whole row becomes a card
 * with an `accent` border and the waveform opens up under the name — the one place in the product
 * where picking something makes it grow rather than tick it.
 */
export function RowTrack({
  title,
  length,
  selected,
  playing,
  at = 0,
  onPress,
  play,
  divider,
}: {
  title: string;
  /** «2:14» — written by the screen. */
  length: string;
  selected?: boolean;
  playing?: boolean;
  /** 0…1 — how much of it has been heard, which is what colours the waveform. */
  at?: number;
  onPress?: () => void;
  /** The round 44 «Послушать» button, handed in so this row knows nothing about buttons. */
  play?: ReactNode;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View>
      {divider && !selected ? <Divider /> : null}
      <Tappable
        label={title}
        onPress={onPress}
        selected={selected}
        style={[styles.track, selected ? styles.trackPicked : null]}
      >
        {play}
        <View style={styles.grow}>
          <View style={styles.trackLine}>
            <Text role="row" numberOfLines={1} style={styles.grow}>
              {title}
            </Text>
            <Text role="meta">{length}</Text>
          </View>
          {selected ? <Waveform at={playing || at > 0 ? at : 0} /> : null}
        </View>
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <Icon icon={Check} size={14} color={color.onFill} /> : null}
        </View>
      </Tappable>
    </View>
  );
}

/** Sixteen bars of varying height: what has been heard in `accent`, the rest in `handle`. */
export function Waveform({ at }: { at: number }) {
  const styles = useStyles();
  // A fixed pattern and not a random one: a waveform that reshuffles on every render is noise
  // pretending to be a signal. The real shape of a track is the montage worker's to know.
  const bars = [5, 9, 14, 8, 17, 11, 20, 13, 7, 16, 10, 19, 12, 6, 15, 9];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wave}
    >
      {bars.map((tall, i) => (
        <View
          key={i}
          style={[styles.waveBar, { height: tall }, i / bars.length < at ? styles.waveHeard : null]}
        />
      ))}
    </View>
  );
}

/**
 * One reason the automatic pass dropped frames (spec 7.6): a 38 glyph square, what it is called, how
 * many it took, and the way to take them back. The pass reports, it does not decide.
 */
export function RowRejected({
  icon,
  title,
  count,
  children,
  divider,
}: {
  icon: IconComponent;
  title: string;
  /** «22 кадра — оставили лучший из серии» — the reason and its price in one line. */
  count: string;
  /** The small 40 «Вернуть» button. */
  children?: ReactNode;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View>
      {divider ? <Divider /> : null}
      <View style={styles.rejected}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.square}
        >
          <Icon icon={icon} size={18} color={color.muted} />
        </View>
        <View style={styles.grow}>
          <Text role="row" numberOfLines={1}>
            {title}
          </Text>
          <Text role="meta">{count}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

/** Where one stage of the build stands (spec 7.6). */
export type StepState = 'done' | 'running' | 'waiting' | 'failed';

/**
 * One stage of a montage being assembled: a 26 circle saying where it is, the stage's own name, and
 * a word on the right. The stage is named rather than counted — spec's own rule for `MontageProgress`.
 */
export function RowStep({
  title,
  state,
  word,
}: {
  title: string;
  state: StepState;
  /** «готово», «идёт», «не вышло» — a word, so the screen writes it; `waiting` has none. */
  word?: string;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View style={styles.step}>
      {state === 'running' ? (
        <Spinner size={26} track={color.line} head={color.accent} />
      ) : (
        <View
          style={[
            styles.stepMark,
            state === 'done' ? styles.stepDone : null,
            state === 'failed' ? styles.stepFailed : null,
            state === 'waiting' ? styles.stepWaiting : null,
          ]}
        >
          {state === 'done' ? <Icon icon={Check} size={14} color={color.sparkInk} /> : null}
          {state === 'failed' ? <Icon icon={X} size={14} color={color.dangerText} /> : null}
        </View>
      )}
      <Text
        role={state === 'running' ? 'row' : 'body'}
        tone={
          state === 'running'
            ? 'paper'
            : state === 'waiting'
              ? 'faint'
              : state === 'failed'
                ? 'danger'
                : 'muted'
        }
        numberOfLines={1}
        style={styles.grow}
      >
        {title}
      </Text>
      {word ? (
        <Text
          role="meta"
          tone={state === 'running' ? 'accent' : state === 'failed' ? 'danger' : 'muted'}
        >
          {word}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One action inside a sheet (spec 7.6): 56 tall, a 20 glyph, the words. The dangerous one is the
 * only red thing on the sheet, and there is never more than one of it.
 */
export function RowAction({
  icon,
  label,
  danger,
  onPress,
  divider,
}: {
  icon: IconComponent;
  label: string;
  danger?: boolean;
  onPress?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const tint = danger ? color.dangerText : color.paper;

  return (
    <View>
      {divider ? <Divider /> : null}
      <Tappable label={label} onPress={onPress} style={styles.action}>
        <Icon icon={icon} size={20} color={tint} />
        <Text role="row" style={[styles.grow, { color: tint }]}>
          {label}
        </Text>
      </Tappable>
    </View>
  );
}

/**
 * A row that leads to a screen of its own (spec 7.6): 72 tall, a surface of its own, a sign on the
 * left, two lines of words, a chevron. The account screen's «Контакты» is the one the layout draws.
 */
export function RowSection({
  title,
  meta,
  sign,
  onPress,
  style,
}: {
  title: string;
  meta?: string;
  /** The stack of avatars, or a glyph — whatever stands for where this leads. */
  sign?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <Tappable label={title} onPress={onPress} style={[styles.section, style]}>
      {sign}
      <View style={styles.grow}>
        <Text role="subtitle" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text role="meta" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={20} color={color.faint} />
    </Tappable>
  );
}

/**
 * The pressable behind every row above: one place that holds the press dip, the focus ring and the
 * rule that a row nobody can press is not a button. Rows differ in what they carry, never in how
 * they answer a finger.
 */
function Tappable({
  label,
  onPress,
  selected,
  style,
  children,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        style,
        hovered ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    hover: { backgroundColor: color.raise },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: height.small,
      paddingHorizontal: space.s4,
    },
    summaryLabel: { width: 88 },
    summaryValue: { textAlign: 'right' },
    track: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: radius.section,
    },
    trackPicked: {
      backgroundColor: color.surface,
      borderColor: color.accent,
      paddingHorizontal: space.s3,
    },
    trackLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    wave: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20, marginTop: 6 },
    waveBar: { width: 3, borderRadius: radius.pill, backgroundColor: color.handle },
    waveHeard: { backgroundColor: color.accent },
    radio: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: color.accent, borderColor: color.accent },
    rejected: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
    },
    square: {
      width: 38,
      height: 38,
      borderRadius: radius.thumb,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s2,
    },
    stepMark: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDone: { backgroundColor: color.spark },
    stepFailed: { borderColor: color.dangerText },
    stepWaiting: { borderColor: color.line },
    action: {
      minHeight: height.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.cell,
    },
    section: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s4,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.section,
      backgroundColor: color.surface,
    },
  }),
);
