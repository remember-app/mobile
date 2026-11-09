import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import {
  confirmCode,
  refreshGlobal,
  requestCode,
  setNetworkOverride,
  signOut,
} from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { SettingsSelect } from '@/ui/components/settings-select';
import { useNetwork, useSession } from '@/ui/hooks';
import { applyLanguage } from '@/ui/i18n';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlockHead } from '@/ui/kit/block-head';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { setTheme, space, themed, useTheme, useThemeChoice } from '@/ui/theme';

const THEMES = [
  { value: 'system', label: 'Система' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
] as const;

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const;

const USERS = [
  { email: 'a@x.io', username: 'alice', name: 'Алиса' },
  { email: 'b@x.io', username: 'bob', name: 'Bob' },
  { email: 'c@x.io', username: 'carol', name: 'Кэрол' },
  { email: 'd@x.io', username: 'dave', name: 'Dave' },
];

type Open = 'user' | 'theme' | 'language' | null;

export default function DevScreen() {
  const router = useRouter();
  const theme = useThemeChoice();
  const { color } = useTheme();
  const network = useNetwork();
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [language, setLanguage] = useState<Language>('ru');
  const [open, setOpen] = useState<Open>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles();
  const online = network.status !== 'offline';

  useEffect(() => {
    void readLanguage().then((next) => {
      setLanguage(next);
      void applyLanguage(next);
    });
  }, []);

  const switchUser = async (email: string) => {
    setOpen(null);
    setSwitching(email);
    setError(null);
    try {
      await signOut();
      const result = await requestCode(email);
      await confirmCode(email, result.code ?? '123456');
      await refreshGlobal();
      router.navigate('/home');
    } catch {
      setError('Не удалось войти под этим пользователем');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Board bar={<AppBar variant="root" title="Разработка" />} body={styles.body}>
      {open !== null ? <Pressable style={styles.overlay} onPress={() => setOpen(null)} /> : null}
      <BlockHead label="Настройки" />
      <View style={styles.card}>
        <SettingsSelect
          label="Пользователь"
          value={switching ? 'Переключаем…' : (account?.username ?? 'не выбран')}
          open={open === 'user'}
          onToggle={() => setOpen(open === 'user' ? null : 'user')}
          options={USERS.map((user) => ({
            value: user.email,
            label: `${user.username} · ${user.email}`,
            selected: account?.email === user.email,
          }))}
          onChange={(email) => void switchUser(email)}
        />
        {error ? (
          <Text role="hint" tone="danger">
            {error}
          </Text>
        ) : null}
        <SettingsSelect
          label="Тема"
          value={THEMES.find((option) => option.value === theme)?.label ?? theme}
          open={open === 'theme'}
          onToggle={() => setOpen(open === 'theme' ? null : 'theme')}
          options={THEMES.map((option) => ({
            value: option.value,
            label: option.label,
            selected: option.value === theme,
          }))}
          onChange={(next) => {
            setOpen(null);
            void setTheme(next);
          }}
        />
        <SettingsSelect
          label="Язык"
          value={LANGUAGES.find((option) => option.value === language)?.label ?? language}
          open={open === 'language'}
          onToggle={() => setOpen(open === 'language' ? null : 'language')}
          options={LANGUAGES.map((option) => ({
            value: option.value,
            label: option.label,
            selected: option.value === language,
          }))}
          onChange={(next) => {
            setOpen(null);
            setLanguage(next);
            void writeLanguage(next);
            void applyLanguage(next);
          }}
        />
        <View style={styles.row}>
          <Text role="row">Сеть</Text>
          <Switch
            value={online}
            onValueChange={(next) => setNetworkOverride(next)}
            trackColor={{ false: color.line, true: color.accent }}
            ios_backgroundColor={color.line}
          />
        </View>
      </View>

      <BlockHead label="Экраны" />
      <View style={styles.column}>
        <Button
          label="Онбординг"
          variant="secondary"
          onPress={() => router.navigate('/onboarding/welcome')}
        />
        <Button label="Приложение" variant="secondary" onPress={() => router.navigate('/home')} />
      </View>
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
    },
    body: {
      paddingHorizontal: space.s4,
      paddingTop: space.s4,
      paddingBottom: space.s7,
      gap: space.s3,
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: color.line,
      padding: space.s4,
      gap: space.s4,
      zIndex: 20,
    },
    column: {
      gap: space.s3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  }),
);
