import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { cacheUsage, clearCache } from '@/functionality';
import { CacheDonut, type CacheSlice } from '@/ui/components/cache-donut';
import { confirmAction } from '@/ui/confirm';
import { size } from '@/ui/format';
import { useProjects } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton, Button } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { labelColors, space, useTheme } from '@/ui/theme';

type Usage = ReturnType<typeof cacheUsage>;

export default function CacheScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const projects = useProjects();
  const [usage, setUsage] = useState<Usage>({ total: 0, groups: [] });

  useFocusEffect(
    useCallback(() => {
      setUsage(cacheUsage());
    }, []),
  );

  const titles = new Map(projects.cards.map((card) => [card.id, card.title]));
  const merged = new Map<string, { label: string; bytes: number }>();
  for (const group of usage.groups) {
    const title = group.id === 'other' ? undefined : titles.get(group.id);
    const key = title ? group.id : 'other';
    const known = merged.get(key);
    merged.set(key, {
      label: title ?? t('cache.other'),
      bytes: (known?.bytes ?? 0) + group.bytes,
    });
  }
  const palette = labelColors(theme);
  const slices: CacheSlice[] = [...merged.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([id, group], index) => ({
      id,
      label: group.label,
      bytes: group.bytes,
      color: palette[index % palette.length] ?? theme.color.accent,
    }));

  const clear = () =>
    confirmAction({
      confirm: t('cache.clear'),
      destructive: true,
      onConfirm: () => {
        clearCache();
        setUsage(cacheUsage());
      },
    });

  return (
    <Board
      bar={
        <AppBar
          title={t('cache.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
        />
      }
      body={pageBody}
    >
      <View style={styles.top}>
        <CacheDonut slices={slices} total={usage.total} />
        <Text role="row">{t('cache.used')}</Text>
        <Text role="hint" tone="muted">
          {t('cache.stored')}
        </Text>
      </View>

      {slices.length === 0 ? (
        <Text role="body" tone="muted" style={styles.empty}>
          {t('cache.empty')}
        </Text>
      ) : (
        <Card style={styles.list}>
          {slices.map((slice, index) => (
            <View key={slice.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <View style={[styles.dot, { backgroundColor: slice.color }]} />
                <Text role="row" style={styles.grow}>
                  {slice.label}
                </Text>
                <Text role="rowPlain" tone="muted">
                  {size(slice.bytes)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Button
        label={usage.total > 0 ? `${t('cache.clear')} · ${size(usage.total)}` : t('cache.clear')}
        variant="primary"
        disabled={usage.total === 0}
        onPress={clear}
      />
      <Text role="hint" tone="muted">
        {t('cache.note')}
      </Text>
    </Board>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s4,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: space.s6,
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
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  grow: {
    flex: 1,
  },
});
