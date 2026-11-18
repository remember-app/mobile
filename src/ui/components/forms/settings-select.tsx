import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconComponent } from '@/ui/kit/primitives/icon';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export function SettingsSelect<T extends string>({
  label,
  value,
  open,
  onToggle,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  options: readonly { value: T; label: string; selected: boolean }[];
  onChange: (value: T) => void;
  icon?: IconComponent;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.wrap, open ? styles.front : null]}>
      <Pressable onPress={onToggle} style={styles.row}>
        <View style={styles.label}>
          {icon ? <Icon icon={icon} size={18} color={color.muted} /> : null}
          <Text role="row" numberOfLines={1} style={styles.labelText}>
            {label}
          </Text>
        </View>
        <View style={styles.value}>
          <Text role="rowPlain" tone="muted">
            {value}
          </Text>
          {open ? (
            <ChevronUp size={18} color={color.muted} />
          ) : (
            <ChevronDown size={18} color={color.muted} />
          )}
        </View>
      </Pressable>
      {open ? (
        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={styles.option}
            >
              <Text role="row">{option.label}</Text>
              {option.selected ? <Check size={18} color={color.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    wrap: {
      position: 'relative',
      zIndex: 20,
    },
    front: {
      zIndex: 40,
    },
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
    label: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      flexShrink: 1,
    },
    labelText: {
      flexShrink: 1,
    },
    value: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    options: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: space.s1,
      backgroundColor: color.raise,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s3,
      paddingVertical: space.s1,
      boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
      zIndex: 30,
    },
    option: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
  }),
);
