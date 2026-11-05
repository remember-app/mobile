import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { font, height, radius, space, themed } from '@/ui/theme';
import { IconButton } from './button';
import { dayKey, ribbonOf, weeksOf } from './calendar-grid';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { TAP } from './tap';
import { fitCell, Text } from './text';

const DAY = 40;
export type CalendarProps = {
  month: Date;
  onMonth: (month: Date) => void;
  from: Date | null;
  to?: Date | null;
  onPick: (day: Date) => void;
  min?: Date;
  max?: Date;
  weekdays: readonly string[];
  monthLabel: string;
  prevLabel: string;
  nextLabel: string;
  dayLabel: (day: Date) => string;
  style?: StyleProp<ViewStyle>;
};
export function Calendar({
  month,
  onMonth,
  from,
  to,
  onPick,
  min,
  max,
  weekdays,
  monthLabel,
  prevLabel,
  nextLabel,
  dayLabel,
  style,
}: CalendarProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const [column, setColumn] = useState(0);
  const narrow = column > 0 && column < TAP;
  const figure = fitCell({
    fontScale,
    width: Math.min(column, DAY),
    role: 'bodySm',
    em: FIGURES_EM,
    rest: narrow ? TAP : DAY,
  });
  const circle = column > 0 && column < DAY ? { width: column, height: column } : null;
  const letters = fitCell({
    fontScale,
    width: column,
    role: 'badge',
    em: LETTERS_EM,
    rest: 0,
  }).most;
  const today = dayKey(new Date());
  const start = from ? dayKey(from) : null;
  const end = to ? dayKey(to) : null;
  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <IconButton
          icon={ChevronLeft}
          label={prevLabel}
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        />
        <Text role="section" accessibilityRole="header" style={styles.month}>
          {monthLabel}
        </Text>
        <IconButton
          icon={ChevronRight}
          label={nextLabel}
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        />
      </View>

      <View style={styles.week}>
        {weekdays.map((day) => (
          <Text
            key={day}
            role="badge"
            tone="muted"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            maxFontSizeMultiplier={letters}
            style={styles.weekday}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid} onLayout={(e) => setColumn(e.nativeEvent.layout.width / 7)}>
        {weeksOf(month).map((week, w) => {
          const ribbon = ribbonOf(week, start, end);
          return (
            <View key={w} style={styles.weekRow}>
              {ribbon ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.ribbon,
                    {
                      left: `${(ribbon.from / 7) * 100}%`,
                      right: `${((7 - ribbon.to) / 7) * 100}%`,
                    },
                    ribbon.from % 1 === 0 ? styles.ribbonStart : null,
                    ribbon.to % 1 === 0 ? styles.ribbonEnd : null,
                  ]}
                />
              ) : null}
              {week.map((day, i) => {
                if (!day)
                  return (
                    <View key={`blank-${i}`} style={[styles.cell, { height: figure.height }]} />
                  );
                const at = dayKey(day);
                return (
                  <Day
                    key={at}
                    day={day}
                    label={dayLabel(day)}
                    edge={at === start || at === end}
                    inside={start !== null && end !== null && at > start && at < end}
                    today={at === today}
                    disabled={!!((min && at < dayKey(min)) || (max && at > dayKey(max)))}
                    figure={figure}
                    circle={circle}
                    onPress={() => onPick(day)}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
const FIGURES_EM = 1.35;
const LETTERS_EM = 2.6;
function Day({
  day,
  label,
  edge,
  inside,
  today,
  disabled,
  figure,
  circle,
  onPress,
}: {
  day: Date;
  label: string;
  edge: boolean;
  inside: boolean;
  today: boolean;
  disabled: boolean;
  figure: ReturnType<typeof fitCell>;
  circle: {
    width: number;
    height: number;
  } | null;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: edge || inside }}
      disabled={disabled}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.cell,
        { height: figure.height },
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <View
        style={[
          styles.day,
          circle,
          today && !edge ? styles.today : null,
          edge ? styles.edge : null,
          hovered && !edge && !disabled ? styles.hover : null,
        ]}
      >
        <Text
          role="bodySm"
          tone={disabled ? 'dayOff' : edge ? 'onFill' : 'paper'}
          maxFontSizeMultiplier={figure.most}
          style={[styles.figure, edge ? styles.figureEdge : null]}
        >
          {day.getDate()}
        </Text>
      </View>
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      paddingTop: space.s1,
      paddingHorizontal: space.s3,
      paddingBottom: space.s3,
      gap: space.s1,
    },
    head: { minHeight: height.bar, flexDirection: 'row', alignItems: 'center' },
    month: { flex: 1, textAlign: 'center' },
    week: { minHeight: 22, flexDirection: 'row', alignItems: 'center' },
    weekday: { flex: 1, textAlign: 'center', fontFamily: font.semi },
    grid: { gap: 2 },
    weekRow: { flexDirection: 'row' },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    ribbon: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: color.accent,
      opacity: 0.26,
    },
    ribbonStart: { borderTopLeftRadius: DAY / 2, borderBottomLeftRadius: DAY / 2 },
    ribbonEnd: { borderTopRightRadius: DAY / 2, borderBottomRightRadius: DAY / 2 },
    day: {
      width: DAY,
      height: DAY,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    today: { borderWidth: 1, borderColor: color.lineStrong },
    edge: { backgroundColor: color.accent },
    hover: { backgroundColor: color.raise },
    figure: { fontFamily: font.medium, fontVariant: ['tabular-nums'] },
    figureEdge: { fontFamily: font.bold },
  }),
);
