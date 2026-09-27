import { Image } from 'expo-image';
import { Children, type ReactNode, useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  PanResponder,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { night, photo, radius, space, themed, useTheme } from '@/theme';

import { useReach } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';

/**
 * Spec 7.9 — the small parts. None of them is a component in its own right on any screen; every one
 * of them is a piece another component is built from, and they live together so that the hairline in
 * a list and the hairline in a group heading cannot drift apart.
 */

/**
 * A 1px rule. `grow` is the version that stretches between a label and a count; `soft` is the one
 * drawn inside a list rather than between blocks — spec 7.10 gives those two different weights, and
 * a `line` hairline between every two rows of a long list reads as a grid.
 */
export function Divider({
  grow,
  soft,
  style,
}: {
  grow?: boolean;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.divider,
        soft ? styles.dividerSoft : null,
        grow ? styles.dividerGrow : null,
        style,
      ]}
    />
  );
}

/**
 * Things side by side in equal shares, 8 apart — «Сохранить» and «Поделиться» under a finished film,
 * its three number tiles, the day tiles of the filter (TASK-400). They stand as the layout draws them
 * until a word in any of them breaks at the phone's type size and width, and from then on one under
 * another, each the whole width (`useWordRoom`): a share of a row is only ever as wide as the row
 * over their number, and Yoga has no smallest width of a word to keep it from being narrower.
 */
export function Shares({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { roomy, way, room } = useWordRoom();

  return (
    <WordRoom.Provider value={room}>
      <View style={[shares.row, roomy ? shares.column : null, style]}>
        {Children.map(children, (child) =>
          child ? (
            <View key={way} style={roomy ? shares.whole : shares.share}>
              {child}
            </View>
          ) : null,
        )}
      </View>
    </WordRoom.Provider>
  );
}

const shares = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.s2 },
  column: { flexDirection: 'column' },
  share: { flex: 1, minWidth: 0 },
  // Stacked, each takes the width by stretching and not by a basis: Yoga keeps the basis it first
  // worked out for a node, and a new one would never reach the phone (TASK-375).
  whole: { flex: 0, alignSelf: 'stretch' },
});

/**
 * The 3px dot between two pieces of meta, and nowhere else in the product. Over a photograph it is
 * drawn in white at 45%, because `lineStrong` would disappear into the picture.
 */
export function MetaDot({ onPhoto }: { onPhoto?: boolean }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, onPhoto ? styles.dotOnPhoto : null]}
    />
  );
}

/**
 * The live dot (spec 7.4): 6px of `danger` — the one place in the product where that colour is not
 * danger but «right now». It stands before the count of who is watching and inside the «СЕЙЧАС» mark
 * on a frame, and it never blinks: a dot that blinks is asking to be looked at, and this one is only
 * saying that something is running.
 *
 * Hidden from screen readers: whatever it stands beside already says the word.
 */
export function LiveDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.live, style]}
    />
  );
}

/**
 * The wizard's step scale: equal 3px segments with 6 between them. The passed ones and the current
 * one are `accent`; the future ones are `line`.
 *
 * `tone="spark"` is the five-segment variant on the card of a montage being built, where what is
 * done is done rather than in hand — `spark` behind, `accent` on the one running now.
 *
 * `tone="paper"` is the onboarding's one progress (spec 7.1, detail 75): 4px, what is walked and
 * where the person stands in `paper` — «where I am», neither work nor the main action. It is the one
 * scale that stays on the screen while the steps change under it, so its fill moves (spec 6): the
 * next segment fills left to right, a jump fills every segment it passes in one movement, and a step
 * back empties the one it left the same way back.
 */
export function StepScale({
  steps,
  done,
  tone = 'accent',
  label,
  style,
}: {
  steps: number;
  /** How many are behind, the current one included. */
  done: number;
  tone?: 'accent' | 'spark' | 'paper';
  /** For a screen reader: «Шаг 3 из 5». The segments are not read one by one. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const reach = useReach(done);
  const paper = tone === 'paper';

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: paper ? 1 : 0, max: steps, now: done }}
      style={[styles.scale, style]}
    >
      {Array.from({ length: steps }, (_, i) =>
        paper ? (
          <View key={i} style={[styles.scaleStep, styles.scaleStepPaper]}>
            <Animated.View
              style={[
                styles.scaleFill,
                {
                  width: reach.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        ) : (
          <View
            key={i}
            style={[
              styles.scaleStep,
              i < done - 1 && tone === 'spark' ? styles.scaleSpark : null,
              i < done && (tone === 'accent' || i === done - 1) ? styles.scaleAccent : null,
            ]}
          />
        ),
      )}
    </View>
  );
}

/**
 * A progress bar: 4px filled in `spark` for what the participants have brought, 6px filled in
 * `accent` for what is being sent. It reaches for a new value over 300ms and never runs backwards
 * (spec 6), and it is never drawn without a number beside it — a bar on its own says nothing.
 */
export function Progress({
  value,
  tone = 'accent',
  onPhoto,
  label,
  style,
}: {
  /** 0…1 */
  value: number;
  tone?: 'accent' | 'spark';
  /** Over a cover the track is white at 22%, not `line`. */
  onPhoto?: boolean;
  /** For a screen reader: what this bar is counting. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, value));
  const width = useReach(clamped * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        styles.track,
        tone === 'spark' ? styles.trackThin : null,
        onPhoto ? styles.trackOnPhoto : null,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          tone === 'spark' ? styles.fillSpark : styles.fillAccent,
          { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/** How far one press of a screen reader's «increment» moves the bar — a twentieth of the film. */
const STEP = 0.05;

/** What a screen reader may do to a bar it can move, since it has no finger to drag it with. */
const STEPS = [{ name: 'increment' }, { name: 'decrement' }];

/**
 * The video scrubber (spec 7.9): timecode, the bar with its `spark` handle, the running time, and
 * the sound button. It stands on a line of its own above the filmstrip so that two horizontal
 * gestures never fight over the same finger.
 *
 * With `onSeek` the bar is dragged and pressed as well as read: the handle follows the finger from
 * the moment it lands anywhere along the line, and the film follows the handle. Without it the bar
 * only reports, which is what every other bar in the product does.
 */
export function VideoTrack({
  at,
  of,
  value,
  onSeek,
  sound,
  label,
}: {
  /** The timecode played so far, «0:24» — a number the screen formats. */
  at: string;
  /** The whole running time, «1:08». */
  of: string;
  /** 0…1 */
  value: number;
  /** Where the finger put it, 0…1. Given, the bar can be dragged and pressed; left off it cannot. */
  onSeek?: (value: number) => void;
  /** The sound button, 36 and round; handed in so this part knows nothing about buttons. */
  sound?: ReactNode;
  label?: string;
}) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, value));
  /**
   * Where the finger is holding the handle, and `null` when nothing is holding it. The film is
   * seeked all the way through the drag, but it answers back four times a second at best — so what
   * is drawn is the finger's own place until it lifts, or the handle would stutter behind it.
   */
  const [held, setHeld] = useState<number | null>(null);
  /** How wide the line is, measured rather than assumed: it is whatever the row leaves it. */
  const width = useRef(0);
  const shown = held ?? clamped;

  // `locationX` is the touch measured against the view it landed on, which is the pad and never
  // the line inside it: the line, the fill and the handle are all `none` to a finger, and the pad
  // is 36 tall around a 4px bar — a target nobody has to aim at (spec 10.2).
  const take = (e: GestureResponderEvent) => {
    const to =
      width.current === 0 ? 0 : Math.max(0, Math.min(1, e.nativeEvent.locationX / width.current));
    setHeld(to);
    onSeek?.(to);
  };

  // Rebuilt every render rather than remembered, and it costs nothing to: where the finger is comes
  // off the event itself, never off a tally this object keeps between one touch and the next.
  const pan = !onSeek
    ? null
    : PanResponder.create({
        // A press anywhere on the line is a seek to that point, and a drag carries on from there —
        // one gesture, so tapping and dragging cannot disagree about where the film goes.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Nothing around this bar scrolls sideways — the filmstrip is a line of its own below it —
        // so once the finger is on the handle it keeps it.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: take,
        onPanResponderMove: take,
        onPanResponderRelease: (e) => {
          take(e);
          setHeld(null);
        },
        onPanResponderTerminate: () => setHeld(null),
      });

  return (
    <View style={styles.videoRow}>
      <Text role="timecode" style={styles.elapsed}>
        {at}
      </Text>
      <View
        accessibilityRole={onSeek ? 'adjustable' : 'progressbar'}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
        accessibilityActions={onSeek ? STEPS : undefined}
        onAccessibilityAction={
          onSeek &&
          ((e) =>
            onSeek(
              Math.max(
                0,
                Math.min(1, shown + (e.nativeEvent.actionName === 'decrement' ? -STEP : STEP)),
              ),
            ))
        }
        style={styles.videoPad}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        {...pan?.panHandlers}
      >
        <View style={styles.videoTrack} pointerEvents="none">
          <View style={[styles.videoFill, { width: `${shown * 100}%` }]} />
          <View style={[styles.videoHandle, { left: `${shown * 100}%` }]} />
        </View>
      </View>
      <Text role="timecode" style={styles.runs}>
        {of}
      </Text>
      {sound}
    </View>
  );
}

/**
 * The stack of frames on the first onboarding step (spec 7.10, detail 76): three photographs at −9°,
 * +8° and −1.5°, the middle one larger, on top of the other two and hanging lower than them.
 *
 * It runs the width of the board: the side frames hang off its two edges, as the layout hangs them,
 * so a narrower phone overlaps them more instead of pushing them off the screen.
 */
export function PhotoStack({
  photos,
  style,
}: {
  /**
   * A url, or a picture that ships with the app — the onboarding screens stand before any session
   * and have no frames of a memory to draw. `expo-image` takes either unchanged (`src/image.d.ts`).
   */
  photos: readonly (string | number)[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const place = [styles.stackLeft, styles.stackCentre, styles.stackRight];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stack, style]}
    >
      {/* Keyed by place and not by what is in it: the three stand in fixed positions, and a picture
          that ships with the app is a number the bundler chose. */}
      {photos.slice(0, 3).map((shot, i) => (
        <Image key={i} source={shot} contentFit="cover" style={[styles.stackShot, place[i]]} />
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    divider: { height: 1, backgroundColor: color.line },
    dividerSoft: { backgroundColor: color.raise },
    dividerGrow: { flex: 1 },
    // `UploadLimited`: 1 of dashed `line` and no fill, 18 at the corners, 67 round one line of the
    // note's 19 — 23 over and under it inside the hairline, 16 at the sides.
    dashedNote: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.line,
      borderRadius: radius.field,
      paddingVertical: 23,
      paddingHorizontal: space.s4,
    },
    centred: { textAlign: 'center' },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color.lineStrong },
    dotOnPhoto: { backgroundColor: photo.dot },
    live: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.danger },
    scale: { flexDirection: 'row', gap: 6 },
    scaleStep: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: color.line },
    scaleStepPaper: { height: 4, overflow: 'hidden' },
    scaleFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.paper },
    scaleAccent: { backgroundColor: color.accent },
    scaleSpark: { backgroundColor: color.spark },
    track: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: color.line,
      overflow: 'hidden',
    },
    trackThin: { height: 4 },
    trackOnPhoto: { backgroundColor: photo.track },
    fill: { height: '100%', borderRadius: radius.pill },
    fillAccent: { backgroundColor: color.accent },
    fillSpark: { backgroundColor: color.spark },
    // Spec 7.10: 10 between the timecodes, the line and the sound.
    videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The line is 4 tall and the finger's share of it is 36 — the height of the sound button beside
    // it, so the row is no taller for being draggable.
    videoPad: { flex: 1, justifyContent: 'center', paddingVertical: space.s4 },
    videoTrack: { height: 4, borderRadius: radius.pill, backgroundColor: photo.videoTrack },
    videoFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.spark },
    videoHandle: {
      position: 'absolute',
      width: 14,
      height: 14,
      top: -5,
      marginLeft: -7,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
    },
    // Spec 7.10: what has played in the night's `paper`, the whole length a voice lower.
    elapsed: { color: night.paper },
    runs: { color: photo.viewerMeta },
    // Spec 7.10 — the box 176, and each frame where the layout puts it before it is turned: the side
    // ones hung 34 off their own edge of the board, the middle one centred. Past the layout's 390 the
    // stack stays that wide rather than pulling its frames apart; what reaches over its box is cut,
    // as the layout cuts it.
    stack: { width: '100%', maxWidth: 390, height: 176, alignItems: 'center', overflow: 'hidden' },
    stackShot: { position: 'absolute' },
    stackLeft: {
      left: 34,
      top: 12,
      width: 116,
      height: 144,
      borderRadius: radius.cell,
      transform: [{ rotate: '-9deg' }],
    },
    stackCentre: {
      top: 16,
      width: 136,
      height: 158,
      borderRadius: radius.field,
      zIndex: 1,
      transform: [{ rotate: '-1.5deg' }],
    },
    stackRight: {
      right: 34,
      top: 6,
      width: 116,
      height: 144,
      borderRadius: radius.cell,
      transform: [{ rotate: '8deg' }],
    },
  }),
);

/**
 * A dashed plate with one quiet line in it, where there is something the screen may not show — the
 * rest of a day under a partial grant (spec 8, `UploadLimited`). Hollow, unlike the empty strip
 * below: nothing here is missing, it is only out of sight.
 */
export function DashedNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.dashedNote, style]}>
      {/* 13 / 500 `muted` (spec 8, `UploadLimited`; 10.1 for the layout's `faint`). */}
      <Text role="note" style={styles.centred}>
        {text}
      </Text>
    </View>
  );
}

/** The dashed empty frame the layout puts where a strip of photographs would be (spec 7.6). */
export function DashedFrame({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: color.dashed,
          borderRadius: radius.strip,
          backgroundColor: color.raise,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s2,
          padding: space.s4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
