import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { photo, radius } from '@/theme';

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
  limited,
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
  /** The count is about what the phone will not show, so it is drawn back rather than forward. */
  limited?: boolean;
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
      {/* 10 / 12 / 600 with a hair of tracking (spec 7.8, `MemoryDated`, `FramesByPeople`): the
          words of a seam are a quiet line, not the bold caps of a badge. */}
      <Text role="seam" tone={lone ? 'muted' : 'paper'} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {count ? (
        <Text role="badgeSm" tone={limited || onPress ? 'faint' : 'muted'} style={styles.count}>
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
  // of it in both directions, so taking a whole day never costs the grid a row.
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
 * Spec 7.8 — the date spine: a hairline down the right edge of the feed with a pill on it at every
 * seam where a day begins. It lies over the photographs rather than between them, so a feed of a
 * thousand frames can still be read by date without a single row being spent on saying so.
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
          <View style={styles.spinePill}>
            <Text role="badgeSm" style={styles.spineText}>
              {mark.label}
            </Text>
          </View>
          <View style={styles.spineDash} />
          <View style={styles.spineDot} />
        </View>
      ))}
    </View>
  );
}

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
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  // A long day never pushes the count off the band; the count itself never wraps.
  label: { flexShrink: 1 },
  count: { flexShrink: 0 },
  spine: { position: 'absolute', top: 0, bottom: 0, right: 12, width: 1 },
  spineLine: { flex: 1, width: 1, backgroundColor: photo.spine },
  spineMark: {
    position: 'absolute',
    right: 0,
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
  spineText: { color: photo.spineMark, lineHeight: 16 },
  spineDash: { width: 8, height: 1, backgroundColor: photo.spineTick },
  spineDot: {
    width: 4,
    height: 4,
    marginRight: -1.5,
    borderRadius: radius.pill,
    backgroundColor: photo.spineDot,
  },
});
