import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Calendar, Field } from '@/kit';
import { atClock, clockOf, formatDay, formatMonth, weekdayLetters } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';

/**
 * `ShotEditor` — «Снято», opened in place: the day on the calendar the product already picks days
 * with, and the clock typed in. A frame cannot have been shot tomorrow, so nothing past today
 * answers.
 *
 * Its own file rather than a part of either screen that raises it: it is the one editor of when a
 * frame was shot, and the sheet on «Мои кадрах» and the row of the frame's own screen stand this
 * same one up. A copy would be two places keeping one rule, and the two would part ways.
 */
export function ShotEditor({
  from,
  busy,
  onSave,
}: {
  /** What is in it now — the frame's own stamp, `null` for a frame that has none. */
  from: string | null;
  busy: boolean;
  onSave: (at: Date) => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const today = useMemo(() => new Date(), []);
  const start = from ? new Date(from) : today;
  const [day, setDay] = useState(start);
  const [month, setMonth] = useState(start);
  const [clock, setClock] = useState(() => clockOf(start));
  const [wrong, setWrong] = useState(false);

  function save() {
    const at = atClock(day, clock);
    setWrong(at === null);
    if (at !== null) onSave(at);
  }

  return (
    <View style={styles.editor}>
      <Calendar
        month={month}
        onMonth={setMonth}
        from={day}
        onPick={setDay}
        max={today}
        weekdays={weekdayLetters()}
        monthLabel={formatMonth(month)}
        prevLabel={s.create.prevMonth}
        nextLabel={s.create.nextMonth}
        dayLabel={formatDay}
      />
      <Field
        label={s.mine.time}
        variant="search"
        onSurface
        value={clock}
        onChangeText={(typed) => {
          setClock(typed);
          setWrong(false);
        }}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        onSubmitEditing={save}
        state={wrong ? 'error' : undefined}
        hint={wrong ? s.mine.timeWrong : undefined}
      />
      <Button variant="primary" label={s.action.save} busy={busy} onPress={save} />
    </View>
  );
}

const useStyles = themed(() => StyleSheet.create({ editor: { gap: space.s3 } }));
