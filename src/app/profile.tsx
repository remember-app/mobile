import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { UsernameForm } from '@/username-form';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
    // On success the gate swaps this screen out, so nothing to reset.
  }

  return (
    <View style={styles.container}>
      <Text style={styles.username}>{user?.username ?? '—'}</Text>
      <Text style={styles.name}>{user?.name ?? 'No name set'}</Text>

      <UsernameForm submitLabel="Change username" />

      <View style={styles.spacer} />
      <Button title="Log out" onPress={logOut} disabled={busy} color="#C0392B" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 24 },
  username: { fontSize: 26, fontWeight: '600' },
  name: { fontSize: 16, opacity: 0.7 },
  spacer: { flex: 1 },
  error: { fontSize: 15, color: '#C0392B' },
});
