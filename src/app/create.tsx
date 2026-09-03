import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { createMemory, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { endOfDay, formatDay, startOfDay } from '@/dates';

/** Creating a memory: a title and the day (or span) the event happened on. */
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(() => startOfDay(new Date()));
  // null is «single day». The end is optional in doc-01, so it stays absent until asked for.
  const [end, setEnd] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createMemory(token, {
        title: title.trim(),
        event_start: start.toISOString(),
        event_end: end?.toISOString(),
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
    <View style={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Anna's birthday"
        editable={!busy}
      />

      <DayField
        label="Event date"
        value={start}
        onChange={(day) => setStart(startOfDay(day))}
        disabled={busy}
      />

      <View style={styles.toggle}>
        <Text style={styles.label}>Lasted more than a day</Text>
        <Switch
          value={end !== null}
          onValueChange={(on) => setEnd(on ? endOfDay(start) : null)}
          disabled={busy}
        />
      </View>

      {end === null ? null : (
        <DayField
          label="Ends"
          value={end}
          onChange={(day) => setEnd(endOfDay(day))}
          // Makes the one range the api rejects unreachable from the picker itself.
          minimumDate={start}
          disabled={busy}
        />
      )}

      <View style={styles.spacer} />
      <Button title="Create" onPress={submit} disabled={busy || title.trim() === ''} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** A day, picked with the platform's own calendar — so there is no such thing as bad input. */
function DayField({
  label,
  value,
  onChange,
  minimumDate,
  disabled,
}: {
  label: string;
  value: Date;
  onChange: (day: Date) => void;
  minimumDate?: Date;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Button title={formatDay(value)} onPress={() => setOpen(true)} disabled={disabled} />
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          // iOS draws the calendar in place; Android opens its own dialog and reports
          // 'dismissed' when it is cancelled, which must not overwrite the value.
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === 'set' && picked) onChange(picked);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 24 },
  field: { gap: 6 },
  label: { fontSize: 15, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, fontSize: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { flex: 1 },
  error: { fontSize: 15, color: '#C0392B' },
});
