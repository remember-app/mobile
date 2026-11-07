import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { isUsernameShapeValid } from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { Person } from '@/ui/components/person';
import { confirmAction } from '@/ui/confirm';
import { number } from '@/ui/format';
import { applyLanguage } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Field } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { contactsState, subscribeContacts } from '@/ui/mocks/contacts';
import { profileState, saveProfile, setAvatar, subscribeProfile } from '@/ui/mocks/profile';
import { radius, setTheme, space, themed, useTheme, useThemeChoice } from '@/ui/theme';

const LANGUAGES = ['ru', 'en'] as const;
const THEMES = ['system', 'light', 'dark'] as const;

const LANGUAGE_LABELS = {
  ru: 'profile.languages.ru',
  en: 'profile.languages.en',
} as const;

const THEME_LABELS = {
  system: 'profile.themes.system',
  light: 'profile.themes.light',
  dark: 'profile.themes.dark',
} as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const styles = useStyles();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const [language, setLanguage] = useState<Language>('ru');
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const chosen = useThemeChoice();
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

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatar(result.assets[0]?.uri ?? null);
  };

  return (
    <Board
      body={pageBody}
      bar={
        <AppBar
          title={t('profile.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
        />
      }
    >
      <Card label={t('profile.edit')} onPress={openEdit} style={[styles.pad, styles.person]}>
        <Person
          name={profile.name}
          username={profile.username}
          size={64}
          heading
          note={profile.email}
          uri={profile.avatarUri}
        />
      </Card>

      <Card style={styles.pad}>
        <View style={styles.row}>
          <Text role="row">{t('profile.storage')}</Text>
          <Text role="rowPlain" tone="muted">
            {`${number(left)} / ${number(profile.storageTotalGb)} ${t('unit.gb')}`}
          </Text>
        </View>
        <Divider style={styles.fullDivider} />
        <View style={styles.row}>
          <Text role="row">{t('profile.tokens')}</Text>
          <Text role="rowPlain" tone="muted">
            {profile.tokens}
          </Text>
        </View>
      </Card>

      <Card style={[styles.pad, styles.settingsCard]}>
        <SettingsSelect
          label={t('profile.language')}
          value={t(LANGUAGE_LABELS[language])}
          open={open}
          onToggle={() => {
            setOpen((was) => !was);
            setThemeOpen(false);
          }}
          options={LANGUAGES.map((item) => ({
            value: item,
            label: t(LANGUAGE_LABELS[item]),
            selected: item === language,
          }))}
          onChange={choose}
        />
        <Divider style={styles.fullDivider} />
        <SettingsSelect
          label={t('profile.theme')}
          value={t(THEME_LABELS[chosen])}
          open={themeOpen}
          onToggle={() => {
            setThemeOpen((was) => !was);
            setOpen(false);
          }}
          options={THEMES.map((item) => ({
            value: item,
            label: t(THEME_LABELS[item]),
            selected: item === chosen,
          }))}
          onChange={(next) => {
            setThemeOpen(false);
            void setTheme(next);
          }}
        />
      </Card>

      <Card onPress={() => router.navigate('/contacts')} style={[styles.pad, styles.row]}>
        <Text role="row">{t('profile.contacts')}</Text>
        <View style={styles.value}>
          <Text role="rowPlain" tone="muted">
            {contacts.length}
          </Text>
          <ChevronRight size={18} color={color.muted} />
        </View>
      </Card>

      <Button
        label={t('profile.logout')}
        variant="danger"
        onPress={() =>
          confirmAction({
            confirm: t('profile.logout'),
            destructive: true,
            onConfirm: () => router.replace('/onboarding/welcome'),
          })
        }
      />

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title={t('profile.edit')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
          onPress={() => void pickAvatar()}
          style={styles.avatarEdit}
        >
          <Avatar name={profile.name} size={72} uri={profile.avatarUri} />
          <Text role="controlSm" tone="accent">
            {t('profile.changePhoto')}
          </Text>
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}
        >
          <Field
            label={t('profile.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('profile.name')}
            autoCapitalize="words"
          />
          <Field
            label={t('profile.nick')}
            value={username}
            onChangeText={setUsername}
            placeholder={t('profile.nick')}
            prefix="@"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label={t('action.save')} variant="primary" disabled={!valid} onPress={save} />
        </KeyboardAvoidingView>
      </BottomSheet>
    </Board>
  );
}

function SettingsSelect<T extends string>({
  label,
  value,
  open,
  onToggle,
  options,
  onChange,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  options: readonly { value: T; label: string; selected: boolean }[];
  onChange: (value: T) => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.settingsWrap, open ? styles.front : null]}>
      <Pressable onPress={onToggle} style={styles.row}>
        <Text role="row">{label}</Text>
        <View style={styles.value}>
          <Text role="rowPlain" tone="muted">
            {value}
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
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={styles.option}
            >
              <Text role="row">{option.label}</Text>
              {option.selected ? <Check size={18} color={color.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s4,
    },
    form: {
      gap: space.s4,
    },
    avatarEdit: {
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: space.s2,
    },
    fullDivider: {
      marginHorizontal: -space.s4,
    },
    pad: {
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
    front: {
      zIndex: 40,
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
