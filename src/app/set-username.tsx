import { StyleSheet, Text, View } from 'react-native';

import { UsernameForm } from '@/username-form';

/** The only screen a signed-in account without a username can reach. Claiming one opens the app. */
export default function SetUsernameScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick a username</Text>
      <Text style={styles.hint}>This is how other people find you in a memory.</Text>
      <UsernameForm submitLabel="Continue" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 26, fontWeight: '600' },
  hint: { fontSize: 15, opacity: 0.7 },
});
