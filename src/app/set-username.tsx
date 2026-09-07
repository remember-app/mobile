import { StyleSheet, View } from 'react-native';

import { Text } from '@/kit';
import { useStrings } from '@/language';
import { color, space } from '@/theme';
import { UsernameForm } from '@/username-form';

/** The only screen a signed-in account without a username can reach. Claiming one opens the app. */
export default function SetUsernameScreen() {
  const s = useStrings();

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text role="display">{s.username.pick}</Text>
        <Text style={styles.lead}>{s.username.lead}</Text>
      </View>
      <UsernameForm submitLabel={s.username.continue} />
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
