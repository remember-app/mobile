import { Download, Send, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { IconButton } from '@/ui/kit/controls/button';
import type { IconComponent } from '@/ui/kit/primitives/icon';
import { space } from '@/ui/theme';

export function SelectionActions({
  progress,
  bottom,
  onSave,
  onDelete,
  onShare,
}: {
  progress: SharedValue<number>;
  bottom: number;
  onSave: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.actions, { bottom }]}>
      <RisingAction
        progress={progress}
        index={2}
        icon={Download}
        label={t('action.save')}
        onPress={onSave}
      />
      <RisingAction
        progress={progress}
        index={1}
        icon={Trash2}
        label={t('action.delete')}
        onPress={onDelete}
      />
      <RisingAction
        progress={progress}
        index={0}
        icon={Send}
        label={t('action.share')}
        onPress={onShare}
      />
    </View>
  );
}

function RisingAction({
  progress,
  index,
  icon,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  index: number;
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * index * (52 + space.s2) }],
  }));
  return (
    <Animated.View style={style}>
      <IconButton icon={icon} label={label} tone="surface" size={52} onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: {
    position: 'absolute',
    right: space.s4,
    alignItems: 'flex-end',
    gap: space.s2,
  },
});
