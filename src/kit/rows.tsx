import { ChevronRight, Pause, Play } from 'lucide-react-native';
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
import { Icon, type IconComponent, playFor } from './icon';
import { hitSlop, PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
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
 * A fact and the words that change it (spec 8, `FrameInfo`): when the frame was shot, and at its
 * tail «Изменить» in `accent` — words alone, with no chevron and nothing round them. The chevron
 * belongs to a row that leads to a screen, and this one leads nowhere: the editor opens in place,
 * under the row. So the words are the row's own tail and not a separate button standing beside it.
 *
 * `onEdit` left off, the tail is not drawn at all rather than drawn as words that refuse — the same
 * answer `RowSummary` gives a fact it cannot lead anywhere from. What is left is the value, which
 * every reader of the frame may see whatever they may do to it.
 *
 * The value is at 15 / 600 like the layout's (`FrameInfo.html` e58), which is the `row` face and
 * not the summary's — a date has no other column here to line up with.
 */
export function RowEdit({
  value,
  edit,
  onEdit,
  divider,
}: {
  value: string;
  /** «Изменить» — the words at the tail, written by the screen. */
  edit: string;
  /** What the tail does. Left off, there is no tail. */
  onEdit?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();

  return (
    <View>
      {divider ? <Divider soft /> : null}
      <View style={styles.edit}>
        <Text role="row" style={[styles.grow, styles.figures]}>
          {value}
        </Text>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            // The words alone say «Изменить» and not what — so they are read out with the value,
            // the way `RowSummary` reads a line of a list.
            accessibilityLabel={`${edit}: ${value}`}
            hitSlop={hitSlop(EDIT_TAIL)}
            onPress={onEdit}
            {...props}
            style={({ pressed }) => [
              styles.editAt,
              pressed && !reduced ? PRESS : null,
              focused ? focusRing : null,
            ]}
          >
            <Text role="controlSm" tone="accent">
              {edit}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
 * The pencil of a track's wish, in its 36 among the chosen (spec 7.7, detail 54; `MontageMusic.json`
 * e20, e29): the layout's pen (`DRAWN.pen`) at 15 / 1.9 — a size under the circle's own 16, as the
 * layout draws it. Lucide's pencil at the circle's 18 read 16 × 16 against 12.3 × 11.7 (TASK-398).
 */
export const WISH_GLYPH = { size: 15, stroke: 1.9 } as const;

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
            <Text role="row" tone={playing ? 'spark' : 'paper'} style={styles.shrink}>
              {title}
            </Text>
            <Text role="meta">{length}</Text>
          </View>
          {/* One line cut short (spec 7.7, detail 54; `MontageMusic`: «полностью видно в раскрытом
              поле») — the wish is said whole in the field the pencil unfolds. */}
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
          <Text role="row">{title}</Text>
          <Text role="meta">{count}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

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
        <Text role="subtitle">{title}</Text>
        {meta ? <Text role="meta">{meta}</Text> : null}
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
 *
 * A row nobody can press is a plain view, read out whole as one: a `Pressable` held `disabled`
 * would be read as a control that is out («недоступно», «dimmed»), which a line of facts is not.
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
  const state = selected === undefined ? undefined : { selected };

  if (!onPress)
    return (
      <View accessible accessibilityLabel={label} accessibilityState={state} style={style}>
        {children}
      </View>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={state}
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

/** The height `FrameInfo` draws its «Изменить» at — 28, and a finger's 44 all the same (spec 10.2). */
const EDIT_TAIL = 28;

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
    // `FrameInfo.html` e57: the row is 14 over its value and 12 under, the words at its end beside
    // the first line rather than centred on the whole — a two-line date with one button beside it
    // would leave the button floating between the lines.
    edit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: space.s4,
    },
    // The tail is 28 tall (`FrameInfo.html` e61) and felt at a finger's 44; it holds only its words,
    // so it is a floor and the words grow through it.
    editAt: { minHeight: EDIT_TAIL },
    // A date is figures that never dance (spec 3), the value of this row whatever face it is set in.
    figures: { fontVariant: ['tabular-nums'] },
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
    // The length goes under the name, rather than squeeze it, once the two no longer share a line.
    trackLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: space.s2,
    },
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
    stepLarge: { minHeight: 58 },
    stepWordsLarge: { gap: 2 },
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
    stepMarkLarge: { width: 26, height: 26 },
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
