import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, checkUsername, isValidUsername } from '@/api';
import { Button, Field, type FieldState, read } from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import type { Strings } from '@/strings';
import { space } from '@/theme';

const CHECK_DELAY_MS = 400;
type Availability = 'checking' | 'free' | 'taken';
const availabilityHint = (s: Strings): Record<Availability, string> => ({
  checking: s.state.checking,
  free: s.username.free,
  taken: s.error.usernameTaken,
});
export function useUsername({
  onClaimed,
  onConsentNeeded,
}: {
  onClaimed?: () => void;
  onConsentNeeded?: () => void;
} = {}) {
  const { token, user, setUsername } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<'taken' | 'format' | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const typed = value.trim();
  const unchanged = typed === (user?.username ?? '');
  const malformed = typed !== '' && !isValidUsername(typed);
  const taken = refused === 'taken' || availability === 'taken';
  const format = refused === 'format' || malformed;
  const state: FieldState | undefined =
    format || taken ? 'error' : availability === 'free' ? 'ok' : undefined;
  useEffect(() => {
    if (token === null || unchanged || !isValidUsername(typed)) {
      setAvailability(null);
      return;
    }
    setAvailability('checking');
    let live = true;
    const timer = setTimeout(() => {
      checkUsername(token, typed).then(
        ({ available }) => {
          if (live) setAvailability(available ? 'free' : 'taken');
        },
        () => {
          if (live) setAvailability(null);
        },
      );
    }, CHECK_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, typed, unchanged]);
  function change(next: string) {
    setValue(next);
    setRefused(null);
    setFailed(null);
  }
  async function submit() {
    const username = value.trim();
    if (!isValidUsername(username)) {
      setRefused('format');
      return;
    }
    setBusy(true);
    setRefused(null);
    setFailed(null);
    try {
      await setUsername(username);
      onClaimed?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && onConsentNeeded) {
        onConsentNeeded();
        return;
      }
      if (e instanceof ApiError && e.status === 409) setRefused('taken');
      else if (e instanceof ApiError && e.status === 400) setRefused('format');
      else setFailed(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return {
    value,
    change,
    typed,
    unchanged,
    busy,
    availability,
    taken,
    format,
    failed,
    hint: failed && read(failed.text),
    state,
    submit,
  };
}
export type Username = ReturnType<typeof useUsername>;
export function UsernameField({ name, wayIn }: { name: Username; wayIn?: boolean }) {
  const s = useStrings();
  const { availability, format, taken, failed } = name;
  const state = !wayIn && failed ? 'error' : name.state;
  const hint = wayIn
    ? format
      ? s.error.usernameFormat
      : taken
        ? s.username.taken
        : availability === 'free'
          ? s.username.available
          : undefined
    : (name.hint ??
      (format
        ? s.error.usernameFormat
        : taken
          ? s.error.usernameTaken
          : availability === null
            ? s.username.lead
            : availabilityHint(s)[availability]));
  return (
    <Field
      label={s.username.label}
      variant="username"
      prefix="@"
      placeholder={s.username.placeholder}
      value={name.value}
      onChangeText={name.change}
      state={state}
      hint={hint}
      hintAbove={wayIn}
      hintAfter={!wayIn && state === 'ok' ? s.username.lead : undefined}
      pending={wayIn && availability === 'checking'}
      autoCapitalize="none"
      autoCorrect={false}
      editable={!name.busy}
    />
  );
}
export function UsernameButton({ name, label }: { name: Username; label: string }) {
  return (
    <Button
      label={label}
      variant={name.unchanged ? 'secondary' : 'primary'}
      wide
      busy={name.busy}
      disabled={name.typed === ''}
      onPress={name.submit}
    />
  );
}
export function UsernameForm({
  submitLabel,
  onClaimed,
}: {
  submitLabel: string;
  onClaimed?: () => void;
}) {
  const name = useUsername({ onClaimed });
  return (
    <View style={styles.form}>
      <UsernameField name={name} />
      <UsernameButton name={name} label={submitLabel} />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { alignSelf: 'stretch', gap: space.s3 },
});
