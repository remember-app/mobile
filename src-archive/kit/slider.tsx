import { Minus, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  PanResponder,
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { height, radius, space, themed, useTheme } from '@/theme';
import { IconButton } from './button';
import { drawnAs } from './icon';
import { hitSlop, PRESS, TAP, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { fitCell, Text } from './text';

const NUDGE = 5;
const NUDGE_GLYPH = { size: 18, stroke: 2.2 } as const;
const LESS = drawnAs(Minus, 12 / 14);
const MORE = drawnAs(Plus, 12 / 14);
export type LengthSliderProps = {
  value: number;
  onChange: (seconds: number) => void;
  min: number;
  max: number;
  valueLabel: string;
  note?: string;
  minLabel: string;
  maxLabel: string;
  label: string;
  shorterLabel: string;
  longerLabel: string;
  presets?: readonly {
    label: string;
    value: number;
  }[];
  style?: StyleProp<ViewStyle>;
};
function clamp(seconds: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(seconds)));
}
function place(seconds: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (seconds - min) / Math.max(1, max - min)));
}
export function grabLength(
  x: number,
  width: number,
  {
    value,
    min,
    max,
  }: {
    value: number;
    min: number;
    max: number;
  },
): (to: number) => number | null {
  const under = (at: number) => min + (width === 0 ? 0 : at / width) * Math.max(1, max - min);
  const from = Math.abs(x - place(value, min, max) * width) <= TAP / 2 ? under(x) - value : 0;
  let last = value;
  return (to) => {
    const next = clamp(under(to) - from, min, max);
    if (next === last) return null;
    last = next;
    return next;
  };
}
export function LengthSlider({
  value,
  onChange,
  min,
  max,
  valueLabel,
  note,
  minLabel,
  maxLabel,
  label,
  shorterLabel,
  longerLabel,
  presets,
  style,
}: LengthSliderProps) {
  const styles = useStyles();
  const focusRing = useFocusRing();
  const { focused, props } = useHoverFocus();
  const width = useRef(0);
  const hold = useRef<(x: number) => number | null>(() => null);
  const [held, setHeld] = useState<number | null>(null);
  const at = place(held ?? value, min, max);
  const { fontScale } = useWindowDimensions();
  const [row, setRow] = useState(0);
  const count = presets?.length ?? 0;
  const pill = fitCell({
    fontScale,
    width: count > 0 && row > 0 ? (row - PRESET_GAP * (count - 1)) / count : 0,
    role: 'label',
    em: PRESET_EM,
    rest: height.roundTiny,
  });
  const follow = (e: GestureResponderEvent) => {
    const seconds = hold.current(e.nativeEvent.locationX);
    if (seconds === null) return;
    setHeld(seconds);
    onChange(seconds);
  };
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      hold.current = grabLength(e.nativeEvent.locationX, width.current, { value, min, max });
      follow(e);
    },
    onPanResponderMove: follow,
    onPanResponderRelease: (e) => {
      follow(e);
      setHeld(null);
    },
    onPanResponderTerminate: () => setHeld(null),
  });
  const move = (by: number) => onChange(clamp(value + by, min, max));
  return (
    <View style={[styles.card, style]}>
      <View style={styles.figureRow}>
        <IconButton
          icon={LESS}
          label={shorterLabel}
          tone="raise"
          glyph={NUDGE_GLYPH}
          onPress={() => move(-NUDGE)}
          disabled={value <= min}
        />
        <View style={styles.figureWords}>
          <Text role="figureSm">{valueLabel}</Text>
          {note ? <Text role="meta">{note}</Text> : null}
        </View>
        <IconButton
          icon={MORE}
          label={longerLabel}
          tone="raise"
          glyph={NUDGE_GLYPH}
          onPress={() => move(NUDGE)}
          disabled={value >= max}
        />
      </View>

      <View style={styles.line}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueLabel}
          accessibilityActions={STEPS}
          onAccessibilityAction={(e) =>
            move(e.nativeEvent.actionName === 'decrement' ? -NUDGE : NUDGE)
          }
          {...props}
          style={[styles.pad, focused ? focusRing : null]}
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          <View style={styles.track} pointerEvents="none">
            <View style={[styles.fill, { width: `${at * 100}%` }]} />
            <View style={[styles.handle, { left: `${at * 100}%` }]} />
          </View>
        </View>

        <View style={styles.ends}>
          <Text role="metaSm">{minLabel}</Text>
          <Text role="metaSm" style={styles.endRight}>
            {maxLabel}
          </Text>
        </View>
      </View>

      {presets ? (
        <View style={styles.presets} onLayout={(e) => setRow(e.nativeEvent.layout.width)}>
          {presets.map((preset) => {
            const over = preset.value > max;
            return (
              <Preset
                key={preset.label}
                label={preset.label}
                selected={!over && clamp(preset.value, min, max) === value}
                disabled={over}
                fit={pill}
                onPress={() => onChange(clamp(preset.value, min, max))}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
const STEPS = [{ name: 'increment' }, { name: 'decrement' }];
const PRESET_GAP = 6;
const PRESET_EM = 2.35;
function Preset({
  label,
  selected,
  disabled,
  fit,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  fit: ReturnType<typeof fitCell>;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop(TAP, fit.height)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.preset,
        { height: fit.height },
        disabled
          ? styles.presetOff
          : selected
            ? styles.presetOn
            : hovered
              ? styles.presetHover
              : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <Text
        role="label"
        maxFontSizeMultiplier={fit.most}
        style={[
          styles.presetWord,
          { color: disabled ? color.faint : selected ? color.ink : color.paper },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.section,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      paddingTop: space.s4 - 2,
      paddingHorizontal: space.s4,
      paddingBottom: space.s4,
      gap: space.s3,
    },
    figureRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    figureWords: { flex: 1, alignItems: 'center', gap: 1 },
    line: { gap: 6 },
    pad: { height: 26, justifyContent: 'center' },
    track: { height: 6, borderRadius: radius.pill, backgroundColor: color.line },
    fill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },
    handle: {
      position: 'absolute',
      width: 26,
      height: 26,
      top: -10,
      marginLeft: -13,
      borderRadius: radius.pill,
      backgroundColor: color.onFill,
      boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
    },
    ends: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s3 },
    endRight: { marginLeft: 'auto', textAlign: 'right' },
    presets: { flexDirection: 'row', gap: PRESET_GAP },
    preset: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineQuiet,
    },
    presetOn: { backgroundColor: color.paper, borderColor: color.paper },
    presetOff: { borderColor: color.line },
    presetHover: { backgroundColor: color.raise },
    presetWord: { fontVariant: ['tabular-nums'] },
  }),
);
