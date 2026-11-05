import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton, Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar title="Профиль" left={<BackButton label="Назад" onPress={() => router.back()} />} />
      }
    >
      <View style={styles.person}>
        <Avatar name="Анна Петрова" size={64} />
        <View style={styles.words}>
          <Text role="title">Анна Петрова</Text>
          <Text role="noteSm" tone="muted">
            @anna
          </Text>
          <Text role="noteSm" tone="faint">
            anna@example.com
          </Text>
        </View>
      </View>
      <Divider />
      <Button
        label="Выйти"
        variant="danger"
        onPress={() => router.replace('/onboarding/welcome')}
      />
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s4,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
  },
  words: {
    flex: 1,
    gap: 2,
  },
});
