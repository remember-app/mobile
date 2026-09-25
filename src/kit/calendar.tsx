import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { font, height, radius, space, themed } from '@/theme';

import { IconButton } from './button';
import { dayKey, ribbonOf, weeksOf } from './calendar-grid';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { fitCell, Text } from './text';

/** The circle a day's figure stands in, and the cell's height at the system's own type (spec 7.3). */
const DAY = 40;

/**
 * Spec 7.3, detail 15 — the calendar. It replaced the field that opened the phone's own picker: a
 * memory is one day or a few, and the fastest way to say «12th to the 14th» is to touch the 12th and
 * then the 14th. So there is no switch for «больше дня» and no second field for the end — the first
 * tap sets a day, the second closes the range, the third starts over.
 *
 * Wordless like everything else here: the month's name, the seven weekday letters and the sentence
 * each day is read out under all arrive from the screen, which is where the language lives. The week
 * starts on Monday, which is how the layout draws it and how the weekday letters must be handed in.
 */
export type CalendarProps = {
  /** Any day of the month being shown — the grid is built around it. */
  month: Date;
  onMonth: (month: Date) => void;
  /** The day picked, or the first of the range. */
  from: Date | null;
  /** The last day of the range, when there is one. */
  to?: Date | null;
  /** A day was touched. Which of the three taps it is belongs to the screen, not to the drawing. */
  onPick: (day: Date) => void;
  /** Nothing before this can be touched. */
  min?: Date;
  /** Nothing after it either: a memory cannot have happened tomorrow. */
  max?: Date;
  /** «ПН»…«ВС», Monday first. */
  weekdays: readonly string[];
  /** «Сентябрь 2026». */
  monthLabel: string;
  /** What the two month buttons are called. */
  prevLabel: string;
  nextLabel: string;
  /** «12 сентября» — how one day is read out. */
  dayLabel: (day: Date) => string;
  style?: StyleProp<ViewStyle>;
};

export function Calendar({
  month,
  onMonth,
  from,
  to,
  onPick,
  min,
  max,
  weekdays,
  monthLabel,
  prevLabel,
  nextLabel,
  dayLabel,
  style,
}: CalendarProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  // Seven columns share the card whatever the type (`fitCell`). A figure stands in its day's circle
  // and the circle in its column; the letters over them stand in the column alone.
  const [column, setColumn] = useState(0);
  const figure = fitCell({
    fontScale,
    width: Math.min(column, DAY),
    role: 'bodySm',
    em: FIGURES_EM,
    rest: DAY,
  });
  const letters = fitCell({
    fontScale,
    width: column,
    role: 'badge',
    em: LETTERS_EM,
    rest: 0,
  }).most;
  const today = dayKey(new Date());
  const start = from ? dayKey(from) : null;
  const end = to ? dayKey(to) : null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <IconButton
          icon={ChevronLeft}
          label={prevLabel}
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        />
        <Text role="section" accessibilityRole="header" style={styles.month}>
          {monthLabel}
        </Text>
        <IconButton
          icon={ChevronRight}
          label={nextLabel}
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        />
      </View>

      <View style={styles.week}>
        {weekdays.map((day) => (
          // The letters repeat what the column already says; a screen reader gets the whole date off
          // each day instead. Read, so `muted` and not the layout's `faint` (spec 7.3, 10.1).
          <Text
            key={day}
            role="badge"
            tone="muted"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            maxFontSizeMultiplier={letters}
            style={styles.weekday}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid} onLayout={(e) => setColumn(e.nativeEvent.layout.width / 7)}>
        {weeksOf(month).map((week, w) => {
          const ribbon = ribbonOf(week, start, end);
          return (
            <View key={w} style={styles.weekRow}>
              {/* Spec 7.3: the days between the ends lie on one ribbon, drawn under the week whole —
                  a piece per day left a seam wherever two of them met. Its ends round off where they
                  meet the week's edge rather than a circle. */}
              {ribbon ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.ribbon,
                    {
                      left: `${(ribbon.from / 7) * 100}%`,
                      right: `${((7 - ribbon.to) / 7) * 100}%`,
                    },
                    ribbon.from % 1 === 0 ? styles.ribbonStart : null,
                    ribbon.to % 1 === 0 ? styles.ribbonEnd : null,
                  ]}
                />
              ) : null}
              {week.map((day, i) => {
                if (!day)
                  return (
                    <View key={`blank-${i}`} style={[styles.cell, { height: figure.height }]} />
                  );
                const at = dayKey(day);
                return (
                  <Day
                    key={at}
                    day={day}
                    label={dayLabel(day)}
                    edge={at === start || at === end}
                    inside={start !== null && end !== null && at > start && at < end}
                    today={at === today}
                    disabled={!!((min && at < dayKey(min)) || (max && at > dayKey(max)))}
                    figure={figure}
                    onPress={() => onPick(day)}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * How wide the widest pair of figures (tabular «28») and of weekday letters («ПН» with the badge's
 * tracking) run, in em of their own size — measured off Onest.
 */
const FIGURES_EM = 1.35;
const LETTERS_EM = 1.8;

function Day({
  day,
  label,
  edge,
  inside,
  today,
  disabled,
  figure,
  onPress,
}: {
  day: Date;
  label: string;
  edge: boolean;
  /** Between the two ends of a range, on its ribbon. */
  inside: boolean;
  today: boolean;
  disabled: boolean;
  figure: ReturnType<typeof fitCell>;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: edge || inside }}
      disabled={disabled}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.cell,
        { height: figure.height },
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <View
        style={[
          styles.day,
          today && !edge ? styles.today : null,
          edge ? styles.edge : null,
          hovered && !edge && !disabled ? styles.hover : null,
        ]}
      >
        <Text
          role="bodySm"
          tone={disabled ? 'dayOff' : edge ? 'onFill' : 'paper'}
          maxFontSizeMultiplier={figure.most}
          style={[styles.figure, edge ? styles.figureEdge : null]}
        >
          {day.getDate()}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      paddingTop: space.s1,
      paddingHorizontal: space.s3,
      paddingBottom: space.s3,
      gap: space.s1,
    },
    // Floors and not heights: a month's name on large type takes more than one line.
    head: { minHeight: height.bar, flexDirection: 'row', alignItems: 'center' },
    month: { flex: 1, textAlign: 'center' },
    week: { minHeight: 22, flexDirection: 'row', alignItems: 'center' },
    // `ПН…ВС` 11 / 600 with the badge's 0.06em (`Create.json` e20…e26).
    weekday: { flex: 1, textAlign: 'center', fontFamily: font.semi },
    grid: { gap: 2 },
    weekRow: { flexDirection: 'row' },
    // A seventh of the row, and the row is the card: the grid measures itself, so it fits whatever
    // width it is given and a six-week month is as wide as a five-week one. How tall — `fitCell`.
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Spec 7.3 — the days between the ends: `accent` at 26%, laid under the figures rather than
    // mixed into a colour of its own.
    ribbon: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: color.accent,
      opacity: 0.26,
    },
    // The circle's own curve (`Create.json`: 20 at the ends of the 13th and the 14th).
    ribbonStart: { borderTopLeftRadius: DAY / 2, borderBottomLeftRadius: DAY / 2 },
    ribbonEnd: { borderTopRightRadius: DAY / 2, borderBottomRightRadius: DAY / 2 },
    day: {
      width: DAY,
      height: DAY,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    today: { borderWidth: 1, borderColor: color.lineStrong },
    edge: { backgroundColor: color.accent },
    hover: { backgroundColor: color.raise },
    figure: { fontFamily: font.medium, fontVariant: ['tabular-nums'] },
    figureEdge: { fontFamily: font.bold },
  }),
);
