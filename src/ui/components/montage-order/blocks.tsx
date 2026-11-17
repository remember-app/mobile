import { Music, Sparkles, VolumeX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Icon, type IconComponent } from '@/ui/kit/icon';
import { Image } from '@/ui/kit/image';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export type FactItem = { icon: IconComponent; value: string };
export type SummarySong = { name: string; author: string | null; coverUrl: string | null };

export function Facts({ items }: { items: readonly FactItem[] }) {
  const styles = useStyles();
  return (
    <View style={styles.facts}>
      {items.map((item, at) => (
        <Fact key={`${item.value}-${at}`} item={item} />
      ))}
    </View>
  );
}

function Fact({ item }: { item: FactItem }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <Card style={styles.fact}>
      <Icon icon={item.icon} size={16} color={color.muted} />
      <Text role="row">{item.value}</Text>
    </Card>
  );
}

export function MusicCard({
  songs,
  group,
  director,
  onPress,
}: {
  songs: readonly SummarySong[];
  group?: string | null;
  director?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const first = songs[0];
  const spare = songs.length - 1;
  return (
    <Card
      style={styles.row}
      onPress={onPress}
      label={onPress ? t('montage.order.musicTitle') : undefined}
    >
      {director ? (
        <>
          <View style={[styles.sign, { backgroundColor: color.raise }]}>
            <Sparkles size={18} color={color.paper} />
          </View>
          <View style={styles.rowWords}>
            <Text role="row">{t('montage.order.musicTitle')}</Text>
            <Text role="meta" tone="muted">
              {t('montage.order.directorChoice')}
            </Text>
          </View>
        </>
      ) : first ? (
        <>
          <View style={styles.cover}>
            {first.coverUrl ? (
              <Image
                source={first.coverUrl}
                group={group}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Music size={18} color={color.muted} />
            )}
          </View>
          <View style={styles.rowWords}>
            <Text role="row" numberOfLines={1}>
              {first.name}
            </Text>
            {first.author ? (
              <Text role="meta" tone="muted" numberOfLines={1}>
                {first.author}
              </Text>
            ) : null}
          </View>
          {spare > 0 ? (
            <View style={[styles.count, { backgroundColor: color.raise }]}>
              <Text role="meta">+{spare}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.sign, { backgroundColor: color.raise }]}>
            <VolumeX size={18} color={color.muted} />
          </View>
          <View style={styles.rowWords}>
            <Text role="row">{t('montage.order.noMusicChoice')}</Text>
          </View>
        </>
      )}
    </Card>
  );
}

export function PromptCard({ prompt, onOpen }: { prompt: string | null; onOpen?: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (!prompt) return null;
  return (
    <Card
      style={styles.row}
      onPress={onOpen}
      label={onOpen ? t('montage.movie.prompt') : undefined}
    >
      <Text role="body" style={styles.quote} numberOfLines={3}>
        {prompt}
      </Text>
    </Card>
  );
}

export function FramesCard({
  frames,
  group,
  onPress,
}: {
  frames: readonly string[];
  group?: string | null;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <Card style={styles.framesCard}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.framesRow}
      >
        {frames.map((uri) => (
          <Image
            key={uri}
            source={uri}
            group={group}
            style={styles.frame}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ))}
      </ScrollView>
      {onPress ? (
        <Button label={t('montage.movie.allFrames')} variant="quiet" onPress={onPress} />
      ) : null}
    </Card>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    facts: {
      flexDirection: 'row',
      gap: space.s2,
    },
    fact: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: space.s2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s3,
    },
    rowWords: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    sign: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cover: {
      width: 44,
      height: 44,
      borderRadius: radius.tile,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    count: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.s1,
    },
    quote: {
      flex: 1,
    },
    framesCard: {
      gap: space.s2,
      padding: space.s3,
    },
    framesRow: {
      gap: space.s1,
    },
    frame: {
      width: 56,
      height: 56,
      borderRadius: radius.tile,
    },
  }),
);
