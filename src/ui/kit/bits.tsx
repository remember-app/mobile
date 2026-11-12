import { Fragment, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { themed, useTheme } from '@/ui/theme';

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
    dividerSoft: { backgroundColor: color.raise },
    dividerGrow: { flex: 1 },
  }),
);
