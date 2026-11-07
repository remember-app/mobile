import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContactStrip } from '@/ui/components/contact-strip';
import { EventDates } from '@/ui/components/event-dates';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { Slider } from '@/ui/kit/slider';
import { contactsState, subscribeContacts } from '@/ui/mocks/contacts';
import { createMockProject } from '@/ui/mocks/projects';
import { space } from '@/ui/theme';

export default function CreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  const [limit, setLimit] = useState(10);

  const toggle = (id: string) =>
    setInvited((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Board
      body={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      bar={
        <AppBar
          title={t('create.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
        />
      }
    >
      <Field
        label={t('create.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('create.name')}
        maxLength={30}
      />
      <EventDates
        from={from}
        to={to}
        onChange={(nextFrom, nextTo) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }}
      />
      <ContactStrip contacts={contacts} selected={invited} onToggle={toggle} />
      <Slider
        value={limit}
        onChange={setLimit}
        min={1}
        max={100}
        valueLabel={`${limit} ${t('unit.gb')}`}
        minLabel={`1 ${t('unit.gb')}`}
        maxLabel={`100 ${t('unit.gb')}`}
        label={t('create.limit')}
      />
      <Button
        label={t('create.create')}
        variant="primary"
        disabled={!title.trim() || !from}
        onPress={() => {
          if (!title.trim() || !from) return;
          createMockProject({ title: title.trim(), eventStart: from, eventEnd: to });
          router.back();
        }}
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
