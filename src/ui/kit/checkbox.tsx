import { Check } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/ui/theme';

import { Icon } from './icon';
import { Text } from './text';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Checkbox({ label, checked, onChange, disabled, style }: Props) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, style]}
    >
      <View style={[styles.box, checked ? { backgroundColor: color.accent } : null]}>
        {checked ? <Icon icon={Check} size={13} color={color.onFill} /> : null}
      </View>
      <Text role="row" tone={disabled ? 'faint' : 'paper'}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: 44,
    },
    box: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
