import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';

import { isUsernameShapeValid } from '@/functionality';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { profileState, saveProfile, subscribeProfile } from '@/ui/mocks/profile';
import { space } from '@/ui/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const clean = username.trim().replace(/^@/, '');
  const valid = isUsernameShapeValid(clean);

  const save = () => {
    if (!valid) return;
    saveProfile({ name: name.trim() || clean, username: clean });
    router.back();
  };

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar title="Профиль" left={<BackButton label="Назад" onPress={() => router.back()} />} />
      }
    >
      <Field
        label="Имя"
        value={name}
        onChangeText={setName}
        placeholder="Имя"
        autoCapitalize="words"
      />
      <Field
        label="Ник"
        value={username}
        onChangeText={setUsername}
        placeholder="Ник"
        prefix="@"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button label="Сохранить" variant="primary" disabled={!valid} onPress={save} />
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    paddingBottom: space.s7,
    gap: space.s5,
  },
});
