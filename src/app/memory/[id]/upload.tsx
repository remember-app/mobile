import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/**
 * The screen the invite push asks for (doc-01: «переход по уведомлению открывает приложение
 * сразу на этом воспоминании, на экране загрузки»). Bare on purpose — picking media and
 * sending it is m-1; this exists so the deep link and the push already have somewhere to land.
 */
export default function UploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Uploading lands here (m-1).</Text>
      <Text style={styles.id}>{id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  hint: { fontSize: 16, opacity: 0.7 },
  id: { fontSize: 13, opacity: 0.4 },
});
