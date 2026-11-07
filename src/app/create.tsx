import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addMember, createProject, loadContacts, refreshSession } from '@/functionality';
import { ContactStrip } from '@/ui/components/contact-strip';
import { EventDates } from '@/ui/components/event-dates';
import { useContacts, useSession } from '@/ui/hooks';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton, Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { Slider } from '@/ui/kit/slider';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

export default function CreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const contactsState = useContacts();
  const contacts = contactsState.contacts;
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  const [storageGb, setStorageGb] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storage = account?.consumables.storage;
  const available = Math.max(
    0,
    Math.floor(((storage?.bytes ?? 0) - (storage?.spend ?? 0)) / 1024 ** 3),
  );
  const most = available;
  const size = Math.min(storageGb, most);

  useEffect(() => {
    void loadContacts();
    void refreshSession().catch(() => undefined);
  }, []);

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
      <ContactStrip
        contacts={contacts.map((contact) => ({
          id: contact.userId,
          name: contact.name ?? contact.username ?? '',
        }))}
        selected={invited}
        onToggle={toggle}
      />
      <Slider
        value={size}
        onChange={setStorageGb}
        min={0}
        max={most}
        valueLabel={`${size} ${t('unit.gb')}`}
        minLabel={`0 ${t('unit.gb')}`}
        maxLabel={`${most} ${t('unit.gb')}`}
        label={t('create.storage')}
      />
      <Button
        label={t('create.create')}
        variant="primary"
        disabled={busy || !title.trim() || !from}
        onPress={() => {
          if (busy || !title.trim() || !from) return;
          setBusy(true);
          setError(null);
          void (async () => {
            try {
              const project = await createProject({
                title: title.trim(),
                eventStart: from.toISOString(),
                eventEnd: to?.toISOString() ?? null,
                storageBytes: size * 1024 ** 3,
              });
              const usernames = contacts.flatMap((contact) =>
                invited.has(contact.userId) && contact.username ? [contact.username] : [],
              );
              await Promise.allSettled(
                usernames.map((username) => addMember(project.id, username, 'contributor')),
              );
              router.back();
            } catch {
              setError(t('create.error'));
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
      {error ? (
        <Text role="hint" tone="danger">
          {error}
        </Text>
      ) : null}
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
