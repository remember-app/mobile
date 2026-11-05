import { useRouter } from 'expo-router';
import { Camera, Check, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, AvatarStack } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider, Progress, StepScale } from '@/ui/kit/bits';
import { BlockHead } from '@/ui/kit/block-head';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Banner } from '@/ui/kit/card';
import { Checkbox } from '@/ui/kit/checkbox';
import { Chip } from '@/ui/kit/chip';
import { ChoiceCard } from '@/ui/kit/choice';
import { CircularProgress } from '@/ui/kit/circular-progress';
import { Empty } from '@/ui/kit/empty';
import { CodeField, Field, TextArea } from '@/ui/kit/field';
import { Palette } from '@/ui/kit/palette';
import { Segment } from '@/ui/kit/segment';
import { Skeleton } from '@/ui/kit/skeleton';
import { RowToggle } from '@/ui/kit/toggle';
import { space } from '@/ui/theme';

const COLORS = ['#FFB547', '#FF7A9C', '#FF5A5A', '#4BD6A0', '#4FB3FF', '#8A7CFF'] as const;
const NAMES = ['мед', 'роза', 'алый', 'мята', 'небо', 'лила'] as const;

export default function KitScreen() {
  const router = useRouter();
  const [name, setName] = useState('Название');
  const [code, setCode] = useState('');
  const [story, setStory] = useState('');
  const [chip, setChip] = useState(true);
  const [segment, setSegment] = useState(1);
  const [checked, setChecked] = useState(true);
  const [toggle, setToggle] = useState(true);
  const [color, setColor] = useState<string>(COLORS[0]);

  return (
    <Board
      bar={<AppBar title="Кит" left={<BackButton label="Назад" onPress={() => router.back()} />} />}
      body={styles.body}
    >
      <BlockHead label="Кнопки" />
      <View style={styles.column}>
        <Button label="Основная" variant="primary" onPress={() => undefined} />
        <Button label="Вторая" variant="secondary" onPress={() => undefined} />
        <View style={styles.row}>
          <Button label="Контур" variant="outline" onPress={() => undefined} />
          <Button label="Тихо" variant="quiet" onPress={() => undefined} />
          <Button label="Ссылка" variant="link" onPress={() => undefined} />
        </View>
        <Button label="Удалить" variant="danger" icon={Trash2} onPress={() => undefined} />
        <Button label="С пунктиром" variant="dashed" onPress={() => undefined} />
        <View style={styles.row}>
          <IconButton icon={Plus} label="Добавить" onPress={() => undefined} />
          <IconButton icon={Camera} label="Камера" tone="surface" onPress={() => undefined} />
          <IconButton icon={Check} label="Готово" tone="raise" onPress={() => undefined} />
        </View>
      </View>

      <Divider />
      <BlockHead label="Поля" />
      <View style={styles.column}>
        <Field
          label="Название"
          value={name}
          onChangeText={setName}
          placeholder="Например, день рождения"
        />
        <CodeField label="Код" value={code} onChangeText={setCode} />
        <TextArea label="Многострочный текст" value={story} onChangeText={setStory} limit={240} />
      </View>

      <Divider />
      <BlockHead label="Выбор" />
      <View style={styles.column}>
        <View style={styles.row}>
          <Chip label="Все" selected toggle onPress={() => setChip(!chip)} />
          <Chip label="Видео" toggle onPress={() => undefined} />
          <Chip label="Третий" onPress={() => undefined} />
        </View>
        <ChoiceCard
          icon={Sparkles}
          title="Выбрано"
          note="Короткое описание выбора"
          variant="row"
          selected
          onPress={() => undefined}
        />
        <ChoiceCard
          icon={Sparkles}
          title="Не выбрано"
          note="Короткое описание выбора"
          variant="row"
          onPress={() => undefined}
        />
        <Segment
          label="Сегмент"
          options={[
            { value: 1, label: 'Один' },
            { value: 2, label: 'Два' },
            { value: 3, label: 'Три' },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <RowToggle label="Показывать скрытое" value={toggle} onValueChange={setToggle} />
      </View>

      <Divider />
      <BlockHead label="Флажки" />
      <View style={styles.column}>
        <Checkbox label="Согласен" checked={checked} onChange={setChecked} />
        <Checkbox label="Недоступно" checked={false} onChange={() => undefined} disabled />
      </View>

      <Divider />
      <BlockHead label="Состояния" />
      <View style={styles.column}>
        <Banner text="Не удалось загрузить данные" tone="error" />
        <Banner text="Готово" tone="done" />
        <Empty sign="spark" icon={Camera} title="Здесь пусто" />
      </View>

      <Divider />
      <BlockHead label="Прогресс" />
      <View style={styles.column}>
        <Progress value={0.65} label="65%" />
        <StepScale steps={5} done={2} label="Шаг 2 из 5" />
        <View style={styles.row}>
          <CircularProgress value={0.25} />
          <CircularProgress value={0.65} />
          <CircularProgress value={1} />
        </View>
        <View style={styles.column}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
        </View>
      </View>

      <Divider />
      <BlockHead label="Аватары и теги" />
      <View style={styles.column}>
        <View style={styles.row}>
          <Avatar name="Анна" size={48} />
          <Avatar name="Борис" size={48} />
          <AvatarStack names={['Анна', 'Борис', 'Вера', 'Глеб', 'Даша']} size={36} />
        </View>
      </View>

      <Divider />
      <BlockHead label="Цвет" />
      <Palette label="Цвет" colors={COLORS} names={NAMES} value={color} onChange={setColor} />
    </Board>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.s4,
    paddingBottom: space.s8,
    gap: space.s4,
  },
  column: {
    gap: space.s3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s2,
  },
});
