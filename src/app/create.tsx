import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ActionBar, AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { space } from '@/ui/theme';

export default function CreateScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar
          title="Новое воспоминание"
          left={<BackButton label="Назад" onPress={() => router.back()} />}
        />
      }
      footer={
        <ActionBar keyboardGap={space.s4}>
          <Button
            label="Создать"
            variant="primary"
            disabled={!title.trim()}
            onPress={() => router.back()}
          />
        </ActionBar>
      }
    >
      <Field
        label="Название"
        value={title}
        onChangeText={setTitle}
        placeholder="Например, день рождения"
      />
      <Field
        label="Когда"
        value={when}
        onChangeText={setWhen}
        placeholder="Например, 14 июня"
        hint="Календарь добавим отдельным шагом."
      />
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s5,
    gap: space.s5,
  },
});
