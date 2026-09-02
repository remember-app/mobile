import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isApiHealthy } from '@/api';
import { useAuth } from '@/auth';

type Status = 'checking' | 'ok' | 'unreachable';

const LABEL: Record<Status, string> = {
  checking: 'API: checking…',
  ok: 'API: ok',
  unreachable: 'API: unreachable',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('checking');

  const check = useCallback(() => {
    setStatus('checking');
    isApiHealthy().then((healthy) => setStatus(healthy ? 'ok' : 'unreachable'));
  }, []);

  useEffect(check, [check]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi, {user?.username}</Text>
      {/* The real list is m-0; this screen only proves you got past the gate. */}
      <Text style={styles.placeholder}>Your memories will show up here.</Text>
      <Link href="/profile" style={styles.link}>
        Profile
      </Link>
      <Link href="/about" style={styles.link}>
        About this app
      </Link>
      <Text style={styles.status}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '600' },
  placeholder: { fontSize: 16, opacity: 0.7 },
  link: { fontSize: 16, color: '#208AEF' },
  status: { fontSize: 13, opacity: 0.5 },
});
