import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { StepDots } from '@/ui/components/onboarding/steps';
import { ActionBar } from '@/ui/kit/action-bar';
import { Button } from '@/ui/kit/button';
import { space, themed, useTheme } from '@/ui/theme';

export type Orientation = 'portrait' | 'landscape';

export type Change = (patch: Partial<Draft> | ((was: Draft) => Partial<Draft>)) => void;

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

export function OrderPage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return <View style={{ width, height }}>{children}</View>;
}

export function OrderScroll({
  top,
  bottom,
  children,
}: {
  top: number;
  bottom: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: top + space.s4, paddingBottom: bottom }]}
    >
      {children}
    </ScrollView>
  );
}

export function OrderHead({ step }: { step: number }) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <StepDots step={step} total={STEPS} />
    </View>
  );
}

export function OrderActions({
  back,
  next,
  disabled,
  label,
  chrome,
  hidden,
}: {
  back: () => void;
  next: () => void;
  disabled?: boolean;
  label?: string;
  chrome?: SharedValue<number>;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const style = useAnimatedStyle(() => ({
    opacity: 1 - (chrome?.value ?? 0),
    transform: [{ translateY: (chrome?.value ?? 0) * 96 }],
  }));
  return (
    <ActionBar>
      <Animated.View style={[styles.actions, style]} pointerEvents={hidden ? 'none' : 'auto'}>
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
      </Animated.View>
    </ActionBar>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    page: {
      paddingHorizontal: space.s5,
      gap: space.s4,
    },
    head: {
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingBottom: space.s2,
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
