import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './text';
export function BlockHead({
  label,
  tone = 'muted',
  children,
}: {
  label: string;
  tone?: 'muted' | 'danger';
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text role="eyebrow" tone={tone} accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  label: { flexGrow: 1 },
});
