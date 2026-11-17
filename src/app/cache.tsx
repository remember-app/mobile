import { useFocusEffect } from 'expo-router';
import { ChevronDown, CircleHelp } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cacheUsage, clearCache, clearCacheGroups } from '@/functionality';
import type { MediaScope } from '@/integrations/files/media-cache';
import { CacheDonut, type CacheSlice } from '@/ui/components/cache-donut';
import { confirmAction } from '@/ui/confirm';
import { size } from '@/ui/format';
import { useProjects } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { Button, IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Checkbox } from '@/ui/kit/checkbox';
import { Text } from '@/ui/kit/text';
import { BackBar } from '@/ui/screens/chrome';
import { height, labelColors, space, themed, useTheme } from '@/ui/theme';

type Usage = ReturnType<typeof cacheUsage>;

const EMPTY: Usage = { total: 0, projects: [], other: [], data: 0 };

export default function CacheScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const [usage, setUsage] = useState<Usage>(EMPTY);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [hint, setHint] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setUsage(cacheUsage());
    }, []),
  );

  const titles = new Map(projects.cards.map((card) => [card.id, card.title]));
  const memories = usage.projects
    .filter((group) => titles.has(group.id))
    .map((group) => ({ id: group.id, label: titles.get(group.id) ?? '', bytes: group.bytes }))
    .sort((left, right) => right.bytes - left.bytes);
  const hidden = usage.projects.filter((group) => !titles.has(group.id));
  const scoped = (scope: MediaScope) => usage.other.find((group) => group.id === scope)?.bytes ?? 0;
  const avatarsBytes = scoped('avatars');
  const systemMediaBytes = scoped('system');
  const musicBytes = scoped('music');
  const orphanBytes = hidden.reduce((sum, group) => sum + group.bytes, 0) + scoped('misc');
  const systemBytes = avatarsBytes + systemMediaBytes + musicBytes + orphanBytes + usage.data;

  const allIds = [...memories.map((memory) => memory.id), 'system'];
  const isSelected = (id: string) => selected === null || selected.has(id);
  const toggle = (id: string) => {
    setSelected((was) => {
      const next = new Set(was ?? allIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const palette = labelColors(theme);
  const slices: CacheSlice[] = [
    ...memories.map((memory, index) => ({
      id: memory.id,
      label: memory.label,
      bytes: memory.bytes,
      color: palette[index % palette.length] ?? theme.color.accent,
      on: isSelected(memory.id),
    })),
    {
      id: 'system',
      label: t('cache.system'),
      bytes: systemBytes,
      color: palette[memories.length % palette.length] ?? theme.color.accent,
      on: isSelected('system'),
    },
  ];
  const tintOf = (id: string) => slices.find((slice) => slice.id === id)?.color;

  const selectedBytes =
    memories.reduce((sum, memory) => sum + (isSelected(memory.id) ? memory.bytes : 0), 0) +
    (isSelected('system') ? systemBytes : 0);

  const breakdown = [
    { id: 'avatars', label: t('cache.avatars'), bytes: avatarsBytes },
    { id: 'systemMedia', label: t('cache.systemMedia'), bytes: systemMediaBytes },
    { id: 'music', label: t('cache.music'), bytes: musicBytes },
    { id: 'orphans', label: t('cache.orphans'), bytes: orphanBytes },
    { id: 'data', label: t('cache.data'), bytes: usage.data },
  ];

  const clear = () =>
    confirmAction({
      confirm: t('cache.clear'),
      destructive: true,
      onConfirm: () => {
        const chosen = memories.filter((memory) => isSelected(memory.id));
        const system = isSelected('system');
        if (system && memories.every((memory) => isSelected(memory.id))) clearCache();
        else
          clearCacheGroups(
            [
              ...chosen.map((memory) => memory.id),
              ...(system ? hidden.map((group) => group.id) : []),
            ],
            system,
          );
        setUsage(cacheUsage());
        setSelected(null);
      },
    });

  return (
    <View style={styles.root}>
      <Board
        bar={
          <BackBar
            title={t('cache.title')}
            right={
              <IconButton
                icon={CircleHelp}
                label={t('cache.about')}
                tone="surface"
                size={44}
                on={hint}
                onPress={() => setHint((was) => !was)}
              />
            }
          />
        }
        body={pageBody}
        footer={
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.s4 }]}>
            <Button
              label={
                selectedBytes > 0
                  ? `${t('cache.clear')} · ${size(selectedBytes)}`
                  : t('cache.clear')
              }
              variant="primary"
              disabled={selectedBytes === 0}
              onPress={clear}
            />
          </View>
        }
      >
        <View style={styles.top}>
          <CacheDonut slices={slices} />
        </View>

        {memories.length > 0 ? (
          <Card style={styles.list}>
            {memories.map((memory, index) => (
              <View key={memory.id}>
                {index === 0 ? null : <Divider />}
                <View style={styles.line}>
                  <Checkbox
                    checked={isSelected(memory.id)}
                    label={memory.label}
                    tint={tintOf(memory.id)}
                    onPress={() => toggle(memory.id)}
                  />
                  <Text role="row" numberOfLines={1} style={styles.grow}>
                    {memory.label}
                  </Text>
                  <Text role="rowPlain" tone="muted">
                    {size(memory.bytes)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.list}>
          <View style={styles.line}>
            <Checkbox
              checked={isSelected('system')}
              label={t('cache.system')}
              tint={tintOf('system')}
              onPress={() => toggle('system')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cache.system')}
              accessibilityState={{ expanded: systemOpen }}
              onPress={() => setSystemOpen((was) => !was)}
              style={styles.systemToggle}
            >
              <Text role="row" style={styles.grow}>
                {t('cache.system')}
              </Text>
              <ChevronDown
                size={18}
                color={theme.color.muted}
                style={{ transform: [{ rotate: systemOpen ? '180deg' : '0deg' }] }}
              />
            </Pressable>
            <Text role="rowPlain" tone="muted">
              {size(systemBytes)}
            </Text>
          </View>
          {systemOpen
            ? breakdown.map((line) => (
                <View key={line.id}>
                  <Divider />
                  <View style={styles.line}>
                    <Text role="row" style={styles.grow}>
                      {line.label}
                    </Text>
                    <Text role="rowPlain" tone="muted">
                      {size(line.bytes)}
                    </Text>
                  </View>
                </View>
              ))
            : null}
        </Card>
      </Board>

      {hint ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('action.close')}
            onPress={() => setHint(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.hint, { top: insets.top + height.bar + space.s1 }]}>
            <Card style={styles.hintCard}>
              <Text role="body">{t('cache.hint')}</Text>
            </Card>
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    root: { flex: 1 },
    top: {
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: space.s4,
    },
    list: {
      paddingHorizontal: space.s4,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: 52,
    },
    grow: {
      flex: 1,
    },
    systemToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      minHeight: 52,
    },
    footer: {
      paddingHorizontal: space.s5,
      paddingTop: space.s3,
    },
    hint: {
      position: 'absolute',
      right: space.s4,
      width: 300,
      zIndex: 20,
    },
    hintCard: {
      padding: space.s4,
    },
  }),
);
