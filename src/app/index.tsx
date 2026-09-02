import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { isApiHealthy } from '@/api';

type Status = 'checking' | 'ok' | 'unreachable';

const LABEL: Record<Status, string> = {
  checking: 'API: checking…',
  ok: 'API: ok',
  unreachable: 'API: unreachable',
};

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  const check = useCallback(() => {
    setStatus('checking');
    isApiHealthy().then((healthy) => setStatus(healthy ? 'ok' : 'unreachable'));
  }, []);

  useEffect(check, [check]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Remember</Text>
      <Text style={styles.status}>{LABEL[status]}</Text>
      <Button title="Check again" onPress={check} disabled={status === 'checking'} />
      <Link href="/about" style={styles.link}>
        About this app
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '600' },
  status: { fontSize: 18 },
  link: { fontSize: 16, color: '#208AEF' },
});
