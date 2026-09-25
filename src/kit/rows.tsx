import { Image } from 'expo-image';
import { Check, ChevronRight, Pause, Play, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { height, photo, radius, space, themed, useTheme } from '@/theme';

import { Divider } from './bits';
import { IconButton } from './button';
import { Spinner } from './empty';
import { Icon, type IconComponent, playFor } from './icon';
import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';

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
      <Tappable
        label={`${label}: ${value}`}
        onPress={onPress}
        style={[styles.summary, onPress ? styles.summaryTap : null]}
      >
        <Text role="meta" style={styles.summaryLabel}>
          {label}
        </Text>
        <Text role="summary" style={styles.grow}>
          {value}
        </Text>
        {onPress ? <Icon icon={ChevronRight} size={18} color={color.faint} /> : null}
      </Tappable>
    </View>
  );
}

/**
 * How tall one track row stands (spec 7.7) — on the shelf, and among the chosen while nothing is
 * written under its name. A list of them that is dragged measures its rows, because a chosen one
 * with a wish stands taller; this is what a row counts as until it has been measured.
 */
export const TRACK_ROW = 52;

/** The glyph of «Послушать»: the layout's triangle in its 16 box, filled (spec 5, 7.7). */
const PLAY_GLYPH = { size: playFor(16), filled: true } as const;

/**
 * A music track (spec 7.7): the round «послушать» on the left, the name and its length on one
 * baseline, and on the right the buttons that act on it.
 *
 * Two places, one row. On the shelf (detail 53) it is 52 tall and the one button on its right takes
 * the track or gives it back. Among the chosen (`picked`, detail 54) it sits tighter, carries the
 * wish written about it as a line under the name — 60 tall then — and whatever unfolds under it
 * (`children`: the field that wish is written in) belongs to it.
 *
 * The row itself picks nothing — that is what the buttons handed in are for, so a track knows
 * nothing about buttons. Several tracks can be taken at once, and a row that was itself the switch
 * could not say that: it would have had to be a radio.
 */
export function RowTrack({
  title,
  length,
  wish,
  picked,
  playing,
  grip,
  play,
  action,
  divider,
  children,
}: {
  title: string;
  /** «2:14» — written by the screen. */
  length: string;
  /** «На сборы, тихо, под голоса» — one line under the name, cut short where it runs long. */
  wish?: string;
  /** Standing in «Выбрано» rather than on the shelf. */
  picked?: boolean;
  /** Sounding right now: the name goes `spark`, and «Послушать» becomes a pause. */
  playing?: boolean;
  /**
   * What the row is held by while the list is being reordered (spec 7.7, detail 54: «строку берут
   * за имя и ведут») — its name and the line under it, the part of it that is not a button. The
   * handlers belong to whoever owns the list.
   */
  grip?: ViewProps;
  /**
   * The round «Послушать» on the left — what it is called right now («Послушать …» or «Стоп …»,
   * the screen's words) and what it does. Left off, the track has nothing to listen to.
   */
  play?: { label: string; onPress: () => void };
  /** The round 36s on the right: a plus or a tick on the shelf, the pencil and the cross among the chosen. */
  action?: ReactNode;
  divider?: boolean;
  /** What unfolds under the row — the field its wish is written in. */
  children?: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View>
      {divider ? <Divider soft style={picked ? styles.insetPicked : styles.insetTrack} /> : null}
      <View style={[styles.track, picked ? styles.trackPicked : null, wish ? styles.wished : null]}>
        {/* Spec 7.7, details 53 and 54: 40 `raise` on the shelf, 36 among the chosen, and in both
            the small filled play of the layout — a pause while the track sounds. */}
        {play ? (
          <IconButton
            icon={playing ? Pause : Play}
            label={play.label}
            size={picked ? height.roundRow : height.roundTrack}
            tone="raise"
            glyph={PLAY_GLYPH}
            onPress={play.onPress}
          />
        ) : null}
        <View {...grip} style={[styles.grow, styles.trackWords]}>
          <View style={styles.trackLine}>
            <Text
              role="row"
              tone={playing ? 'spark' : 'paper'}
              numberOfLines={1}
              style={styles.shrink}
            >
              {title}
            </Text>
            <Text role="meta">{length}</Text>
          </View>
          {wish ? (
            <Text role="meta" numberOfLines={1} style={styles.wish}>
              {wish}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children ? <View style={styles.unfolded}>{children}</View> : null}
    </View>
  );
}

/**
 * The waveform (spec 7.10): twenty 3px bars beside the track in the «Музыка» section of the order
 * summary — and nowhere else, the rows of the music step carry none. It is a fixed drawing and says
 * nothing about the track: the real shape of one is the montage worker's to know, and a waveform
 * that reshuffles on every render is noise pretending to be a signal.
 */
export function Waveform() {
  const styles = useStyles();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wave}
    >
      {BARS.map((tall, i) => (
        <View key={i} style={[styles.waveBar, { height: tall }]} />
      ))}
    </View>
  );
}

const BARS = [6, 10, 15, 9, 18, 12, 7, 14, 17, 9, 13, 6, 11, 16, 8, 12, 15, 7, 10, 14];

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
 * still ahead is not a road at all — no meta, no chevron, one quiet line naming what is coming, and
 * the layout draws that row 44 rather than 48 (`MontageLive`).
 *
 * Nothing on it is cut: a name, a meta or the line of what is ahead that outgrows the row on large
 * system type wraps, and the row grows down with it.
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
      <Tappable
        label={[title, meta].filter(Boolean).join('. ')}
        onPress={ahead ? undefined : onPress}
        style={[styles.step, ahead ? styles.stepAhead : null]}
      >
        {state === 'running' ? (
          <Spinner size={24} ring={2} track={color.line} head={color.accent} />
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
          // Spec detail 56 and 10.11: 13 / 500 `muted` (the layout's `faint` is under the floor for
          // words that are read), wrapping onto a second line of 18 rather than cut.
          <Text role="note" style={[styles.grow, styles.aheadWords]}>
            {title}
          </Text>
        ) : (
          // Spec 7.7, detail 56: the name 14 / 600 and the line under it 11 / 500 `muted`.
          <View style={styles.grow}>
            <Text role="rowSm">{title}</Text>
            {meta ? <Text role="metaSm">{meta}</Text> : null}
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
 *
 * The mark stands at the right of the thought while the thought keeps its words whole beside it; on
 * large type a long one — «Беру 0:02–0:06» — goes under the thought instead (`useWordRoom`,
 * TASK-375).
 */
export function StepNote({
  uri,
  length,
  text,
  mark,
  onPress,
}: {
  uri?: string;
  /** A video's running time in the corner of the thumbnail. */
  length?: string;
  text: string;
  /** The decision pill — `BadgeDecision`, handed in so this row knows no words. */
  mark?: ReactNode;
  /**
   * The frame's own card, where there is one to open (`SheetLiveFile`). Without it the row is a
   * glance and takes no finger at all — which is what it is while the montage is still being cut
   * and the record on it is a second old.
   */
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { roomy, room } = useWordRoom();

  return (
    // No label of its own: the thought is what a person means by the row, but the decision beside it
    // — «Беру», «Мимо» — is the other half of what the record says, and a label of the thought alone
    // would keep it from a screen reader.
    <Tappable onPress={onPress} style={styles.note}>
      <View style={styles.noteShot}>
        {uri ? <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
        {length ? (
          <Text role="runtimeXs" style={styles.noteLength}>
            {length}
          </Text>
        ) : null}
      </View>
      <View style={[styles.grow, styles.noteWords]}>
        {/* Spec detail 56: 12 / 500 / 16 in the quoted-words ink, two lines at most. */}
        <WordRoom.Provider value={room}>
          <Text role="meta" tone="quote" numberOfLines={2} style={styles.quoted}>
            {text}
          </Text>
        </WordRoom.Provider>
        {roomy ? mark : null}
      </View>
      {roomy ? null : mark}
    </Tappable>
  );
}

/**
 * The last line of an opened stage (spec detail 56) — «Весь журнал этапа · 148 записей», the way out
 * of the two records the row shows and into everything the stage has said. It lines up with those
 * records rather than with the stage's own name, because it is the end of what they are part of.
 *
 * Its own row and not a `Button`: nothing here is an action on the montage, it is a road, and the
 * only thing it wears is the chevron that says so.
 */
export function StepLink({ label, onPress }: { label: string; onPress?: () => void }) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <Tappable
      label={label}
      onPress={onPress}
      slop={hitSlop(TAP, STEP_LINK)}
      style={styles.stepLink}
    >
      <Text role="timecode" tone="accent" style={styles.shrink}>
        {label}
      </Text>
      <Icon icon={ChevronRight} size={14} color={color.accentText} />
    </Tappable>
  );
}

/** The layout's own height for the way into a stage's journal (`MontageLive`); felt at `TAP`. */
const STEP_LINK = 40;

/**
 * One action inside the glass menu that drops out of the «⋯» (spec 7.7): 50 tall, the words on the
 * left at 15 / 500 (spec 7.1, detail 9) and the 19 glyph on the right. It was a sheet's row until the
 * menu existed; the glyph moved to the far side with it, because a menu is read down its left edge.
 * The dangerous one is the only red line in the menu, and there is never more than one of it.
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
        <Text role="rowPlain" style={[styles.grow, { color: tint }]}>
          {label}
        </Text>
        <Icon icon={icon} size={19} color={tint} />
      </Tappable>
    </View>
  );
}

/**
 * A section that leads to a screen of its own (spec 7.7, detail 58): its heading in `eyebrow` over
 * a 26 card, and in the card a sign on the left, two lines of words, a chevron. The account screen's
 * «Контакты» is the one the layout draws.
 *
 * The card is read out as the words on it, not as one of them: «8 человек» alone says nothing about
 * what is behind it, and the heading over it has already been read as a header.
 */
export function RowSection({
  heading,
  title,
  meta,
  sign,
  onPress,
  style,
}: {
  /** The section's own name over the card, drawn in caps. */
  heading?: string;
  title: string;
  meta?: string;
  /** The stack of avatars, or a glyph — whatever stands for where this leads. */
  sign?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  const card = (
    <Tappable onPress={onPress} style={[styles.section, heading ? null : style]}>
      {sign}
      <View style={[styles.grow, styles.sectionWords]}>
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

  return heading ? (
    <View style={[styles.headed, style]}>
      <Text role="eyebrow" tone="muted" accessibilityRole="header">
        {heading.toUpperCase()}
      </Text>
      {card}
    </View>
  ) : (
    card
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
  slop,
  style,
  children,
}: {
  /**
   * What the row is called out as. Left off, a screen reader is given the words on it as they
   * stand — which is the right answer for a row whose parts are all words and a mark, where a label
   * of one part would drop the rest.
   */
  label?: string;
  onPress?: () => void;
  selected?: boolean;
  /** A row the layout draws under 44 is felt at 44 (spec 10.2) — `hitSlop` of what it is drawn at. */
  slop?: ReturnType<typeof hitSlop>;
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
      hitSlop={slop}
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
    // Spec 7.7, detail 52: the two are read across one baseline, and the row is as tall as what it
    // holds — 11 above and below the value's 18, so rows of one line stand 41 apart with their rule
    // (`SheetFrameInfo`, «шаг 41, не 45»).
    summary: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.s3,
      paddingVertical: 11,
      paddingHorizontal: space.s4,
    },
    // A row that leads somewhere is a button, and a button is never under a finger's 44.
    summaryTap: { minHeight: height.small },
    summaryLabel: { width: 96 },
    track: {
      minHeight: TRACK_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
    },
    // Spec 7.7, detail 54: among the chosen the row pulls in — 12 on the left, 8 on the right, 10
    // between its parts — and a wish under the name takes it from 52 to 60.
    trackPicked: { gap: 10, paddingLeft: space.s3, paddingRight: space.s2 },
    wished: { minHeight: 60 },
    // The hairline starts where the name does — past the round button, never under it.
    insetTrack: { marginLeft: 64 },
    insetPicked: { marginLeft: 60 },
    trackWords: { gap: 2 },
    trackLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    shrink: { flexShrink: 1 },
    wish: { lineHeight: 16 },
    // The field under a chosen row keeps to the row's own sides, and stands clear of the next one.
    unfolded: { paddingLeft: space.s3, paddingRight: space.s2, paddingBottom: 10 },
    wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 },
    waveBar: { width: 3, borderRadius: radius.pill, backgroundColor: color.faint },
    // «Вернуть» moves under the reason when the system type leaves it no room beside it. 10 above
    // and below, as spec 7.7 (detail 55) draws it.
    rejected: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: 10,
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
    stepAhead: { minHeight: height.small },
    aheadWords: { lineHeight: 18 },
    // Spec 7.7 — the stage in hand is washed rather than boxed: it is one of a list of stages, and
    // a border round it would make it a card standing apart from its own neighbours.
    stepOpen: { backgroundColor: color.accentNote },
    // Spec detail 56 and 10.11: the ring of a stage ahead is 1, where the running one's is 2.
    stepMark: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1,
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
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingRight: 14,
      paddingLeft: 50,
    },
    // The thought, and the mark under it once the two no longer share a line.
    noteWords: { alignItems: 'flex-start', gap: 6 },
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
    quoted: { lineHeight: 16 },
    // Drawn at the layout's 40 and felt at 44 through the slop: the four points spec 10.2 asks of
    // anything a finger lands on are not four points of room under a stage. The chevron follows the
    // words rather than standing at the far edge.
    stepLink: {
      minHeight: STEP_LINK,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 50,
      paddingRight: 14,
      paddingBottom: 4,
    },
    action: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      borderRadius: radius.cell,
    },
    // Spec 7.7, detail 58: 10 between the heading and the card; the card 26 round, 16 inside, 12
    // between its parts, 2 between its two lines.
    headed: { gap: 10 },
    section: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s4,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.cover,
      backgroundColor: color.surface,
    },
    sectionWords: { gap: 2 },
  }),
);
