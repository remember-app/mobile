import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Skeleton } from '@/ui/kit/skeleton';
import { radius, space, themed } from '@/ui/theme';

export function ProjectCardSkeleton() {
  const { width } = useWindowDimensions();
  const cardWidth = width - space.s4 * 2;
  return <Skeleton width={cardWidth} height={Math.round(cardWidth * 0.75)} round={radius.card} />;
}

export function GallerySkeleton({ top, bottom }: { top: number; bottom: number }) {
  const { width } = useWindowDimensions();
  const styles = useStyles();
  const cell = Math.floor(width / 3);
  return (
    <View style={[styles.grid, { paddingTop: top, paddingBottom: bottom }]}>
      {Array.from({ length: 18 }, (_, index) => (
        <View key={index} style={{ width: cell, height: cell, padding: 1 }}>
          <Skeleton width="100%" height={cell - 2} round={radius.tile} />
        </View>
      ))}
    </View>
  );
}

export function MemberRowsSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.member}>
          <Skeleton width={44} height={44} round={22} />
          <View style={styles.words}>
            <Skeleton width="45%" height={13} round={6} />
            <Skeleton width="30%" height={11} round={6} />
          </View>
          <Skeleton width={22} height={22} round={11} />
        </View>
      ))}
    </View>
  );
}

export function LabelRowsSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.labelRow}>
          <Skeleton width={30} height={30} round={8} />
          <Skeleton width="42%" height={14} round={6} />
          <View style={styles.grow} />
          <Skeleton width={22} height={12} round={6} />
        </View>
      ))}
    </View>
  );
}

export function StatsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.stats}>
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.stat}>
          <Skeleton width={68} height={68} round={34} />
          <Skeleton width={42} height={12} round={6} />
        </View>
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s4,
    },
    member: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    words: {
      flex: 1,
      gap: space.s1,
    },
    labelRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    grow: {
      flex: 1,
    },
    stats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      paddingVertical: space.s4,
    },
    stat: {
      alignItems: 'center',
      gap: space.s2,
    },
  }),
);
