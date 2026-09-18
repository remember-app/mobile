import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronDown, ChevronLeft, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { createMemory, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { endOfDay, formatDay, startOfDay } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Board,
  Button,
  Field,
  FieldShell,
  HintNote,
  ICO_S,
  Icon,
  IconButton,
  Text,
  Toggle,
} from '@/kit';
import { useStrings } from '@/language';
import { space, useTheme } from '@/theme';

/** Spec 8, `Create` — naming an event and saying when it was, and nothing else. */
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
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

      <View style={styles.form}>
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

        <DayField
          label={s.create.eventDate}
          // The one explanation on the screen stands under the one field that does something later.
          // Under the first day only — the end is the same answer, said twice.
          hint={s.create.dateHint}
          value={start}
          onChange={(day) => setStart(startOfDay(day))}
          disabled={busy}
        />

        <Toggle
          label={s.create.multiDay}
          value={end !== null}
          onValueChange={(on) => setEnd(on ? endOfDay(start) : null)}
          disabled={busy}
        />

        {/* Spec 8, «Края»: switched off, the whole block goes and its neighbours come up. */}
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

        {/* Spec 8 closes the body with it: the one thing this screen does not ask for, said before
            «Создать» so nobody puts off creating until they have the guest list. `spark` on the
            glyph because the hint is about people (spec 7.6). */}
        <HintNote icon={UserPlus} tone="spark" text={s.create.inviteHint} />
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
    </Board>
  );
}

/**
 * Spec 7.3, «поле-кнопка даты»: the calendar glyph, the day in tabular figures, the chevron — and
 * the whole thing presses, opening the platform's own picker, so there is no such thing as bad
 * input. The kit does not draw a calendar and should not: that is system UI. What it does draw is
 * everything around it, which it hands over as `FieldShell` — this is the kit's own field with a day
 * inside it, and not a second one built to look the same.
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
  /** The line under the field that says what the day is for. */
  hint?: string;
  value: Date;
  onChange: (day: Date) => void;
  minimumDate?: Date;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
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
        <Icon icon={CalendarDays} size={ICO_S} color={color.muted} />
        <Text style={styles.day}>{formatDay(value)}</Text>
        <Icon icon={ChevronDown} size={ICO_S} color={color.faint} />
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

// Shape only: the board, the fields and the bottom layer each carry their own colours — and a
// disabled field is dimmed by the kit, not by a second colour spelled out here.
const styles = StyleSheet.create({
  // The body of the screen, on the kit's own side inset and its 24 between blocks.
  form: { flex: 1, gap: space.s6, paddingHorizontal: space.s4, paddingTop: space.s6 },
  error: { marginHorizontal: space.s4, marginBottom: space.s3 },
  // Stretched between the calendar and the chevron, in the tabular figures every date is written in.
  day: { flex: 1, fontVariant: ['tabular-nums'] },
});
