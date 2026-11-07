import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { setNetworkOverride } from '@/functionality';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import type { Language } from '@/types/language';
import { useNetwork } from '@/ui/hooks';
import { applyLanguage } from '@/ui/i18n';
import { AppBar, Board } from '@/ui/kit/bars';
import { BlockHead } from '@/ui/kit/block-head';
import { Button, IconButton } from '@/ui/kit/button';
import { Segment } from '@/ui/kit/segment';
import { Text } from '@/ui/kit/text';
import { contactsState, setContactCount, subscribeContacts } from '@/ui/mocks/contacts';
import { loadingState, setMockLoading, subscribeLoading } from '@/ui/mocks/loading';
import { projectsState, setMockProjectCount, subscribeProjects } from '@/ui/mocks/projects';
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

export default function DevScreen() {
  const router = useRouter();
  const theme = useThemeChoice();
  const { color } = useTheme();
  const network = useNetwork();
  const projects = useSyncExternalStore(subscribeProjects, projectsState);
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const loading = useSyncExternalStore(subscribeLoading, loadingState);
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

      <BlockHead label="Данные" />
      <View style={styles.card}>
        <CountRow label="Воспоминания" value={projects.length} onChange={setMockProjectCount} />
        <CountRow label="Контакты" value={contacts.length} onChange={setContactCount} />
        <View style={styles.row}>
          <Text role="row">Скелетоны</Text>
          <Switch
            value={loading}
            onValueChange={setMockLoading}
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

function CountRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text role="row">{label}</Text>
      <View style={styles.counter}>
        <IconButton
          icon={Minus}
          label="Меньше"
          tone="ghost"
          size={36}
          disabled={value <= 0}
          onPress={() => onChange(value - 1)}
        />
        <Text role="row" style={styles.count}>
          {value}
        </Text>
        <IconButton
          icon={Plus}
          label="Больше"
          tone="ghost"
          size={36}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    count: {
      minWidth: 24,
      textAlign: 'center',
    },
  }),
);
