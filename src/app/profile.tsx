import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { isUsernameShapeValid } from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { applyLanguage } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { contactsState, subscribeContacts } from '@/ui/mocks/contacts';
import { profileState, saveProfile, subscribeProfile } from '@/ui/mocks/profile';
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);

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
  const clean = username.trim().replace(/^@/, '');
  const valid = isUsernameShapeValid(clean);

  const openEdit = () => {
    setName(profile.name);
    setUsername(profile.username);
    setEditing(true);
  };

  const save = () => {
    if (!valid) return;
    saveProfile({ name: name.trim() || clean, username: clean });
    setEditing(false);
  };

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar title="Профиль" left={<BackButton label="Назад" onPress={() => router.back()} />} />
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Изменить профиль"
        onPress={openEdit}
        style={[styles.card, styles.person]}
      >
        <Avatar name={profile.name} size={64} />
        <View style={styles.words}>
          <View style={styles.nameRow}>
            <Text role="title" numberOfLines={1} style={styles.name}>
              {profile.name}
            </Text>
            <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
              {`@${profile.username}`}
            </Text>
          </View>
          <Text role="noteSm" tone="faint">
            {profile.email}
          </Text>
        </View>
      </Pressable>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text role="row">Хранилище</Text>
          <Text role="rowPlain" tone="muted">
            {`${number(left)} / ${number(profile.storageTotalGb)} ГБ`}
          </Text>
        </View>
        <Divider style={styles.fullDivider} />
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

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title="Изменить профиль">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}
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
        </KeyboardAvoidingView>
      </BottomSheet>
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
    form: {
      gap: space.s4,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    fullDivider: {
      marginHorizontal: -space.s4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      flexShrink: 1,
    },
    nick: {
      flexShrink: 1,
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
