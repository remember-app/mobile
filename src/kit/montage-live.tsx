import { Image } from 'expo-image';
import { Play, Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, space, themed, useTheme } from '@/theme';

import { LiveDot } from './bits';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useLoop, useReach, useReducedMotion } from './interaction';
import { Avatar } from './member';
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
 * How tall the frame in hand is drawn (detail 49), and the same frame given the room of a sheet
 * (`SheetLiveFile`) with the square over it. Exported because the gaze arrives as fractions of the
 * picture and the screen is what turns those into points — `gazeAt` in `@/montage-journal`.
 */
export const SHOT = 150;
export const SHOT_SHEET = 220;
export const GAZE_SHEET = 110;

/**
 * Spec 7.6 — «Сейчас»: the frame the director is holding, where on it they are looking, and the
 * thought they are in the middle of saying. The one card in the product that is a window onto
 * something happening rather than a record of something that happened.
 *
 * Three states: thinking (the thought carries a cursor), decided (no cursor, and the decision stands
 * beside the name), and waiting — no frame at all, a spinner and a line saying the queue is what is
 * being waited on.
 */
export function CardNow({
  uri,
  author,
  authorLine,
  now,
  gaze,
  who,
  standing,
  thought,
  typing,
  decision,
  waiting,
  style,
}: {
  uri?: string;
  /** Whose frame it is — the name inside the 18 circle on the plate. */
  author?: string;
  /** «Аня · 13 сент, 16:42» — the plate's own line, written by the screen. */
  authorLine?: string;
  /** «СЕЙЧАС» — the word beside the live dot. Left off, the plate is not drawn. */
  now?: string;
  /**
   * Where on the frame the director is looking, in points from its top left corner. The square is
   * 96 and everything outside it goes down 18%; it walks to a new place over 300ms rather than
   * jumping, unless the phone asks for less movement.
   */
  gaze?: { left: number; top: number };
  /** «Режиссёр» — who is speaking. */
  who: string;
  /** «думает…» / «решил» — the same voice in two tenses. */
  standing?: string;
  /** What they are saying about this frame. */
  thought?: string;
  /** Still arriving: the thought carries the blinking cursor at the end of it. */
  typing?: boolean;
  /** The decision pill once there is one — `BadgeDecision`, handed in. */
  decision?: ReactNode;
  /** «Ждём очереди» — nothing is in hand, so there is no frame and no thought. */
  waiting?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.card, style]}>
      {waiting ? (
        <View style={styles.wait}>
          <Spinner size={26} />
          <Text role="note" tone="muted">
            {waiting}
          </Text>
        </View>
      ) : (
        <View style={styles.shot}>
          {uri ? (
            <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : null}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shotTop]} />
          {author || authorLine ? (
            <View style={[styles.plate, styles.plateLeft]}>
              {author ? <Avatar name={author} size={18} /> : null}
              <Text role="meta" style={styles.onPhoto}>
                {authorLine}
              </Text>
            </View>
          ) : null}
          {now ? (
            <View style={[styles.plate, styles.plateRight]}>
              <LiveDot />
              <Text role="badge" style={styles.onPhoto}>
                {now}
              </Text>
            </View>
          ) : null}
          {gaze ? <Gaze left={gaze.left} top={gaze.top} /> : null}
        </View>
      )}

      {waiting ? null : (
        <View style={styles.say}>
          <View style={styles.sayWho}>
            <SparkMark size={22} />
            <Text role="label">{who}</Text>
            {standing ? <Text role="meta">{standing}</Text> : null}
            <View style={styles.grow} />
            {decision}
          </View>
          {thought ? (
            // Spec 10.4: the square on the frame says nothing out loud, and what it is pointing at
            // is exactly what the thought is about — so the thought is the live area, and a screen
            // reader is told the director's sentence as it arrives rather than told about a square.
            <Text accessibilityLiveRegion="polite" role="note" tone="paper">
              {thought}
              {typing ? <Cursor /> : null}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * Spec 7.6 — `SheetLiveFile`'s own frame: the picture the director was looking at, at the size a
 * sheet has room for, and the square where the eye was. The square here neither walks nor dims what
 * is around it — the record it belongs to was decided long before the sheet was opened, and what
 * somebody came to this sheet for is the photograph itself.
 */
export function ShotGaze({
  uri,
  gaze,
  style,
}: {
  uri?: string;
  /** Where the square goes, in points from the frame's top left — `gazeAt` at {@link GAZE_SHEET}. */
  gaze?: { left: number; top: number };
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.shotSheet, style]}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      {gaze ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.gazeSheet, { left: gaze.left, top: gaze.top }]}
        />
      ) : null}
    </View>
  );
}

/**
 * The 96 square of `spark` over the frame, with everything outside it put out. Drawn as a huge
 * outward shadow rather than four dimming panels: one view, and the hole in it is the square itself.
 */
function Gaze({ left, top }: { left: number; top: number }) {
  const styles = useStyles();
  // 300ms and never a jump, which is the whole point: the eye is meant to be followed to the new
  // place, not found there. `useReach` is the product's one «go to this number» value, and under
  // reduced motion it sets instead of running.
  const x = useReach(left);
  const y = useReach(top);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.gaze, { left: x, top: y }]}
    />
  );
}

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

/** The `spark` circle with the sparkle in it — the director, wherever they speak. */
function SparkMark({ size }: { size: 20 | 22 }) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.sparkMark, { width: size, height: size }]}>
      <Icon icon={Sparkles} size={size === 22 ? 12 : 11} color={color.sparkInk} />
    </View>
  );
}

/**
 * Spec 7.6 — the director's thought as a plate: the sparkle, the sentence, and sometimes a second
 * line saying where it landed in the film. It is the same plate whether it holds the plan for a
 * whole stage or the conclusion about one file.
 */
export function NoteThought({
  text,
  outcome,
  style,
}: {
  text: string;
  /** «Часть 2 „Клятвы“ · 1:12–1:16 · крупный план» — where the thought ended up. */
  outcome?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.plateNote, style]}>
      <SparkMark size={20} />
      <View style={styles.grow}>
        <Text role="note" tone="paper">
          {text}
        </Text>
        {outcome ? (
          <Text role="meta" tone="accent" style={styles.outcome}>
            {outcome}
          </Text>
        ) : null}
      </View>
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
  typing,
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
  /** The freshest thought is still being said, so it carries the cursor. */
  typing?: boolean;
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
      {source ? <Text role="meta">{source}</Text> : null}
      {text ? (
        <Text role="note" tone="paper">
          {text}
          {typing ? <Cursor /> : null}
        </Text>
      ) : null}
      {marks ? <View style={styles.marks}>{marks}</View> : null}
    </>
  );

  return (
    <View style={styles.entry}>
      <View style={[styles.dot, fresh ? styles.dotFresh : null]} />
      <Text role="meta" tone={fresh ? 'paper' : 'faint'}>
        {time}
      </Text>
      {children ?? (
        // A record about a file opens that file's own card; one about a series or a thought alone
        // does not, so the press is only ever offered where there is somewhere to go.
        <Touch label={source ?? text ?? time} onPress={uri ? onPress : undefined}>
          {uri ? (
            <View style={styles.entryFile}>
              <View style={styles.shotSmall}>
                <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                {length ? (
                  <Text role="badgeSm" style={styles.shotLength}>
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
export function Journal({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
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
  label: string;
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
      style={({ pressed }) => [style, pressed && !reduced ? PRESS : null, focused ? focusRing : null]}
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
      <Text role="label" numberOfLines={1} style={styles.grow}>
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
 * They stand three to a row and say nothing on their own: «214» is an answer to «просмотрел».
 */
export function TileNumber({ figure, label }: { figure: string; label: string }) {
  const styles = useStyles();

  return (
    <View style={styles.number}>
      <Text role="figureTile">{figure}</Text>
      <Text role="meta">{label}</Text>
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
    wait: { height: SHOT, alignItems: 'center', justifyContent: 'center', gap: space.s3 },
    shot: { height: SHOT, backgroundColor: color.raise },
    shotSheet: {
      height: SHOT_SHEET,
      borderRadius: radius.field,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    gazeSheet: {
      position: 'absolute',
      width: GAZE_SHEET,
      height: GAZE_SHEET,
      borderWidth: 2,
      borderColor: color.spark,
      borderRadius: radius.cell,
    },
    // Only the top is darkened: the plates live up there and the frame itself is the point.
    shotTop: {
      experimental_backgroundImage:
        'linear-gradient(to bottom, rgba(9,9,14,0.55) 0%, rgba(9,9,14,0) 40%)',
    },
    plate: {
      position: 'absolute',
      top: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: radius.pill,
      backgroundColor: photo.plate,
    },
    plateLeft: { left: 10, paddingLeft: 5 },
    plateRight: { right: 10 },
    onPhoto: { color: photo.on },
    gaze: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderWidth: 2,
      borderColor: color.spark,
      borderRadius: radius.strip,
      // The frame is a hole: everything outside these 96 points goes down by 18%, in one view.
      boxShadow: '0 0 0 9999px rgba(9,9,14,0.18)',
    },
    say: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, gap: space.s2 },
    sayWho: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    sparkMark: {
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    outcome: { marginTop: space.s1 },
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.7 — the journal's own line runs 17 to the left of the words, and each record hangs its
    // dot on it. The line belongs to `Journal`, so a record only draws the dot.
    journal: { paddingLeft: 22, gap: 18 },
    journalLine: { position: 'absolute', left: 5, top: 8, bottom: 0, width: 1, backgroundColor: color.line },
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
    filmAt: {
      height: 40,
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
      flex: 1,
      gap: 2,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
  }),
);
