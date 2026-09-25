import { Pressable, StyleSheet, View } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.3, detail 74 — a day of the filter's «День» block: the figure of the day and its weekday on
 * top, and under them a bar of how much the day holds beside the fullest day of the memory and the
 * count in words. By the bar alone one sees where the material is and where there is next to none.
 *
 * Tiles share their row evenly (`flex: 1`), so one tile or two run the whole width of it.
 *
 * Chosen is `paper` and `ink` — a choice that goes nowhere (spec 1, rule 7). The quieter lines on a
 * chosen tile are the tile's own `ink` thinned, never a colour of their own, so they swap with the
 * theme along with the fill.
 */
export function DayTile({
  day,
  weekday,
  count,
  fill,
  label,
  selected,
  onPress,
}: {
  /** «13» */
  day: string;
  /** «сб» */
  weekday: string;
  /** «312 кадров» — declined by the screen. */
  count: string;
  /** 0–1: this day's material beside the fullest day of the memory, which is 1. */
  fill: number;
  /** Everything in words, the way it is read out: «13 сентября, сб, 312 кадров». */
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const figure = { color: selected ? color.ink : color.paper };
  const quiet = selected ? { color: color.ink, opacity: 0.62 } : { color: color.muted };
  const width = `${Math.round(Math.min(Math.max(fill, 0), 1) * 100)}%` as const;

  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.tile,
        selected ? styles.chosen : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <View style={styles.top}>
        <Text role="figureDay" numberOfLines={1} style={figure}>
          {day}
        </Text>
        <Text role="metaTile" numberOfLines={1} style={quiet}>
          {weekday}
        </Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.bar}>
          {/* The chosen track is the tile's `ink` at 16%: laid under the fill rather than mixed into
              it, so the fill on top of it stays whole. */}
          <View style={[StyleSheet.absoluteFill, selected ? styles.trackChosen : styles.track]} />
          <View
            style={[styles.fill, { width, backgroundColor: selected ? color.ink : color.faint }]}
          />
        </View>
        <Text role="metaTile" numberOfLines={1} style={quiet}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // 86 is the tile as drawn; the largest system type only ever makes it taller, never lets its
    // words out of it.
    tile: {
      flex: 1,
      minWidth: 0,
      minHeight: height.dayTile,
      paddingVertical: 10,
      paddingHorizontal: 11,
      justifyContent: 'space-between',
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.ink,
    },
    chosen: { backgroundColor: color.paper, borderColor: color.paper },
    top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 },
    bottom: { gap: 5 },
    bar: { height: space.s1, borderRadius: radius.pill, overflow: 'hidden' },
    track: { backgroundColor: color.raise },
    trackChosen: { backgroundColor: color.ink, opacity: 0.16 },
    fill: { height: '100%', borderRadius: radius.pill },
  }),
);
