import type { ReactNode } from 'react';
import {
  type CellRendererProps,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { photo, radius, space } from '@/theme';

import { Divider } from './bits';
import { useFocusRing, useHoverFocus } from './interaction';
import { Avatar } from './member';
import { Text } from './text';
import { PickCircle } from './tile';

/**
 * Spec 7.8 — the 20px seam between two grids of frames, and the overlay that says the same thing
 * while a finger is dragging the feed. Both are about one question — «where does this day start» —
 * and both answer it without ever taking a row away from the photographs.
 */

/**
 * The day gap (spec 7.8): a 20px band between two grids, read in the middle rather than at the left
 * edge, because the grid under it runs to both edges and a heading hanging off one of them would
 * look like it belonged to the frame below it. Three kinds:
 *
 * - **a day** — «13 сентября, суббота»;
 * - **a person** — their circle at 16, ringed in `spark` if they are the organizer, and a count;
 * - **a day that picks** — with `onPress`, the whole band becomes a 44 button that takes the day
 *   and gives it back, and a 13 circle stands in front of the date saying which it is now.
 */
export function DayMark({
  label,
  count,
  avatar,
  organizer,
  picked,
  onPress,
  pressLabel,
  style,
}: {
  label: string;
  /** The count on the right — «174 кадра», «112 фото», «61». */
  count?: string;
  /** A person's name: the band then carries their circle in front of the label. */
  avatar?: string;
  organizer?: boolean;
  /** Whether the whole day is taken. Only means anything beside `onPress`. */
  picked?: boolean;
  /** Takes the whole day, and takes it back — `Upload` is the one screen that has this. */
  onPress?: () => void;
  /** What that press is called out as, since the band's own words are a date and a number. */
  pressLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const focusRing = useFocusRing();

  // A date on its own is a quiet marker between two walls of frames (spec 7.8, `MemoryDated`); a
  // label that leads something — a person, a count, the day's own switch — is read in `paper`.
  const lone = !avatar && !count && !onPress;

  const inner = (
    <>
      {onPress ? <PickCircle kind={picked ? 'send' : 'off'} size={13} /> : null}
      {avatar ? <Avatar name={avatar} size={16} ring={organizer} /> : null}
      {/* Spec 3, `day`: 10 / 12 / 600 with a hair of tracking (`MemoryDated`, `FramesByPeople`,
          `Upload`) — the words of a seam are a quiet line, not the bold caps of a badge. */}
      <Text role="day" tone={lone ? 'muted' : 'paper'} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {/* 10 / 12 / 500 `muted` beside every kind (spec detail 65; the layout's `faint` in `Upload`
          is under the floor for words that are read, 10.1). */}
      {count ? (
        <Text role="dayCount" tone="muted" style={styles.count}>
          {count}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="header" style={[styles.mark, style]}>
        {inner}
      </View>
    );
  }

  // Drawn 20 and felt 44 (spec 7.8): the band keeps its height in the flow and the button grows out
  // of it in both directions, so taking a whole day never costs the grid a row — and it runs the
  // width of the screen, not of its words (`Upload`: the button is 390 across).
  return (
    <View style={[styles.mark, style]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!picked }}
        accessibilityLabel={pressLabel ?? label}
        onPress={onPress}
        {...props}
        style={[styles.band, focused ? focusRing : null]}
      >
        {inner}
      </Pressable>
    </View>
  );
}

/**
 * The cell a feed with seams in it draws each row in — `CellRendererComponent` of its list. A seam
 * that picks is a 44 band over a 20 strip, spilling 12 onto the rows either side, and in that spill
 * it wins over the frames (spec 7.8, detail 65); a list stacks every row over the one before it, so
 * the seam's own cell is lifted over both. A frame's circle is centred 19 down, clear of the spill,
 * so the frame is still picked where its circle is.
 */
export function seamsOver<Row>(isSeam: (row: Row) => boolean) {
  return function SeamCell({
    item,
    style,
    children,
    cellKey,
    index,
    ...rest
  }: CellRendererProps<Row>) {
    return (
      <View {...rest} style={[style, isSeam(item) ? styles.over : null]}>
        {children}
      </View>
    );
  };
}

/**
 * The heading of a day over the send queue's grid (spec 8, `UploadQueue`, `UploadLimited`): the day
 * on the left in `label`, a hairline running to what stands at the end — the count of the day in
 * `muted`, or the button that takes all of it. Not a seam: that grid stands in the screen's margins,
 * so the day reads off the left edge like any heading of a list.
 *
 * 17 clear above and below whatever it holds, and never under 56: `UploadLimited` draws the bare
 * heading 56 tall, `UploadQueue` the one with the 44 button 78 from the block over it to the grid.
 * The row wraps, so on large type the button goes under the day rather than past the edge.
 *
 * `eyebrow` is the same rule over a list rather than a day: «СОХРАНЁННЫЕ» on `Contacts` — the words
 * in the eyebrow the caller writes in caps, the count at the far end, 34 tall (`Contacts.html`).
 */
export function DayHead({
  label,
  count,
  eyebrow,
  children,
  style,
}: {
  label: string;
  /** «3 кадра» — what the day holds, where there is no button to take it. */
  count?: string;
  eyebrow?: boolean;
  /** «Выбрать все 61» — `small`, the one button that stands in the heading. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.head, eyebrow ? styles.headList : null, style]}>
      <Text role={eyebrow ? 'eyebrow' : 'label'} accessibilityRole="header">
        {label}
      </Text>
      <Divider grow />
      {/* 12 / 500 `muted` (spec detail 65, `UploadLimited`; 10.1 for the layout's `faint`). */}
      {count ? <Text role="meta">{count}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Spec 7.8 — the date spine: a hairline down the left edge of the feed with a pill on it at every
 * seam where a day begins. It lies over the photographs rather than between them, so a feed of a
 * thousand frames can still be read by date without a single row being spent on saying so.
 *
 * The left edge and not the right: the spine stands where the thumb is while a finger is reading
 * the date under it, and a mark a palm is resting on is a mark not read. Each mark runs off the
 * line to the right — the dot on the hairline, then the tick, then the words.
 *
 * Where each mark stands is the screen's arithmetic — it is the one thing here that needs to know
 * how tall a row is — so a mark arrives with its own `top` already worked out.
 */
export function DateSpine({
  marks,
  style,
}: {
  /** Each day and how far down the feed it starts, in points from the top of the list. */
  marks: readonly { label: string; top: number }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    // The dates are in the gaps as well for anyone who cannot see this, so the spine itself is not
    // read out: it is a way of moving, not a thing to be told about.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.spine, style]}
    >
      <View style={styles.spineLine} />
      {marks.map((mark) => (
        <View key={`${mark.label}-${mark.top}`} style={[styles.spineMark, { top: mark.top }]}>
          {/* Off the line and away from it: the dot on the hairline, then the tick, then the words. */}
          <View style={styles.spineDot} />
          <View style={styles.spineDash} />
          <View style={styles.spinePill}>
            <Text role="day" style={styles.spineText}>
              {mark.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** How far the spine's line stands in from the left edge of the feed (`MemoryScrub`). */
const SPINE_LEFT = 12;

/**
 * No `themed()` in this file: every colour the seam and the spine draw in belongs to the photograph
 * under them, and `photo` is the same in both themes on purpose (spec 2). The words go through
 * `Text`, which is what pairs a role with the theme's own ink.
 */
const styles = StyleSheet.create({
  mark: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  band: {
    height: 44,
    marginVertical: -12,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  over: { zIndex: 1 },
  // A long day never pushes the count off the band; the count itself never wraps.
  label: { flexShrink: 1 },
  count: { flexShrink: 0 },
  // The line in the middle of the 56 and not at its top: a row that wraps stacks its lines from the
  // top of what is over them, and the bare heading of `UploadLimited` stood 3 high in it — 17 under
  // the plate, where the layout has its words 19.5 under it and 19.5 over the grid (TASK-397).
  head: {
    minHeight: 56,
    paddingVertical: 17,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    gap: space.s3,
  },
  // The eyebrow's 16 and 9 over and under it — a floor, it grows with the type.
  headList: { minHeight: 34, paddingVertical: 9 },
  // The layer is as wide as the feed and the line is drawn in it, 12 off the left edge — not a
  // layer 1 wide: an absolute child of a column is held to its parent's width on iOS, and a mark
  // hung in a 1-wide spine measured its words in 1 and drew «13» of «13 сент», its tick and dot
  // past the line (TASK-397, R'12).
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SPINE_LEFT,
    width: 1,
    backgroundColor: photo.spine,
  },
  spineMark: {
    position: 'absolute',
    left: SPINE_LEFT,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinePill: {
    height: 16,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: photo.plateQuiet,
  },
  // Spec 7.8, detail 66: the date 10 / 16 / 600, untracked (`MemoryScrub.json` e29).
  spineText: { color: photo.spineMark, lineHeight: 16, letterSpacing: 0 },
  spineDash: { width: 8, height: 1, backgroundColor: photo.spineTick },
  spineDot: {
    width: 4,
    height: 4,
    marginLeft: -1.5,
    borderRadius: radius.pill,
    backgroundColor: photo.spineDot,
  },
});
