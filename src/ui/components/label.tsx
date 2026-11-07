import { Tag as TagIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/ui/kit/icon';
import { night, themed } from '@/ui/theme';

export function LabelMark({ tint, size = 30 }: { tint: string; size?: 30 | 64 | 18 }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size === 18 ? 6 : size === 64 ? 14 : 9 },
        { backgroundColor: tint },
      ]}
    >
      <Icon icon={TagIcon} size={size === 64 ? 30 : size === 18 ? 10 : 15} color={night.ink} />
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    mark: { alignItems: 'center', justifyContent: 'center' },
  }),
);
