import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { createMemory } from '@/api';
import { ActionBar, AppBar, BackButton, Banner, Board, Button, Field } from '@/kit';
import { useAuth } from '@/lib/auth';
import { endOfDay, startOfDay } from '@/lib/dates';
import { type Failure, failure } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { EventWhen, type Span } from '@/screens/memory/when';
import { board, height, space } from '@/theme';
export default function CreateMemoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const [title, setTitle] = useState('');
  const [span, setSpan] = useState<Span>(() => ({ from: startOfDay(new Date()), to: null }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createMemory(token, {
        title: title.trim(),
        event_start: startOfDay(span.from).toISOString(),
        event_end: span.to === null ? undefined : endOfDay(span.to).toISOString(),
      });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(failure(e));
      setBusy(false);
    }
  }
  return (
    <Board
      bar={
        <AppBar
          title={s.create.title}
          left={
            router.canGoBack() ? (
              <BackButton label={s.action.back} onPress={() => router.back()} />
            ) : null
          }
        />
      }
      footer={
        <>
          {error ? <Banner tone="error" failure={error} style={styles.error} /> : null}
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
        </>
      }
      body={styles.form}
    >
      <Field
        variant="name"
        label={s.create.titleLabel}
        value={title}
        onChangeText={setTitle}
        placeholder={s.create.titlePlaceholder}
        editable={!busy}
      />

      <EventWhen value={span} onChange={setSpan} disabled={busy} />
    </Board>
  );
}
const styles = StyleSheet.create({
  form: {
    flexGrow: 1,
    gap: 22,
    paddingHorizontal: space.s4,
    paddingTop: board.bodyCreate - board.status - height.bar,
    paddingBottom: space.s5,
  },
  error: { marginHorizontal: space.s4, marginBottom: space.s3 },
});
