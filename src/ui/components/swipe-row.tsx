import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconComponent } from '@/ui/kit/icon';
import { useTheme } from '@/ui/theme';

export const SWIPE_WIDTH = 64;

const openRows = new Set<SwipeableMethods>();
let rowRect: { x: number; y: number; width: number; height: number } | null = null;

export function closeOpenRows(): void {
  for (const row of openRows) row.close();
  rowRect = null;
}

export function maybeCloseOpenRows(x: number, y: number): void {
  if (openRows.size === 0) return;
  const rect = rowRect;
  if (rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
    return;
  }
  closeOpenRows();
}

export function SwipeRow({
  tone,
  icon,
  onAction,
  children,
}: {
  tone: 'danger' | 'accent';
  icon: IconComponent;
  onAction: () => void;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const swipe = useRef<SwipeableMethods | null>(null);
  const row = useRef<ComponentRef<typeof View>>(null);
  const moved = useRef<SharedValue<number> | null>(null);
  const armed = useRef(false);
  const tint = tone === 'danger' ? color.dangerFill : color.accent;

  const stretch = useCallback((value: number) => {
    armed.current = value > SWIPE_WIDTH;
  }, []);

  const show = () => {
    row.current?.measureInWindow((x, y, width, height) => {
      rowRect = { x, y, width, height };
    });
  };

  const hide = () => {
    rowRect = null;
  };

  useEffect(
    () => () => {
      if (swipe.current) openRows.delete(swipe.current);
    },
    [],
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      renderRightActions={(_, translation) => {
        moved.current = translation;
        return (
          <Action
            translation={translation}
            onStretch={stretch}
            tint={tint}
            icon={icon}
            onAction={onAction}
          />
        );
      }}
      rightThreshold={0}
      friction={2}
      overshootRight
      onSwipeableOpenStartDrag={() => {
        armed.current = false;
        const current = swipe.current;
        if (!current) return;
        openRows.add(current);
        for (const row of openRows) {
          if (row !== current) row.close();
        }
      }}
      onSwipeableWillOpen={() => {
        const value = Math.abs(moved.current?.value ?? 0);
        if (armed.current || value > SWIPE_WIDTH) onAction();
      }}
      onSwipeableOpen={show}
      onSwipeableClose={hide}
    >
      <View ref={row} collapsable={false}>
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}

function Action({
  translation,
  onStretch,
  tint,
  icon,
  onAction,
}: {
  translation: SharedValue<number>;
  onStretch: (value: number) => void;
  tint: string;
  icon: IconComponent;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const width = useAnimatedStyle(() => ({
    width: Math.max(SWIPE_WIDTH, Math.abs(translation.value)),
  }));

  useAnimatedReaction(
    () => Math.abs(translation.value),
    (value) => {
      scheduleOnRN(onStretch, value);
    },
  );

  return (
    <Animated.View style={[styles.action, { backgroundColor: tint }, width]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.action')}
        onPress={onAction}
        style={styles.tap}
      >
        <Icon icon={icon} size={22} color={color.onFill} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
