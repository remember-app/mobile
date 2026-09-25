import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, Chip, Hint, Text } from '@/kit';
import {
  daysBefore,
  formatDay,
  formatEventDates,
  formatMonth,
  lastWeekend,
  startOfDay,
  weekdayLetters,
} from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';

/** The days a memory stands on, as the calendar holds them: whole local days. */
export type Span = {
  from: Date;
  /** The last day, when the span has one. `null` is a memory that happened on a single day. */
  to: Date | null;
};

/**
 * What the calendar makes of one touched day, which is the whole of the gesture (spec 7.3, detail
 * 15). An open span closes on anything after its first day; a day before it is the first tap being
 * corrected rather than a span running backwards, and a closed span starts over.
 */
export function pickDay(span: Span, day: Date): Span {
  const picked = startOfDay(day);
  return span.to === null && picked > startOfDay(span.from)
    ? { from: span.from, to: picked }
    : { from: picked, to: null };
}

/**
 * How many days a span covers, both ends counted — «3 дня» beside «12–14 сентября». Over whole days
 * and not over hours, so a clock change inside the span cannot make three days read as two.
 */
export function daysIn({ from, to }: Span): number {
  if (to === null) return 1;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1;
}

/**
 * What the four quick days hand over, each a whole answer: both ends at once. «Выходные» are the
 * weekend just gone, and on a Saturday that is the Saturday alone — a span that ends on the day it
 * began is a single day, so it comes back with no end at all, the same shape a tap on the calendar
 * makes. Left as `to === from`, the create screen would send an end for one day and the edit screen
 * would see a change where there is none.
 *
 * «Неделя» is the week behind, today included — seven days and not «this calendar week», which on a
 * Monday would be one day long.
 */
export function quickSpans(today: Date): Record<'today' | 'yesterday' | 'weekend' | 'week', Span> {
  const weekend = lastWeekend(today);
  return {
    today: { from: today, to: null },
    yesterday: { from: daysBefore(today, 1), to: null },
    weekend: { from: weekend.from, to: weekend.to > weekend.from ? weekend.to : null },
    week: { from: daysBefore(today, 6), to: today },
  };
}

/**
 * «Когда это было» — the one block `Create` and `MemoryEdit` are both built round (spec 10.8.3: the
 * same, without a single change). The span written out beside its own eyebrow, four quick days, the
 * calendar, and one line under it saying how the thing is worked.
 *
 * There is no switch for «больше дня» and no second field for the end: one day is one tap, a span is
 * two, and a third starts over. A memory cannot have happened tomorrow, so nothing past today
 * answers at all.
 */
export function EventWhen({
  value,
  onChange,
  disabled,
}: {
  value: Span;
  onChange: (span: Span) => void;
  disabled?: boolean;
}) {
  const s = useStrings();
  const today = startOfDay(new Date());
  const days = daysIn(value);
  // Which month the grid is showing, and nothing else — so paging with the arrows past a span longer
  // than a month never touches what is picked (spec 8, «Края»).
  const [month, setMonth] = useState(value.from);
  // A quick day can land in another month, and closing a span never makes a new `from` — so the grid
  // follows the first day of the span, and only when that day is itself replaced.
  useEffect(() => setMonth(value.from), [value.from]);

  const spans = quickSpans(today);
  const quick = [
    { label: s.create.today, span: spans.today },
    { label: s.create.yesterday, span: spans.yesterday },
    { label: s.create.weekend, span: spans.weekend },
    { label: s.create.week, span: spans.week },
  ];

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text role="eyebrow" accessibilityRole="header" style={styles.grow}>
          {s.create.eventDate.toUpperCase()}
        </Text>
        <Text role="controlSm" style={styles.picked}>
          {formatEventDates(value.from.toISOString(), value.to?.toISOString() ?? null)}
          {/* Spec 8, «Края»: one day is one date, with no length hung off it. */}
          {days > 1 ? <Text role="chip" tone="muted">{` · ${s.create.days(days)}`}</Text> : null}
        </Text>
      </View>

      <View style={styles.quick}>
        {quick.map((day) => (
          <Chip
            key={day.label}
            label={day.label}
            size={36}
            disabled={disabled}
            onPress={() => onChange(day.span)}
          />
        ))}
      </View>

      <Calendar
        month={month}
        onMonth={setMonth}
        from={value.from}
        to={value.to}
        onPick={(day) => onChange(pickDay(value, day))}
        // A memory cannot be of tomorrow, so the days after this one do not answer.
        max={today}
        weekdays={weekdayLetters()}
        monthLabel={formatMonth(month)}
        prevLabel={s.create.prevMonth}
        nextLabel={s.create.nextMonth}
        // The whole date out loud, year and all: the grid's own heading is not read with it.
        dayLabel={formatDay}
      />

      <Hint>{s.create.dateHint}</Hint>
    </View>
  );
}

// Shape only: every colour in here belongs to the chips, the calendar and the words themselves.
const styles = StyleSheet.create({
  // Spec 10.8.3, the rhythm of `Create`: 10 between the eyebrow, the chips, the grid and the line.
  block: { gap: 10 },
  // The heading on the left, the days on the right — and the days under it, whole, once both do not
  // fit on one line: a long range, or large type (TASK-377).
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.s3 },
  grow: { flexGrow: 1 },
  picked: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  quick: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s2 },
});
