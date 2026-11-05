import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.color.ink }]}>
      <Text role="hero">Remember</Text>
      <Text role="body" tone="muted" style={styles.lead}>
        Лаборатория движения: сетка фотографий, полноэкранный просмотр, жесты.
      </Text>
      <Pressable
        onPress={() => router.push('/lab')}
        style={[styles.button, { backgroundColor: theme.color.accent }]}
      >
        <Text role="control" tone="onFill">
          Открыть лабораторию
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.s6,
    gap: space.s4,
  },
  lead: {
    maxWidth: 340,
  },
  button: {
    height: 52,
    borderRadius: radius.cell,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.s4,
  },
});
