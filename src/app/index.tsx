import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { setNetworkOverride } from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { useNetwork } from '@/ui/hooks';
import { applyLanguage } from '@/ui/i18n';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlockHead } from '@/ui/kit/block-head';
import { Button } from '@/ui/kit/button';
import { Segment } from '@/ui/kit/segment';
import { RowToggle } from '@/ui/kit/toggle';
import { setTheme, space, themed, useThemeChoice } from '@/ui/theme';

const THEMES = [
  { value: 'system', label: 'Система' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
] as const;

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const;

export default function DevScreen() {
  const router = useRouter();
  const theme = useThemeChoice();
  const network = useNetwork();
  const [language, setLanguage] = useState<Language>('ru');
  const styles = useStyles();
  const online = network.status !== 'offline';

  useEffect(() => {
    void readLanguage().then((next) => {
      setLanguage(next);
      void applyLanguage(next);
    });
  }, []);

  return (
    <Board bar={<AppBar variant="root" title="Разработка" />} body={styles.body}>
      <BlockHead label="Настройки" />
      <View style={styles.card}>
        <Segment
          label="Тема"
          options={THEMES}
          value={theme}
          onChange={(next) => void setTheme(next)}
        />
        <Segment
          label="Язык"
          options={LANGUAGES}
          value={language}
          onChange={(next) => {
            setLanguage(next);
            void writeLanguage(next);
            void applyLanguage(next);
          }}
        />
        <RowToggle label="Сеть" value={online} onValueChange={(next) => setNetworkOverride(next)} />
      </View>

      <BlockHead label="Экраны" />
      <View style={styles.column}>
        <Button
          label="Онбординг"
          variant="secondary"
          onPress={() => router.push('/onboarding/welcome')}
        />
        <Button label="Приложение" variant="secondary" onPress={() => router.push('/home')} />
      </View>

      <BlockHead label="Плейграунд" />
      <Button label="Кит" variant="secondary" onPress={() => router.push('/kit')} />
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
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
    },
    column: {
      gap: space.s3,
    },
  }),
);
