import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContactStrip } from '@/ui/components/contact-strip';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Calendar } from '@/ui/kit/calendar';
import { dayKey } from '@/ui/kit/calendar-grid';
import { Field } from '@/ui/kit/field';
import { Slider } from '@/ui/kit/slider';
import { MOCK_CONTACTS } from '@/ui/mocks/contacts';
import { space } from '@/ui/theme';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function monthLabel(month: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month);
}

function dayLabel(day: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day);
}

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  const [limit, setLimit] = useState(10);

  const toggle = (id: string) =>
    setInvited((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pick = (day: Date) => {
    if (!from || to || dayKey(day) <= dayKey(from)) {
      setFrom(day);
      setTo(null);
      return;
    }
    setTo(day);
  };

  return (
    <Board
      body={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      bar={
        <AppBar
          title="Новое воспоминание"
          left={<BackButton label="Назад" onPress={() => router.back()} />}
        />
      }
    >
      <Field label="Название" value={title} onChangeText={setTitle} placeholder="Название" />
      <Calendar
        month={month}
        onMonth={setMonth}
        from={from}
        to={to}
        onPick={pick}
        weekdays={WEEKDAYS}
        monthLabel={monthLabel(month)}
        prevLabel="Предыдущий месяц"
        nextLabel="Следующий месяц"
        dayLabel={dayLabel}
      />
      <ContactStrip contacts={MOCK_CONTACTS} selected={invited} onToggle={toggle} />
      <Slider
        value={limit}
        onChange={setLimit}
        min={1}
        max={100}
        valueLabel={`${limit} ГБ`}
        minLabel="1 ГБ"
        maxLabel="100 ГБ"
        label="Лимит памяти"
        shorterLabel="Меньше"
        longerLabel="Больше"
      />
      <Button
        label="Создать"
        variant="primary"
        disabled={!title.trim() || !from}
        onPress={() => router.back()}
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
