import { Image } from 'expo-image';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  PawPrint,
  User,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Divider, LiveDot, Progress, Shares, SparkMark } from './bits';
import { BlockHead } from './block-head';
import { BackButton, Button, IconButton } from './button';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Avatar } from './member';
import { Text } from './text';

/**
 * Spec 8, `Journal*` — the journal of one stage of the making. One screen in four states (waits,
 * runs, ready, stopped) and a row of blocks under its head, so what is here is what all of them
 * stand on: the summary the screen opens with, the counters under it, the parts of the story, the
 * tape of the music, the substeps of the assembly, the frame row and the card one frame opens into.
 *
 * None of it invents a word or a figure: every label, number and reason arrives as a prop, and a
 * fact the api did not send is a block that is not drawn rather than a tile standing a zero.
 */

/** A block of the journal (spec 8, «Общее для `Journal*`»): radius 22, `surface` + `line`, 14 in. */
export function BlockJournal({
  label,
  children,
  style,
}: {
  /** The eyebrow over the block, where it has one. */
  label?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.block, style]}>
      {label ? (
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * The first block of every one of them — the summary of the stage: what it is doing (or what it came
 * to) at 14 / 600 with the time at 12 / 500 `muted` on its baseline, and under them what it counts.
 *
 * `count` is the one figure with its own bar — «61 из 214 разобрано» — and `tiles` the two or three
 * numbers a stage has instead of a single count. A stage with neither draws the head alone rather
 * than an empty block under it.
 */
export function SummaryJournal({
  what,
  time,
  count,
  tiles,
  children,
}: {
  what: string;
  time?: string;
  count?: { figure: string; of: string; word: string; share: number } | null;
  tiles?: readonly { figure: string; label: string }[];
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.say}>
        <Text role="row" style={styles.what}>
          {what}
        </Text>
        {time ? (
          <Text role="metaSm" tone="muted" style={styles.time}>
            {time}
          </Text>
        ) : null}
      </View>
      {count ? (
        <View style={styles.counted}>
          <Text role="figureTile">
            {count.figure}
            <Text role="figureTile" tone="muted">
              {` из ${count.of}`}
            </Text>
          </Text>
          <Text role="metaSm" tone="muted">
            {count.word}
          </Text>
          <Progress value={count.share} tone="spark" label={count.word} style={styles.bar} />
        </View>
      ) : null}
      {tiles?.length ? (
        <Shares>
          {tiles.map((tile) => (
            <View key={tile.label} accessible style={styles.tile}>
              <Text role="figureTile">{tile.figure}</Text>
              <Text role="metaSm" tone="muted">
                {tile.label}
              </Text>
            </View>
          ))}
        </Shares>
      ) : null}
      {children}
    </BlockJournal>
  );
}

/**
 * One half of the preparation's two counters — «Фото 98 из 168» over its own bar. The two stand in a
 * row of equal shares and each counts one kind of file out of the order's own.
 */
export function CountPair({
  label,
  done,
  of,
  share,
}: {
  label: string;
  done: number;
  of: number;
  share: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.pair}>
      <View style={styles.say}>
        <Text role="metaSm" tone="muted" style={styles.grow}>
          {label}
        </Text>
        <Text role="metaSm">{`${done} из ${of}`}</Text>
      </View>
      <Progress value={share} tone="spark" label={label} />
    </View>
  );
}

/**
 * One person of the order's «Кто прислал»: their face, their name, the bar they stand at against
 * whoever brought the most — against the largest, not against the total, so the fullest bar really
 * is the fullest one — and the number of their frames at the end.
 */
export function RowShare({
  name,
  count,
  share,
  uri,
}: {
  name: string;
  count: number;
  share: number;
  uri?: string | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.bringer}>
      <Avatar name={name} size={38} uri={uri} />
      <Progress value={share} tone="accent" label={name} style={styles.grow} />
      <Text role="metaSm" tone="muted" style={styles.tally}>
        {String(count)}
      </Text>
    </View>
  );
}

/**
 * The director's thought about the stage as a whole (spec detail 50, the `JournalDirectorRun` form):
 * the spark, the words that say whose it is, and «СЕЙЧАС» with the live dot while it is being
 * thought — then the sentence itself.
 *
 * `said` and `unsaid` are the two halves of a sentence still arriving (`useTypedThought`): the words
 * take their room from the first letter, so nothing under them moves while they come. The cursor
 * stands with them and goes when they are whole.
 */
export function ThoughtJournal({
  label,
  now,
  said,
  unsaid,
}: {
  label: string;
  /** «СЕЙЧАС» with the live dot, and the cursor at the end of the sentence — off once it is said. */
  now?: string;
  said: string;
  unsaid?: string;
}) {
  const styles = useStyles();
  const typing = now !== undefined && unsaid !== undefined && unsaid !== '';
  return (
    <BlockJournal>
      <View style={styles.say}>
        <SparkMark />
        <Text role="eyebrow" tone="paper">
          {label}
        </Text>
        {now ? (
          <View style={styles.grow}>
            <LiveDot />
            <Text role="eyebrow">{now}</Text>
          </View>
        ) : null}
      </View>
      <Text role="log">
        {said}
        <Text style={styles.unsaid}>{unsaid}</Text>
        {typing ? <View style={styles.cursor} /> : null}
      </Text>
    </BlockJournal>
  );
}

/**
 * One part of the story: its eyebrow — «ЧАСТЬ 2 · СОБИРАЕТСЯ» — over the name, its own line, and the
 * frames the director took into it underneath where it is open.
 *
 * A part with frames behind it is one press; a part with none does not press at all, because there
 * is nothing under it to open — and `more` is the count folded into a single «+15» on the stack.
 */
export function PartJournal({
  label,
  building,
  title,
  line,
  more,
  onPress,
  children,
}: {
  label: string;
  /** The word after the label of the part being cut right now — «· СОБИРАЕТСЯ». */
  building?: string;
  title: string;
  /** «19 кадров · 0:24–0:58», or «ещё не собрана». */
  line: string;
  more?: number;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const body = (
    <BlockJournal>
      <BlockHead label={label}>
        {building ? <Text role="eyebrow">{` · ${building}`}</Text> : null}
      </BlockHead>
      <View style={styles.say}>
        <Text role="rowSm" style={styles.grow}>
          {title}
        </Text>
        {more === undefined ? null : (
          <View style={styles.more}>
            <Text role="metaSm" tone="muted">{`+${more}`}</Text>
          </View>
        )}
      </View>
      <Text role="metaSm" tone="muted">
        {line}
      </Text>
    </BlockJournal>
  );

  return (
    <View>
      {onPress && children ? (
        <Press onPress={onPress} label={title}>
          {body}
        </Press>
      ) : (
        body
      )}
      {children}
    </View>
  );
}

/**
 * One frame: its picture, the file and who brought it, the sentence about it, and the marks of the
 * decision. The row carries no line down the side and no time — this is the film and not the story
 * of how it was cut — so what is left is the frame, the words and the decision.
 *
 * `dim` is a description taken ready-made out of a past film: it stands quieter than one written
 * now, because that is all it is.
 */
export function RowFrame({
  uri,
  length,
  source,
  text,
  marks,
  dim,
  onPress,
  label,
}: {
  uri?: string;
  /** The file's own running time, over its picture. */
  length?: string;
  source?: string;
  text?: string;
  marks?: ReactNode;
  dim?: boolean;
  onPress?: () => void;
  /** What the row is read out as where the words alone do not say what opens. */
  label?: string;
}) {
  const styles = useStyles();
  return (
    <Press onPress={onPress} label={label}>
      <View style={[styles.frame, dim ? styles.dim : null]}>
        <View style={styles.shot}>
          {uri ? <Image source={{ uri }} contentFit="cover" style={styles.fill} /> : null}
          {length ? (
            <Text role="runtimeXs" style={styles.length}>
              {length}
            </Text>
          ) : null}
        </View>
        <View style={styles.grow}>
          {source ? (
            <Text role="metaSm" tone="muted">
              {source}
            </Text>
          ) : null}
          {text ? <Text role="log">{text}</Text> : null}
          {marks ? <View style={styles.marks}>{marks}</View> : null}
        </View>
      </View>
    </Press>
  );
}

/**
 * The tape of the music stage (spec 8, `JournalMusicRun`): a line across the block with the cuts
 * standing on it as white ticks. Not a waveform and no pretence of one — the shape of a track is the
 * worker's to know, and a wave that moved on every render would be noise dressed as a signal. What
 * this says is where the film is cut.
 */
export function TapeCuts({ cuts }: { cuts: readonly { at: number; share: number }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.tape}>
      {cuts.map((cut, i) => (
        <View key={`${cut.at}-${i}`} style={[styles.tick, { left: `${cut.share * 100}%` }]} />
      ))}
    </View>
  );
}

/**
 * One part of the story as the music is heard in it: its name, the seconds it stands at, the two
 * shares — the music and the frames' own sound — as two bars, and the line the worker wrote about it.
 *
 * The two never add up to one and are not drawn as if they did: loud music and a loud room happen
 * together, and a pair of bars that always summed would be drawing a rule that is not there. A part
 * the worker has not reached has neither bar and one line of its own saying so.
 */
export function PartSound({
  title,
  line,
  shares,
  why,
  now,
}: {
  title: string;
  /** «0:00–0:24», where the part's place in the film is known. */
  line?: string;
  /** The two bars, in the order they are drawn — each its own word over its own share. */
  shares?: readonly { label: string; share: number }[];
  why?: string;
  /** «СЕЙЧАС» — the part being mixed right now. */
  now?: boolean;
}) {
  const styles = useStyles();
  return (
    <BlockJournal>
      <BlockHead label={title}>{now ? <LiveDot /> : null}</BlockHead>
      {line ? (
        <Text role="metaSm" tone="muted">
          {line}
        </Text>
      ) : null}
      {shares?.map((one) => (
        <View key={one.label} style={styles.pair}>
          <View style={styles.say}>
            <Text role="metaSm" tone="muted" style={styles.grow}>
              {one.label}
            </Text>
            <Text role="metaSm">{`${Math.round(one.share * 100)}%`}</Text>
          </View>
          <Progress value={one.share} tone="spark" label={one.label} />
        </View>
      ))}
      {why ? (
        <Text role="note" tone="muted">
          {why}
        </Text>
      ) : null}
    </BlockJournal>
  );
}

/**
 * One substep of the assembly in the three states the worker leaves it in: done with a tick in
 * `spark`, the one being walked with the ring, and the ones still ahead at their number.
 */
export function RowStep({
  at,
  label,
  state,
}: {
  at: number;
  label: string;
  state: 'pending' | 'running' | 'done';
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.say}>
      <View style={[styles.stepMark, state === 'done' ? styles.stepDone : null]}>
        {state === 'done' ? (
          <Icon icon={Check} size={14} stroke={3} color={color.sparkInk} />
        ) : state === 'running' ? (
          <Spinner size={16} ring={2} track={color.line} head={color.accent} />
        ) : (
          <Text role="metaTile" tone="faint">
            {String(at)}
          </Text>
        )}
      </View>
      <Text role="rowSm" tone={state === 'pending' ? 'muted' : undefined} style={styles.grow}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The one card the analysis opens a frame into (spec 8, `JournalAnalysisCardOpen`): its picture and
 * who brought it over the head, then what was seen on it — what happens, who is in it, the place
 * and the light and the mood and the shot, and for a clip the camera, the speech and its best
 * moments — and the comments under it.
 *
 * A field the worker did not write is not drawn: the card of a photograph has no «Камера» and no
 * «Речь», and one described in three words has three fields. The comments are their own block and
 * they stand whether or not there is anything in them — the shape of the card does not change with
 * the day.
 */
export function CardFrame({
  uri,
  title,
  meta,
  words,
  what,
  fields,
  marks,
  people,
  moments,
  comments,
  fold,
  onClose,
  close,
}: {
  uri?: string;
  title: string;
  meta?: string;
  /** The names the card's own blocks go by — the screen's words, not the kit's. */
  words: { what: string; who: string; moments: string; comments: string };
  /** What happens on the frame — the sentence the worker wrote about it. */
  what?: string;
  /** The rest of the fields, each under its own word, in the card's order. */
  fields?: readonly { label: string; value: string }[];
  /** The marks of «Кто в кадре» — a person and an animal are told apart by the sign. */
  marks?: readonly { label: string; person: boolean }[];
  /** «всего 14 человек», in the head of that block. */
  people?: string;
  moments?: readonly { seconds: string; text: string }[];
  /** The line under the comments, where there is nothing in them. */
  comments?: string;
  /** «Подробное описание» — folded away under a rule until it is pressed. */
  fold?: string;
  onClose?: () => void;
  /** What the cross over the card says — «Свернуть». */
  close?: string;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.say}>
        <View style={styles.shotBig}>
          {uri ? <Image source={{ uri }} contentFit="cover" style={styles.fill} /> : null}
        </View>
        <View style={styles.grow}>
          <Text role="row">{title}</Text>
          {meta ? (
            <Text role="metaSm" tone="muted">
              {meta}
            </Text>
          ) : null}
        </View>
        {onClose && close ? (
          <IconButton icon={X} label={close} size={height.roundRow} onPress={onClose} />
        ) : null}
      </View>

      {what ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.what}
          </Text>
          <Text role="bodySm">{what}</Text>
        </View>
      ) : null}

      {marks ? (
        <View style={styles.wide}>
          <BlockHead label={words.who}>
            {people ? (
              <Text role="metaSm" tone="muted">
                {people}
              </Text>
            ) : null}
          </BlockHead>
          <View style={styles.marks}>
            {marks.map((mark) => (
              <View key={mark.label} style={styles.mark}>
                <Icon icon={mark.person ? User : PawPrint} size={12} color={color.muted} />
                <Text role="metaSm">{mark.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {fields?.map((field) => (
        <View key={field.label} style={styles.field}>
          <Text role="eyebrow" tone="muted">
            {field.label}
          </Text>
          <Text role="bodySm">{field.value}</Text>
        </View>
      ))}

      {moments?.length ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.moments}
          </Text>
          {moments.map((moment) => (
            <View key={moment.seconds} style={styles.moment}>
              <Text role="metaSm" tone="spark">
                {moment.seconds}
              </Text>
              <Text role="metaSm" tone="muted" style={styles.grow}>
                {moment.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {comments !== undefined ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.comments}
          </Text>
          <Text role="metaSm" tone="muted">
            {comments}
          </Text>
        </View>
      ) : null}

      {fold ? (
        <>
          <Divider soft />
          <Text role="rowSm">{fold}</Text>
        </>
      ) : null}
    </BlockJournal>
  );
}

/**
 * The one block the two ends of a stage wear (`JournalStageNotStarted`, `JournalStageStopped`): the
 * sign in its circle, the words about it, and — where the stage stopped — why.
 *
 * There is no «Повторить» here. That is the film screen's button, and a second one over the same
 * thing is two buttons for one press.
 */
export function StageNotice({
  title,
  text,
  stopped,
  action,
  onAction,
}: {
  title: string;
  text: string;
  /** The stage stopped: the sign goes in danger, and the reason stands in the screen's own words. */
  stopped?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.notice}>
        <View style={[styles.noticeSign, stopped ? styles.noticeStopped : null]}>
          <Icon
            icon={stopped ? Pause : Clock}
            size={22}
            color={stopped ? color.dangerText : color.muted}
          />
        </View>
        <Text role="titleSm" accessibilityRole="header" style={styles.centred}>
          {title}
        </Text>
        <Text role="body" tone={stopped ? undefined : 'muted'} style={styles.centred}>
          {text}
        </Text>
        {action && onAction ? (
          <Button size="xs" wide={false} label={action} onPress={onAction} />
        ) : null}
      </View>
    </BlockJournal>
  );
}

/**
 * The two buttons at the foot of the screen: the stage before and the stage after, in two shares of
 * the row. The first has only the one after it, and the last only the one before — and there, where
 * there is no stage after, the way back to the film takes its place.
 *
 * A stage that has not begun is still a road: its own screen is what says it has not begun, and it
 * says it rather than refusing to open.
 */
export function StagePager({
  before,
  after,
  toFilm,
  onBefore,
  onAfter,
  onFilm,
}: {
  before?: string;
  after?: string;
  toFilm?: string;
  onBefore?: () => void;
  onAfter?: () => void;
  onFilm?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const cell = (
    label: string | undefined,
    onPress: (() => void) | undefined,
    icon: typeof ChevronLeft,
    toEnd: boolean,
  ) => {
    if (!label) return <View style={styles.pagerCell} />;
    return (
      <Press onPress={onPress} label={label} style={styles.pagerCell}>
        <View style={[styles.pagerRow, toEnd ? styles.pagerEnd : null]}>
          {toEnd ? null : <Icon icon={icon} size={17} stroke={2} color={color.paper} />}
          <Text role="rowSm" numberOfLines={1}>
            {label}
          </Text>
          {toEnd ? <Icon icon={icon} size={17} stroke={2} color={color.paper} /> : null}
        </View>
      </Press>
    );
  };
  return (
    <View style={styles.pager}>
      {cell(before, onBefore, ChevronLeft, false)}
      {cell(after ?? toFilm, onAfter ?? onFilm, ChevronRight, true)}
    </View>
  );
}

/** Read out once and not as a theme token: the chevrons take the colour of the words beside them. */
/**
 * The press under a row that leads somewhere: the dip, the focus ring, and no button at all where
 * there is nowhere to go — the same rule `film.tsx` keeps for the stage rows.
 */
function Press({
  onPress,
  label,
  style,
  children,
}: {
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const ring = useFocusRing();
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [style, pressed && !reduced ? PRESS : null, focused ? ring : null]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    block: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: 14,
      gap: space.s3,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    headWords: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 },
    headStage: { flexShrink: 0 },
    say: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    what: { flexShrink: 1 },
    time: { flexShrink: 0 },
    grow: { flex: 1, minWidth: 0 },
    counted: { gap: 4 },
    bar: { marginTop: 4 },
    tile: { flexGrow: 1, gap: 2 },
    centred: { textAlign: 'center' },
    fill: { flex: 1 },

    pair: { flex: 1, gap: 6 },
    bringer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tally: { width: 32, textAlign: 'right' },

    unsaid: { color: 'transparent' },
    cursor: { width: 2, height: 15, marginLeft: 2, backgroundColor: color.spark },

    more: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
    },

    frame: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    shot: {
      width: 44,
      height: 44,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shotBig: {
      width: 56,
      height: 56,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    length: { position: 'absolute', right: 3, bottom: 3 },
    dim: { opacity: 0.5 },
    marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },

    tape: { height: 6, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
    tick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: color.paper },

    stepMark: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDone: { backgroundColor: color.spark },

    wide: { gap: 6 },
    field: { gap: 3, backgroundColor: color.raise, borderRadius: radius.thumb, padding: 9 },
    mark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: color.line,
    },
    moment: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },

    notice: { alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
    noticeSign: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeStopped: { borderStyle: 'solid', backgroundColor: color.dangerTextSoft },

    pager: { flexDirection: 'row', gap: space.s2 },
    pagerCell: {
      flex: 1,
      minWidth: 0,
      minHeight: height.quietSheet,
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      backgroundColor: color.surface,
      paddingHorizontal: 14,
    },
    pagerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pagerEnd: { justifyContent: 'flex-end' },
  }),
);

/**
 * The bar of the journal (spec 8, «Общее для `Journal*`»): «К ролику» at 44, and on the baseline
 * beside it the name of the stage and its place among the five.
 *
 * The two stand on one baseline rather than over one another because they are one sentence — «the
 * music, stage four of five» — and a bar that stacked them would spend two lines saying what one
 * says. It is drawn here rather than by an `AppBar` because every other bar of the product puts the
 * meta under the name, and this is the one place the spec draws it beside.
 */
export function StageHead({
  name,
  stageOf,
  onFilm,
  label,
}: {
  name: string;
  /** «Этап 4 из 5» — its place among the five, counted from one. */
  stageOf: string;
  onFilm: () => void;
  /** «К ролику» — what the way back says, and where it leads. */
  label: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <BackButton label={label} onPress={onFilm} />
      <View style={styles.headWords}>
        <Text role="stageName">{name}</Text>
        <Text role="metaSm" tone="muted" style={styles.headStage}>
          {stageOf}
        </Text>
      </View>
    </View>
  );
}
