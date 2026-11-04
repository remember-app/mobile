import { Pressable, StyleSheet, View } from 'react-native';
import { height, radius, space, themed, useTheme } from '@/theme';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export function DayTile({
  day,
  weekday,
  count,
  fill,
  label,
  selected,
  onPress,
}: {
  day: string;
  weekday: string;
  count: string;
  fill: number;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const figure = { color: selected ? color.ink : color.paper };
  const quiet = selected ? { color: color.ink, opacity: 0.62 } : { color: color.muted };
  const width = `${Math.round(Math.min(Math.max(fill, 0), 1) * 100)}%` as const;
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.tile,
        selected ? styles.chosen : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <View style={styles.top}>
        <Text role="figureDay" style={figure}>
          {day}
        </Text>
        <Text role="metaTile" style={quiet}>
          {weekday}
        </Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.bar}>
          <View style={[StyleSheet.absoluteFill, selected ? styles.trackChosen : styles.track]} />
          <View
            style={[styles.fill, { width, backgroundColor: selected ? color.ink : color.faint }]}
          />
        </View>
        <Text role="metaTile" style={quiet}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    tile: {
      flexGrow: 1,
      minHeight: height.dayTile,
      paddingVertical: 10,
      paddingHorizontal: 11,
      justifyContent: 'space-between',
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.ink,
    },
    chosen: { backgroundColor: color.paper, borderColor: color.paper },
    top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 },
    bottom: { gap: 5 },
    bar: { height: space.s1, borderRadius: radius.pill, overflow: 'hidden' },
    track: { backgroundColor: color.raise },
    trackChosen: { backgroundColor: color.ink, opacity: 0.16 },
    fill: { height: '100%', borderRadius: radius.pill },
  }),
);
