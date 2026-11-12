import { Image } from 'expo-image';
import {
  Clock,
  Coins,
  Images,
  RectangleHorizontal,
  RectangleVertical,
  Star,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { duration } from '@/ui/format';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Segment } from '@/ui/kit/segment';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

import { Facts, MusicCard, PromptCard, type SummarySong } from './blocks';
import type { Orientation } from './wizard';

const ON_PHOTO = '#ffffff';
const ON_PHOTO_QUIET = 'rgba(255,255,255,0.78)';
const POSTER_CELLS = 3;

export function OrderSummary({
  title,
  seconds,
  orientation,
  shots,
  shotsCount,
  requiredCount,
  songs,
  director,
  prompt,
  tokens,
  payer,
  onPayer,
  projectFree,
  userFree,
  loading,
  failed,
  problems,
  funded,
}: {
  title: string;
  seconds: number;
  orientation: Orientation;
  shots: readonly string[];
  shotsCount: number;
  requiredCount: number;
  songs: readonly SummarySong[];
  director: boolean;
  prompt: string | null;
  tokens: number;
  payer: 'project' | 'user';
  onPayer: (value: 'project' | 'user') => void;
  projectFree: number;
  userFree: number;
  loading: boolean;
  failed: boolean;
  problems: readonly string[];
  funded: boolean;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const free = payer === 'project' ? projectFree : userFree;

  return (
    <>
      <View
        style={[
          styles.poster,
          {
            height: orientation === 'portrait' ? 200 : 150,
            backgroundColor: color.surface,
          },
        ]}
      >
        <View style={styles.posterCells}>
          {Array.from({ length: POSTER_CELLS }, (_, at) => {
            const uri = shots[at];
            return (
              <View
                key={uri ?? at}
                style={[styles.posterCell, at === 0 ? styles.posterLead : null]}
              >
                {uri ? (
                  <Image
                    source={uri}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : null}
              </View>
            );
          })}
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.posterScrim]} />
        <View style={styles.posterFoot}>
          <Text role="displaySm" numberOfLines={2} style={styles.onPhoto}>
            {title}
          </Text>
          {requiredCount > 0 ? (
            <View style={styles.posterMeta}>
              <Star size={13} color={color.accent} fill={color.accent} />
              <Text role="meta" style={styles.onPhotoQuiet}>
                {requiredCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Facts
        items={[
          { icon: Clock, value: duration(seconds) },
          {
            icon: orientation === 'portrait' ? RectangleVertical : RectangleHorizontal,
            value: orientation === 'portrait' ? '9:16' : '16:9',
          },
          { icon: Images, value: String(shotsCount) },
          { icon: Star, value: String(requiredCount) },
        ]}
      />

      <MusicCard songs={songs} director={director} />
      <PromptCard prompt={prompt} />

      <Card style={styles.cost}>
        {loading ? (
          <View style={styles.centre}>
            <CircularSpinner size={24} />
          </View>
        ) : failed ? (
          <Text role="body" tone="danger">
            {t('montage.order.error')}
          </Text>
        ) : problems.length > 0 ? (
          problems.map((problem) => (
            <Text key={problem} role="meta" tone="danger">
              {problem}
            </Text>
          ))
        ) : (
          <>
            <View style={styles.costHead}>
              <View style={[styles.sign, { backgroundColor: color.raise }]}>
                <Coins size={18} color={color.paper} />
              </View>
              <Text role="row" style={styles.costWords}>
                {t('montage.order.tokens')}
              </Text>
              <Text role="title">{tokens}</Text>
            </View>
            <Segment<'project' | 'user'>
              label={t('montage.order.payer')}
              hideLabel
              options={[
                {
                  value: 'project',
                  label: t('montage.order.fromProject'),
                  icon: Users,
                },
                { value: 'user', label: t('montage.order.fromMe'), icon: Coins },
              ]}
              value={payer}
              onChange={onPayer}
            />
            {!funded && tokens > 0 ? (
              <Text role="meta" tone="danger">
                {t('montage.order.tokensShort', { left: free })}
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    poster: {
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    posterCells: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 2,
    },
    posterCell: {
      flex: 1,
      backgroundColor: color.raise,
      overflow: 'hidden',
    },
    posterLead: {
      flex: 1.3,
    },
    posterScrim: {
      experimental_backgroundImage:
        'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.78))',
    },
    posterFoot: {
      marginTop: 'auto',
      padding: space.s4,
      gap: space.s1,
    },
    posterMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
    },
    onPhoto: {
      color: ON_PHOTO,
    },
    onPhotoQuiet: {
      color: ON_PHOTO_QUIET,
    },
    sign: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cost: {
      padding: space.s3,
      gap: space.s3,
    },
    costHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    costWords: {
      flex: 1,
    },
    centre: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space.s3,
    },
  }),
);
