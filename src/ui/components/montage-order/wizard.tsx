import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StepDots } from '@/ui/components/onboarding/steps';
import { ActionBar } from '@/ui/kit/action-bar';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space, themed, useTheme } from '@/ui/theme';

export type Orientation = 'portrait' | 'landscape';

export type Draft = {
  templateId: string | null;
  name: string;
  targetSeconds: number;
  orientation: Orientation;
  prompt: string;
  includeItemIds: string[];
  requiredItemIds: string[];
  musicIds: string[];
};

export const STEPS = 5;

export const Start: Draft = {
  templateId: null,
  name: '',
  targetSeconds: 30,
  orientation: 'portrait',
  prompt: '',
  includeItemIds: [],
  requiredItemIds: [],
  musicIds: [],
};

export const dimensionsOf = (orientation: Orientation) =>
  orientation === 'portrait' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

export const orientationOf = (dimensions: { width: number; height: number }): Orientation =>
  dimensions.width >= dimensions.height ? 'landscape' : 'portrait';

export function OrderHead({ step, title }: { step: number; title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <Text role="title" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <StepDots step={step} total={STEPS} />
    </View>
  );
}

export function OrderActions({
  back,
  next,
  disabled,
  label,
}: {
  back: () => void;
  next: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <ActionBar>
      <View style={styles.actions}>
        <Button
          label={t('action.back')}
          variant="secondary"
          onPress={back}
          style={[styles.action, { backgroundColor: color.surface }]}
        />
        <Button
          label={label ?? t('montage.order.next')}
          variant="primary"
          disabled={disabled}
          onPress={next}
          style={styles.action}
        />
      </View>
    </ActionBar>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    head: {
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingBottom: space.s2,
    },
    title: {
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: space.s2,
    },
    action: {
      flex: 1,
    },
  }),
);
