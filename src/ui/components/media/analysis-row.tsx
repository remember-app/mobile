import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Analysis } from '@/models';
import { scoreColor } from '@/ui/format';
import { Image } from '@/ui/kit/image';
import { Text } from '@/ui/kit/text';
import { radius, space } from '@/ui/theme';

export function AnalysisRow({
  source,
  group,
  analysis,
  status,
  error,
  onPress,
}: {
  source: string | null;
  group?: string | null;
  analysis: Analysis | null;
  status: string;
  error?: string | null;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const face = (
    <>
      <View style={styles.file}>
        {source ? (
          <Image
            source={source}
            group={group}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.thumb, styles.emptyThumb]} />
        )}
        {analysis?.scoreImportance !== undefined ? (
          <Text role="noteSm" style={{ color: scoreColor(analysis.scoreImportance) }}>
            {t('photo.importanceShort')} {analysis.scoreImportance.toFixed(1)}
          </Text>
        ) : null}
        {analysis?.scoreQuality !== undefined ? (
          <Text role="noteSm" style={{ color: scoreColor(analysis.scoreQuality) }}>
            {t('photo.qualityShort')} {analysis.scoreQuality.toFixed(1)}
          </Text>
        ) : null}
      </View>
      <View style={styles.words}>
        {analysis ? (
          <Text role="body">{analysis.summary}</Text>
        ) : (
          <Text role="body" tone="muted">
            {status}
          </Text>
        )}
        {!analysis && error ? (
          <Text role="hint" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {face}
    </Pressable>
  ) : (
    <View style={styles.row}>{face}</View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s2,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.tile,
  },
  emptyThumb: {
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  file: {
    alignItems: 'center',
    gap: 2,
  },
  words: {
    flex: 1,
    minWidth: 0,
  },
});
