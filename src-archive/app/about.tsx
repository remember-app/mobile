import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { API_URL } from '@/api';
import { Board, Button, Text } from '@/kit';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';
export default function AboutScreen() {
  const s = useStrings();
  const styles = useStyles();
  return (
    <Board body={styles.container} style={styles.whole}>
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
