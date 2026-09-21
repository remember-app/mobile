import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, height, radius, space, themed } from '@/theme';

import { IconButton } from './button';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

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

/** Midnight, so two days compare by the day they land on and by nothing else. */
function key(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/**
 * Which half of a square the range's ribbon fills: all of it between the ends, the right half under
 * the first day, the left half under the last — so a range reads as one ribbon and not as three
 * separate marks. `null` at both ends of the question: no range, or a day outside it.
 */
function laneOf(at: number, start: number | null, end: number | null): Lane {
  // One day picked twice is one day, and one day is not a ribbon.
  if (start === null || end === null || end <= start) return null;
  if (at > start && at < end) return 'full';
  if (at === start) return 'right';
  if (at === end) return 'left';
  return null;
}

type Lane = 'left' | 'right' | 'full' | null;

/**
 * Every square of the grid: the days of the month, with as many blanks in front as the month needs
 * to start under its own weekday.
 */
function squares(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // `getDay()` counts from Sunday; the grid counts from Monday.
  const lead = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
}

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
  const today = key(new Date());
  const start = from ? key(from) : null;
  const end = to ? key(to) : null;

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
          // each day instead.
          <Text
            key={day}
            role="badge"
            tone="faint"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.weekday}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {squares(month).map((day, i) => {
          if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
          const at = key(day);
          const edge = at === start || at === end;
          return (
            <Day
              key={at}
              day={day}
              label={dayLabel(day)}
              edge={edge}
              lane={laneOf(at, start, end)}
              today={at === today}
              disabled={!!((min && at < key(min)) || (max && at > key(max)))}
              onPress={() => onPick(day)}
            />
          );
        })}
      </View>
    </View>
  );
}

function Day({
  day,
  label,
  edge,
  lane,
  today,
  disabled,
  onPress,
}: {
  day: Date;
  label: string;
  edge: boolean;
  lane: Lane;
  today: boolean;
  disabled: boolean;
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
      accessibilityState={{ disabled, selected: edge || lane === 'full' }}
      disabled={disabled}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.cell,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {lane ? (
        <View
          pointerEvents="none"
          style={[
            styles.lane,
            lane === 'right' ? styles.laneRight : null,
            lane === 'left' ? styles.laneLeft : null,
          ]}
        />
      ) : null}
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
          tone={disabled ? 'faint' : edge ? 'onFill' : 'paper'}
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
    head: { height: height.bar, flexDirection: 'row', alignItems: 'center' },
    month: { flex: 1, textAlign: 'center' },
    week: { height: 22, flexDirection: 'row', alignItems: 'center' },
    weekday: { flex: 1, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 },
    // A seventh of the row, and the row is the card: the grid measures itself, so it fits whatever
    // width it is given and a six-week month is as wide as a five-week one.
    cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
    // Spec 7.3 — the days between the ends: `accent` at 26%, laid under the figures rather than
    // mixed into a colour of its own.
    lane: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: color.accent,
      opacity: 0.26,
    },
    laneRight: { left: '50%' },
    laneLeft: { right: '50%' },
    day: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    today: { borderWidth: 1, borderColor: color.lineStrong },
    edge: { backgroundColor: color.accent },
    hover: { backgroundColor: color.raise },
    figure: { fontFamily: font.medium, fontSize: 15, fontVariant: ['tabular-nums'] },
    figureEdge: { fontFamily: font.bold },
  }),
);
