import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, Chip, Text } from '@/kit';
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
export type Span = {
  from: Date;
  to: Date | null;
};
export function pickDay(span: Span, day: Date): Span {
  const picked = startOfDay(day);
  return span.to === null && picked > startOfDay(span.from)
    ? { from: span.from, to: picked }
    : { from: picked, to: null };
}
export function daysIn({ from, to }: Span): number {
  if (to === null) return 1;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1;
}
export function quickSpans(today: Date): Record<'today' | 'yesterday' | 'weekend' | 'week', Span> {
  const weekend = lastWeekend(today);
  return {
    today: { from: today, to: null },
    yesterday: { from: daysBefore(today, 1), to: null },
    weekend: { from: weekend.from, to: weekend.to > weekend.from ? weekend.to : null },
    week: { from: daysBefore(today, 6), to: today },
  };
}
export const ASIDE_BLEED = 5;
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
  const [month, setMonth] = useState(value.from);
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
        <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.grow}>
          {s.create.eventDate.toUpperCase()}
        </Text>
        <Text role="rowSm" style={styles.picked}>
          {formatEventDates(value.from.toISOString(), value.to?.toISOString() ?? null)}

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
        max={today}
        weekdays={weekdayLetters()}
        monthLabel={formatMonth(month)}
        prevLabel={s.create.prevMonth}
        nextLabel={s.create.nextMonth}
        dayLabel={formatDay}
        style={styles.grid}
      />

      <Text role="aside" tone="muted" style={styles.aside}>
        {s.create.dateHint}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  block: { gap: 10 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.s3 },
  grow: { flexGrow: 1 },
  picked: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.s2,
  },
  grid: { marginTop: 2 },
  aside: { marginRight: -ASIDE_BLEED },
});
