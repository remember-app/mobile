import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/api';
import { Board, Button, Text } from '@/kit';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';

/** Which api this build talks to. Service page — the kit's tokens, and nothing it does not need. */
export default function AboutScreen() {
  const s = useStrings();
  const styles = useStyles();

  return (
    <Board body={styles.container} style={styles.whole}>
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
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Centred on the whole screen, status line included, the way this page always stood.
    whole: { paddingTop: 0 },
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s4,
      padding: space.s6,
    },
    lead: { color: color.muted },
    api: { alignItems: 'center', gap: space.s1 },
    hint: { textAlign: 'center' },
  }),
);
