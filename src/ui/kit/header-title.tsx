import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

export const TITLE_MIN = 120;

export function HeaderTitle({
  title,
  icon,
  maxWidth,
  minWidth,
}: {
  title: string;
  icon?: ReactNode;
  maxWidth?: number;
  minWidth?: number;
}) {
  return (
    <View style={[styles.head, { minWidth: minWidth ?? TITLE_MIN, maxWidth: maxWidth ?? '100%' }]}>
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
    gap: space.s1,
    paddingHorizontal: space.s3,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
});
