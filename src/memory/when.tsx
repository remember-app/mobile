import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDay, formatEventDates, formatMonth, startOfDay } from '@/dates';
import { Calendar, Chip, Hint, Text } from '@/kit';
import { useStrings } from '@/language';
import { space } from '@/theme';

/**
 * «Когда это было» — the block `Create` is built round and `MemoryEdit` repeats without a single
 * change (spec 10.8.3): the span written out on the right of its own eyebrow, four quick chips, the
 * calendar, and one line under it saying how it is worked. Here rather than inside either screen
 * because it is one block standing on two of them, and the day the two differ is the day one of them
 * is wrong.
 *
 * There is no switch for «больше дня» and no second field for the end: one day is one tap, a span is
 * two, and a third tap starts over (`pickDay`). A memory cannot have happened tomorrow, so nothing
 * past today can be touched at all.
 */
export type Span = {
  from: Date;
  /** The last day, when the span has one. `null` is a memory that happened on a single day. */
  to: Date | null;
};

/**
 * What the calendar makes of one touched day, which is the whole of the gesture (spec 7.3, detail
 * 15). An open span closes on anything at or after its first day; a day before it becomes the new
 * first day rather than an upside-down span, and a closed span starts over.
 */
export function pickDay(span: Span, day: Date): Span {
  const picked = startOfDay(day);
  if (span.to !== null) return { from: picked, to: null };
  return picked < startOfDay(span.from)
    ? { from: picked, to: null }
    : { from: span.from, to: picked };
}

/** How many days a span covers, both ends counted — «3 дня» beside «12–14 сентября». */
export function daysIn({ from, to }: Span): number {
  if (to === null) return 1;
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

const DAY_MS = 86_400_000;
const shift = (day: Date, by: number) => startOfDay(new Date(day.getTime() + by * DAY_MS));

/**
 * The four quick answers of the layout, each worked out from today rather than stored: «Сегодня»,
 * «Вчера», «Выходные» — the last Saturday and Sunday that have actually happened — and «Неделя»,
 * the seven days ending today.
 */
function quickSpans(today: Date): { key: keyof Quick; span: Span }[] {
  // Saturday is day 6; `(day + 1) % 7` is how many days back the most recent one is, and on a
  // Saturday that is none — the Sunday after it has not happened yet, so the span is the one day.
  const saturday = shift(today, -((today.getDay() + 1) % 7));
  const sunday = shift(saturday, 1);
  return [
    { key: 'today', span: { from: today, to: null } },
    { key: 'yesterday', span: { from: shift(today, -1), to: null } },
    { key: 'weekend', span: { from: saturday, to: sunday > today ? null : sunday } },
    { key: 'week', span: { from: shift(today, -6), to: today } },
  ];
}

type Quick = { today: string; yesterday: string; weekend: string; week: string };

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
  // Which month the grid is showing is the calendar's own business and not the span's: the arrows
  // move it without touching what is picked, which is how a span longer than a month is read.
  const [month, setMonth] = useState(value.from);
  // But a quick chip can land in another month, and closing a span never makes a new `from` — so
  // this follows the first day of the span and only when that day is itself replaced.
  useEffect(() => setMonth(value.from), [value.from]);

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.grow}>
          {s.when.label.toUpperCase()}
        </Text>
        {/* «12–14 сентября · 3 дня»: the span in the screen's own voice, the count after it a
            shade quieter. One day counts nothing — the date already says it. */}
        <Text role="controlSm" numberOfLines={1} style={styles.span}>
          {formatEventDates(value.from.toISOString(), value.to?.toISOString() ?? null)}
          {days > 1 ? <Text role="meta">{` · ${s.when.days(days)}`}</Text> : null}
        </Text>
      </View>

      <View style={styles.quick}>
        {quickSpans(today).map(({ key, span }) => (
          <Chip
            key={key}
            size={36}
            label={s.when[key]}
            disabled={disabled}
            onPress={() => onChange(span)}
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
        weekdays={s.when.weekdays}
        monthLabel={formatMonth(month)}
        prevLabel={s.when.prevMonth}
        nextLabel={s.when.nextMonth}
        dayLabel={(day) => formatDay(day)}
      />

      <Hint>{s.when.hint}</Hint>
    </View>
  );
}

// Shape only: every colour in here belongs to the chips, the calendar and the words themselves.
const styles = StyleSheet.create({
  // Spec 10.8.3, the rhythm of `Create`: 10 between the eyebrow, the row of chips, the grid and the
  // line under it.
  block: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3 },
  grow: { flex: 1, minWidth: 0 },
  span: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  quick: { flexDirection: 'row', justifyContent: 'center', gap: space.s2 },
});
