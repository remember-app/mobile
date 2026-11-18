import { Fragment, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { themed, useTheme } from '@/ui/theme';
import { Text } from './text';

export function Divider({
  grow,
  soft,
  hairline,
  style,
}: {
  grow?: boolean;
  soft?: boolean;
  hairline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.divider,
        hairline ? styles.dividerHairline : null,
        soft ? styles.dividerSoft : null,
        grow ? styles.dividerGrow : null,
        style,
      ]}
    />
  );
}

/** Строка «добавить» с отбивкой — верх всех списков, которые можно пополнить. */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.add}>
        <Text role="row" tone="accent">
          {label}
        </Text>
      </Pressable>
      <Divider hairline />
    </>
  );
}

export function Rows<T>({
  items,
  keyOf,
  hairline,
  children,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  hairline?: boolean;
  children: (item: T) => ReactNode;
}) {
  const { color } = useTheme();
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={keyOf(item)}>
          {index === 0 ? null : hairline ? (
            <View style={[styles.hairline, { backgroundColor: color.line }]} />
          ) : (
            <Divider />
          )}
          {children(item)}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hairline: { height: StyleSheet.hairlineWidth },
});

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    divider: { height: 1, backgroundColor: color.line },
    dividerHairline: { height: StyleSheet.hairlineWidth },
    dividerSoft: { backgroundColor: color.raise },
    dividerGrow: { flex: 1 },
    add: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  }),
);
