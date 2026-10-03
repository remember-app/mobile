import { Image } from 'expo-image';
import { Bell, Check, Pause } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Divider, LiveDot, Progress } from './bits';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 8, `Film*` — the pieces every screen of a movie is built from. A film has five states and
 * they are one screen in five dresses: a stage line under the bar, the list of the five stages, and
 * whatever else that state has to say. What is here is what all five share, so the journal screen
 * built later (`Journal*`, TASK-470) stands on the same bricks rather than drawing its own.
 *
 * None of it holds state, fetches anything or invents a word: every string here is a prop, because
 * this is the look and the screens are the voice.
 */

/**
 * Where the making stands, under the bar of every `Film*` (spec 8, «Общее для `Film*`»): the name
 * of the stage in hand, where it is in the five, what is left of it or — where nothing more is
 * coming — how it ended, and under them the scale of the five.
 *
 * The stage itself is named and not counted: «73 %» tells a person nothing, «Режиссура» tells them
 * where it is. The figure beside it is its place among the five, counted from one.
 *
 * `stopped` draws the one state that has no time left in it: the pill on the right says it, and the
 * part of the scale the stage had reached goes in danger rather than in `spark`.
 */
export function FilmStageLine({
  name,
  of,
  stageOf,
  right,
  done,
  share,
  stopped,
}: {
  /** The stage in hand, by the screen's own word for it. */
  name: string;
  of: number;
  /** «Этап 3 из 5» — its place among the five, counted from one, in the screen's own sentence. */
  stageOf: string;
  /** «осталось ≈ 8 мин», «было ≈ 8 мин», or the state where nothing more is coming. */
  right?: string;
  /** How many stages are behind, the one in hand included — what the scale has lit. */
  done: number;
  /** How much of the stage in hand is done, 0…1; see {@link FilmStageScale}. */
  share?: number | null;
  /** The stage in hand is the one that stopped, and says so in danger rather than in `spark`. */
  stopped?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={styles.line}>
      <View style={styles.say}>
        <Text role="section" style={styles.name}>
          {name}
        </Text>
        {stageOf ? (
          <Text role="timecode" tone="muted">
            {stageOf}
          </Text>
        ) : null}
        <View style={styles.grow} />
        {right ? (
          <Text role="meta" style={stopped ? styles.stopped : null}>
            {right}
          </Text>
        ) : null}
      </View>
      {stageOf ? (
        <FilmStageScale of={of} done={done} share={share} stopped={stopped} label={stageOf} />
      ) : null}
    </View>
  );
}

/**
 * The five bars under the stage line: 5 tall, 4 between, what is behind in `spark` and the stage in
 * hand filled to the share of itself that is done. A stage that stopped takes its own bar in danger —
 * the same one it wears as a pill, so the two never say different things.
 *
 * Read out as one element: five bars are not five things to read, and «Stage 3 of 5» is said by the
 * line above rather than bar by bar.
 */
export function FilmStageScale({
  of,
  done,
  share,
  stopped,
  label,
}: {
  of: number;
  done: number;
  /**
   * How much of the stage in hand is done, 0…1 — its own bar fills as it goes rather than lighting
   * all at once. Null where the stage has no counter to speak of yet, and that bar stands as the
   * ones behind it do: nothing to show is not nothing done.
   */
  share?: number | null;
  /** The stage in hand is the one that stopped; its own bar goes in danger. */
  stopped?: boolean;
  label?: string;
}) {
  const styles = useStyles();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: of, now: done }}
      style={styles.scale}
    >
      {Array.from({ length: of }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            i < done - 1 ? styles.behind : null,
            i === done - 1 && stopped ? styles.stoppedBar : null,
            i === done - 1 && !stopped ? styles.here : null,
          ]}
        >
          {i === done - 1 && !stopped && share ? (
            <Progress value={share} tone="spark" style={styles.share} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One stage of the making, as a row (spec 8, detail 56): the 26 circle of its state, its name, the
 * one line of what came of it, and the chevron into its journal.
 *
 * All five states are here and each is drawn by its own rule, because a stage's state is the whole
 * of what the row has to say before the words:
 *
 * - **done** — `spark` with a check; what it came to in `muted`;
 * - **running** — a ring with an `accent` arc turning in it, the row washed `accentNote`, and what
 *   it has got to so far rather than what it came to;
 * - **waiting** — a hairline ring with the stage's own number in it, and where it stands nothing
 *   said about the making at all;
 * - **failed** — a hairline ring in danger with a pause in it, and why it stopped in danger.
 *
 * `at` is the stage's place among the five, said in the ring of a stage nobody has come to: a number
 * in a circle is what «ждёт» looks like, and without it the five waiting rows are five identical
 * grey rings.
 */
/** The four states a stage of the making stands in — spec 8, detail 56. */
export type FilmStageState = 'done' | 'running' | 'waiting' | 'failed';

export function RowFilmStage({
  at,
  title,
  meta,
  state,
  onPress,
  children,
}: {
  /** The stage's place among the five — what stands in the ring while it waits. */
  at: number;
  title: string;
  /** What the stage came to, or how far it has got — written by the screen. */
  meta?: string;
  state: FilmStageState;
  onPress?: () => void;
  /** The stage in hand opens out here: its journal is one press further, never inside the row. */
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const waiting = state === 'waiting';

  return (
    <View style={state === 'running' ? styles.running : null}>
      <FilmPress onPress={waiting ? undefined : onPress} style={styles.stageRow}>
        <View
          style={[
            styles.stageMark,
            state === 'done' ? styles.markDone : null,
            state === 'running' ? styles.markRunning : null,
            state === 'failed' ? styles.markFailed : null,
          ]}
        >
          {state === 'done' ? (
            <Icon icon={Check} size={14} stroke={3} color={color.sparkInk} />
          ) : state === 'failed' ? (
            <Icon icon={Pause} size={12} color={color.dangerText} />
          ) : waiting ? (
            <Text role="metaTile" tone="faint">
              {String(at)}
            </Text>
          ) : (
            <Spinner size={26} ring={2} track={color.line} head={color.accent} />
          )}
        </View>
        <View style={styles.stageWords}>
          <Text role="rowSm" tone={waiting ? 'muted' : undefined}>
            {title}
          </Text>
          {meta ? (
            <Text
              role="metaSm"
              numberOfLines={2}
              style={state === 'failed' ? styles.dangerText : null}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </FilmPress>
      {state === 'running' ? children : null}
    </View>
  );
}

/**
 * The list the five stage rows stand in — a card of 20 with the hairline between them inset to
 * where the names start, which is what makes it a list rather than a grid.
 *
 * Drawn here and not by the screen so that the same five rows look the same on the queued screen,
 * the making one, the one that stopped and the finished one.
 */
export function FilmStageList({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <View style={[styles.list, style]}>{children}</View>;
}

/** The hairline between two of the five, inset to where their names start. */
export function FilmStageDivider() {
  return <Divider soft style={FILM_DIVIDER} />;
}
const FILM_DIVIDER = { marginLeft: 52 } as const;

/**
 * Spec 8, detail 49 — «Сейчас»: what the stage in hand is doing at this moment. One line at the top
 * saying who is working and on what, the marker beside it; under that, the frame being worked on at
 * 72 and the sentence about it, with the decision's own marks beneath.
 *
 * The whole card is one press into the journal of the stage in hand — it is a window onto a thing
 * happening, and the thing that happened to it is written down.
 *
 * `now` is what says the card is live at all: «СЕЙЧАС» with the blinking dot while the reads are
 * coming, and «обновлено 2 мин назад» without one while the connection is gone — the card then says
 * how old it is rather than pretending it is moving.
 */
export function CardFilmNow({
  who,
  what,
  now,
  uri,
  thought,
  marks,
  onPress,
}: {
  /** «Режиссёр» — who is working. */
  who: string;
  /** «думает над кадром» — what they are doing, in the voice of the stage in hand. */
  what: string;
  /** «СЕЙЧАС» with the live dot, or «обновлено 2 мин назад» without it. */
  now: string;
  /** The frame under the sentence, when the stage is working on one. */
  uri?: string;
  /** What has been said about it so far. */
  thought?: string;
  /** The decision's own marks — `BadgeDecision` each, handed in. */
  marks?: ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();

  return (
    <FilmPress onPress={onPress} style={styles.nowCard}>
      <View>
        <View style={styles.nowHead}>
          <Text role="badgeSm">{who}</Text>
          <Text role="metaSm" tone="muted" style={styles.grow}>
            {what}
          </Text>
          <View style={styles.nowMark}>
            <LiveDot />
            <Text role="badgeSm">{now}</Text>
          </View>
        </View>
        {uri || thought ? (
          <View style={styles.nowBody}>
            {uri ? (
              <View style={styles.nowShot}>
                <Image source={{ uri }} contentFit="cover" style={styles.nowShotFill} />
              </View>
            ) : null}
            <View style={styles.grow}>
              {thought ? (
                <Text accessibilityLiveRegion="polite" role="bodyXs" tone="paper">
                  {thought}
                </Text>
              ) : null}
              {marks ? <View style={styles.nowMarks}>{marks}</View> : null}
            </View>
          </View>
        ) : null}
      </View>
    </FilmPress>
  );
}

/**
 * The pressable behind a stage row and the card above it. No button where there is nowhere to go — a
 * stage nobody has come to yet is not a road, and offering a finger where nothing opens is the
 * oldest way a screen lies.
 */
function FilmPress({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  if (!onPress) return <View style={style}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style, pressed && !reduced ? PRESS : null]}
    >
      {children}
    </Pressable>
  );
}

/**
 * The scale of the stage in hand, as a fraction of itself that is done — «61 из 214 разложено» is a
 * count and this is the bar under it. Null where the stage has no counter to speak of yet, which is
 * every stage but the two the worker counts as it goes.
 */
export function stageShare(stage: { done_count: number; total_count: number | null } | undefined) {
  if (!stage || stage.total_count === null || stage.total_count === 0) return null;
  return stage.done_count / stage.total_count;
}

/**
 * One fact about what was ordered, as a tile (spec 8, detail 44, the `FilmQueued` variant): the
 * label above, the figure, and a note under it that may be absent — a track whose tempo was never
 * learned has no note rather than a zero, and the tile simply ends above the second line.
 *
 * `figure` is a node and not a string because one of the four is an icon beside its own word.
 */
export function TileOrder({
  label,
  figure,
  note,
}: {
  label: string;
  figure: ReactNode;
  note?: string;
}) {
  const styles = useStyles();
  return (
    <View accessible style={styles.tile}>
      <Text role="meta" tone="muted">
        {label}
      </Text>
      {typeof figure === 'string' ? <Text role="figureTile">{figure}</Text> : figure}
      {note ? <Text role="metaSm">{note}</Text> : null}
    </View>
  );
}

/** The row the four tiles stand in — two to a row, 8 between. */
export function TileOrderRow({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.tiles}>{children}</View>;
}

/**
 * A block of what the order said, in a card of 20 (spec 8, `FilmQueued`): the name of the thing in
 * the eyebrow, and what was said under it. The story the organizer typed is the only block on that
 * screen that can hold their own words — everything else on it is a figure.
 */
export function FilmBlock({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <Text role="eyebrow" tone="muted" accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * The line under a queued or building screen about not having to watch (spec 8, `FilmQueued`): the
 * bell, and the promise that closing the screen costs nothing. It leads nowhere and is not a button
 * — it is the one line on the screen about what to do next rather than about the film.
 */
export function FilmCloseNote({ text }: { text: string }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.close}>
      <Icon icon={Bell} size={18} color={color.muted} />
      <Text role="meta" style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    line: { gap: 8 },
    say: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    name: { flexShrink: 1 },
    at: { flexShrink: 0 },
    grow: { flex: 1, minWidth: 0 },
    stopped: { color: color.dangerText },
    scale: { flexDirection: 'row', gap: 4 },
    bar: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: color.line },
    behind: { backgroundColor: color.spark },
    // The stage in hand is a track with what it has got to in it — the only partial bar on a film's
    // screen, and the one thing here that moves while somebody watches.
    here: { overflow: 'hidden' },
    share: { height: '100%' },
    stoppedBar: { backgroundColor: color.dangerText },
    list: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 58 },
    stageMark: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: color.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markDone: { backgroundColor: color.spark, borderColor: color.spark },
    markRunning: { borderColor: color.line },
    markFailed: { borderColor: color.dangerText },
    running: { backgroundColor: color.accentNote },
    stageWords: { flex: 1, minWidth: 0, gap: 2 },
    dangerText: { color: color.dangerText },

    // Spec 8, detail 44 — the tile of what was ordered, on the queued screen: 12 in, radius 16, a
    // label above the figure and a note under it, two to a row.
    tile: {
      flexGrow: 1,
      flexBasis: '46%',
      gap: 3,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    tileLabel: {},
    tileFigure: {},
    tileNote: { color: color.faint },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },

    // The block of what the order said, in the making and the queue alike.
    // Spec 8, detail 49 — the card «Сейчас»: 20 round, `surface` + `line`, 12 in, 10 between.
    nowCard: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s3,
      gap: 10,
    },
    nowHead: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    nowMark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nowBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    nowShot: {
      width: 72,
      height: 72,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    nowShotFill: { flex: 1 },
    nowMarks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },

    close: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: space.s3,
      paddingHorizontal: 14,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    block: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingHorizontal: 14,
      paddingVertical: space.s3,
      gap: 6,
    },
  }),
);
