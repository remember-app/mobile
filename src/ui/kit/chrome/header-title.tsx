import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

export const TITLE_MIN = 120;

export function HeaderTitle({
  title,
  icon,
  maxWidth,
  minWidth,
  surface,
}: {
  title: string;
  icon?: ReactNode;
  maxWidth?: number;
  minWidth?: number;
  surface?: boolean;
}) {
  const { color } = useTheme();
  return (
    <View
      style={[
        styles.head,
        surface
          ? [styles.surface, { backgroundColor: color.surface, borderColor: color.line }]
          : null,
        { minWidth: minWidth ?? TITLE_MIN, maxWidth: maxWidth ?? '100%' },
      ]}
    >
      {icon}
      <Text role="barTitle" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    height: 44,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
  },
  surface: {
    borderWidth: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
});
