import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMemory, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { endOfDay, formatDay, startOfDay } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  Field,
  FieldShell,
  Icon,
  IconButton,
  TAP,
  Text,
} from '@/kit';
import { useStrings } from '@/language';
import { space, themed, useTheme } from '@/theme';

/** Creating a memory: a title and the day (or span) the event happened on. */
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  // The platform's switch takes its colours as props, not as a style.
  const { color } = useTheme();
  // The native header is off for the whole app, so the screen owes the status bar its own room.
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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

      <View style={styles.form}>
        <Field
          label={s.create.titleLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={s.create.titlePlaceholder}
          editable={!busy}
        />

        <DayField
          label={s.create.eventDate}
          // The kit draws `.field-hint` under this one field and under no other on the screen: the
          // day is the only thing here that does something later, and this is where it says so.
          // Under the first field only — the end date is the same answer, said twice.
          hint={s.create.dateHint}
          value={start}
          onChange={(day) => setStart(startOfDay(day))}
          disabled={busy}
        />

        <View style={styles.toggle}>
          <Text role="label">{s.create.multiDay}</Text>
          {/* The kit has no switch of its own — this is the platform's, wearing the kit's
              colours: ember when it is on, hairline when it is off, paper for the thumb. */}
          <Switch
            // The words beside it are a sibling, and React Native joins nothing up on its own —
            // without this the toggle is announced with no name at all.
            accessibilityLabel={s.create.multiDay}
            value={end !== null}
            onValueChange={(on) => setEnd(on ? endOfDay(start) : null)}
            disabled={busy}
            trackColor={{ false: color.line, true: color.ember }}
            thumbColor={color.paper}
            // The same paper again, for the half of the web switch `thumbColor` does not reach:
            // switch.d.ts has the why.
            activeThumbColor={color.paper}
            ios_backgroundColor={color.line}
          />
        </View>

        {end === null ? null : (
          <DayField
            label={s.create.ends}
            value={end}
            onChange={(day) => setEnd(endOfDay(day))}
            // Makes the one range the api rejects unreachable from the picker itself.
            minimumDate={start}
            disabled={busy}
          />
        )}

        {/* The kit closes the body with it (screens, 3): the one thing this screen does not ask
            for, said before «Создать» so nobody puts off creating until they have the guest list. */}
        <Banner text={s.create.inviteHint} />
      </View>

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
    </View>
  );
}

/**
 * A day, picked with the platform's own calendar — so there is no such thing as bad input. The kit
 * does not draw a calendar, and it should not: this is system UI. What the kit does draw is
 * everything around it, and it hands that over as `FieldShell` (section 4) — so this is the kit's
 * own field with a day inside it, and not a second one built to look the same (TASK-56).
 */
function DayField({
  label,
  hint,
  value,
  onChange,
  minimumDate,
  disabled,
}: {
  label: string;
  /** The kit's `.field-hint`: the line under the input that says what the day is for. */
  hint?: string;
  value: Date;
  onChange: (day: Date) => void;
  minimumDate?: Date;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <>
      <FieldShell
        label={label}
        hint={hint}
        accessibilityValue={{ text: formatDay(value) }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.day, disabled ? styles.dayOff : null]}>{formatDay(value)}</Text>
        <Icon icon={CalendarDays} color={color.muted} />
      </FieldShell>
      {/* Outside the field, never inside it: on iOS this is a whole calendar drawn in place, and it
          stands under the field the way the platform's own dialog stands over the screen. */}
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
    </>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: color.ink, paddingHorizontal: space.s4 },
    // The kit's `.stack-6` — what the body of this screen is spaced on.
    form: { flex: 1, gap: space.s6, paddingTop: space.s2 },
    // The row keeps a finger's worth of height whatever the platform draws the switch at.
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s4,
      minHeight: TAP,
    },
    error: { marginBottom: space.s3 },
    // The kit's input type, with the tabular figures it asks of every date.
    day: { fontVariant: ['tabular-nums'] },
    dayOff: { color: color.muted },
  }),
);
