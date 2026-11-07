import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { themed } from '@/ui/theme';

export function Divider({
  grow,
  soft,
  style,
}: {
  grow?: boolean;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.divider,
        soft ? styles.dividerSoft : null,
        grow ? styles.dividerGrow : null,
        style,
      ]}
    />
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    divider: { height: 1, backgroundColor: color.line },
    dividerSoft: { backgroundColor: color.raise },
    dividerGrow: { flex: 1 },
  }),
);
