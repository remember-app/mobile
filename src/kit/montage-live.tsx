import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Text as RNText,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { photo, radius, space, themed, useTheme } from '@/theme';

import { SparkMark } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useLoop, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.6 and 7.7 — the surface of a montage being made. Everything here answers one question from
 * a person who is watching a machine work: what is it doing *right now*, and why did it decide that.
 * So none of it reports a percentage; all of it is the frame in the director's hands, the sentence
 * they are saying about it, and the record of every sentence before.
 */

/** How long the cursor at the end of an unfinished thought takes to blink once (spec 6). */
const BLINK = 1000;

/**
 * A thought still arriving, inside the `Text` that holds it: what is said so far, the cursor, and
 * the rest of the sentence laid out but not drawn. The words take their final room from the first
 * letter, so nothing under them moves while they arrive (spec 7.6, «экран не прыгает»). The hidden
 * half is a bare `Text`, so it inherits the size and the line height of the words it continues.
 */
function Said({ said, unsaid }: { said?: string; unsaid?: string }) {
  return (
    <>
      {said}
      {unsaid ? (
        <>
          <Cursor />
          <RNText style={unsaidStyle}>{unsaid}</RNText>
        </>
      ) : null}
    </>
  );
}

const unsaidStyle = { color: 'transparent' } as const;

/** The 2 × 15 `spark` cursor at the end of a thought still arriving. Blinks once a second (spec 6). */
function Cursor() {
  const styles = useStyles();
  const beat = useLoop(BLINK);

  // Reduced motion takes the cursor away rather than freezing it: a still bar at the end of a
  // sentence reads as a typo, and the thought under that setting arrives whole anyway.
  if (!beat) return null;

  return (
    <Animated.View
      style={[
        styles.cursor,
        { opacity: beat.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] }) },
      ]}
    />
  );
}

/**
 * Spec 7.6 — the director's thought as a plate: the sparkle and the sentence. It is the same plate
 * whether it holds the plan for a whole stage or the thought about one file — one plate, not the two
 * the layout draws (spec detail 50, 10.11): 16 round, 12 inside, the 22 and the words 13 / 400 / 18.
 * Where that file lay in the film is not a thought but the layout's fact, and is not drawn inside it.
 */
export function NoteThought({
  text,
  unsaid,
  style,
}: {
  text: string;
  /** The rest of the sentence, still arriving — see {@link Said}. */
  unsaid?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.plateNote, style]}>
      <SparkMark />
      <Text role="log" style={styles.grow}>
        <Said said={text} unsaid={unsaid} />
      </Text>
    </View>
  );
}

/**
 * Spec 7.7 — one record in the director's journal, hung off the vertical line that runs down the
 * whole of it. The dot on that line is `spark` on the freshest record and `lineStrong` on every one
 * behind it, and it wears a ring of the screen's own ink so it cuts the line rather than sitting on
 * it.
 *
 * Three bodies, and the screen picks by what it has: one file, a series of them, or a thought with
 * no file at all — that last one is a `NoteThought` across the full width, handed in as `children`.
 */
export function LogEntry({
  time,
  fresh,
  uri,
  length,
  photos,
  source,
  text,
  unsaid,
  marks,
  children,
  onPress,
}: {
  /** «сейчас», «16:43». */
  time: string;
  /** The newest record: its dot is `spark` and its time is read in `paper`. */
  fresh?: boolean;
  /** One file's frame at 62. */
  uri?: string;
  /** That file's running time, if it moves. */
  length?: string;
  /** A series instead of one frame: four at 44. */
  photos?: readonly string[];
  /** «IMG_2041 · Аня» — the file and who brought it. */
  source?: string;
  text?: string;
  /** The freshest thought is still being said: the rest of it — see {@link Said}. */
  unsaid?: string;
  /** The decision pills, in a row that wraps — `BadgeDecision` each. */
  marks?: ReactNode;
  /** A thought with no file: the plate, full width. */
  children?: ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();

  const body = (
    <>
      {photos?.length ? (
        <View style={styles.series}>
          {photos.slice(0, 4).map((shot) => (
            <Image key={shot} source={{ uri: shot }} contentFit="cover" style={styles.seriesShot} />
          ))}
        </View>
      ) : null}
      {/* Spec detail 61: the file and its author 11 / 500 `muted`, the thought 13 / 400 / 18. */}
      {source ? <Text role="metaSm">{source}</Text> : null}
      {text || unsaid ? (
        <Text role="log">
          <Said said={text} unsaid={unsaid} />
        </Text>
      ) : null}
      {marks ? <View style={styles.marks}>{marks}</View> : null}
    </>
  );

  return (
    <View style={styles.entry}>
      <View style={[styles.dot, fresh ? styles.dotFresh : null]} />
      {/* Spec detail 61: 11 / 600 — «сейчас» in `paper`, every time behind it `muted` (10.1: the
          layout's `faint` is under the floor for words that are read). */}
      <Text role="metaTile" tone={fresh ? 'paper' : 'muted'}>
        {time}
      </Text>
      {children ?? (
        // A record about a file opens that file's own card; one about a series or a thought alone
        // does not, so the press is only ever offered where there is somewhere to go.
        // Nothing is said in place of the record: its file, its thought and the decision pills are
        // all words, and a label of the first of them would keep the rest from a screen reader.
        <Touch onPress={uri ? onPress : undefined}>
          {uri ? (
            <View style={styles.entryFile}>
              <View style={styles.shotSmall}>
                <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                {length ? (
                  <Text role="runtimeXs" style={styles.shotLength}>
                    {length}
                  </Text>
                ) : null}
              </View>
              <View style={styles.grow}>{body}</View>
            </View>
          ) : (
            body
          )}
        </Touch>
      )}
    </View>
  );
}

/**
 * Spec 7.7 — the journal itself: the 1px line every record hangs its dot on, and the 18 between
 * them. The line belongs here and not to a record, or it would break at every gap.
 */
export function Journal({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.journal, style]}>
      <JournalLine />
      {children}
    </View>
  );
}

/**
 * That line on its own, for the journal that is a whole screen rather than a block: a stage's own
 * log is hundreds of records and scrolls as a list, and a list has no single box to draw a line down
 * — so the line is laid behind it and the records scroll past it, which is what the layout draws.
 *
 * The parent is what positions it: anything it is put in gets the line 5 points from its left edge.
 */
export function JournalLine() {
  const styles = useStyles();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.journalLine}
    />
  );
}

/**
 * The pressable behind the two rows in this file that lead somewhere. The same shape `rows.tsx`
 * keeps for its own: the press dip, the focus ring, and no button at all where there is no `onPress`.
 */
function Touch({
  label,
  onPress,
  style,
  children,
}: {
  /** Left off, the words on the row are read as they stand — see `Tappable` in `rows.tsx`. */
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        style,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Spec 7.7 — «в каких роликах и на какой секунде»: the one line that takes a frame out of the
 * gallery and into the film it ended up in. Several films, several lines.
 */
export function RowFilmAt({
  title,
  at,
  onPress,
}: {
  title: string;
  /** «на 1:12» — written by the screen. */
  at: string;
  onPress?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <Touch label={`${title} ${at}`} onPress={onPress} style={styles.filmAt}>
      <Icon icon={Play} size={16} color={color.paper} fill={color.paper} />
      <Text role="label" style={styles.grow}>
        {title}
      </Text>
      <Text role="meta" tone="accent">
        {at}
      </Text>
    </Touch>
  );
}

/**
 * Spec 7.6 — one number out of how a montage was put together, and the word for what it counts.
 * They stand three to a row and say nothing on their own: «214» is an answer to «просмотрел». The row
 * is `Shares`: a tile fills the height of its share, so three stand even whatever each one wraps to.
 */
export function TileNumber({ figure, label }: { figure: string; label: string }) {
  const styles = useStyles();

  return (
    <View style={styles.number}>
      <Text role="figureTile">{figure}</Text>
      <Text role="metaSm">{label}</Text>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    // Only the top is darkened: the plates live up there and the frame itself is the point.
    // 10 in from the frame's top corners (detail 49). No gap across: the two stand at the two ends,
    // and «СЕЙЧАС» goes under the author's only where the two would otherwise run into each other.
    onPhoto: { color: photo.on },
    // The cursor at the end of a thought still arriving — the `spark` circle it sits inside is
    // `SparkMark` in `bits.tsx`, which every plate that says a thought shares.
    cursor: { width: 2, height: 15, marginLeft: 2, backgroundColor: color.spark },
    plateNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.accentEdge,
      backgroundColor: color.accentNote,
    },
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.7 — the journal's own line runs 17 to the left of the words, and each record hangs its
    // dot on it. The line belongs to `Journal`, so a record only draws the dot.
    journal: { paddingLeft: 22, gap: 18 },
    journalLine: {
      position: 'absolute',
      left: 5,
      top: 8,
      bottom: 0,
      width: 1,
      backgroundColor: color.line,
    },
    entry: { gap: 7 },
    dot: {
      position: 'absolute',
      left: -21,
      top: 5,
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: color.lineStrong,
      // The ring is the screen's own ink, so the dot cuts the line instead of lying on top of it.
      boxShadow: `0 0 0 3px ${color.ink}`,
    },
    dotFresh: { backgroundColor: color.spark },
    entryFile: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
    shotSmall: {
      width: 62,
      height: 62,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    shotLength: { color: photo.on, paddingRight: 3, paddingBottom: 2 },
    series: { flexDirection: 'row', gap: space.s1 },
    seriesShot: { width: 44, height: 44, borderRadius: 9, backgroundColor: color.raise },
    marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Spec detail 62: 42 — a floor, so a title grown with the system's type grows the row.
    filmAt: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s3,
      borderRadius: radius.thumb,
      borderWidth: 1,
      borderColor: color.accentEdge,
      backgroundColor: color.accentNote,
    },
    number: {
      flexGrow: 1,
      gap: 2,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
  }),
);
