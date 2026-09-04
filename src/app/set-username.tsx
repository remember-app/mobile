import { StyleSheet, View } from 'react-native';

import { Text } from '@/kit';
import { color, space } from '@/theme';
import { UsernameForm } from '@/username-form';

/** The only screen a signed-in account without a username can reach. Claiming one opens the app. */
export default function SetUsernameScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text role="display">Pick a username</Text>
        <Text style={styles.lead}>This is how other people find you in a memory.</Text>
      </View>
      <UsernameForm submitLabel="Continue" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: space.s6,
    padding: space.s6,
    backgroundColor: color.ink,
  },
  intro: { gap: space.s2 },
  lead: { color: color.muted },
});
