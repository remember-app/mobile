import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  isUsernameShapeValid,
  loadAvatar,
  loadContacts,
  setName as saveName,
  setUsername as saveUsername,
  setAccountLanguage,
  signOut,
  uploadAvatar,
} from '@/functionality';
import { writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { Person } from '@/ui/components/person';
import { SettingsSelect } from '@/ui/components/settings-select';
import { confirmAction } from '@/ui/confirm';
import { number } from '@/ui/format';
import { useAvatar, useContacts, useSession } from '@/ui/hooks';
import { applyLanguage } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Field } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { setTheme, space, themed, useTheme, useThemeChoice } from '@/ui/theme';

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
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const avatar = useAvatar();
  const contacts = useContacts();
  const [language, setLanguage] = useState<Language>(account?.language ?? 'ru');
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const chosen = useThemeChoice();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account?.name ?? '');
  const [username, setUsername] = useState(account?.username ?? '');

  useEffect(() => {
    void loadAvatar();
    void loadContacts();
  }, []);

  useEffect(() => {
    if (account) setLanguage(account.language);
  }, [account?.language]);

  const choose = (next: Language) => {
    setLanguage(next);
    setOpen(false);
    void writeLanguage(next);
    void applyLanguage(next);
    void setAccountLanguage(next).catch(() => undefined);
  };

  const storage = account?.consumables.storage;
  const tokens = account?.consumables.tokens;
  const gib = 1024 ** 3;
  const left = Math.max(0, (storage?.bytes ?? 0) - (storage?.spend ?? 0)) / gib;
  const total = (storage?.bytes ?? 0) / gib;
  const tokenLeft = Math.max(0, (tokens?.tokens ?? 0) - (tokens?.spend ?? 0));
  const clean = username.trim().replace(/^@/, '');
  const valid = isUsernameShapeValid(clean);

  const openEdit = () => {
    setName(account?.name ?? '');
    setUsername(account?.username ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (!valid) return;
    try {
      await saveName(name.trim() || null);
      await saveUsername(clean);
      setEditing(false);
    } catch {
      return;
    }
  };

  const pickAvatar = async () => {
    setEditing(false);
    await new Promise((resolve) => setTimeout(resolve, 260));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
    await uploadAvatar(asset.uri, asset.fileName ?? `avatar.${extension}`).catch(() => undefined);
  };

  if (!account) return null;

  return (
    <Board
      body={pageBody}
      bar={
        <AppBar
          title={t('profile.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
          right={
            <IconButton
              icon={LogOut}
              label={t('profile.logout')}
              tone="ghost"
              size={48}
              onPress={() =>
                confirmAction({
                  confirm: t('profile.logout'),
                  destructive: true,
                  onConfirm: () => {
                    void signOut().finally(() => router.replace('/onboarding/welcome'));
                  },
                })
              }
            />
          }
        />
      }
    >
      <Card label={t('profile.edit')} onPress={openEdit} style={[styles.pad, styles.person]}>
        <Person
          name={account.name ?? ''}
          username={account.username ?? ''}
          size={64}
          heading
          note={account.email ?? ''}
          uri={avatar.url}
        />
      </Card>

      <Card style={styles.pad}>
        <View style={styles.row}>
          <Text role="row">{t('profile.storage')}</Text>
          <Text role="rowPlain" tone="muted">
            {`${number(left)} / ${number(total)} ${t('unit.gb')}`}
          </Text>
        </View>
        <Divider style={styles.fullDivider} />
        <View style={styles.row}>
          <Text role="row">{t('profile.tokens')}</Text>
          <Text role="rowPlain" tone="muted">
            {tokenLeft}
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
            {contacts.contacts.length}
          </Text>
          <ChevronRight size={18} color={color.muted} />
        </View>
      </Card>

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title={t('profile.edit')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
          onPress={() => void pickAvatar()}
          style={styles.avatarEdit}
        >
          <Avatar name={account.name ?? ''} size={72} uri={avatar.url} />
          <Text role="controlSm" tone="accent">
            {t('profile.changePhoto')}
          </Text>
        </Pressable>
        <View style={styles.form}>
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
        </View>
      </BottomSheet>
    </Board>
  );
}

const useStyles = themed(() =>
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
  }),
);
