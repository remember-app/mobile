import type { ReactNode } from 'react';
import {
  type CellRendererProps,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { photo, radius, space } from '@/theme';
import { Divider } from './bits';
import { useFocusRing, useHoverFocus } from './interaction';
import { Avatar } from './member';
import { Text } from './text';
import { PickCircle } from './tile';
export function DayMark({
  label,
  count,
  avatar,
  organizer,
  picked,
  onPress,
  pressLabel,
  style,
}: {
  label: string;
  count?: string;
  avatar?: string;
  organizer?: boolean;
  picked?: boolean;
  onPress?: () => void;
  pressLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const focusRing = useFocusRing();
  const lone = !avatar && !count && !onPress;
  const inner = (
    <>
      {onPress ? <PickCircle kind={picked ? 'send' : 'off'} size={13} /> : null}
      {avatar ? <Avatar name={avatar} size={16} ring={organizer} /> : null}

      <Text role="day" tone={lone ? 'muted' : 'paper'} numberOfLines={1} style={styles.label}>
        {label}
      </Text>

      {count ? (
        <Text role="dayCount" tone="muted" style={styles.count}>
          {count}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessibilityRole="header" style={[styles.mark, style]}>
        {inner}
      </View>
    );
  }
  return (
    <View style={[styles.mark, style]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!picked }}
        accessibilityLabel={pressLabel ?? label}
        onPress={onPress}
        {...props}
        style={[styles.band, focused ? focusRing : null]}
      >
        {inner}
      </Pressable>
    </View>
  );
}
export function seamsOver<Row>(isSeam: (row: Row) => boolean) {
  return function SeamCell({
    item,
    style,
    children,
    cellKey,
    index,
    ...rest
  }: CellRendererProps<Row>) {
    return (
      <View {...rest} style={[style, isSeam(item) ? styles.over : null]}>
        {children}
      </View>
    );
  };
}
export function DayHead({
  label,
  count,
  eyebrow,
  children,
  style,
}: {
  label: string;
  count?: string;
  eyebrow?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.head, eyebrow ? styles.headList : null, style]}>
      <Text role={eyebrow ? 'eyebrow' : 'label'} accessibilityRole="header">
        {label}
      </Text>
      <Divider grow />

      {count ? <Text role="meta">{count}</Text> : null}
      {children}
    </View>
  );
}
export function DateSpine({
  marks,
  style,
}: {
  marks: readonly {
    label: string;
    top: number;
  }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.spine, style]}
    >
      <View style={styles.spineLine} />
      {marks.map((mark) => (
        <View key={`${mark.label}-${mark.top}`} style={[styles.spineMark, { top: mark.top }]}>
          <View style={styles.spineDot} />
          <View style={styles.spineDash} />
          <View style={styles.spinePill}>
            <Text role="day" style={styles.spineText}>
              {mark.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const SPINE_LEFT = 12;
const styles = StyleSheet.create({
  mark: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  band: {
    height: 44,
    marginVertical: -12,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  over: { zIndex: 1 },
  label: { flexShrink: 1 },
  count: { flexShrink: 0 },
  head: {
    minHeight: 56,
    paddingVertical: 17,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    gap: space.s3,
  },
  headList: { minHeight: 34, paddingVertical: 9 },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SPINE_LEFT,
    width: 1,
    backgroundColor: photo.spine,
  },
  spineMark: {
    position: 'absolute',
    left: SPINE_LEFT,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinePill: {
    height: 16,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: photo.plateQuiet,
  },
  spineText: { color: photo.spineMark, lineHeight: 16, letterSpacing: 0 },
  spineDash: { width: 8, height: 1, backgroundColor: photo.spineTick },
  spineDot: {
    width: 4,
    height: 4,
    marginLeft: -1.5,
    borderRadius: radius.pill,
    backgroundColor: photo.spineDot,
  },
});
