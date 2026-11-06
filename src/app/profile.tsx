import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp, Pencil } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { applyLanguage } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { contactsState, subscribeContacts } from '@/ui/mocks/contacts';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { radius, space, themed, useTheme } from '@/ui/theme';

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const;

function number(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { color } = useTheme();
  const styles = useStyles();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const [language, setLanguage] = useState<Language>('ru');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void readLanguage().then((next) => {
      setLanguage(next);
      void applyLanguage(next);
    });
  }, []);

  const choose = (next: Language) => {
    setLanguage(next);
    setOpen(false);
    void writeLanguage(next);
    void applyLanguage(next);
  };

  const left = Math.max(0, profile.storageTotalGb - profile.storageUsedGb);
  const current = LANGUAGES.find((item) => item.value === language) ?? LANGUAGES[0];

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar title="Профиль" left={<BackButton label="Назад" onPress={() => router.back()} />} />
      }
    >
      <View style={[styles.card, styles.person]}>
        <Avatar name={profile.name} size={64} />
        <View style={styles.words}>
          <Text role="title">{profile.name}</Text>
          <Text role="noteSm" tone="muted">{`@${profile.username}`}</Text>
          <Text role="noteSm" tone="faint">
            {profile.email}
          </Text>
        </View>
        <IconButton
          icon={Pencil}
          label="Изменить профиль"
          tone="surface"
          size={40}
          onPress={() => router.push('/profile/edit')}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text role="row">Место</Text>
          <Text role="rowPlain" tone="muted">
            {`${number(left)} / ${number(profile.storageTotalGb)} ГБ`}
          </Text>
        </View>
        <Divider />
        <View style={styles.row}>
          <Text role="row">Токены</Text>
          <Text role="rowPlain" tone="muted">
            {profile.tokens}
          </Text>
        </View>
      </View>

      <View style={[styles.card, styles.settingsCard]}>
        <View style={styles.settingsWrap}>
          <Pressable onPress={() => setOpen((was) => !was)} style={styles.row}>
            <Text role="row">Язык</Text>
            <View style={styles.value}>
              <Text role="rowPlain" tone="muted">
                {current.label}
              </Text>
              {open ? (
                <ChevronUp size={18} color={color.muted} />
              ) : (
                <ChevronDown size={18} color={color.muted} />
              )}
            </View>
          </Pressable>
          {open ? (
            <View style={styles.options}>
              {LANGUAGES.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => choose(item.value)}
                  style={styles.option}
                >
                  <Text role="row">{item.label}</Text>
                  {item.value === language ? <Check size={18} color={color.accent} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <Pressable onPress={() => router.push('/contacts')} style={[styles.card, styles.row]}>
        <Text role="row">Мои контакты</Text>
        <View style={styles.value}>
          <Text role="rowPlain" tone="muted">
            {contacts.length}
          </Text>
          <ChevronRight size={18} color={color.muted} />
        </View>
      </Pressable>

      <Button
        label="Выйти"
        variant="danger"
        onPress={() => router.replace('/onboarding/welcome')}
      />
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: space.s5,
      paddingTop: space.s5,
      paddingBottom: space.s7,
      gap: space.s4,
    },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s4,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s4,
    },
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
    value: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    settingsCard: {
      zIndex: 20,
    },
    settingsWrap: {
      position: 'relative',
      zIndex: 20,
    },
    options: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: space.s1,
      backgroundColor: color.raise,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s3,
      paddingVertical: space.s1,
      boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
      zIndex: 30,
    },
    option: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
  }),
);
