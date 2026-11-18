import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, themed } from '@/ui/theme';

export function Card({
  children,
  clip,
  flat,
  label,
  onPress,
  style,
}: {
  children?: ReactNode;
  clip?: boolean;
  flat?: boolean;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const look = [styles.card, flat ? styles.flat : null, clip ? styles.clip : null, style];
  if (!onPress) return <View style={look}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={look}>
      {children}
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
    },
    flat: { borderWidth: 0 },
    clip: { overflow: 'hidden' },
  }),
);
