import { Minus, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { IconButton } from './button';
import { PRESS, TAP, hitSlop, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.3, detail 19 — how long the film should be. A card with the figure in the middle of it, a
 * button on each side that moves it by five seconds, the line it can be dragged along, and five
 * lengths worth having as ready answers.
 *
 * It knows nothing about time: every figure it draws — the value, the two ends, the presets — comes
 * in as a word already formatted, because «2:30» and «9:10 · всё, что есть» are the screen's to
 * write. What it holds is a number of seconds and the two walls it runs between.
 *
 * `step` of 5 is the same step the two buttons take and the same one a screen reader's increment
 * takes, so there is only ever one way this thing moves.
 */
export const STEP = 5;

export type LengthSliderProps = {
  /** Seconds. */
  value: number;
  onChange: (seconds: number) => void;
  min: number;
  /** Worked out from the material: `min(10:00, Σ video + 2.5s × photos)` — the screen does that sum. */
  max: number;
  /** «2:30» — the value, written out. */
  valueLabel: string;
  /** «из шаблона „Для родителей“», under the figure. */
  note?: string;
  /** «0:10» and «9:10 · всё, что есть», under the two ends of the line. */
  minLabel: string;
  maxLabel: string;
  /** What the whole control is called, and what each of the two buttons does. */
  label: string;
  shorterLabel: string;
  longerLabel: string;
  /** «0:30 · 1:00 · 1:30 · 3:00 · Всё» — a word and the seconds behind it. */
  presets?: readonly { label: string; value: number }[];
  style?: StyleProp<ViewStyle>;
};

/** Held to the step and to both walls, which is the one place any of those three is decided. */
function clamp(seconds: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(seconds / STEP) * STEP));
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
  /** How wide the line is, measured rather than assumed: it is whatever the card leaves it. */
  const width = useRef(0);
  /** Where the finger is holding it, and `null` when nothing is. */
  const [held, setHeld] = useState<number | null>(null);
  const shown = held ?? value;
  const span = Math.max(1, max - min);
  const at = Math.max(0, Math.min(1, (shown - min) / span));

  const take = (e: GestureResponderEvent) => {
    const to =
      width.current === 0 ? 0 : Math.max(0, Math.min(1, e.nativeEvent.locationX / width.current));
    // Spec 7.3: at the wall the handle simply stops — the figure never runs past what there is
    // material for.
    const seconds = clamp(min + to * span, min, max);
    setHeld(seconds);
    onChange(seconds);
  };

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: take,
    onPanResponderMove: take,
    onPanResponderRelease: (e) => {
      take(e);
      setHeld(null);
    },
    onPanResponderTerminate: () => setHeld(null),
  });

  const move = (by: number) => onChange(clamp(value + by, min, max));

  return (
    <View style={[styles.card, style]}>
      <View style={styles.figureRow}>
        <IconButton
          icon={Minus}
          label={shorterLabel}
          tone="raise"
          onPress={() => move(-STEP)}
          disabled={value <= min}
        />
        <View style={styles.figureWords}>
          <Text role="figureSm">{valueLabel}</Text>
          {note ? <Text role="meta">{note}</Text> : null}
        </View>
        <IconButton
          icon={Plus}
          label={longerLabel}
          tone="raise"
          onPress={() => move(STEP)}
          disabled={value >= max}
        />
      </View>

      <View style={styles.line}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          // The `aria-` spelling of `accessibilityValue`: React Native maps one onto the other, and
          // the text form is the point — «150 секунд» says nothing to anybody and «2:30» does.
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueLabel}
          accessibilityActions={STEPS}
          onAccessibilityAction={(e) =>
            move(e.nativeEvent.actionName === 'decrement' ? -STEP : STEP)
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
          <Text role="meta" tone="muted">
            {minLabel}
          </Text>
          <Text role="meta" tone="muted">
            {maxLabel}
          </Text>
        </View>
      </View>

      {presets ? (
        <View style={styles.presets}>
          {presets.map((preset) => {
            const on = clamp(preset.value, min, max) === value;
            return (
              <Preset
                key={preset.label}
                label={preset.label}
                selected={on}
                onPress={() => onChange(clamp(preset.value, min, max))}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** What a screen reader may do to a control it cannot drag. */
const STEPS = [{ name: 'increment' }, { name: 'decrement' }];

/** One of the five ready lengths: a 32 pill, quiet until it is the one the value stands on. */
function Preset({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
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
      accessibilityState={{ selected }}
      hitSlop={hitSlop(TAP, height.roundTiny)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.preset,
        selected ? styles.presetOn : hovered ? styles.presetHover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <Text role="label" style={[styles.presetWord, { color: selected ? color.ink : color.paper }]}>
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
    // The bar is 6 tall and the finger's share of it is 26, the width of the handle: spec 10.2 again,
    // and the whole row is dragged rather than the handle alone.
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
    ends: { flexDirection: 'row', justifyContent: 'space-between' },
    presets: { flexDirection: 'row', gap: 6 },
    preset: {
      flex: 1,
      height: height.roundTiny,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineQuiet,
    },
    presetOn: { backgroundColor: color.paper, borderColor: color.paper },
    presetHover: { backgroundColor: color.raise },
    presetWord: { fontVariant: ['tabular-nums'] },
  }),
);
