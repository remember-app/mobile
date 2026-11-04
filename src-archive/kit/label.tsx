import { Check, Lock, Plus, Tag as TagIcon, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { night, radius, space, themed, useTheme } from '@/theme';
import { Divider } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export type LabelScope = 'shared' | 'own';
export function LabelMark({ tint, size = 30 }: { tint: string; size?: 30 | 64 | 18 }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size === 18 ? 6 : size === 64 ? 14 : 9 },
        { backgroundColor: tint },
      ]}
    >
      <Icon icon={TagIcon} size={size === 64 ? 30 : size === 18 ? 10 : 15} color={night.ink} />
    </View>
  );
}
export function RowLabel({
  name,
  count,
  scope,
  scopeLabel,
  inside,
  onPress,
  actions,
  divider,
  tint,
}: {
  name: string;
  count?: string;
  scope: LabelScope;
  scopeLabel: string;
  inside?: boolean;
  onPress?: () => void;
  actions?: ReactNode;
  divider?: boolean;
  tint: string;
}): ReactNode {
  const { color } = useTheme();
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const shared = scope === 'shared';
  const inner = (
    <>
      <LabelMark tint={tint} />
      <View style={styles.words}>
        <Text role="row" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          {count ? <Text role="meta">{count} ·</Text> : null}
          <Icon icon={shared ? Users : Lock} size={12} color={color.muted} />
          <Text role="meta">{scopeLabel}</Text>
        </View>
      </View>
      {actions ??
        (onPress ? (
          <View style={[styles.circle, inside ? styles.circleIn : null]}>
            <Icon
              icon={inside ? Check : Plus}
              size={inside ? 14 : 15}
              color={inside ? color.onFill : color.paper}
            />
          </View>
        ) : null)}
    </>
  );
  return (
    <View>
      {divider ? <Divider soft style={styles.inset} /> : null}
      {actions || !onPress ? (
        <View style={styles.row}>{inner}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !!inside }}
          accessibilityLabel={[name, count, scopeLabel].filter(Boolean).join(', ')}
          onPress={onPress}
          {...props}
          style={({ pressed }) => [
            styles.row,
            hovered ? styles.hover : null,
            pressed && !reduced ? PRESS : null,
            focused ? focusRing : null,
          ]}
        >
          {inner}
        </Pressable>
      )}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    mark: { alignItems: 'center', justifyContent: 'center' },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
    },
    hover: { backgroundColor: color.raise },
    inset: { marginLeft: 56 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
    circle: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleIn: { backgroundColor: color.accent, borderColor: color.accent },
  }),
);
