import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Calendar, Field } from '@/kit';
import { atClock, clockOf, formatDay, formatMonth, weekdayLetters } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';
export function ShotEditor({
  from,
  busy,
  onSave,
}: {
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
