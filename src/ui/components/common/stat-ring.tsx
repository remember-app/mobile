import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CircularProgress } from '@/ui/kit/display/circular-progress';

export function StatRing({
  value,
  size,
  stroke,
  track,
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  track?: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.circle, { width: size, height: size }]}>
      <CircularProgress value={value} size={size} stroke={stroke} track={track} />
      <View style={styles.icon} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
