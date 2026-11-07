import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space, themed, useTheme } from '@/ui/theme';

export function StepDots({ step, total }: { step: number; total: number }) {
  const { color } = useTheme();
  const styles = useStyles();
  const current = Math.max(0, step - 1);
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index <= current ? color.accent : color.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

type Props = {
  step: number;
  total: number;
  title: string;
  lead: string;
  back?: () => void;
  children?: ReactNode;
};

export function OnboardingHead({ step, total, title, lead, back, children }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <View style={styles.bar}>
        {back ? (
          <BackButton label={t('action.back')} onPress={back} />
        ) : (
          <View style={styles.side} />
        )}
        <View style={styles.track}>
          <StepDots step={step} total={total} />
        </View>
        <View style={styles.side} />
      </View>
      <View style={styles.words}>
        <Text role="display" accessibilityRole="header">
          {title}
        </Text>
        <Text role="body" tone="muted">
          {lead}
        </Text>
      </View>
      {children}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    head: {
      gap: space.s5,
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    side: {
      width: 44,
      height: 44,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    track: {
      flex: 1,
    },
    words: {
      gap: space.s2,
    },
  }),
);
