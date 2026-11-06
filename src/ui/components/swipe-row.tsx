import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Icon, type IconComponent } from '@/ui/kit/icon';
import { useTheme } from '@/ui/theme';

export const SWIPE_WIDTH = 64;

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
  const stretch = useSharedValue(0);
  const tint = tone === 'danger' ? color.dangerFill : color.accent;

  return (
    <ReanimatedSwipeable
      renderRightActions={(_, translation) => (
        <Action
          translation={translation}
          stretch={stretch}
          tint={tint}
          icon={icon}
          onAction={onAction}
        />
      )}
      rightThreshold={0}
      friction={2}
      overshootRight
      onSwipeableWillOpen={(direction) => {
        if (direction === 'right' && stretch.value > SWIPE_WIDTH) onAction();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Action({
  translation,
  stretch,
  tint,
  icon,
  onAction,
}: {
  translation: SharedValue<number>;
  stretch: SharedValue<number>;
  tint: string;
  icon: IconComponent;
  onAction: () => void;
}) {
  const { color } = useTheme();
  const width = useAnimatedStyle(() => ({
    width: Math.max(SWIPE_WIDTH, Math.abs(translation.value)),
  }));

  useAnimatedReaction(
    () => Math.abs(translation.value),
    (value) => {
      stretch.value = value;
    },
  );

  return (
    <Animated.View style={[styles.action, { backgroundColor: tint }, width]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Действие"
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
