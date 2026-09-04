import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/api';
import { Button, Text } from '@/kit';
import { color, space } from '@/theme';

/** Which api this build talks to. Service page — the kit's tokens, and nothing it does not need. */
export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text role="display">Remember</Text>
      <Text style={styles.lead}>Mobile client.</Text>

      <View style={styles.api}>
        <Text role="meta">API base URL</Text>
        <Text role="subtitle">{API_URL}</Text>
      </View>

      <Text role="meta" style={styles.hint}>
        Set EXPO_PUBLIC_API_URL to point the app elsewhere.
      </Text>

      <Link href="/" asChild>
        <Button variant="quiet" label="Back home" />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s4,
    padding: space.s6,
    backgroundColor: color.ink,
  },
  lead: { color: color.muted },
  api: { alignItems: 'center', gap: space.s1 },
  hint: { textAlign: 'center' },
});
