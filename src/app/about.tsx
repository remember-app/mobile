import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/api';
import { Button, Text } from '@/kit';
import { useStrings } from '@/language';
import { space, themed } from '@/theme';

/** Which api this build talks to. Service page — the kit's tokens, and nothing it does not need. */
export default function AboutScreen() {
  const s = useStrings();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      {/* The product's name, and the one word on this screen that is the same in every language. */}
      <Text role="display">Remember</Text>
      <Text style={styles.lead}>{s.about.lead}</Text>

      <View style={styles.api}>
        <Text role="meta">{s.about.apiUrl}</Text>
        <Text role="subtitle">{API_URL}</Text>
      </View>

      <Text role="meta" style={styles.hint}>
        {s.about.hint}
      </Text>

      <Link href="/" asChild>
        <Button variant="quiet" label={s.about.back} />
      </Link>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
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
  }),
);
