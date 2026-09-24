import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { createMemory, errorMessage } from '@/api';
import { ActionBar, AppBar, Banner, Board, Button, Field, IconButton } from '@/kit';
import { useAuth } from '@/lib/auth';
import { endOfDay, startOfDay } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { EventWhen, type Span } from '@/screens/memory/when';
import { space } from '@/theme';

/** Spec 8, `Create` — naming an event and saying when it was, and nothing else. */
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const [title, setTitle] = useState('');
  // The days it happened on. There is no switch for «больше дня» (spec 7.3, detail 15): the second
  // tap on the calendar is that switch, and `to: null` is a memory of a single day, which is what the
  // api gets told by sending no end.
  const [span, setSpan] = useState<Span>(() => ({ from: startOfDay(new Date()), to: null }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createMemory(token, {
        title: title.trim(),
        event_start: startOfDay(span.from).toISOString(),
        // A single day sends no end at all — the api reads a memory without one as that one day.
        event_end: span.to === null ? undefined : endOfDay(span.to).toISOString(),
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

        {/* Spec 8 — «Когда это было»: the middle of the screen and the only thing on it that decides
            anything. The same block `MemoryEdit` draws, so it is one piece and not two. */}
        <EventWhen value={span} onChange={setSpan} disabled={busy} />
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
  // The body of the screen, on the kit's own side inset and the layout's 22 between blocks (the same
  // rhythm `MemoryEdit` keeps). `flexGrow` and not `flex`, so the column is at least the height of
  // the screen and scrolls once it is taller.
  form: {
    flexGrow: 1,
    gap: 22,
    paddingHorizontal: space.s4,
    paddingTop: space.s6,
    paddingBottom: space.s5,
  },
  error: { marginHorizontal: space.s4, marginBottom: space.s3 },
});
