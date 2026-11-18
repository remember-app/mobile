import { ListFilter } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { Label, Member } from '@/models';
import { Icon } from '@/ui/kit/primitives/icon';
import { useTheme } from '@/ui/theme';

import { GalleryFiltersPanel, type GalleryFiltersValue } from './gallery-filters';

const HEIGHT = 288;

export function FilterControl({
  chrome,
  anim,
  filtering,
  full,
  onToggle,
  filters,
  labels,
  members,
  onChange,
}: {
  chrome: SharedValue<number>;
  anim: SharedValue<number>;
  filtering: boolean;
  full: number;
  onToggle: () => void;
  filters: GalleryFiltersValue;
  labels: Label[];
  members: Member[];
  onChange: (value: GalleryFiltersValue) => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const left = useAnimatedStyle(() => ({
    opacity: chrome.value,
    transform: [{ translateX: (1 - chrome.value) * -72 }],
  }));
  const block = useAnimatedStyle(() => ({
    width: 52 + (full - 52) * anim.value,
    height: 52 + (HEIGHT - 52) * anim.value,
  }));
  const icon = useAnimatedStyle(() => ({ opacity: 1 - anim.value }));
  const content = useAnimatedStyle(() => ({ opacity: anim.value }));
  return (
    <Animated.View style={[left, styles.layer]}>
      <Animated.View
        style={[styles.block, block, { backgroundColor: color.surface, borderColor: color.line }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('project.filter')}
          hitSlop={8}
          pointerEvents={filtering ? 'none' : 'auto'}
          onPress={onToggle}
          style={styles.hit}
        >
          <Animated.View style={icon}>
            <Icon icon={ListFilter} size={26} color={color.paper} />
          </Animated.View>
        </Pressable>
        {filtering ? (
          <Animated.View style={[styles.content, content]}>
            <GalleryFiltersPanel
              value={filters}
              labels={labels}
              members={members}
              onChange={onChange}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    width: 52,
    height: 52,
    zIndex: 2,
  },
  block: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
