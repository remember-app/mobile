import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/ui/theme';

export function ActionBar({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { paddingBottom: insets.bottom + space.s2 }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
  },
});
