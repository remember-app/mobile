import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { themed, useTheme } from '@/ui/theme';

export function Checkbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
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
          borderColor: checked ? color.accent : color.line,
          backgroundColor: checked ? color.accent : 'transparent',
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
