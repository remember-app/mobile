import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Analysis } from '@/models';
import { scoreColor } from '@/ui/format';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { space, themed, useTheme } from '@/ui/theme';

export function AnalysisBlock({ analysis }: { analysis: Analysis }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <Card clip flat>
      <View style={styles.row}>
        <Sparkles size={18} color={color.accent} />
        <Text role="row" style={[styles.grow, styles.paper]}>
          {t('photo.analysis')}
        </Text>
        <Text role="meta" style={styles.muted}>
          {t('photo.score')}
        </Text>
        <Text role="row" style={{ color: scoreColor(analysis.score) }}>
          {analysis.score.toFixed(1)}
        </Text>
      </View>
      {analysis.description ? (
        <>
          <View style={styles.divider} />
          <View style={styles.body}>
            <Text role="bodySm" style={styles.paper}>
              {analysis.description}
            </Text>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
    },
    grow: {
      flex: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    body: {
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
    },
    paper: {
      color: color.paper,
    },
    muted: {
      color: color.muted,
    },
  }),
);
