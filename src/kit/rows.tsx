import { Image } from 'expo-image';
import { Check, ChevronRight, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { height, photo, radius, space, themed, useTheme } from '@/theme';

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
 * One summary line (spec 7.7, detail 52): a fixed 96 label and the value beside it, on one
 * baseline. The value wraps and the label never does — «Файл» keeps its column whatever stands in
 * the other one.
 *
 * The chevron belongs to a row that leads somewhere, and only to that one: on the order's summary
 * every line is the way back to the step that settled it, and on the frame's own sheet there is
 * nowhere to go — the sheet is «только смотреть», and an arrow on it would promise a screen that
 * does not exist.
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
      {divider ? <Divider soft /> : null}
      <Tappable label={`${label}: ${value}`} onPress={onPress} style={styles.summary}>
        <Text role="label" tone="muted" style={styles.summaryLabel}>
          {label}
        </Text>
        <Text role="row" style={styles.grow}>
          {value}
        </Text>
        {onPress ? <Icon icon={ChevronRight} size={18} color={color.faint} /> : null}
      </Tappable>
    </View>
  );
}

/**
 * How tall one track row stands (spec 7.7). Exported because a list of them that can be dragged
 * counts rows by it: how far a finger has travelled is how many of these it has crossed.
 */
export const TRACK_ROW = 52;

/**
 * A music track (spec 7.7): 52 tall, the round «послушать» on the left, the name and its length on
 * one baseline, and on the right the button that takes it or gives it back.
 *
 * The row itself picks nothing any more — that is what the button on its right is for, and it is
 * handed in, so a track knows nothing about buttons. Several tracks can be taken at once, and a row
 * that was itself the switch could not say that: it would have had to be a radio.
 */
export function RowTrack({
  title,
  length,
  playing,
  wave,
  grip,
  play,
  action,
  divider,
}: {
  title: string;
  /** «2:14» — written by the screen. */
  length: string;
  /** Sounding right now: the name goes `spark`, and the button handed in becomes a pause. */
  playing?: boolean;
  /** The 12-bar waveform between the name and the right edge — the «Выбрано» block draws it. */
  wave?: boolean;
  /**
   * What the row is held by while the list is being reordered (spec 7.7, detail 54: «строка
   * берётся за волну»). The handlers belong to whoever owns the list, and they go on the wave
   * because it is the one part of the row that is not already a button.
   */
  grip?: ViewProps;
  /** The round «Послушать» — 40 `raise` in the library, 36 `paper` among the chosen. */
  play?: ReactNode;
  /** The round 36 on the right: a plus, a tick, or the cross that takes a chosen track out. */
  action?: ReactNode;
  divider?: boolean;
}) {
  const styles = useStyles();

  return (
    <View>
      {divider ? <Divider soft style={styles.insetTrack} /> : null}
      <View style={styles.track}>
        {play}
        <View style={[styles.grow, styles.trackLine]}>
          <Text role="row" tone={playing ? 'spark' : 'paper'} numberOfLines={1} style={styles.shrink}>
            {title}
          </Text>
          <Text role="meta">{length}</Text>
        </View>
        {wave ? (
          <View {...grip}>
            <Waveform />
          </View>
        ) : null}
        {action}
      </View>
    </View>
  );
}

/**
 * The waveform (spec 7.10): twelve 2px bars in a row, twenty 3px ones in the order summary. It is a
 * fixed drawing and says nothing about the track — the real shape of one is the montage worker's to
 * know, and a waveform that reshuffles on every render is noise pretending to be a signal.
 */
export function Waveform({ wide }: { wide?: boolean }) {
  const styles = useStyles();
  const bars = wide ? WIDE_BARS : BARS;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wave, wide ? styles.waveWide : null]}
    >
      {bars.map((tall, i) => (
        <View key={i} style={[styles.waveBar, wide ? styles.waveBarWide : null, { height: tall }]} />
      ))}
    </View>
  );
}

const BARS = [5, 9, 13, 8, 15, 10, 6, 12, 14, 7, 11, 5];
const WIDE_BARS = [6, 10, 15, 9, 18, 12, 7, 14, 17, 9, 13, 6, 11, 16, 8, 12, 15, 7, 10, 14];

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

/** Where one stage of the build stands (spec 7.7). */
export type StepState = 'done' | 'running' | 'waiting' | 'failed';

/**
 * One stage of a montage being made (spec 7.7): a 24 circle saying where it is, the stage's own
 * name, a line of what came of it, and the chevron into its journal. The stage is named rather than
 * counted — «73 %» tells a person nothing, «Режиссёр строит историю» does.
 *
 * The one still running opens: it takes an `accentNote` wash and carries its last few records under
 * it, so the screen shows what the director is doing without anybody having to go looking. A stage
 * still ahead is not a road at all — no meta, no chevron, one faint line naming what is coming.
 */
export function RowStep({
  title,
  meta,
  state,
  open,
  onPress,
  children,
}: {
  title: string;
  /** «212 из 214 годятся · 1 мин» — written by the screen; a stage ahead has none. */
  meta?: string;
  state: StepState;
  /** The stage in hand, opened out: its last records and the way into the whole journal. */
  open?: boolean;
  onPress?: () => void;
  /** Those records — `StepNote` each, and the link under them. */
  children?: ReactNode;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const ahead = state === 'waiting';

  return (
    <View style={open ? styles.stepOpen : null}>
      <Tappable label={[title, meta].filter(Boolean).join('. ')} onPress={ahead ? undefined : onPress} style={styles.step}>
        {state === 'running' ? (
          <Spinner size={24} track={color.line} head={color.accent} />
        ) : (
          <View
            style={[
              styles.stepMark,
              state === 'done' ? styles.stepDone : null,
              state === 'failed' ? styles.stepFailed : null,
              ahead ? styles.stepWaiting : null,
            ]}
          >
            {state === 'done' ? <Icon icon={Check} size={13} color={color.sparkInk} /> : null}
            {state === 'failed' ? <Icon icon={X} size={13} color={color.dangerText} /> : null}
          </View>
        )}
        {ahead ? (
          <Text role="note" tone="faint" numberOfLines={1} style={styles.grow}>
            {title}
          </Text>
        ) : (
          <View style={styles.grow}>
            <Text role="label" numberOfLines={1}>
              {title}
            </Text>
            {meta ? (
              <Text role="badgeSm" tone="muted" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        )}
        {ahead ? null : <Icon icon={ChevronRight} size={16} color={color.faint} />}
      </Tappable>
      {open ? children : null}
    </View>
  );
}

/**
 * One record under an opened stage (spec 7.7): the frame at 34, two lines of what the director
 * thought about it, and the mark of what they decided. The journal's own full-size entry is
 * `LogEntry` — this is the glance at it that fits inside a row.
 */
export function StepNote({
  uri,
  length,
  text,
  mark,
}: {
  uri?: string;
  /** A video's running time in the corner of the thumbnail. */
  length?: string;
  text: string;
  /** The decision pill — `BadgeDecision`, handed in so this row knows no words. */
  mark?: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View style={styles.note}>
      <View style={styles.noteShot}>
        {uri ? <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
        {length ? (
          <Text role="badgeSm" style={styles.noteLength}>
            {length}
          </Text>
        ) : null}
      </View>
      <Text role="meta" tone="paper" numberOfLines={2} style={styles.grow}>
        {text}
      </Text>
      {mark}
    </View>
  );
}

/**
 * One action inside the glass menu that drops out of the «⋯» (spec 7.7): 50 tall, the words on the
 * left and the glyph on the right. It was a sheet's row until the menu existed; the glyph moved to
 * the far side with it, because a menu is read down its left edge. The dangerous one is the only red
 * line in the menu, and there is never more than one of it.
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
      {divider ? <Divider soft /> : null}
      <Tappable label={label} onPress={onPress} style={styles.action}>
        <Text role="row" style={[styles.grow, { color: tint }]}>
          {label}
        </Text>
        <Icon icon={icon} size={19} color={tint} />
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
    // Spec 7.7: the two are read across one baseline, and the row is as tall as what it holds —
    // 11 above and below, which on one line is the 44 every other row of the product stands at.
    summary: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.s3,
      minHeight: height.small,
      paddingVertical: 11,
      paddingHorizontal: space.s4,
    },
    summaryLabel: { width: 96 },
    track: {
      height: TRACK_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
    },
    // The hairline starts where the name does — past the round button, never under it.
    insetTrack: { marginLeft: 64 },
    trackLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    shrink: { flexShrink: 1 },
    wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 16 },
    waveWide: { gap: 2, height: 18 },
    waveBar: { width: 2, borderRadius: radius.pill, backgroundColor: color.faint },
    waveBarWide: { width: 3 },
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
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: 14,
    },
    // Spec 7.7 — the stage in hand is washed rather than boxed: it is one of a list of stages, and
    // a border round it would make it a card standing apart from its own neighbours.
    stepOpen: { backgroundColor: color.accentNote },
    stepMark: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDone: { backgroundColor: color.spark },
    stepFailed: { borderColor: color.dangerText },
    stepWaiting: { borderColor: color.line },
    // The records under an opened stage line up with its name, not with its circle.
    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingRight: 14,
      paddingLeft: 50,
    },
    noteShot: {
      width: 34,
      height: 34,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: color.raise,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    noteLength: { color: photo.on, paddingRight: 3, paddingBottom: 2 },
    action: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
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
