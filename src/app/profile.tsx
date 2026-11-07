import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { isUsernameShapeValid } from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { confirmAction } from '@/ui/confirm';
import { applyLanguage, locale } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button } from '@/ui/kit/button';
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

function number(value: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(value);
}

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
      body={styles.body}
      bar={
        <AppBar
          title={t('profile.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.edit')}
        onPress={openEdit}
        style={[styles.card, styles.person]}
      >
        <Avatar name={profile.name} size={64} uri={profile.avatarUri} />
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
      </View>

      <View style={[styles.card, styles.settingsCard]}>
        <View style={[styles.settingsWrap, open ? styles.front : null]}>
          <Pressable
            onPress={() => {
              setOpen((was) => !was);
              setThemeOpen(false);
            }}
            style={styles.row}
          >
            <Text role="row">{t('profile.language')}</Text>
            <View style={styles.value}>
              <Text role="rowPlain" tone="muted">
                {t(LANGUAGE_LABELS[language])}
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
                <Pressable key={item} onPress={() => choose(item)} style={styles.option}>
                  <Text role="row">{t(LANGUAGE_LABELS[item])}</Text>
                  {item === language ? <Check size={18} color={color.accent} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Divider style={styles.fullDivider} />
        <View style={[styles.settingsWrap, themeOpen ? styles.front : null]}>
          <Pressable
            onPress={() => {
              setThemeOpen((was) => !was);
              setOpen(false);
            }}
            style={styles.row}
          >
            <Text role="row">{t('profile.theme')}</Text>
            <View style={styles.value}>
              <Text role="rowPlain" tone="muted">
                {t(THEME_LABELS[chosen])}
              </Text>
              {themeOpen ? (
                <ChevronUp size={18} color={color.muted} />
              ) : (
                <ChevronDown size={18} color={color.muted} />
              )}
            </View>
          </Pressable>
          {themeOpen ? (
            <View style={styles.options}>
              {THEMES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setThemeOpen(false);
                    void setTheme(item);
                  }}
                  style={styles.option}
                >
                  <Text role="row">{t(THEME_LABELS[item])}</Text>
                  {item === chosen ? <Check size={18} color={color.accent} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <Pressable onPress={() => router.navigate('/contacts')} style={[styles.card, styles.row]}>
        <Text role="row">{t('profile.contacts')}</Text>
        <View style={styles.value}>
          <Text role="rowPlain" tone="muted">
            {contacts.length}
          </Text>
          <ChevronRight size={18} color={color.muted} />
        </View>
      </Pressable>

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
    avatarEdit: {
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: space.s2,
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
