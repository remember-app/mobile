import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import type { Memory } from '@/api';
import { Banner, Button, GlassBar, IconButton, Text } from '@/kit';
import type { Failure } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { height, space } from '@/theme';
export type Head = {
  memory: Memory | null;
  error: Failure | null;
  reload: () => void;
};
export function MemoryHead({
  title,
  meta,
  capsuleLabel,
  onCapsule,
  middle,
  left,
  right,
  children,
}: {
  title: string;
  meta?: string;
  capsuleLabel: string;
  onCapsule?: () => void;
  middle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const s = useStrings();
  return (
    <View style={styles.head} pointerEvents="box-none">
      <GlassBar
        title={title}
        meta={meta}
        capsuleLabel={capsuleLabel}
        onCapsule={onCapsule}
        middle={middle}
        left={
          left ?? (
            <IconButton
              icon={ChevronLeft}
              tone="glass"
              size={height.roundViewer}
              label={s.action.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          )
        }
        right={right}
      />
      {children}
    </View>
  );
}
export function HeadTrouble({
  error,
  reload,
  onLayout,
}: Omit<Head, 'memory' | 'error'> & {
  error: Failure;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const s = useStrings();
  return (
    <View style={styles.banner} onLayout={onLayout}>
      <Banner tone="error" failure={error}>
        <Button size="xs" variant="quiet" label={s.action.retry} onPress={reload} />
      </Banner>
    </View>
  );
}
export function BlockHead({
  title,
  count,
  style,
}: {
  title: string;
  count?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.block, style]}>
      <Text role="section" accessibilityRole="header">
        {title}
      </Text>
      {count ? <Text role="meta">{count}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  head: { position: 'absolute', left: 0, right: 0, top: 0 },
  banner: { marginHorizontal: space.s3, marginTop: space.s2 },
  block: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s2,
    paddingHorizontal: space.s4,
  },
});
