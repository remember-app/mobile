import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { themed, useTheme } from '@/ui/theme';

export function Checkbox({
  checked,
  label,
  tint,
  onPress,
}: {
  checked: boolean;
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const mark = tint ?? color.accent;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.box,
        {
          borderColor: mark,
          backgroundColor: checked ? mark : 'transparent',
        },
      ]}
    >
      {checked ? <Check size={16} color={color.onFill} strokeWidth={3} /> : null}
    </Pressable>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    box: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
