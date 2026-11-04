import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, themed } from '@/theme';
import { hitSlop, TAP } from './tap';
import { Text } from './text';

const TRACK = { width: 52, height: 32 } as const;
export type ToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};
export function Track({ value, disabled }: { value: boolean; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, value ? styles.on : styles.off, disabled ? styles.unavailable : null]}
    >
      <View style={styles.grip} />
    </View>
  );
}
export function Toggle({ label, value, onValueChange, disabled }: ToggleProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop(TAP, TRACK.height)}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}
    >
      <Text role="rowPlain" style={styles.grow}>
        {label}
      </Text>
      <Track value={value} disabled={disabled} />
    </Pressable>
  );
}
export function RowToggle({
  label,
  value,
  onValueChange,
  disabled,
  style,
}: ToggleProps & {
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.card, style]}
    >
      <Text role="row" style={styles.label}>
        {label}
      </Text>
      <Track value={value} disabled={disabled} />
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
      minHeight: TRACK.height,
    },
    grow: { flex: 1, minWidth: 0 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4 - 2,
      paddingVertical: space.s4 - 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.cover,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    label: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21 },
    track: {
      ...TRACK,
      padding: 2,
      borderWidth: 1,
      borderRadius: radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
    },
    on: { backgroundColor: color.accent, borderColor: color.accent, justifyContent: 'flex-end' },
    off: { backgroundColor: color.raise, borderColor: color.line, justifyContent: 'flex-start' },
    unavailable: { opacity: 0.45 },
    grip: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.onFill },
  }),
);
