import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { createMemory, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import {
  daysBefore,
  endOfDay,
  formatDay,
  formatEventDates,
  formatMonth,
  lastWeekend,
  startOfDay,
  weekdayLetters,
} from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Board,
  Button,
  Calendar,
  Chip,
  Field,
  Hint,
  IconButton,
  Text,
} from '@/kit';
import { useStrings } from '@/language';
import { space } from '@/theme';

/** Spec 8, `Create` — naming an event and saying when it was, and nothing else. */
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const today = startOfDay(new Date());
  const [title, setTitle] = useState('');
  // The day it started on, and the day it ended on once there is a second one. There is no switch
  // for «больше дня» any more (spec 7.3, detail 15): the second tap on the calendar is that switch,
  // and `null` is a memory of a single day, which is what the api gets told by sending no end.
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState<Date | null>(null);
  // Which month the grid is showing, and nothing else — so paging with the arrows past a span
  // longer than a month never touches what is picked (spec 8, «Края»).
  const [month, setMonth] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The three taps of detail 15: the first sets a day, the second closes the range behind it, the
   * third starts over. A tap *before* the day already picked is not a range running backwards — it
   * is the first tap being corrected, so it becomes the new first one.
   */
  function pick(day: Date) {
    const picked = startOfDay(day);
    if (to === null && picked > from) setTo(picked);
    else {
      setFrom(picked);
      setTo(null);
    }
  }

  /** A quick day is the whole answer: both ends at once, and the grid brought to where they are. */
  function jump(range: { from: Date; to: Date | null }) {
    setFrom(range.from);
    setTo(range.to);
    setMonth(range.from);
  }

  const quick = [
    { label: s.create.today, range: { from: today, to: null } },
    { label: s.create.yesterday, range: { from: daysBefore(today, 1), to: null } },
    { label: s.create.weekend, range: lastWeekend(today) },
    // «Неделя» is the week behind, today included — seven days and not «this calendar week»,
    // which on a Monday would be one day long.
    { label: s.create.week, range: { from: daysBefore(today, 6), to: today } },
  ];

  // Counted over whole days rather than over hours, so a clock change inside the span cannot make
  // three days read as two.
  const days = to === null ? 1 : Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createMemory(token, {
        title: title.trim(),
        event_start: from.toISOString(),
        // A single day sends no end at all — the api reads a memory without one as that one day.
        event_end: to === null ? undefined : endOfDay(to).toISOString(),
      });
      // The list refetches on focus, so it comes back holding the new memory. Falling
      // back to a replace covers the case where this screen was not pushed from it.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      // Includes the api's own wording for a 400 — a blank title, or an end before the start.
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Board>
      <AppBar
        title={s.create.title}
        // Drawn only when there is somewhere to go back to — this screen is also the landing
        // spot of a replace, and a button that answers nothing is worse than no button.
        left={
          router.canGoBack() ? (
            <IconButton icon={ChevronLeft} label={s.action.back} onPress={() => router.back()} />
          ) : null
        }
      />

      {/* Scrolls rather than stands: the layout's 390 × 844 holds the calendar whole, and a phone
          with the keyboard up over a shorter screen does not. `handled` so the first tap on a day
          picks it instead of only putting the keyboard away. */}
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {/* Spec 7.3, the 56 field: a memory's name is typed in the face it will be printed in on
            its own cover, so this one field is Unbounded and no other on the screen is. */}
        <Field
          variant="name"
          label={s.create.titleLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={s.create.titlePlaceholder}
          editable={!busy}
        />

        {/* Spec 8 — «Когда это было»: what is picked, the four quick days, the calendar, and the
            one line under it. The middle of the screen and the only thing on it that decides
            anything. */}
        <View style={styles.when}>
          <View style={styles.head}>
            <Text role="eyebrow" style={styles.grow}>
              {s.create.eventDate.toUpperCase()}
            </Text>
            <Text role="controlSm" style={styles.picked}>
              {formatEventDates(from.toISOString(), to === null ? null : to.toISOString())}
              {/* Spec 8, «Края»: one day is one date, with no length hung off it. */}
              {days > 1 ? <Text role="chip" tone="muted">{` · ${s.create.days(days)}`}</Text> : null}
            </Text>
          </View>

          <View style={styles.quick}>
            {quick.map((day) => (
              <Chip key={day.label} label={day.label} size={36} onPress={() => jump(day.range)} />
            ))}
          </View>

          <Calendar
            month={month}
            onMonth={setMonth}
            from={from}
            to={to}
            onPick={pick}
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
      </ScrollView>

      {/* In the flow of the screen and right above the action that raised it, never over it. */}
      {error ? <Banner tone="error" text={error} style={styles.error} /> : null}

      <ActionBar>
        <Button
          label={s.create.submit}
          variant="primary"
          wide
          busy={busy}
          disabled={title.trim() === ''}
          onPress={submit}
        />
      </ActionBar>
    </Board>
  );
}

// Shape only: the board, the fields, the calendar and the bottom layer each carry their own
// colours, in whichever theme the app is currently in.
const styles = StyleSheet.create({
  // The body of the screen, on the kit's own side inset and its 24 between blocks. `flexGrow` and
  // not `flex`, so the column is at least the height of the screen and scrolls once it is taller.
  form: {
    flexGrow: 1,
    gap: space.s6,
    paddingHorizontal: space.s4,
    paddingTop: space.s6,
    paddingBottom: space.s5,
  },
  when: { gap: space.s3 },
  // The name of the block and what is picked, on one baseline: a 12 eyebrow and a 14 date.
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3 },
  grow: { flex: 1 },
  // In the tabular figures every date in the product is written in.
  picked: { fontVariant: ['tabular-nums'] },
  // Spec 7.3: a row of chips 8 apart, wrapping rather than cutting a word in half.
  quick: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s2 },
  error: { marginHorizontal: space.s4, marginBottom: space.s3 },
});
