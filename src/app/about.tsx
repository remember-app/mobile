import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { API_URL } from '@/api';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Remember — mobile client.</Text>
      <Text style={styles.text}>API base URL:</Text>
      <Text style={styles.url}>{API_URL}</Text>
      <Text style={styles.hint}>Set EXPO_PUBLIC_API_URL to point the app elsewhere.</Text>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { fontSize: 16 },
  url: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  link: { fontSize: 16, color: '#208AEF' },
});
