import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from '@/ui/kit/interaction';
import { Text } from '@/ui/kit/text';
import { themed } from '@/ui/theme';
export const NAME_SIZES = [33, 30, 27, 24, 21] as const;
export function nameSize(wide: number, room: number): number {
  if (wide === 0 || room === 0) return NAME_SIZES[0];
  return (
    NAME_SIZES.find((size) => (wide * size) / NAME_SIZES[0] <= room) ??
    NAME_SIZES[NAME_SIZES.length - 1]
  );
}
export function NameHeading({
  name,
  label,
  onPress,
  style,
}: {
  name: string;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();
  const [room, setRoom] = useState(0);
  const [wide, setWide] = useState(0);
  const size = nameSize(wide, room);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      {...props}
      style={({ pressed }) => [
        styles.heading,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      <View style={styles.name}>
        <Text
          role="filmName"
          numberOfLines={1}
          style={{ fontSize: size, letterSpacing: -0.04 * size }}
        >
          {name}
        </Text>
        <View style={styles.dash}>
          <View style={styles.dashLine} />
        </View>
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text role="filmName" onLayout={(event) => setWide(event.nativeEvent.layout.width)}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}
const DASH = 1.5;
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    heading: { paddingBottom: 10 - 6 - DASH },
    name: { alignSelf: 'flex-start', maxWidth: '100%' },
    dash: { height: DASH, marginTop: 6, overflow: 'hidden' },
    dashLine: {
      height: DASH * 3,
      marginHorizontal: -DASH,
      borderWidth: DASH,
      borderStyle: 'dashed',
      borderColor: color.lineStrong,
    },
    measure: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4096,
      alignItems: 'flex-start',
      opacity: 0,
      pointerEvents: 'none',
    },
  }),
);
