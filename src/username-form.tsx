import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, isValidUsername, USERNAME_HINT } from '@/api';
import { useAuth } from '@/auth';
import { Button, Field, type FieldState } from '@/kit';
import { space } from '@/theme';

/**
 * The one username field, shared by the first claim (/set-username) and the change (/profile).
 *
 * The kit's field answers before the form is sent (section 4, «Ник»): the same rule the submit
 * runs — `isValidUsername` — colours the field while it is being typed, and the line underneath
 * says what to fix. `ok` is only as much as this side can know: the name is well formed. Whether
 * it is free is the server's word, and that comes back as the error under the field.
 */
export function UsernameForm({ submitLabel }: { submitLabel: string }) {
  const { user, setUsername } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = value.trim();
  const malformed = typed !== '' && !isValidUsername(typed);
  const state: FieldState | undefined =
    error !== null || malformed ? 'error' : typed === '' ? undefined : 'ok';

  async function submit() {
    const username = value.trim();
    if (!isValidUsername(username)) {
      setError(USERNAME_HINT);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUsername(username);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'That username is taken — pick another.'
          : e instanceof ApiError && e.status === 400
            ? USERNAME_HINT
            : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="Username"
        value={value}
        // What the server said was about the name that was sent, so it goes as soon as the name does.
        onChangeText={(next) => {
          setValue(next);
          setError(null);
        }}
        state={state}
        hint={error ?? (state === 'ok' ? 'Looks good.' : USERNAME_HINT)}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <Button
        label={submitLabel}
        variant="primary"
        wide
        busy={busy}
        disabled={typed === ''}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: 'stretch', gap: space.s5 },
});
