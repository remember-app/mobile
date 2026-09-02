import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, errorMessage, isValidUsername, USERNAME_HINT } from '@/api';
import { useAuth } from '@/auth';

/** The one username field, shared by the first claim (/set-username) and the change (/profile). */
export function UsernameForm({ submitLabel }: { submitLabel: string }) {
  const { user, setUsername } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="username"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <Button title={submitLabel} onPress={submit} disabled={busy || value.trim() === ''} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: 'stretch', gap: 12 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { fontSize: 15, color: '#C0392B' },
});
